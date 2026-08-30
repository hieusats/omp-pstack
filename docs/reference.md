# omp-pstack technical reference

omp-pstack is the omp-only distribution of [Lauren Tan's pstack](https://github.com/cursor/plugins/tree/main/pstack). One plugin, one harness, one catalog. Every skill is written omp-first; there is no cross-harness translation layer.

## Install

This repo ships as an omp marketplace containing one plugin (`pstack`).

```shell
omp plugin marketplace add hieusats/omp-pstack
omp plugin install pstack@omp-pstack
```

The catalog lives at `.omp-plugin/marketplace.json`, omp's preferred path, and the plugin manifest at `plugins/pstack/.omp-plugin/plugin.json`. The startup mandate is omp-native: the always-apply rule `rules/pstack-session-mandate.md` is injected into every session's system prompt automatically. See [omp.md](omp.md) for details and the model-lane setup.

## Layout

```text
.
├── .omp-plugin/marketplace.json      # omp marketplace manifest (repo root)
├── plugins/pstack/                   # the plugin itself
│   ├── .omp-plugin/plugin.json       # omp plugin manifest
│   ├── skills/                       # 52 skills, written omp-first
│   │   ├── poteto-mode/references/provider-dispatch.md  # provider routing
│   │   └── poteto-mode/scripts/      # bun/bash/node tooling: watch-pr, orch, runner, check-plan.mjs, worktree-audit.sh
│   ├── rules/                        # always-apply session mandate, auto-injected into every omp session
│   └── agents/                       # omp task agents: poteto-agent, comment-sicko, and the Fable and Opus lanes at each selectable effort
├── tests/skill-collision-repro.sh    # package invariants
├── tests/check-omp-structure.test.ts # omp-only structure invariants
├── LICENSE                           # pstack upstream MIT
├── LICENSE-cursor-team-kit           # cursor-team-kit upstream MIT
├── NOTICE.md                         # attribution table
├── UPSTREAM.md                       # current Cursor sync point and update procedure
├── CHANGES.md                        # per-skill substitution audit
├── README.md                         # plain-English introduction and quick start
└── docs/reference.md                 # this technical reference
```

Plugin-internal `skills/<name>/` path references in the docs below are relative to `plugins/pstack/`.

## Running on omp

The `skills/` tree is the only workflow source; no `commands/` layer ships. Skill prose names omp tools directly (`read`, `write`, `edit`, `bash`, `grep`, `glob`, `task`, `todo`, `ask`, `browser`), and skills resolve under flat names: `skill://poteto-mode`, `/skill:poteto-mode`, `/skill:architect`.

- **Skill invocation.** omp loads `SKILL.md` natively. Invoke a skill with `/skill:<name>`, by asking for it by name, or by reading `skill://<name>`.
- **Subagents.** The `task` tool with a named `agent` dispatches the shipped agents. Parallel fan-out is one multi-item `tasks[]` dispatch. If a native lane is unmapped in `task.agentModelOverrides`, record that lane as unconfigured; external lanes still run, and no provider is silently substituted. For an ad-hoc subagent in poteto style, dispatch `poteto-agent` or a `task` worker told to read `poteto-mode` first.
- **Models.** `setup-pstack` asks one requested effort per frontier family (`low`, `medium`, `high`, `xhigh`, `max`) and writes the seven `pstack-*` lane rows under `task.agentModelOverrides` in `~/.omp/agent/config.yml`. The first-run panel is Fable 5 max, GPT-5.6 Sol max, Grok 4.6 xhigh, and Opus 5 xhigh. Lane agents mapped to selectors run as native omp task agents; the codex and Grok families run through the deterministic external runner. Children never detect the parent or reroute themselves.

Verified in fresh installed omp sessions at 2.1.0: the user-facing skills are discovered under flat names, the nine agents are native task agents, the mandate rule is injected without any manual step, and `skill://setup-pstack` serves the omp-only flow. External lanes follow the runner contract with receipts; on hosts where an external CLI is unauthenticated, the lane is a recorded dropout, never a silent substitution.

## Dependencies

Nothing is declared in the plugin manifest.

Referenced in skill bodies:

- **`gh` CLI** — system-level requirement of the `babysit` skill and the Babysit / Shipping playbooks. Install via [`brew install gh`](https://cli.github.com) and authenticate with `gh auth login`.
- **`bun`** — runs the vendored `skills/poteto-mode/scripts/` tooling (`watch-pr`, `orch`, `runner`). Install via [`brew install oven-sh/bun/bun`](https://bun.sh). `bootstrap.ts` installs dependencies for `watch-pr` and `orch`; the runner uses only Bun and Node built-ins, so it launches directly without an install/re-exec layer.
- **`node`** — runs `skills/poteto-mode/scripts/check-plan.mjs`. The checker uses only Node built-ins and does not need Bun.
- **claude, codex, and Grok Build CLIs** — the external runner uses the assigned subscribed CLI directly. Install and authenticate only the providers present in your model sheet.
- **`gt` (Graphite CLI)** — only for the stack playbooks (Shipping, Orchestrate, the autopilots). Everything else works without it.
- **`jq` and `rg` (ripgrep)** — only for `scripts/worktree-audit.sh` (the Worktree cleanup playbook). Without them the audit still runs but blanks its PR and LAST_CHAT columns, so it warns on stderr rather than returning a table that looks complete.

No third-party plugins. The harsher-critique escape hatch lives in the bundled `thermo-nuclear-code-quality-review` skill (imported from cursor-team-kit), not in an external plugin.

## Skills

The table uses the short names. Invoke each as `/skill:<name>` (for example `/skill:poteto-mode`) or by name.

| skill | use it when |
| --- | --- |
| `poteto-mode` | default entry point for any non-trivial task |
| `how` | walk through how a subsystem works |
| `why` | investigate why something was built this way (parallel multi-MCP evidence) |
| `architect` | settle types and module shape before writing code that crosses a function boundary |
| `arena` | run N parallel attempts at the same task and pick the best parts |
| `interrogate` | have four different models try to break a diff |
| `automate-me` | draft your own personal -mode skill from recent transcripts |
| `reflect` | capture a long task's lessons as a skill edit |
| `tdd` | fix a bug by writing the failing test first, then the fix |
| `typescript-best-practices` | ground type-system discipline in TypeScript syntax |
| `teach` | understand a change or subsystem for real: `how` + `why` woven into one plain explanation |
| `swarm` | fan out N parallel workers across slices or races, then one aggregated report |
| `technical-writing` | write docs, RFCs, readmes, PR descriptions, and commit messages to one layered standard |
| `bro` | restate the last message in plain human language, no jargon |
| `figure-it-out` | design a rigorous, auditable playbook for a task no bundled playbook fits |
| `show-me-your-work` | log decisions to a reviewable tsv decision trail |
| `blast-radius` | find what a change could break beyond the diff and prove safety by running code |
| `recall` | catch up on recent working context from chat history, live state, and the shared record |
| `setup-pstack` | configure pstack per-role model choices and per-family requested effort |
| `unslop` | clean up writing by removing AI tells |
| `no-comments` | strip comments before review via the `comment-sicko` agent, then fix what it finds |
| `create-verification-skill` | generate a project-local verification skill and feature map |
| `maintain-verification-skill` | re-sync a drifted verification skill and its feature map |
| `deslop` | deslop a diff before commit |
| `babysit` | monitor an open PR, fix CI/comments, keep it merge-ready |
| `thermo-nuclear-code-quality-review` | extremely strict maintainability audit |
| `make-pr-easy-to-review` | clean noisy history and improve PR description before review |
| `fix-ci` | find failing PR checks, inspect logs, apply focused fixes |
| `fix-merge-conflicts` | non-interactively resolve merge conflicts, validate, finalize |
| `get-pr-comments` | fetch and summarize review comments from the active PR |
| `what-did-i-get-done` | summarize authored commits over a user-chosen period |

## Subagents

`poteto-agent` ships unchanged. Dispatch it as a native omp task agent by name.

`comment-sicko` is the read-only comment reviewer the `no-comments` skill dispatches. Upstream names it `Comment Sicko`; the port renames it to `comment-sicko` so the name works as an omp agent. Invoke it through `no-comments`, not directly.

The native lanes are keyed by omp's bundled roles: `pstack-scout`, `pstack-designer`, `pstack-reviewer`, `pstack-security-reviewer`, `pstack-librarian`, `pstack-task`, and `pstack-sonic`. Each lane's frontmatter carries the wrapped role's omp role alias and tool surface; on omp the model and effort resolve through `task.agentModelOverrides`, and the lanes deny nested task dispatch. pstack dispatches them from provider-qualified descriptors; they are not user-facing workflows.

## Differences from upstream

The port is editorial, not mechanical. Anywhere upstream pstack assumed Cursor-specific primitives, this port substitutes the omp equivalent so refs actually resolve. Two prior ports ([v1truv1us/ai-eng-system](https://github.com/v1truv1us/ai-eng-system), [Evan-Kim2028/agent-fleet](https://github.com/Evan-Kim2028/agent-fleet)) stop at namespacing — they vendor pstack under `pstack/` and leave the Cursor refs intact. This port does the content surgery.

### What's added

- **`skills/babysit/`** — omp analog of Cursor's closed-source `/babysit` built-in. Wraps `gh pr view` / `gh pr checks` / `gh run view --log-failed` plus paced re-checking. Independently authored; workflow informed by Cursor's public `/babysit` behavior — not a copy of Cursor's implementation. Since the v0.14.2 sync, poteto-mode routes PR-status requests to the ported `playbooks/babysit.md` instead, and this skill is the standalone `babysit` entry point.
- **`skills/deslop/`** — imported verbatim from `cursor-team-kit`. Cleans AI tells out of diffs before commit.
- **`skills/thermo-nuclear-code-quality-review/`** — imported verbatim from `cursor-team-kit`. Used as the harsher-critique escape hatch in `arena`, `interrogate`, `architect`, and `how` (replaces the Cursor-original cross-vendor bridge).
- **`skills/make-pr-easy-to-review/`** — imported verbatim from `cursor-team-kit`. Composes with `opening-a-pr` and `babysit`.
- **`skills/fix-ci/`** — imported verbatim from `cursor-team-kit`. Narrower CI-fix primitive that `babysit` can route to.
- **`skills/fix-merge-conflicts/`** — imported verbatim from `cursor-team-kit`. Pairs with `babysit` step 5.
- **`skills/get-pr-comments/`** — imported verbatim from `cursor-team-kit`. Primitive for `babysit` step 4 and `reflect`.
- **`skills/what-did-i-get-done/`** — imported verbatim from `cursor-team-kit`. Commit summary over a chosen period.

### What's substituted in skill bodies

| Upstream (Cursor) | This port (omp) |
| --- | --- |
| `Task` tool, `subagent_type: generalPurpose`, `readonly: false/true` | `task` tool with a named `agent` and access mode assigned by the parent; writers isolated in worktrees |
| `AskQuestion` tool | the `ask` tool |
| Cursor's built-in `/loop` | paced re-runs driven by the agent (`hub` wait between checks) |
| Cursor's built-in `/babysit` | `babysit` skill bundled in this plugin; PR-status requests route through `playbooks/babysit.md` |
| Cursor's built-in `/create-skill` | SKILL.md authoring discipline (name plus description frontmatter, progressive disclosure) |
| `cursor-team-kit` `control-cli` (CLI/TUI driver) | drive the CLI yourself via `bash` (PTY for interactive programs, `hub` managed process for long-running ones) |
| `cursor-team-kit` `control-ui` (browser/Electron driver) | the `browser` tool |
| Transcripts at `~/.cursor/projects/*/` or `agent-transcripts/` | omp session transcripts under your omp data root |
| Skill paths `.cursor/skills/`, `~/.cursor/plugins/` | `skill://<name>` resolution from the installed plugin |
| MCP discovery via Cursor's `mcps/` directory | `mcp://` internal URLs and the MCP tools in the system prompt |
| Cursor cloud agents (`environment: "cloud"`, `cloud_base_branch`) | local background `task` jobs, isolated by git worktree |
| Cursor's `/goal` (standing objective across turns) | The program objective written into the run's standing orders and restated in the todolist |
| The Cursor agent store (path in the system prompt) | `~/.omp/orchestrate/<project-slug>/`, the store directory the orchestrate playbook passes to the `orch` script |
| Model rule `~/.cursor/rules/pstack-models.mdc` | `task.agentModelOverrides` in `~/.omp/agent/config.yml` |
| Multi-model panels (arena, architect, interrogate, how-critics) | Provider dispatch keeps the upstream frontier quad: `claude:claude-fable-5@max`, `codex:gpt-5.6-sol@max`, `grok:grok-4.6@xhigh`, `claude:claude-opus-5@xhigh`. Lane agents run native; external lanes use the bundled runner. |

### Cross-vendor dispatch

The bundled runner keeps upstream's cross-provider judgment signal without adding a daemon or model-router service. omp dispatches the mapped lanes natively and shells out to the claude, codex, and Grok CLIs for external lanes. The top-level parent chooses every route and each external process receives a complete task directly, so there is no supervising model invocation and no child-side harness detection.

### What's deliberately kept

- The `poteto-agent` name and all references to it.
- Background dispatch with retained handles on every task job.
- The principle/playbook structure and every word of the principles themselves.

### What's deliberately not ported

- **`automations/benny/`** (upstream `0452e08`) — a dormant Slack issue-triage automation pack built on Cursor's event-triggered automations. Porting it would require Cursor's event-triggered runtime, Slack, and tracker plumbing this distribution does not provide.
- **`docs/guide/`** (upstream `02c03a9`, `0b7ef5b`, `424829e`) — the ten-chapter usage tutorial and its screenshots teach pstack through Cursor's UI, sticky mode, and cloud agents; a faithful port would be a rewrite rather than a sync. Read it upstream at [cursor/plugins/pstack/docs/guide](https://github.com/cursor/plugins/tree/main/pstack/docs/guide); the concepts map through the substitution table above.
- **Sticky mode** (upstream `#144`) — Cursor-only `mode`/`icon`/`color`/`reminder` frontmatter with no omp equivalent. The always-apply mandate rule carries the non-trivial / trivial / opt-out routing.
- **`make-bot-ui`** (upstream `799151d`, `6fecddb`) — every mechanic is a Cursor product surface (the `update_state` routine tool, the Routines panel, `api2.cursor.sh` webhooks, `SendToUser` secret-request cards) with no omp mapping.
- **`cursor-team-kit` beyond the seven imported skills** — the rest either duplicate omp built-ins (`verify-this` → built-in verification discipline; `check-compiler-errors` → the `lsp` tool; `control-cli`/`control-ui` → `bash`/`browser`, already the substitution targets) or overlap skills this port ships (`loop-on-ci`, `review-and-ship`, `weekly-review` vs `babysit`, `fix-ci`, `make-pr-easy-to-review`, `what-did-i-get-done`). `pr-review-canvas` is Cursor-UI-specific.

### Forking note

Editing skill bodies forks this from upstream. Re-syncing to a future pstack release means re-applying the substitution table. The full re-port recipe is in [CHANGES.md](../CHANGES.md).

## License

MIT. Two upstream LICENSE files are preserved:

- [LICENSE](../LICENSE) — pstack (Lauren Tan)
- [LICENSE-cursor-team-kit](../LICENSE-cursor-team-kit) — Cursor (covers the `deslop` and `thermo-nuclear-code-quality-review` skills)
