# omp (Oh My Pi)

omp-pstack is the omp distribution of pstack; omp is its only target. omp reads this repository's `.omp-plugin/marketplace.json` catalog and discovers skills, commands, tools, MCP servers, and the `agents/` directory from the installed plugin tree.

## Install

```shell
omp plugin marketplace add hieusats/omp-pstack
omp plugin install pstack@omp-pstack
```

Skills appear under flat names — `/skill:architect`, `/skill:poteto-mode`, `skill://poteto-mode` — because omp resolves skill names without the Claude Code `pstack:` prefix. The nine agents (`poteto-agent`, `comment-sicko`, and the seven `pstack-<omp-role>` lanes) are native omp task agents.

## Startup mandate

omp does not execute Claude-style `hooks.json`, so there is no hook to carry the mandate. The plugin instead ships the mandate as an omp-native always-apply rule at `plugins/pstack/rules/pstack-session-mandate.md`. omp's plugin rule discovery loads it from the installed plugin and injects its full content into every session's system prompt automatically; no manual setup step exists. The rule stays addressable as `rule://pstack-session-mandate`, defers to direct user instructions, and lets dispatched subagents ignore it.

To opt out, delete the `rules/` directory from the installed copy under `~/.omp/plugins/cache/plugins/omp-pstack___pstack_*_<version>/`; a plugin update restores it.

Versions before 1.3.0 asked you to paste the mandate into `~/.omp/agent/AGENTS.md`. That block is obsolete now; delete it if you still carry it, so the mandate is not injected twice.

## Model lanes

The seven lane agents wrap omp's bundled roles (`scout`, `designer`, `reviewer`, `security-reviewer`, `librarian`, `task`, `sonic`). Their frontmatter routes through omp role aliases (`@smol`, `@slow`, `@designer`, `@task`), so without setup each lane follows omp's default role routing instead of pstack's chosen model, and a selector's `:level` suffix is the only effort knob.

Run setup-pstack in omp once. It probes each selector through omp's registry (`omp models`, then a one-turn `omp -p --no-extensions --model <provider>/<model>:<level>` marker probe), and only after the probes pass writes seven `task.agentModelOverrides` rows into `~/.omp/agent/config.yml`:

```yaml
task:
  agentModelOverrides:
    pstack-scout: <provider>/<model>:<effort>
    pstack-designer: <provider>/<model>:<effort>
    pstack-reviewer: <provider>/<model>:<effort>
    pstack-security-reviewer: <provider>/<model>:<effort>
    pstack-librarian: <provider>/<model>:<effort>
    pstack-task: <provider>/<model>:<effort>
    pstack-sonic: <provider>/<model>:<effort>
```

`task.agentModelOverrides` is omp's first-priority model source for a task agent, so no agent file is forked and nothing else in the config is touched. Changes apply to new omp sessions. Codex and Grok lanes keep the upstream `pstack-runner` contract when those CLIs are installed and authenticated.

## Status line

The plugin ships a small runtime extension that draws one status line per omp session, keyed `pstack`. At session start it reads `task.agentModelOverrides` from `~/.omp/agent/config.yml` and reports the lane sheet as it finds it:

- no sheet rows (a fresh machine): `pstack: unconfigured - run /skill:setup-pstack`
- all seven lanes mapped: `pstack: configured - 7 lanes: <selector>, ...` — the distinct selectors in lane order, at most three shown, then `+N more`
- unknown `pstack-*` keys, invalid selectors, or missing lanes: `pstack: inconsistent - <problem>, ...` — at most two fragments shown, then `(+N more)`; an unreadable config file reports a `config unreadable: <reason>` fragment the same way

The line renders when omp's `statusLine.showHookStatus` is on (the schema default; opt out by setting it to `false` in `~/.omp/agent/config.yml`). It is drawn once per session start — no polling, no timers — and a failed draw never interrupts the session.
