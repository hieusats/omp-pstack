# omp (Oh My Pi)

omp-pstack targets omp alongside Claude Code and Codex. omp reads this repository's `.claude-plugin/marketplace.json` catalog directly and discovers skills, commands, tools, MCP servers, and the `agents/` directory from the installed plugin tree.

## Install

```shell
omp plugin marketplace add hieusats/omp-pstack
omp plugin install pstack@omp-pstack
```

Skills appear under flat names — `/skill:architect`, `/skill:poteto-mode`, `skill://poteto-mode` — because omp resolves skill names without the Claude Code `pstack:` prefix. The twelve agents (`poteto-agent`, `comment-sicko`, and the ten `pstack-fable-*` / `pstack-opus-*` lanes) are native omp task agents.

## Startup mandate

omp does not execute Claude Code `hooks.json`, so the SessionStart hook that injects the poteto-mode dispatch mandate in Claude Code stays silent on omp. Port it once by adding the block below to `~/.omp/agent/AGENTS.md` (create the file if missing):

```markdown
# pstack session mandate

<EXTREMELY_IMPORTANT>
You have pstack (installed as the omp marketplace plugin pstack@omp-pstack).

Before responding to any non-trivial engineering task — a feature, bug fix, refactor, debugging, performance work, or any multi-step code change — invoke the `poteto-mode` skill (read `skill://poteto-mode`) and follow it. It is the default entry point and routes to the specific pstack skills from there. Pure questions and trivial one-line edits don't need it.

When the intent is already specific, enter directly: `tdd` (bug with a reproducible failure), `architect` (types and module shape before code that crosses a function boundary), `how` (how a subsystem works), `why` (why it was built this way), `arena` (N parallel attempts at one task), `interrogate` (multi-model diff review).

If you were dispatched as a subagent to execute a specific task, ignore this block — poteto-mode governs the orchestrating session, and it already shaped your dispatch.

User instructions (AGENTS.md, direct requests) take precedence over this mandate.
</EXTREMELY_IMPORTANT>
```

The block mirrors `plugins/pstack/hooks/session-start-context.md` with omp's flat skill names. Delete it to remove the mandate.

## Model lanes

The ten lane agents pin Cursor-native model names that omp's registry does not carry, and omp falls back silently to the parent model when an agent's frontmatter model cannot resolve. Without setup, every lane runs on whatever the session runs and the effort in each lane name is decorative.

Run setup-pstack in omp once. It probes each selector through omp's registry (`omp models`, then one one-turn `omp -p --no-extensions --model <provider>/<model>:<level>` marker probe per distinct clamped selector), clamps each lane effort to the nearest thinking level the model actually serves (ties upward), and only after the probes pass writes the sheet into `~/.omp/agent/config.yml`:

```yaml
modelRoles:
  pstack_fable: <provider>/<model>:<clamped effort>
  pstack_opus: <provider>/<model>:<clamped effort>
task:
  agentModelOverrides:
    pstack-fable-low: "@pstack_fable:low"
    pstack-fable-medium: "@pstack_fable:high"
    pstack-fable-high: "@pstack_fable:high"
    pstack-fable-xhigh: "@pstack_fable:max"
    pstack-fable-max: "@pstack_fable:max"
    pstack-opus-low: "@pstack_opus:low"
    pstack-opus-medium: "@pstack_opus:high"
    pstack-opus-high: "@pstack_opus:high"
    pstack-opus-xhigh: "@pstack_opus:max"
    pstack-opus-max: "@pstack_opus:max"
```

The example levels show a model that serves only `low`, `high`, and `max`: the render clamps `medium` and `xhigh` and writes the clamped level, so the config never claims a level omp would silently clamp at dispatch. Each family's selector lives in one `modelRoles` row; changing a panel model edits that single row and every lane follows. `task.agentModelOverrides` stays omp's first-priority model source for a task agent, so no agent file is forked and nothing else in the config is touched. Changes apply to new omp sessions. Codex and Grok lanes keep the upstream `pstack-runner` contract when those CLIs are installed and authenticated.
