# Archify Studio operations

Requires Node.js 22+ and a current browser. Studio adds no npm dependencies. The inherited Archify engine retains its separate package and commands.

```powershell
npm run check
npm run build
npm start
```

Open http://127.0.0.1:43127. The optional preview server binds only to loopback and serves one HTML file; it does not expose the checkout. Stop it with Ctrl+C. `dist/index.html` also opens directly in a normal browser. Some embedded browsers prohibit file URLs; use the loopback preview there.

## Build a retained evidence atlas

```powershell
node studio/build.mjs --atlas 'C:\path\to\atlas-packet' --out '.local\research.html'
node studio/serve.mjs --file '.local\research.html' --port 43128
```

The input directory must contain `atlas-data.json`, its route candidates and hash-matched raw source snapshots. Inputs remain untouched. Relative input paths must resolve within the packet, including symbolic links. Studio currently accepts architecture diagrams from this atlas format. All source text is embedded; the resulting file may contain private information. The default build uses only the clearly labeled authored demonstration.

The builder regenerates connection paths using the pinned upstream architecture router for Studio's component boxes. These are new presentation artifacts; earlier Archify delivery/browser receipts do not qualify Studio rendering. Topology, evidence status and original source hashes remain separate from presentation geometry.

## Interaction and exports

- Click nodes or connection paths; keyboard Tab/Enter also selects them.
- Use `/` for search and the explicit scope control for this diagram or the entire atlas. Arrow keys move between tabs and search results.
- `+`, `-`, `0` zoom and fit the diagram; drag empty canvas to pan. The camera is stored per atlas/diagram. Escape clears selection.
- The resizable details panel includes relationship endpoints, source excerpts and complete source text download. Arrow keys resize its separator.
- Paper/Ink theme, panel visibility and camera preferences are browser-local. URL fragments preserve diagram, view, selection, query, scope and evidence filter.
- SVG export includes complete diagram topology in the current theme; transient focus/dimming is cleared. Portable HTML includes all diagrams and embedded evidence. Downloads never upload data.

## Exit codes and failures

Build/preview commands exit 1 on invalid input, missing data or occupied port; success exits 0 (the server remains resident until stopped). Source hash mismatch fails the build. A write failure leaves the prior completed output intact when failure occurs before atomic rename; a `.tmp` file may remain for diagnosis. Re-run to replace it. Use a distinct output file to retain older editions.

## Boundaries and rollback

No fleet, hardware, tenant or upstream repository changes occur. `.local/` and `dist/` are ignored. The upstream engine and five diagram renderers remain unchanged. To roll back Studio, stop its preview process and use the original Archify artifacts. Do not install this working checkout as a global Skill unless separately requested. CI, publication and local browser qualification are reported separately.

Only `.github/workflows/studio.yml` runs automatically in this derivative. Inherited upstream workflows are preserved, inactive, under `studio/upstream-workflows/`; Studio does not inherit upstream site or release publishing automation.
