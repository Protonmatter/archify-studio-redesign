# Archify Studio

An offline workspace for architecture diagrams and the evidence behind them. An independently maintained derivative of [Archify](https://github.com/tt-a1i/archify), pinned to 3.0.1 / `73aaa069`.

Studio adds a drawing-desk visual system, Paper and Ink themes, persistent diagram state, grouped navigation, scoped search, docked evidence inspection, exact source excerpts, open-question views, and portable SVG/HTML export. It uses plain CSS, SVG and browser APIs, with no new runtime or npm dependencies.

```powershell
npm run check
npm run build
npm start
```

Open http://127.0.0.1:43127 or open `dist/index.html` directly in a browser. Node.js 22+ is required to build. The default artifact is a labeled authored example, not production data.

- [Operations and private atlas import](studio/RUNBOOK.md)
- [Design contract](studio/DESIGN.md)
- [Project design skill](.agents/skills/archify-studio-design/SKILL.md)
- [Upstream provenance and boundary](studio/UPSTREAM.md)
- [Original upstream README](UPSTREAM_README.md)

Private research artifacts belong in ignored `.local/` or a separate output directory. A portable research atlas embeds its source text: review before sharing. Studio currently imports architecture/evidence-atlas inputs; upstream retains its separate five-mode rendering tools. Local test, real browser, upstream, and hosted CI evidence are separate.

## License

MIT. Original Archify and Cocoon AI notices are retained in [LICENSE](LICENSE); see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Studio artifacts embed the upstream license. This repository does not claim endorsement by upstream maintainers.
