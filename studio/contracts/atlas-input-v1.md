# Studio atlas input v1

The reusable Python packaging entrypoint is `studio/tools/package_atlas.py`. Its input is authored data, not hardcoded research logic. It requires Python 3.11+ and Node.js 22+; no third-party Python packages or network access are needed.

## Input

`--model` names UTF-8 JSON with `title`, `routes`, `sources`, and optional `terms`, `subtitle`, `demonstration`. Each route declares `id`, `title`, `nodes`, `edges`, and optional `summary`, `group`, `shortTitle`, `unknowns`. Node fields match `studio/model.mjs`: ID, label, evidence status, finite x/y/width/height, symbols and citations. Edges declare unique IDs, valid from/to IDs, label, status, citations and optional explicit routing. An edge may add an optional `transport` object (RFC 0002) with any of `mechanism`, `protocol` and `call` (non-empty text up to 500 characters), `port` (integer 0 to 65535) and `attributes` (up to 20 `{name, value}` text pairs); it must contain at least one of them, and unknown fields are rejected. Transport is authored metadata under the edge's evidence status, not an observed capture.

An explicit `schemaVersion` must be the integer 1; omission retains compatibility with older versionless packets. Unknown versions fail rather than being silently interpreted as v1.

`sources` declares a unique ID, a relative `path` inside `--source-root`, and an optional repository display label. Only declared files are read; there is no repository scan. Sources must be regular UTF-8 text files. Paths, including symbolic links/junctions, must resolve inside the declared root. Input limits are 20 MiB JSON, 5 MiB per source and 64 MiB combined source bytes; route/node/edge/index limits are enforced by the shared Node validator. Integer-valued JSON numbers must be within ±(2^53−1).

A citation names `source`, one-based `line`, and optional inclusive `end_line`. Optional supplied path/repo/scope/hash metadata must agree with the captured source. Source lines are split on LF (including CRLF); a final empty line follows a trailing LF, matching the Studio validator. The packager labels provenance `snapshot` with no Git revision. It cannot certify committed-source or runtime provenance. An existing retained packet with stronger verified provenance can instead go directly to the Studio importer.

## Output and guarantees

The output directory contains:

- `atlas-data.json`: complete atlas model and source metadata; published last as the importer-visible commit marker.
- `candidates/*.json`: typed architecture candidates with explicit component positions and authored relationships.
- `sources/*.txt`: exact original bytes, with generated filenames independent of machine paths.
- `packet-manifest.json`: deterministic file SHA-256 values and a model/source-integrity scope statement.

The shared `validate-model.mjs` runs before output creation. A successful packager result establishes model/source integrity only; it does not fabricate Archify finalize, browser, visual, accessibility, protocol or hardware receipts. Original input files remain untouched.

The original model's Unicode, depth and numeric profile is checked before normalization, including unused fields and keys. Enriched/serialized packet JSON must also fit the importer's 20 MiB per-file limit; metadata expansion can therefore reject a smaller valid input before any output is created. UTF-8 source BOM bytes are preserved in both snapshots and embedded source text; JSON producers still emit no BOM.

Publication exclusively creates a new output directory. Repeating identical input against an identical complete packet returns `unchanged` with exit 0. A differing or linked existing output is refused; use a fresh path. If writing a new packet fails, a partial directory may remain for diagnosis, and no successful result is reported. The atlas index is only atomically installed after all referenced files are written. This is a local-filesystem publication protocol, not a distributed transaction or a guarantee against hostile concurrent filesystem mutation.

## Usage

```powershell
python studio/tools/package_atlas.py --model studio/examples/atlas-model.json --source-root studio/examples --out .local/example-packet
node studio/build.mjs --atlas .local/example-packet --out .local/example-atlas.html
```

`--node` can select a Node executable path; it is passed as an argument, never interpreted by a shell. Exit 0 means created/unchanged. Exit 1 means source, model, validation, execution or output failure; argparse returns 2 for invalid command usage. Stdout is a JSON summary; errors go to stderr. Inputs should contain only the authored text intentionally selected for inclusion. Generated research packets remain local/ignored by default.

## Historical Python helpers

The original `build_archify_atlas.py`, `archify_firmware_routes.py`, and `package_archify_atlas.py` were local Qualcomm research-authoring scripts. They contained machine paths and embedded research assertions and were not included in commit `573fdde`. This reusable tool replaces the generic packaging responsibility; it does not pretend to preserve or publish those bespoke authoring programs. Move their reusable data into an explicit model only after reviewing its intended publication scope.
