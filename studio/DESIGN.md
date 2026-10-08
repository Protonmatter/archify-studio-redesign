# Archify Studio design contract

## Intent
Create a private, independently maintained Archify derivative for technical investigation. Carry the existing diagram topology and evidence boundaries into a coherent workspace. The approved conversation design supplies persistent state, a docked inspector, explicit search scope, grouped diagrams, evidence navigation and accessible controls.

## Visual direction
An architectural drawing desk. Warm paper (#f6f4ed), charcoal (#252b29), muted teal (#256759). Amber and rust identify unresolved and failed evidence. Fine rules, near-square corners and typography establish hierarchy. The canvas is the focal point. A serif document title, humanist system UI text and monospace identifiers have separate jobs. No external fonts, framework styling, dashboard tiles, ornamental gradients, or ambient motion. Motion appears only where the reader is looking: the selected connection, a selected component's connections and a traced path show beads flowing in the authored direction, and the Flow control switches between that default, every connection, and off, so motion can always be stopped. Flow shows authored direction, never observed traffic, and reduced motion removes it. Light and dark palettes preserve meaning. Rounded rectangles represent actual graph components, not decorative content cards.

### Evidence vocabulary
Each of the six evidence states has a label, a glyph shape and a line style, so states never depend on hue alone: observed (filled circle), software tested (filled square with check), static analysis (open diamond), documented (open circle), unresolved (dashed half-filled circle) and failed (cross). One rule holds everywhere: dashed means not established. Unresolved components and connections are dashed amber; failed ones are dotted rust. The evidence chips above the canvas are both the legend and the filter, with per-state counts for the current diagram.

### Transport
A relationship may say how it crosses its boundary: mechanism (HTTPS, gRPC, IOCTL, system call, shared memory), protocol, port, the specific call (an endpoint, API or system call) and named attributes. The line carries a short mechanism-and-port chip; the inspector, relationship list and search carry the full detail. Transport is part of the authored claim and shares its evidence state; it is not a capture.

## Interaction
A grouped, collapsible diagram directory; a viewport-sized SVG canvas; an optional docked evidence inspector; global search with explicit all-diagrams/current-diagram scope. Diagram, relationship, source, and gaps views preserve the route's camera and selection. URL fragments encode route, view, selection, scope, search and status filter. Browser history represents deliberate navigation. Invalid links recover to a valid overview. Source excerpts are text, never HTML. Keyboard equivalents exist for selection, tabs, closing panels, zoom, panning and focusing the selection; `?` lists them. Search groups results by type and states why each one matched. Focus selection frames the selected component with its neighbors; the overview map appears only when part of the diagram is out of view. At phone widths the directory is an overlay and details open as a bottom sheet while the selection is framed above it. Without a saved choice, the theme follows the system color scheme. Reduced motion is respected.

## Implementation boundary
Keep upstream renderers and validators unchanged. Build a new studio/ application using Node built-ins, vanilla browser APIs and the existing Archify architecture router. Build-time normalization produces bounded JSON and explicit edge geometry. Published examples are authored demonstrations, labeled as such; they do not claim live or empirical validation. The local Qualcomm packet stays in ignored .local/ and externally generated outputs. Preserve MIT and third-party notices.

## Success criteria
User can search a symbol, inspect a node or edge, read evidence, return to the map and reload without losing context. Gaps and sources honor the visible scope. Selected geometry is never obscured by the inspector. Text is legible at ordinary laptop widths, keyboard focus is visible, source input cannot inject HTML, and SVG/HTML exports are offline and self-contained. UI tests are separate from graph semantics and hardware qualification.
