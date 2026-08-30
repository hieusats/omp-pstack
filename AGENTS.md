# omp-pstack

Track all durable work in this repository's GitHub Issues. Do not create a parallel Linear queue. Read `UPSTREAM.md` before changing upstream-derived content.

Cursor's `cursor/plugins/pstack` tree is the content upstream. omp is the only distribution target: keep one omp-first skill tree, name omp tools directly in skill prose, and never reintroduce a Claude Code or Codex surface, manifest, tool-mapping layer, or harness name. Provider routing resolves once in the parent; children do not detect or reroute themselves.

Before opening a pull request, run the Bun tests, strict typecheck, static invariants, and plugin validation.

Nothing merges, tags, releases, or rolls out until the exact candidate is installed and the changed behavior passes a live test from a real omp session. Unit tests, validators, source inspection, and self-reports do not satisfy this gate. Record the installed version, surface, action, and observed result in the pull request template. A pull request without that evidence remains a draft.

Source edits go through omp's edit tool or `ast_edit`. Never `sed -i`, `perl -i`, or ad-hoc script rewrites on tracked source.


Do not add an implicit runtime timeout or a weaker-model fallback.
