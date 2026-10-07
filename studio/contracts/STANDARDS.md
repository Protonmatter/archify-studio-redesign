# Studio standards contract v1

Reviewed against the linked primary specifications on 2026-10-07. This is a scoped engineering contract, not a claim of universal RFC, WCAG, SVG, UML or BPMN conformance.

The uppercase terms MUST, MUST NOT, SHOULD and MAY use BCP 14 meanings only in normative requirements below: [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119.html) and [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174.html). Ordinary prose is not promoted into a normative requirement by capitalization elsewhere.

## Applicability and enforcement

| Contract ID | Applicable surface and reference | Required behavior | Evidence |
|---|---|---|---|
| JSON-01 | External packet/model JSON; [RFC 8259](https://www.rfc-editor.org/rfc/rfc8259), sections 4, 6, 8 | Producers MUST emit UTF-8 JSON without a BOM or nonfinite values. Studio additionally MUST reject duplicate names, unpaired surrogates, nesting over 128 levels, and integer-valued numbers outside ±(2^53−1). Encode large exact counters as decimal strings. | `json-input.mjs`, `validate-model.mjs`, `standards.test.mjs`, Python tests |
| HTTP-01 | Loopback preview; [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html), sections 9.3.1, 9.3.2, 15.5.6 | HEAD MUST omit the response body. Its Content-Length, if present, MUST equal the corresponding GET representation length. A 405 response MUST include Allow. | Real loopback requests in `standards.test.mjs` |
| CACHE-01 | Private preview responses; [RFC 9111](https://www.rfc-editor.org/rfc/rfc9111.html), section 5.2.2.5 | Successful preview responses MUST send `Cache-Control: no-store`. This is a Studio privacy policy using the standard directive, not a claim that all HTTP responses universally require no-store. | `standards.test.mjs` |
| URL-01 | Browser navigation; [WHATWG URL Standard](https://url.spec.whatwg.org/) | State MUST use URLSearchParams and roundtrip reserved characters and Unicode. Unknown/invalid state MUST recover to valid data. | `model.test.mjs` |
| A11Y-01 | Base palettes; [WCAG 2.2](https://www.w3.org/TR/WCAG22/), 1.4.3 and 1.4.11 | Tested normal-text pairs MUST reach 4.5:1 and required diagram boundaries 3:1. Exceptions and deliberately dimmed states MUST be assessed before claiming broader conformance. | `contrast.test.mjs`; coverage is the named base pairs only |
| A11Y-02 | Interactive viewer; [WCAG 2.2](https://www.w3.org/TR/WCAG22/), [WAI-ARIA 1.2](https://www.w3.org/TR/wai-aria-1.2/) | Changes to interaction MUST preserve keyboard access, names/roles/states, visible focus and unobscured selected content. Tabs SHOULD follow the informative [APG tabs pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/). | Browser keyboard/AT/viewport review; full WCAG AA remains unqualified |
| SVG-01 | Exported diagrams; [SVG 1.1 Second Edition](https://www.w3.org/TR/SVG11/) for core geometry/XML, [SVG 2](https://www.w3.org/TR/SVG2/) for current browser evolution | Exports MUST retain namespace, finite geometry, complete authored topology, readable labels and license. Native browser serialization and XML parsing are checks, not proof of complete specification conformance. | Geometry tests plus export/XML/browser review |
| EVIDENCE-01 | Source packets and authoring | Every cited source MUST resolve inside the declared source root. Original bytes, SHA-256 and line bounds MUST agree. Snapshot provenance MUST NOT be labeled committed or runtime-verified without separate proof. | Node/Python source and model tests |
| CLAIM-01 | What a diagram says about a system | A standard or protocol compliance claim MUST name its edition/sections, scope and supporting evidence. Authored arrows, source-code names, or successful drawing checks MUST NOT be treated as runtime or protocol proof. | Author/reviewer assessment |

RFC 8259 recommends unique member names and discusses numeric interoperability; the stronger rejection rules above are **Studio profile decisions**, not quotations of universal JSON requirements. WHATWG URL behavior is used for browser state rather than hand-implementing RFC 3986 encoding. SVG 2 was a Candidate Recommendation Snapshot on the review date; it is not labeled a final W3C Recommendation here.

## Diagram notation and depicted protocols

The default diagram is an authored directed architecture graph. It MUST NOT be advertised as UML, BPMN, C4, or protocol-conformant merely because it looks similar. When a task requests a named notation or a protocol such as HTTP/TLS, the author SHOULD declare the requested notation/profile and relevant specification sections, then tie each substantive claim to a source or observation. If that evidence is missing, keep the statement unresolved or documented as an intended design.

## Change and release contract

Changes to JSON/packet schemas, public CLI behavior, provenance meaning, standard applicability, or conformance claims MUST include an internal design RFC using `studio/rfcs/TEMPLATE.md`, or update an existing applicable RFC. Routine implementation fixes that preserve a contract do not require a new RFC. An internal RFC is a project design decision, not an IETF RFC publication or permission to deploy.

Each changed automatic requirement MUST have a relevant regression. Run `npm run check:all`, build the public example, and exercise Python packet → Studio build. `standards.json` maps requirement IDs to verification surfaces; `check-contracts.mjs` validates registry integrity only. It does not certify the application.

Before claiming full accessibility, notation, or protocol conformance, the report MUST list the exact scope, standard/edition, tested revision, automated coverage, manual coverage, failures, exceptions and untested criteria. Manual/open entries MUST NOT be silently converted to passes because CI is green. Current manual acceptance record: `studio/VALIDATION.md`.

## Exceptions

Record exceptions in the applicable RFC with affected requirement IDs, rationale, impact, compensating behavior, test coverage and a re-evaluation trigger. Do not weaken tests solely to obtain a passing receipt. No skill or contract expands commit, publication, tenant, hardware, or data-disclosure authority beyond the user's instructions.
