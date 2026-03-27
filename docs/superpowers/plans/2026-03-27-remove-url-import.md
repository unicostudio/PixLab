# Remove URL Import Cleanup Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the URL Import feature slice from the repository so Website Import is the only remaining web import workflow.

**Architecture:** This is a focused deletion and navigation cleanup. Remove the URL Import HTML page, its page bootstrap, its fetch helper, and its obsolete planning/spec documents; keep shared pattern helpers untouched because they are still used elsewhere. Verification relies on repo-wide reference searches, navigation checks, and a Website Import smoke check using the local dev server that supports `/proxy/html` and `/proxy/image`.

**Tech Stack:** Static HTML, vanilla JavaScript, `rg`, `git`, `node`, local dev server (`dev-server.js`).

**Spec:** `docs/superpowers/specs/2026-03-27-remove-url-import-design.md`

**Execution Notes:** Use `@superpowers:verification-before-completion` before claiming the cleanup is done. If any new automated check is added beyond the commands below, use `@superpowers:test-driven-development` for that addition.

---

## Task 1: Remove URL Import From Navigation

**Files:**
- Modify: `index.html`
- Modify: `voxelblastjam.html`
- Modify: `pattern-import.html`
- Modify: `image-extractor.html`
- Modify: `website-import.html`

- [ ] **Step 1: Capture the current nav references as a baseline**

Run:

```bash
rg -n 'href="url-import.html"' index.html voxelblastjam.html pattern-import.html image-extractor.html website-import.html
```

Expected: 5 matches, one in each file.

- [ ] **Step 2: Remove the `URL Import` nav link from all five entry pages**

Use `apply_patch` and delete only the `url-import.html` link line in each file.

Target nav shape after the edit:

```html
<a class="page-link" href="index.html">WiggleTangle</a>
<a class="page-link" href="voxelblastjam.html">VoxelBlastJam</a>
<a class="page-link" href="pattern-import.html">Pattern Import</a>
<a class="page-link" href="image-extractor.html">Image Extractor</a>
<a class="page-link" href="website-import.html">Website Import</a>
```

Keep the existing `is-active` class placement correct for each individual page.

- [ ] **Step 3: Re-run the nav search to verify the link is gone**

Run:

```bash
rg -n 'href="url-import.html"' index.html voxelblastjam.html pattern-import.html image-extractor.html website-import.html
```

Expected: no matches, command exits with status `1`.

- [ ] **Step 4: Inspect only the edited nav blocks before committing**

Run:

```bash
sed -n '12,24p' index.html
sed -n '12,24p' voxelblastjam.html
sed -n '12,24p' pattern-import.html
sed -n '12,24p' image-extractor.html
sed -n '12,24p' website-import.html
```

Expected: all five nav blocks still include `Website Import` and none include `URL Import`.

- [ ] **Step 5: Commit the navigation cleanup**

```bash
git add index.html voxelblastjam.html pattern-import.html image-extractor.html website-import.html
git commit -m "chore: remove URL import from navigation"
```

---

## Task 2: Delete URL Import Runtime Files

**Files:**
- Delete: `url-import.html`
- Delete: `js/appUrlImport.js`
- Delete: `js/urlFetcher.js`

- [ ] **Step 1: Verify these files are still the URL Import runtime slice**

Run:

```bash
rg -n 'appUrlImport|UrlFetcher|urlFetcher|url-import.html' js index.html voxelblastjam.html pattern-import.html image-extractor.html website-import.html url-import.html
```

Expected:
- `url-import.html` references itself and its scripts
- `js/appUrlImport.js` and `js/urlFetcher.js` appear only in the URL Import feature slice
- no active page other than the soon-to-be-deleted URL Import page depends on those runtime files

- [ ] **Step 2: Delete the three URL Import runtime files**

Run:

```bash
git rm url-import.html js/appUrlImport.js js/urlFetcher.js
```

- [ ] **Step 3: Re-check active runtime paths for stale URL Import references**

Run:

```bash
rg -n 'href="url-import.html"|appUrlImport|UrlFetcher|urlFetcher' index.html voxelblastjam.html pattern-import.html image-extractor.html website-import.html js
```

Expected: no matches, command exits with status `1`.

- [ ] **Step 4: Inspect the staged deletion set**

Run:

```bash
git status --short
```

Expected: the staged deletions for `url-import.html`, `js/appUrlImport.js`, and `js/urlFetcher.js` are present, and no unrelated paths appear.

- [ ] **Step 5: Commit the runtime file removal**

```bash
git commit -m "chore: delete URL import runtime files"
```

---

## Task 3: Remove URL Import Planning And Spec Artifacts

**Files:**
- Delete: `docs/superpowers/specs/2026-03-27-urlimport-design.md`
- Delete: `docs/superpowers/plans/2026-03-27-url-import.md`

- [ ] **Step 1: Confirm the exact old design artifacts still exist**

Run:

```bash
ls docs/superpowers/specs/2026-03-27-urlimport-design.md docs/superpowers/plans/2026-03-27-url-import.md
```

Expected: both files are listed.

- [ ] **Step 2: Delete the obsolete URL Import plan and spec**

Run:

```bash
git rm docs/superpowers/specs/2026-03-27-urlimport-design.md docs/superpowers/plans/2026-03-27-url-import.md
```

- [ ] **Step 3: Verify only the cleanup design/plan remain as URL Import references in docs**

Run:

```bash
rg -n 'URL Import|url-import' docs/superpowers
```

Expected: hits only in:
- `docs/superpowers/specs/2026-03-27-remove-url-import-design.md`
- `docs/superpowers/plans/2026-03-27-remove-url-import.md`

No old active feature spec/plan files should remain.

- [ ] **Step 4: Commit the documentation cleanup**

```bash
git commit -m "docs: remove URL import planning artifacts"
```

---

## Task 4: Verify Website Import Is The Only Remaining Web Import Entry Point

**Files:**
- Verify: `website-import.html`
- Verify: `js/appWebsiteImport.js`
- Verify: `index.html`
- Verify: `voxelblastjam.html`
- Verify: `pattern-import.html`
- Verify: `image-extractor.html`

- [ ] **Step 1: Confirm no active runtime references to URL Import remain**

Run:

```bash
rg -n 'href="url-import.html"|appUrlImport|UrlFetcher|urlFetcher' index.html voxelblastjam.html pattern-import.html image-extractor.html website-import.html js
```

Expected: no matches, command exits with status `1`.

- [ ] **Step 2: Confirm Website Import still references its own bootstrap**

Run:

```bash
rg -n 'appWebsiteImport\.js' website-import.html
```

Expected: exactly one match for the script tag.

- [ ] **Step 3: Run syntax and patch hygiene verification**

Run:

```bash
node --check js/appWebsiteImport.js
git diff --check
```

Expected:
- `node --check` exits successfully
- `git diff --check` prints nothing and exits successfully

- [ ] **Step 4: Smoke-test the surviving web import page through the correct local server**

Run:

```bash
PORT=8080 node dev-server.js
```

Then open:

```text
http://localhost:8080/website-import.html
```

Manual checks:
- page loads without 404s for removed URL Import assets
- nav contains `Website Import`
- nav does not contain `URL Import`
- page still loads `js/appWebsiteImport.js`

Stop the temporary server after the check if it was started just for verification.

- [ ] **Step 5: Record the final repository state**

Run:

```bash
git status --short --branch
git log --oneline --decorate -n 5
```

Expected:
- branch is clean
- the latest commits correspond to nav cleanup, runtime deletion, and doc cleanup
