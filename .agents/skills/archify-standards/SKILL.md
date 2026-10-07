---
name: archify-standards
description: Apply and verify Archify Studio standards and evidence contracts when changing JSON packets, Python packaging, preview HTTP, accessibility, exports, diagram notation or protocol claims.
---

# Archify standards

Read `studio/contracts/STANDARDS.md` from the repository root and inspect `studio/contracts/standards.json`. For packet/Python changes also read `studio/contracts/atlas-input-v1.md`. These files identify applicable requirements and verification limits; do not substitute a generic compliance checklist.

1. Identify the affected surface and requirement IDs. Use primary normative specifications for technical requirements. Distinguish project restrictions, informative guidance, draft specifications, and published standards.
2. For contract/schema/provenance or conformance-claim changes, write or update an internal RFC under `studio/rfcs/`. Preserve compatible behavior or state the version/migration decision. A routine contract-preserving fix only needs its regression.
3. Enforce automatic requirements with meaningful failing-then-passing tests. Run `npm run check:all`, the relevant build and the Python-to-Studio roundtrip. Registry integrity alone is not conformance evidence.
4. For interaction or SVG changes, inspect real output and report browser/viewport/keyboard/assistive-technology coverage separately from syntax/geometry checks. Keep manual-open requirements visibly open until their actual evidence exists.
5. For diagrams about protocols or standards, cite the exact edition and sections for the claim and its implementation/observation evidence. Mark unsupported execution or compliance assertions unresolved. Do not label generic architecture drawings UML, BPMN or C4-conformant without the requested notation's semantics.
6. Report exact tested revision, applicable standards, enforced subset, exceptions and remaining gaps. Never use an undifferentiated “RFC compliant” or “WCAG compliant” label based only on a green test suite.

Reuse the shared Node model validator from Python rather than creating divergent graph/provenance rules. Preserve original bytes and qualification states. This skill grants no additional publication, installation, data-disclosure or live-operation authority.
