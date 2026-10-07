# Archify Studio implementation plan

Goal: deliver a working private derivative implementing the approved investigation workspace and authored visual direction.
Spec: DESIGN.md. Native implementation with one independent final review. User authorization to implement is retained; commit/push remains a separate explicit user instruction.

1. Model and navigation: studio/model.mjs and test/model.test.mjs. Validate bounded routes, unique IDs, referential integrity and finite geometry. Encode/decode route/view/selection/query/scope/filter; preserve camera in per-route state. Rank exact identifier matches and scope search/gaps. Test malformed data, cycles, unknown hashes, Unicode and adversarial text.
2. Build and portability: studio/build.mjs and test/build.test.mjs. Compile public examples with upstream routing; import atlas data with candidate geometry and source snippets. Reject paths outside the input directory, including symlinks. Serialize safe JSON into one static HTML; no network dependencies. Build outputs are ignored.
3. Workspace: studio/index.html, studio/studio.css, studio/app.mjs. Implement persistent SVG, docked/resizable inspector, grouped navigation, diagram/relationships/evidence/gaps tabs, scoped search, keyboard shortcuts, theme, zoom/pan/reset, exact evidence excerpts and SVG/HTML export.
4. Qualification and handoff: run syntax/model/build tests and upstream viewer freshness/router checks; real browser flow, reload/history, narrow viewport, keyboard and export checks; independent code review and fixes. Document exact boundaries and commands, retain attribution, prepare private GitHub repo.

Review focus: unsafe source paths and HTML, collisions/long labels, invalid persisted selection, empty scoped search/gap results, lost camera state on navigation. Upstream's five-mode renderer support remains available; Studio initially consumes architecture/evidence-atlas inputs only.
