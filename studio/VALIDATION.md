# Studio validation — 2026-10-07

Upstream base: `73aaa0696e8f72c232ea710e6fa94fd953f3e773`. Studio implementation is a separate application; these results do not extend upstream delivery receipts to the Studio presentation.

## Local commands

- `npm run check`: syntax checks and 24 Studio tests passed, zero skips. Coverage includes scoped search, URL/line roundtrip, query isolation, cyclic reachability, malformed metadata, empty IDs, source integrity, line bounds, external directory junction containment, bounded edge geometry, deterministic routing, import candidate topology, HTML serialization and license retention.
- `npm run build`: public demonstration built without additional dependencies.
- `node scripts/generate-viewer.mjs --check`: unchanged upstream viewer remains current.
- `node --test archify/test/route-detour.test.mjs archify/test/authored-straight-routes.test.mjs`: 21 inherited routing tests passed, zero skips.
- `git diff --check`: passed. Private `.local/` and generated `dist/` paths confirmed ignored.
- Actual retained atlas import: 14 diagrams, 136 components, 121 relationships, 315 hash-verified source snapshots and 9,060 indexed terms. Indexed references normalize to exact source identities and line bounds; invalid references fail the build.

## Browser checks

Performed in the available Edge browser, through the supported browser-control API, against loopback-only preview servers.

- Desktop Paper/Ink visual inspection at actual 1432 × 852 CSS viewport.
- Selection and zoom remain unchanged after diagram → relationships → diagram and after reload.
- Exact node-symbol search selects the expected component. An indexed source symbol opens its cited line 391 and retains that line after reload.
- Tab arrow-key navigation and browser Back return to the expected view.
- Every retained diagram was selected in the real browser: expected node/edge counts, finite view boxes, and no node-label bounding boxes outside their component boxes in that pass.
- At an actual 390 × 844 CSS viewport: document width is 390; search, theme, export, details and all four view tabs remain visible and within viewport width. Emulated screenshots were clipped by the capture surface, so no complete mobile perceptual acceptance is claimed.
- Both exports downloaded. Exported SVG parses as XML with all nine example nodes/edges and the license. Portable HTML retains its data and license and was reopened through a separate preview server; node selection works.
- Base palette text contrast is at least 4.5:1 for primary/muted/accent/amber/rust; diagram outline contrast is at least 3:1 in both themes. These tests do not establish full WCAG conformance, including dimmed focus states.

## Independent review

A read-only reviewer reproduced input-validation, evidence-identity, geometry, license-re-export, long-label truncation, exact-source-line and empty-ID issues. Corrections were verified with focused failing-then-passing regressions where applicable. The final reviewer message identified the empty-ID guard as its last remaining finding; the guard and cross-entity regression were then added and the 24-test suite passed. Long labels retain their complete text; exceptionally long labels can shrink and require zoom or inspection.

## Limits

No full inherited suite, hosted CI, screen-reader session, complete mobile visual review, or exhaustive connector-label collision audit is claimed. Studio currently imports architecture/evidence-atlas inputs; upstream's other renderer modes remain separate. No hardware or timing validation occurred. Private evidence, output HTML and screenshots are excluded from Git publication.
