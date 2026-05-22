#!/usr/bin/env bash
# Scans repository for known secret patterns. Fails if any found.
set -euo pipefail

FAIL=0

scan() {
  local pattern="$1"
  local desc="$2"
  local results
  results=$(grep -rn --include="*.yml" --include="*.yaml" --include="*.json" \
    --include="*.sh" --include="*.md" --include="*.txt" --include="*.env" \
    -E "$pattern" . \
    --exclude-dir=.git \
    --exclude-dir=node_modules \
    --exclude="scan-for-secrets.sh" \
    2>/dev/null || true)
  if [ -n "$results" ]; then
    echo "FAIL: $desc pattern found:"
    echo "$results" | head -5
    FAIL=1
  fi
}

scan 'ghp_[A-Za-z0-9]{36,}' "GitHub ghp_ token"
scan 'github_pat_[A-Za-z0-9_]{82,}' "GitHub PAT"
scan 'ya29\.[A-Za-z0-9._-]{100,}' "GCP OAuth token"
scan '"private_key":\s*"-----BEGIN' "GCP service account key"
scan '-----BEGIN (RSA |EC )?PRIVATE KEY' "PEM private key"
scan 'BILLING_ACCOUNT\s*=\s*[0-9A-Z]{6}-[0-9A-Z]{6}-[0-9A-Z]{6}' "Billing account literal"

# Check for .env files
if find . -name ".env" -not -path "./.git/*" -not -path "./node_modules/*" 2>/dev/null | grep -q .; then
  echo "FAIL: .env file found in repository"
  FAIL=1
fi

[ $FAIL -eq 0 ] && echo "PASS: No secret patterns found." && exit 0 || exit 1
