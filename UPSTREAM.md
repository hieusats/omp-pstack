# Upstream synchronization

omp-pstack tracks [Cursor's pstack](https://github.com/cursor/plugins/tree/main/pstack) and distributes it for omp only. Claude Code and Codex targets were removed in 2.0.0. It also tracks the omp harness itself as a second upstream, recorded under "omp upstream" below. Adaptations are recorded in `CHANGES.md` and live at the existing mapping boundaries.

## Current sync point

| Source | Value |
| --- | --- |
| Repository | `https://github.com/cursor/plugins.git` |
| Path | `pstack/` |
| Commit | `6fecddba65801f9b9c08b8b328d998ee5b09d290` |
| Upstream version | `0.14.5` |
| omp-pstack version | `2.1.6` |

The table above is the current Cursor sync point. omp-pstack 2.1.0 records this 0.14.5 sync. The only content change upstream is the `make-bot-ui` skill, which is built on Cursor product primitives with no omp equivalent (the `update_state` routine tool, the Routines panel, `api2.cursor.sh` webhooks, `SendToUser` secret-request cards), so it is deliberately not ported; see `CHANGES.md`. `README-UPSTREAM.md` preserves its pstack README verbatim. `CHANGES.md` and `NOTICE.md` describe the adaptations and provenance.

## Check for changes

The repository already names Cursor's repository as the `cursor` remote in the maintainer checkout. A fresh clone can add it once:

```shell
git remote add cursor https://github.com/cursor/plugins.git
```

Fetch and inspect only commits that touched pstack after the recorded sync point:

```shell
git fetch cursor main
git log --oneline bdf7aa355337897f167153e05069aca505dae17c..cursor/main -- pstack
git diff --stat bdf7aa355337897f167153e05069aca505dae17c..cursor/main -- pstack
```

No output means the tracked pstack tree has not changed. This comparison does not need a polling service or generated mirror branch.

## Incorporate a change

1. Create or update a GitHub issue in the distribution repository and branch from current `main`.
2. Read each upstream pstack commit in order. Bring over its intent and content, then apply the omp substitutions documented in `CHANGES.md` (Cursor primitives become omp tools and skills; harness names do not return).
3. Keep one `plugins/pstack/skills/` tree written omp-first. Provider routing lives in `provider-dispatch.md` and `setup-pstack`. The startup mandate ships as the always-apply rule `plugins/pstack/rules/pstack-session-mandate.md`, documented in `docs/omp.md`.
4. Update the commit and version in this file, the affected provenance rows in `NOTICE.md`, and `README-UPSTREAM.md` when upstream changes it.
5. Run CI-equivalent checks locally, then live-test the installed plugin from a real omp session on the changed surface. Unit tests alone are not a release gate.
6. Merge the reviewed PR before tagging the next release.

Cursor's version and omp-pstack's version are independent. Cursor's version identifies the imported content; omp-pstack's version identifies the omp distribution.

## omp upstream

The distribution also tracks the omp harness itself. The native lanes wrap omp's bundled agent roles and depend on omp's agent frontmatter schema (`tools`, `model` role aliases, `spawns`), so an omp release can move the ground under `plugins/pstack/agents/`. This upstream is a behavioral dependency, not a subtree import; nothing is copied from it.

| Source | Value |
| --- | --- |
| Repository | `https://github.com/can1357/oh-my-pi.git` |
| Release | `18.0.11` |
| Commit | `51f03804476c3fd3c15748ae07e4849d1efc883b` |
| Recorded roster | `tests/fixtures/omp-bundled-agents.json` |

The maintainer checkout names this repository as the `omp` remote. A fresh clone can add it once:

```shell
git remote add omp https://github.com/can1357/oh-my-pi.git
```

### Check for omp changes

```shell
git fetch omp main --tags
git log --oneline 51f03804476c3fd3c15748ae07e4849d1efc883b..omp/main
bun test tests/check-omp-upstream.test.ts
```

The test compares the live `omp agents unpack` roster against the recorded fixture wherever the `omp` CLI is installed, so a roster or schema drift fails loudly instead of surfacing as broken lane dispatch. Refresh deliberately with `UPDATE_ROSTER=1 bun test tests/check-omp-upstream.test.ts`, which rewrites the fixture's `ompVersion` and `agents` from the installed CLI; the commit moves by hand together with the table above.

### Incorporate an omp change

1. Diff the unpacked roster against the previous fixture and name every moved role or schema field.
2. Update the seven lane agents and the `OMP_ROLE_LANES` pin in `runner/model-matrix.test.ts` red-first when roles, aliases, or fields moved; re-run `setup-pstack` probes when role aliases moved.
3. Refresh the fixture with `UPDATE_ROSTER=1`, move the Release and Commit rows, and record a `CHANGES.md` entry.
4. Run the CI-equivalent checks and live-test the installed plugin from a real omp session before merge.

omp's version and omp-pstack's version are independent; the recorded release is the one the fixture was verified against.
