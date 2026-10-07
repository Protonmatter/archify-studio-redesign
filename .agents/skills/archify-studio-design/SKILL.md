---
name: archify-studio-design
description: Design and review the Archify Studio diagram workspace, evidence inspector, and portable SVG outputs using its architectural drawing-desk visual system.
---

# Archify Studio design

Read `studio/DESIGN.md` relative to the repository root before changing visible behavior. Apply this skill to Studio UI and diagram work; it does not govern unrelated repositories or authorize publication.

## The visual contract

The diagram is the main artifact. Surround it with a quiet document workspace: warm paper, charcoal typography, muted teal selection, fine rules and deliberate whitespace. Amber and rust express unresolved and failed evidence. Use existing CSS variables for both Paper and Ink themes. No Tailwind or component-library dependency is needed.

Use the serif face for document titles, the system UI face for readable interface prose and component labels, and monospace for identifiers and metadata. Repeated cards, promotional slogans, gradients, decorative grids, glow, and generic icon tiles do not belong in this workspace. Rectangles in the graph represent real components; their headers, connection ports and evidence states must have meaning.

## Design from the reader's task

First state which investigation becomes easier: finding a component, following a relationship, reading a source, or understanding a missing dependency. Prefer removing steps or preserving context to adding permanent controls. Keep selected geometry clear of the inspector. Use labels a systems engineer recognizes. Never imply observed execution from an authored arrow.

## Verify the actual output

- Inspect the real generated artifact at desktop and narrow widths, in both themes. Record the actual CSS viewport; a requested screenshot size alone does not establish it.
- Check long labels and dense diagrams. Inspect label/connector collisions and clipping, not only screenshots of the small example. Do not silently truncate canonical labels to make a layout pass.
- Exercise selection, scoped search, tab roundtrips, browser history, reload, keyboard focus and export. User state must not alter canonical exported topology.
- Measure meaningful text and non-text contrast, and verify visible focus. Browser tests and visual judgment are separate evidence.
- Compare against the existing visual vocabulary. Introduce new colors, type families or interaction patterns only when they solve a concrete reading problem.

Use the existing `npm run check`, `npm run build`, and browser workflow. Preserve upstream license notices and keep private research data in ignored `.local/` or a user-chosen output directory. This skill grants no commit, push, upload, deployment, or global installation authority.
