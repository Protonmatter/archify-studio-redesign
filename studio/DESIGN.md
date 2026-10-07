# Archify Studio design contract

## Intent
Create a private, independently maintained Archify derivative for technical investigation. Carry the existing diagram topology and evidence boundaries into a coherent workspace. The approved conversation design supplies persistent state, a docked inspector, explicit search scope, grouped diagrams, evidence navigation and accessible controls.

## Visual direction
An architectural drawing desk. Warm paper (#f6f4ed), charcoal (#252b29), muted teal (#256759). Amber and rust identify unresolved and failed evidence. Fine rules, near-square corners and typography establish hierarchy. The canvas is the focal point. A serif document title, humanist system UI text and monospace identifiers have separate jobs. No external fonts, framework styling, dashboard tiles, ornamental gradients, or perpetual motion. Light and dark palettes preserve meaning. Rounded rectangles represent actual graph components, not decorative content cards.

## Interaction
A grouped, collapsible diagram directory; a viewport-sized SVG canvas; an optional docked evidence inspector; global search with explicit all-diagrams/current-diagram scope. Diagram, relationship, source, and gaps views preserve the route's camera and selection. URL fragments encode route, view, selection, scope, search and status filter. Browser history represents deliberate navigation. Invalid links recover to a valid overview. Source excerpts are text, never HTML. Keyboard equivalents exist for selection, tabs, closing panels and zoom. Reduced motion is respected.

## Implementation boundary
Keep upstream renderers and validators unchanged. Build a new studio/ application using Node built-ins, vanilla browser APIs and the existing Archify architecture router. Build-time normalization produces bounded JSON and explicit edge geometry. Published examples are authored demonstrations, labeled as such; they do not claim live or empirical validation. The local Qualcomm packet stays in ignored .local/ and externally generated outputs. Preserve MIT and third-party notices.

## Success criteria
User can search a symbol, inspect a node or edge, read evidence, return to the map and reload without losing context. Gaps and sources honor the visible scope. Selected geometry is never obscured by the inspector. Text is legible at ordinary laptop widths, keyboard focus is visible, source input cannot inject HTML, and SVG/HTML exports are offline and self-contained. UI tests are separate from graph semantics and hardware qualification.
