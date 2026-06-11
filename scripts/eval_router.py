#!/usr/bin/env python3
"""Deterministic Macro-F1 gate for the Agent Router intent classifier.

This evaluates the REAL classifier, not a drifting copy: it reads the system
prompt + model + temperature straight out of
``templates/system/workflows/n8n/agent-router.json`` (the "Classify Intent"
chainLlm node and the "Classifier Model" node), mirrors the "Sanitize Input"
node's normalisation, calls OpenRouter exactly as the live router does, and
parses the reply with the SAME logic as the router's "Build Dispatch" Code node
(robust JSON extract -> allowlist clamp -> 'unknown' on any failure).

Modes:
  eval_router.py --check   Offline. Validate the battery (count / per-class /
                           allowlist / YAML) and assert the classifier prompt
                           still carries its JSON-output instruction. No API key
                           or network needed. Gates pull requests.
  eval_router.py           Online. Run every battery case through OpenRouter,
                           compute Macro-F1, write report.json, print the score.
                           exit 1 if Macro-F1 < threshold. Needs OPENROUTER_API_KEY.

Macro-F1 threshold is 0.85 and is NOT lowerable here by design (a prior decision
locks 0.85 as the floor; raising it is fine, lowering needs a new ADR).
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import unicodedata
from concurrent.futures import ThreadPoolExecutor, as_completed

import yaml

INTENTS = ["ops", "code", "research", "infra", "unknown"]
THRESHOLD = 0.85          # Safety Rule #4 — never lower. Raising requires a new ADR.
PER_CLASS = 50
TOTAL = PER_CLASS * len(INTENTS)   # 250
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_ROUTER = os.path.join(
    _REPO_ROOT, "templates", "system", "workflows", "n8n", "agent-router.json"
)
DEFAULT_BATTERY = os.path.join(_REPO_ROOT, "tests", "router_battery.yaml")
DEFAULT_REPORT = os.path.join(_REPO_ROOT, "report.json")

# Mirror the router "Sanitize Input" node: strip ASCII control chars but KEEP
# TAB (0x09), LF (0x0A), CR (0x0D); also strip DEL (0x7F). Built from code points
# (no raw control bytes / \u escapes in this source) to match the node's
# /[ --]/ exactly.
_CONTROL_CHARS = "".join(
    chr(c) for c in (*range(0x00, 0x09), 0x0B, 0x0C, *range(0x0E, 0x20), 0x7F)
)
_CONTROL_RE = re.compile("[" + re.escape(_CONTROL_CHARS) + "]")
_WS_RE = re.compile(r"\s+")
# Mirror "Build Dispatch": grab the first {...} span (greedy, dot-all).
_JSON_RE = re.compile(r"\{[\s\S]*\}")


def sanitize(raw: str) -> str:
    """Replicate the router's Sanitize Input node so the eval sees the same text."""
    s = _CONTROL_RE.sub("", str(raw))
    s = unicodedata.normalize("NFC", s)
    s = _WS_RE.sub(" ", s).strip()
    return s[:2000]


def load_classifier(router_path: str):
    """Return (system_prompt, model, temperature) read from the live router JSON."""
    with open(router_path, encoding="utf-8") as fh:
        wf = json.load(fh)
    nodes = {n.get("name"): n for n in wf.get("nodes", [])}
    classify = nodes.get("Classify Intent")
    model_node = nodes.get("Classifier Model")
    if classify is None or model_node is None:
        raise ValueError("agent-router.json missing 'Classify Intent' or 'Classifier Model' node")
    prompt = classify["parameters"]["messages"]["messageValues"][0]["message"]
    model = model_node["parameters"]["model"]
    temperature = model_node["parameters"].get("options", {}).get("temperature", 0)
    if not isinstance(prompt, str) or not prompt.strip():
        raise ValueError("classifier system prompt is empty")
    return prompt, model, temperature


def parse_intent(raw_text: str):
    """Mirror the router 'Build Dispatch' node: any failure -> ('unknown', 0.0)."""
    intent = "unknown"
    confidence = 0.0
    try:
        match = _JSON_RE.search(raw_text or "")
        if match:
            parsed = json.loads(match.group(0))
            if isinstance(parsed, dict):
                if isinstance(parsed.get("intent"), str):
                    intent = parsed["intent"].lower().strip()
                try:
                    conf = float(parsed.get("confidence"))
                    if 0.0 <= conf <= 1.0:
                        confidence = conf
                except (TypeError, ValueError):
                    pass
    except (ValueError, TypeError):
        intent, confidence = "unknown", 0.0
    if intent not in INTENTS:          # allowlist clamp, same as the node
        intent = "unknown"
    return intent, confidence


def call_openrouter(prompt, model, temperature, text, api_key, *, timeout=60, retries=4):
    """One classifier call. Retries only transient (429/5xx) failures."""
    import requests  # lazy: --check needs no network deps

    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    # No max_tokens — gpt-5-nano is a reasoning model and a cap starves the reply
    # to empty (the exact bug Stage 51a fixed). Mirrors the Classifier Model node.
    body = {
        "model": model,
        "temperature": temperature,
        "messages": [
            {"role": "system", "content": prompt},
            {"role": "user", "content": text},
        ],
    }
    last_err = "no attempt"
    for attempt in range(retries):
        try:
            resp = requests.post(OPENROUTER_URL, headers=headers, json=body, timeout=timeout)
            if resp.status_code == 200:
                data = resp.json()
                return data["choices"][0]["message"].get("content") or ""
            if resp.status_code in (429, 500, 502, 503, 504):
                last_err = f"HTTP {resp.status_code}"
                time.sleep(2 ** attempt)
                continue
            return f"__ERROR__ HTTP {resp.status_code}: {resp.text[:200]}"
        except Exception as exc:  # noqa: BLE001 — network errors are retried
            last_err = str(exc)
            time.sleep(2 ** attempt)
    return f"__ERROR__ {last_err}"


def load_battery(path: str):
    with open(path, encoding="utf-8") as fh:
        data = yaml.safe_load(fh)
    if not isinstance(data, list):
        raise ValueError("battery must be a YAML list of {text, expected_intent}")
    return data


def validate_battery(cases):
    problems = []
    if len(cases) != TOTAL:
        problems.append(f"expected {TOTAL} cases, got {len(cases)}")
    counts = {i: 0 for i in INTENTS}
    for idx, case in enumerate(cases):
        if not isinstance(case, dict) or "text" not in case or "expected_intent" not in case:
            problems.append(f"case {idx}: must be a mapping with 'text' and 'expected_intent'")
            continue
        if not isinstance(case["text"], str) or not case["text"].strip():
            problems.append(f"case {idx}: 'text' must be a non-empty string")
        exp = case["expected_intent"]
        if exp not in INTENTS:
            problems.append(f"case {idx}: expected_intent '{exp}' not in {INTENTS}")
        else:
            counts[exp] += 1
    for intent in INTENTS:
        if counts[intent] != PER_CLASS:
            problems.append(f"class '{intent}': expected {PER_CLASS} cases, got {counts[intent]}")
    return problems


def validate_prompt(prompt: str):
    """The classifier MUST instruct single-line JSON output carrying the FULL contract:
    the single-pick fields {intent, confidence} AND the additive conditional-fan-out
    fields {intents, multi}.

    Stripping any of these instructions is the canonical regression this gate must
    catch at PR time (DoD red-case), so absence is a hard failure. Note: the literal
    token '"intent"' is the standalone primary field and does NOT match inside
    '"intents"', so both are checked independently.
    """
    problems = []
    for token in ('"intent"', '"confidence"', '"intents"', '"multi"'):
        if token not in prompt:
            problems.append(f"classifier prompt missing {token} — JSON-output instruction removed?")
    if "json" not in prompt.lower():
        problems.append("classifier prompt no longer mentions JSON output")
    return problems


def run_check(args) -> int:
    try:
        prompt, model, temperature = load_classifier(args.router)
    except (OSError, ValueError, KeyError, json.JSONDecodeError) as exc:
        print(f"FAIL: cannot read classifier from {args.router}: {exc}", file=sys.stderr)
        return 1
    problems = validate_prompt(prompt)
    try:
        cases = load_battery(args.battery)
        problems += validate_battery(cases)
    except (OSError, ValueError, yaml.YAMLError) as exc:
        print(f"FAIL: cannot load battery {args.battery}: {exc}", file=sys.stderr)
        return 1
    if problems:
        print("FAIL: --check found problems:", file=sys.stderr)
        for p in problems:
            print(f"  - {p}", file=sys.stderr)
        return 1
    print(
        f"PASS: battery {len(cases)} cases ({PER_CLASS}/class x {len(INTENTS)}); "
        f"classifier model={model} temperature={temperature}; JSON-output instruction present."
    )
    return 0


def run_eval(args) -> int:
    api_key = os.environ.get("OPENROUTER_API_KEY", "").strip()
    if not api_key:
        print("FAIL: OPENROUTER_API_KEY not set — cannot run live eval (use --check offline).", file=sys.stderr)
        return 2
    prompt, model, temperature = load_classifier(args.router)
    cases = load_battery(args.battery)
    problems = validate_battery(cases)
    if problems:
        print("FAIL: battery invalid:", file=sys.stderr)
        for p in problems:
            print(f"  - {p}", file=sys.stderr)
        return 1

    def classify_one(case):
        raw = call_openrouter(prompt, model, temperature, sanitize(case["text"]), api_key)
        pred, conf = parse_intent(raw)
        return {
            "text": case["text"],
            "expected": case["expected_intent"],
            "predicted": pred,
            "confidence": conf,
            "raw": (raw or "")[:500],
        }

    results = [None] * len(cases)
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(classify_one, c): i for i, c in enumerate(cases)}
        for fut in as_completed(futures):
            results[futures[fut]] = fut.result()

    from sklearn.metrics import (
        confusion_matrix,
        f1_score,
        precision_recall_fscore_support,
    )

    y_true = [r["expected"] for r in results]
    y_pred = [r["predicted"] for r in results]
    macro_f1 = float(f1_score(y_true, y_pred, labels=INTENTS, average="macro", zero_division=0))
    prec, rec, f1s, sup = precision_recall_fscore_support(
        y_true, y_pred, labels=INTENTS, zero_division=0
    )
    cm = confusion_matrix(y_true, y_pred, labels=INTENTS)
    per_class = {
        INTENTS[i]: {
            "precision": round(float(prec[i]), 4),
            "recall": round(float(rec[i]), 4),
            "f1": round(float(f1s[i]), 4),
            "support": int(sup[i]),
        }
        for i in range(len(INTENTS))
    }
    misclassified = [r for r in results if r["expected"] != r["predicted"]]
    report = {
        "macro_f1": round(macro_f1, 4),
        "threshold": THRESHOLD,
        "passed": bool(macro_f1 >= THRESHOLD),
        "model": model,
        "temperature": temperature,
        "total": len(results),
        "labels": INTENTS,
        "per_class": per_class,
        "confusion_matrix": cm.tolist(),
        "misclassified": misclassified,
    }
    with open(args.report, "w", encoding="utf-8") as fh:
        json.dump(report, fh, ensure_ascii=False, indent=2)

    print(f"Macro-F1: {macro_f1:.3f} (threshold {THRESHOLD})")
    print("Per-class:")
    for intent in INTENTS:
        pc = per_class[intent]
        print(f"  {intent:9s} P={pc['precision']:.3f} R={pc['recall']:.3f} "
              f"F1={pc['f1']:.3f} (n={pc['support']})")
    print(f"Misclassified: {len(misclassified)}/{len(results)}  (report: {args.report})")
    return 0 if macro_f1 >= THRESHOLD else 1


def main() -> int:
    ap = argparse.ArgumentParser(description="Macro-F1 gate for the Agent Router classifier.")
    ap.add_argument("--check", action="store_true",
                    help="Offline validation of the battery + prompt structure (no API key).")
    ap.add_argument("--router", default=DEFAULT_ROUTER, help="Path to agent-router.json.")
    ap.add_argument("--battery", default=DEFAULT_BATTERY, help="Path to router_battery.yaml.")
    ap.add_argument("--report", default=DEFAULT_REPORT, help="Where to write report.json.")
    ap.add_argument("--workers", type=int, default=8, help="Concurrent OpenRouter calls.")
    args = ap.parse_args()
    return run_check(args) if args.check else run_eval(args)


if __name__ == "__main__":
    sys.exit(main())
