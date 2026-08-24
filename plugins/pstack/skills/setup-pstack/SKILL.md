---
name: setup-pstack
description: Configure pstack's provider-qualified models and parent-owned routes per role. Verifies native and external Claude, Codex, and Grok lanes before writing the override sheet. Use for /setup-pstack, "configure pstack models", or changing pstack's model choices.
---

# Setup pstack

Configure one portable model sheet for the current parent harness. Read [`provider-dispatch.md`](../poteto-mode/references/provider-dispatch.md) before probing or writing anything. Its descriptor grammar and route table are the contract.

Claude Code writes `~/.claude/pstack-models.md` and loads it from `~/.claude/CLAUDE.md` with:

```text
@~/.claude/pstack-models.md
```

Codex writes `~/.codex/pstack-models.md`. Codex has no `@` include, so add the sheet's routing block to `~/.codex/AGENTS.md` and retain the sheet as the editable source of truth.

## Steps

### 1. Establish the parent

Use the harness and tool surface running this skill: Claude Code or Codex. Environment markers may corroborate that top-level answer, but do not launch a child and ask it to detect where it came from. Record the parent because the same descriptor takes a different route in each harness.

### 2. Probe each frontier lane

Check the four current frontier choices before presenting configuration. Do not enumerate or offer older models as substitutes.

| Descriptor | Claude parent route | Codex parent route | Availability proof |
|---|---|---|---|
| `claude:claude-fable-5@max` | native `pstack-fable-max` Agent | Claude CLI | native schema/one-turn probe or `claude auth status --json` plus one-turn probe |
| `codex:gpt-5.6-sol@max` | `codex exec` | native `spawn_agent` | `codex login status` plus one-turn probe or native schema/one-turn probe |
| `grok:grok-4.6@xhigh` | Grok CLI | Grok CLI | `grok models` must list `grok-4.6`; one-turn probe |
| `claude:claude-opus-5@xhigh` | native `pstack-opus-xhigh` Agent | Claude CLI | native schema/one-turn probe or `claude auth status --json` plus one-turn probe |

Use a tiny read-only probe that returns a unique marker. A login-status command alone proves credentials, not that the requested model runs. Record native and external results separately. Never call the external launcher for the parent's own provider.

### 3. Load current state

Read the current parent-specific sheet when it exists. Treat its values as current choices. Otherwise start from the upstream frontier defaults in step 5. A bare host-native slug from an older sheet is invalid here because it does not say which provider owns it.

### 4. Show exactly what will run and confirm

Show the route table for this parent, then show every role and descriptor. Ask whether to use the upstream frontier stack as-is or change named roles. The question must name the four choices, not abstract them into tiers:

> Use Fable 5 at max, GPT-5.6 Sol at max, Grok 4.6 at xhigh, and Opus 5 at xhigh for the multi-model panels, with the upstream single-role assignments below?

Offer only descriptors that passed their actual model probe, plus `inherit-parent` and `auto`. For panel roles, one lane runs per entry. The list length is the fan-out count. `arena cross-judge pool` is a list from which Arena chooses a provider different from the parent and base candidate when possible. `swarm workers` is the default for every worker unless a race explicitly assigns another descriptor.

### 5. Validate and write the sheet

Every non-alias value must match `<provider>:<model>@<effort>` and must have passed step 2. Refuse an unqualified slug, an unavailable route, a model other than the current frontier four, or a provider/model mismatch. `inherit-parent` and `auto` always validate, but say when they reduce a panel's provider diversity.

Why and Reflect require the parent's live MCP surface. Keep their investigator, reviewer, and synthesizer roles on `inherit-parent` or `auto`; the bounded external runner deliberately omits ambient MCPs.

After the operator confirms, overwrite the whole parent-specific sheet so reruns are idempotent:

```markdown
# pstack model configuration

Provider-qualified per-role choices. Read the installed pstack provider-dispatch reference before dispatching a configured role. Delete a line to use the skill default. `inherit-parent` and `auto` use the parent model natively and still count as one panel lane.

feature, refactoring: grok:grok-4.6@xhigh
bug-fix: codex:gpt-5.6-sol@max
perf-issue: codex:gpt-5.6-sol@max
hillclimb: codex:gpt-5.6-sol@max
judgment and prose: claude:claude-fable-5@max
hardest tasks: claude:claude-fable-5@max
how explorer: grok:grok-4.6@xhigh
how explainer: claude:claude-fable-5@max
how critics: claude:claude-fable-5@max, codex:gpt-5.6-sol@max, grok:grok-4.6@xhigh, claude:claude-opus-5@xhigh
why investigators, synthesizer: inherit-parent
reflect tooling, judgment, divergent, synthesizer: inherit-parent
arena runners: claude:claude-fable-5@max, codex:gpt-5.6-sol@max, grok:grok-4.6@xhigh, claude:claude-opus-5@xhigh
arena cross-judge pool: claude:claude-fable-5@max, codex:gpt-5.6-sol@max, grok:grok-4.6@xhigh, claude:claude-opus-5@xhigh
swarm workers: grok:grok-4.6@xhigh
architect runners: claude:claude-fable-5@max, codex:gpt-5.6-sol@max, grok:grok-4.6@xhigh, claude:claude-opus-5@xhigh
interrogate reviewers: claude:claude-fable-5@max, codex:gpt-5.6-sol@max, grok:grok-4.6@xhigh, claude:claude-opus-5@xhigh
```

### 6. Wire it in

On Claude, add the `@~/.claude/pstack-models.md` include only if absent. On Codex, update the existing pstack routing block in `~/.codex/AGENTS.md` rather than appending duplicates. Do not copy the model sheet between harnesses without rerunning the parent-specific probes; route availability can differ even on the same host.

### 7. Behavioral smoke

Before declaring setup complete, run one small read-only mixed panel from this parent: all four descriptors, distinct output/receipt paths, and an independent cross-judge. Launch Claude-native agents and every external process in the background with retained handles, then drain them. Verify the native transcript entries and every external receipt. A structural config check or unit test is not a substitute.

Report the sheet path, parent route table, model-probe results, smoke results, and external elapsed/token/cost receipts. Re-running this skill re-probes and updates the same sheet.
