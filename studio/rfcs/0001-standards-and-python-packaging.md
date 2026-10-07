# RFC 0001: Standards profile and reusable Python packaging

Status: accepted for implementation under the user's 2026-10-07 request
Affected contract IDs: JSON-01, HTTP-01, CACHE-01, URL-01, A11Y-01, A11Y-02, SVG-01, EVIDENCE-01, CLAIM-01
Baseline: 573fdde05b57151f63a18c4579197ed72c8749b4

## Problem and scope

The initial fork published the Node application and inherited integration module but not the earlier bespoke Python research-authoring scripts. Existing authoring/delivery/design guidance did not identify a normative standards profile or map its enforced subset. Add a reusable Python packaging boundary and explicit standards guidance without copying private research facts into reusable code.

## Decision

Use the scoped profile in `../contracts/STANDARDS.md`. Python reads an authored model and only declared source files; it captures exact snapshots and delegates graph/line validation to the existing Node authority. Node import gains a strict JSON interoperability gate. Preview HTTP gains the required 405 Allow header and correct GET/HEAD representation length. No new third-party runtime libraries are introduced.

The packager does not auto-detect or claim Git/runtime provenance. It returns created or unchanged and refuses different existing packets. Data and research-specific authoring remain explicit inputs. Full accessibility and notation/protocol conformance are not inferred from automatic tests.

## Compatibility and migration

Valid existing architecture/evidence packets remain supported. Inputs with duplicate JSON names, malformed UTF-8, lone surrogates, excessive nesting or unsafe/nonfinite numbers now fail explicitly. These are intentional interoperability restrictions; encode exact large counters as decimal strings. Authored group/short title and demonstration metadata are preserved on import. Existing CLI build/preview defaults are retained.

## Acceptance and rollback

Node JSON/HTTP and existing model/build/contrast tests; Python strict input, deterministic bytes, source containment/provenance, idempotent publication and actual Node-build roundtrip; Windows/Ubuntu CI across Node 22/24 and Python 3.11/3.14. Retained private atlas compatibility is checked locally without publishing its sources. Reverting this follow-up returns to the baseline; historical packets and input sources are not mutated.

## Remaining qualification

Manual WCAG/assistive-technology coverage, full SVG conformance and depicted-protocol behavior remain explicit open scopes. The standards registry validates declared verification wiring, not real-world conformance. General multi-root research extraction and migration of the bespoke Qualcomm authoring scripts are outside this packet-tool scope.
