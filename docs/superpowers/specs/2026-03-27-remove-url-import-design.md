# Remove URL Import and Keep Website Import Only — Design Spec

**Date:** 2026-03-27
**Status:** Approved for planning

## Overview

The repository currently contains two web-based import entry points:

- `url-import.html`
- `website-import.html`

The approved direction is to remove the URL Import feature completely and keep Website Import as the only web import workflow.

This is a cleanup change, not a redesign of Website Import. The goal is to eliminate the unused URL Import page, its scripts, its navigation links, and its planning/spec artifacts so the repository reflects a single supported import-from-web path.

## Goals

- Remove all runtime files that exist only for URL Import.
- Remove all navigation links that expose URL Import in the UI.
- Remove URL Import-specific planning and spec documents from the repo.
- Keep Website Import fully intact.
- Preserve shared pattern helpers that are still used by Website Import, Pattern Import, or Image Extractor.

## Non-Goals

- Redesign Website Import behavior.
- Change Website Import proxy architecture.
- Refactor shared pattern helper modules unless they become fully unused.
- Change Pattern Import, Image Extractor, WiggleTangle, or VoxelBlastJam behavior beyond navigation cleanup.

## Existing Context

- `url-import.html` is a standalone page for URL-based pattern loading.
- `js/appUrlImport.js` is the page bootstrap for URL Import.
- `js/urlFetcher.js` exists only to support URL Import.
- `website-import.html` and `js/appWebsiteImport.js` already provide the web import flow that should remain.
- The main navigation currently exposes both URL Import and Website Import, which is no longer desired.

## Approved Approach

Remove URL Import as a complete feature slice while leaving shared pattern infrastructure in place.

The cleanup is limited to:

- deleting URL Import runtime files
- deleting URL Import documentation artifacts
- removing URL Import navigation links from active pages

The cleanup does not touch shared pattern modules such as `js/patternSampler.js`, `js/patternImport.js`, `js/patternExport.js`, or `js/imageExtractor.js`, because those are still relevant outside URL Import.

## Files To Remove

Runtime files:

- `url-import.html`
- `js/appUrlImport.js`
- `js/urlFetcher.js`

Documentation files:

- `docs/superpowers/specs/2026-03-27-urlimport-design.md`
- `docs/superpowers/plans/2026-03-27-url-import.md`

## Files To Update

Navigation cleanup only:

- `index.html`
- `voxelblastjam.html`
- `pattern-import.html`
- `image-extractor.html`
- `website-import.html`

Required change:

- remove the `URL Import` nav link
- keep the remaining links working
- keep `Website Import` in the nav
- preserve the correct active link state on each page

## Files To Keep

Shared helpers remain unless later proven unused:

- `js/patternSampler.js`
- `js/patternImport.js`
- `js/patternExport.js`
- `js/imageExtractor.js`

These modules are not URL Import-specific anymore and should not be deleted as part of this cleanup.

## Data and Behavior Boundaries

After this cleanup:

- there is no user-facing route to URL Import
- there is no runtime script for URL Import
- there is no repo documentation describing URL Import as an active feature
- Website Import remains the only supported web import entry point

This change must not alter:

- Website Import extraction behavior
- Pattern Import JSON import behavior
- Image Extractor export behavior
- existing palette behavior outside nav cleanup

## Verification

The implementation is complete when all of the following are true:

1. `URL Import` no longer appears in any page navigation.
2. `url-import.html` is removed from the repository.
3. `js/appUrlImport.js` and `js/urlFetcher.js` are removed from the repository.
4. URL Import plan/spec documents are removed from the repository.
5. Repo-wide searches for `url-import.html`, `appUrlImport`, and `urlFetcher` no longer return active runtime references.
6. `website-import.html` still loads without broken script references.
7. `git diff --check` passes.

## Risks

- Removing the old plan/spec files also removes the design history for URL Import from the active repo.
- Navigation changes touch multiple HTML entry points, so active-link regressions are possible if edits are inconsistent.

These risks are acceptable because the goal is to simplify the product surface and support only one web import path.

## Implementation Notes

- Treat this as a focused deletion and cleanup task, not a broader refactor.
- Prefer removing dead references before deleting files so verification is straightforward.
- If a supposedly URL Import-only module is found to be used elsewhere during implementation, stop and keep that module in place until its remaining dependency is understood.
