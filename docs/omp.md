# omp (Oh My Pi)

omp-pstack targets omp alongside Claude Code and Codex. omp reads this repository's `.omp-plugin/marketplace.json` catalog (its preferred path, byte-identical to the `.claude-plugin/marketplace.json` copy Claude Code reads) and discovers skills, commands, tools, MCP servers, and the `agents/` directory from the installed plugin tree.

## Install

```shell
omp plugin marketplace add hieusats/omp-pstack
omp plugin install pstack@omp-pstack
```

Skills appear under flat names — `/skill:architect`, `/skill:poteto-mode`, `skill://poteto-mode` — because omp resolves skill names without the Claude Code `pstack:` prefix. The twelve agents (`poteto-agent`, `comment-sicko`, and the ten `pstack-fable-*` / `pstack-opus-*` lanes) are native omp task agents.

## Startup mandate

omp does not execute Claude Code `hooks.json`, so the SessionStart hook Claude Code uses stays silent on omp. The plugin instead ships the mandate as an omp-native always-apply rule at `plugins/pstack/rules/pstack-session-mandate.md`. omp's plugin rule discovery loads it from the installed plugin and injects its full content into every session's system prompt automatically; no manual setup step exists. The rule mirrors `plugins/pstack/hooks/session-start-context.md` with omp's flat skill names, stays addressable as `rule://pstack-session-mandate`, and like the hook version defers to direct user instructions and lets dispatched subagents ignore it.

To opt out, delete the `rules/` directory from the installed copy under `~/.omp/plugins/cache/plugins/omp-pstack___pstack_*_<version>/`; a plugin update restores it.

Versions before 1.3.0 asked you to paste the mandate into `~/.omp/agent/AGENTS.md`. That block is obsolete now; delete it if you still carry it, so the mandate is not injected twice.

## Model lanes

The ten lane agents pin Cursor-native model names that omp's registry does not carry, and omp falls back silently to the parent model when an agent's frontmatter model cannot resolve. Without setup, every lane runs on whatever the session runs and the effort in each lane name is decorative.

Run setup-pstack in omp once. It probes each selector through omp's registry (`omp models`, then a one-turn `omp -p --no-extensions --model <provider>/<model>:<level>` marker probe), and only after the probes pass writes ten `task.agentModelOverrides` rows into `~/.omp/agent/config.yml`:

```yaml
task:
  agentModelOverrides:
    pstack-fable-low: <provider>/<model>:low
    pstack-fable-medium: <provider>/<model>:medium
    pstack-fable-high: <provider>/<model>:high
    pstack-fable-xhigh: <provider>/<model>:xhigh
    pstack-fable-max: <provider>/<model>:max
    pstack-opus-low: <provider>/<model>:low
    pstack-opus-medium: <provider>/<model>:medium
    pstack-opus-high: <provider>/<model>:high
    pstack-opus-xhigh: <provider>/<model>:xhigh
    pstack-opus-max: <provider>/<model>:max
```

`task.agentModelOverrides` is omp's first-priority model source for a task agent, so no agent file is forked and nothing else in the config is touched. Changes apply to new omp sessions. Codex and Grok lanes keep the upstream `pstack-runner` contract when those CLIs are installed and authenticated.
