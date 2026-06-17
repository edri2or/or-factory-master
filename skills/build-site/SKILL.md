# Skill: build-site

Prepare a **static site** — a self-contained folder of static files (HTML/CSS/JS/assets) —
and stage it in a source repo so the `publish-site` skill can put it online at
`<slug>.or-infra.com`. This is the "build" half of "idea → designed site → live URL"; the
"publish" half is the `publish-site` skill + the `publish-static-site.yml` workflow.

## The contract publish expects

`publish-static-site.yml` publishes a directory **as-is** via Cloudflare Pages Direct Upload:

- The site is a folder of **static files** with an **`index.html` at its root**. No build
  step runs server-side — whatever is in the folder is what goes live (so commit the built
  output, not un-built sources needing a bundler).
- It lives in a repo the **broker App can read** (any `edri2or/*` repo — org-wide install),
  at a path you pass as `source_dir` (default convention: `site/`).
- Cloudflare Free limits to respect: ≤ 20,000 files, ≤ 25 MiB per file.

## Steps

1. **Compose the site** (the creative/design work — done by you, an LLM, or a design tool).
   Keep it a single self-contained static folder; inline or vendor assets; relative links.
   RTL/Hebrew is fine (the proven fixture `or-edri-4/site` is a full RTL landing page).
2. **Stage it in a source repo** at `<source_dir>/` (e.g. commit it to an `edri2or/*` repo).
   - For a one-off, reuse an existing repo (e.g. the demo already at `edri2or/or-edri-4`@`main`:`site`).
   - For a dedicated home for many sites, a future `edri2or/or-sites` mono-repo (convention
     `sites/<slug>/`) can become the default source with **zero workflow change** — it's the
     documented next step, deliberately deferred (the workflow already accepts any `source_repo`).
3. **Sanity-check locally** before publishing: the folder has `index.html`, links are relative,
   no secrets are committed.
4. **Hand off to `publish-site`** with the chosen `slug` + `source_repo`/`source_ref`/`source_dir`.

## What it does NOT do

- It does not deploy anything — publishing is `publish-site` (the `publish-static-site.yml`
  workflow). build-site only gets the bytes into a repo in the shape publish expects.
- It is not a server-side build/bundle step; the published folder is served verbatim.

## Handoff

Once the static folder is in a source repo, invoke `publish-site` to take it live.
