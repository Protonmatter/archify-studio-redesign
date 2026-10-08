# RFC 0002: Relationship transport metadata and flow animation

Status: accepted for implementation under the user's 2026-10-08 request
Date: 2026-10-08
Affected contract IDs: JSON-01, A11Y-01, A11Y-02, EVIDENCE-01, CLAIM-01
Tested revision: the PR #1 commit that adds this RFC

## Problem and scope

Readers asked to see how each relationship crosses its boundary: the network protocol and port, the API or system call, or another mechanism such as an IOCTL or shared memory. They also asked for animated flow along connections. The atlas model had nowhere to record transport, and the design contract excluded motion.

Scope: an optional, validated `transport` object on relationships in the Studio model and the atlas input contract, its presentation in the workspace, and interaction-scoped flow animation. Non-goals: inferring transport from source code, capturing traffic, or changing upstream Archify renderers or candidates.

## Standards and decision

Model. An edge may carry `transport` with any of:

- `mechanism`: how the call crosses the boundary (for example HTTPS, gRPC, IOCTL, system call, function call, shared memory, message queue, MMIO).
- `protocol`: the wire or message protocol (for example HTTP/1.1, AMQP 0-9-1, QMI).
- `port`: an integer from 0 to 65535, as in the IANA port number range ([RFC 6335](https://www.rfc-editor.org/rfc/rfc6335), section 6).
- `call`: the specific endpoint, API or system call (for example `POST /v1/requests`, `DeviceIoControl(IOCTL_EXAMPLE)`, `read(2)`).
- `attributes`: up to 20 `{name, value}` text pairs for anything else.

Text fields are non-empty and at most 500 characters (attribute values 2000). At least one field must be present, and unknown fields are rejected, in the transport object and in each attribute, so later additions are deliberate. Transport is read only from the evidence record: when importing a packet, architecture candidates contribute routing geometry and nothing else. Values remain JSON-01 interchange data: a port is a JSON integer, never a string. `studio/model.mjs` is the single validator; the Python packager defers to it through `validate-model.mjs` and copies the field unchanged.

Evidence. Transport is part of the authored relationship and shares its evidence status. It is not a packet capture or runtime observation (EVIDENCE-01, CLAIM-01). The inspector says so under the Transport section.

Presentation. The line carries a short chip with the mechanism and port, so it fits between components; the relationship label is never shortened. The inspector lists every field, relationship rows show the full summary, and search matches transport text, including attributes, and states that the match came from transport.

Motion. The design contract's "no perpetual motion" becomes "no ambient motion". By default, beads flow in the authored direction only along the selected connection, a selected component's connections or a traced path. The Flow control switches between that default, every connection, and off. Because flow can run longer than five seconds beside other content, the control always provides a way to stop it ([WCAG 2.2](https://www.w3.org/TR/WCAG22/), 2.2.2). `prefers-reduced-motion: reduce` removes the animation and disables the control ([WCAG 2.2](https://www.w3.org/TR/WCAG22/), 2.3.3 is advisory at AAA). The beads draw over the line, so solid, dashed and dotted evidence styles are unchanged. Exported SVG omits flow paths.

Alternatives considered: a free-form transport string (not searchable by field, no port validation); always-on animation (violates the design contract and 2.2.2, and suggests live traffic).

## Compatibility and migration

Additive and optional. Existing models and packets without `transport` validate and render as before. Older Studio builds do not check unknown edge fields, so they accept a packet with `transport` and simply do not show it; they also do not validate it. Rollback: remove the field from models. The persisted Flow preference is stored per browser and falls back to the default when absent or invalid.

## Evidence and acceptance

Automated: model tests for valid and invalid transport (empty, wrong types, out-of-range or string ports, unknown fields, malformed attributes), summary formatting and transport search; a Python test that transport passes through the packager and an out-of-range port fails before output; browser checks for chips, inspector rows, list summaries, search match reasons, flow scoping, the three Flow modes and their persistence, reduced motion and SVG export.

Pending: manual screen-reader review of the Transport section and Flow control (A11Y-02 remains manual-open); review against a real private atlas with dense labels.

## Exceptions and re-evaluation

The on-line chip shortens long mechanism text to 18 user-perceived characters with an ellipsis, never splitting a surrogate pair or combining sequence; the full value is always available in the inspector, rows and search. Re-evaluate if readers need protocol on the line, or if animation cost on very dense diagrams with Flow set to every connection becomes noticeable.
