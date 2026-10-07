# Upstream provenance

- Project: https://github.com/tt-a1i/archify
- Version: 3.0.1
- Source commit: 73aaa0696e8f72c232ea710e6fa94fd953f3e773
- License: MIT; preserve root LICENSE and THIRD_PARTY_NOTICES.md.
- Studio directly uses archify/renderers/architecture/routing.mjs and its shared geometry dependencies at build time.
- Upstream files and Git history are retained. Studio code lives in studio/; its generated artifacts are ignored.
- No live Archify installation was created or changed by this fork.
- Upstream release, site, contributor-card and other workflows are preserved in `studio/upstream-workflows/` as references. Only the Studio CI workflow is active in this derivative; this prevents inherited publishing or scheduled automation from running against the new repository.

The Studio visual system and interaction layer are independent. Upstream browser or delivery receipts must not be described as validating Studio. Upstream documentation describes upstream commands; the fork's entrypoint is README.md and studio/RUNBOOK.md.
