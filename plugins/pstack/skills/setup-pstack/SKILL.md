---
name: setup-pstack
description: Configure pstack's provider-qualified models, per-family requested effort, and parent-owned routes per role. Verifies native and external lanes before writing the override sheet. Use for /setup-pstack, "configure pstack models", or changing pstack's model choices.
---

# Setup pstack

Configure one portable model sheet for omp. Read [`provider-dispatch.md`](../poteto-mode/references/provider-dispatch.md) before probing or writing anything. Its provider panel, descriptor grammar, and route table are the contract. Choose one requested effort per panel family the registry can serve. Do not add a second configuration file, a runtime resolver, or a weaker-model fallback.

omp (Oh My Pi) has no sheet include and no second file. The live sheet is `task.agentModelOverrides` in `~/.omp/agent/config.yml`, and the seven `pstack-<omp-role>` lane agents are its role surface. Render one row per lane, with the lane's selector carrying its effort as an omp thinking level:

```text
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

## Steps

### 1. Establish the parent

omp is the parent; this distribution installs nowhere else. Confirm the omp tool surface is what is running this skill, and do not launch a child and ask it to detect where it came from.

### 2. Load current state

The current state is the set of `pstack-*` keys under `task.agentModelOverrides`. Every key must carry an explicit `:level` suffix from the effort universe, and a key that is not one of the seven shipped role lane names is inconsistent state. A bare host-native slug from an older sheet is invalid because it does not say which provider owns it. If the keys are missing, use the complete first-run role map and the panel's Default effort cells.

### 3. Parse per-family efforts

Read the provider panel. Every non-alias value must match `<provider>:<model>@<effort>`. Map it to exactly one panel family by `(provider, model)` and require its effort to appear in that row's Selectable efforts cell. A provider and model the panel does not list is registry-native: `omp models` must list it, and its effort must be one of the thinking levels the registry lists for that model. `inherit-parent` and `auto` rows carry no family effort.

A provider and model listed by neither the panel nor the registry, an out-of-domain effort, a duplicate role, or an unknown role is inconsistent state. Stop, show the conflicting rows verbatim, and ask for an explicit panel family, a registry-listed selector, or an alias replacement. If one or more families have mixed efforts, show every conflicting family and role row, then ask for one normalized effort per family from its Selectable efforts cell. Do not invent a precedence rule. Do not probe or write while any inconsistency is unresolved.

One distinct effort per family is the current value. A family with no non-alias occurrence is unassigned; use its panel Default effort as the proposed value and label it unassigned rather than calling it current.

### 4. Collect one requested effort per family

Ask one effort question per panel family the registry can serve, covering Fable, Sol, Grok, and Opus only where `omp models` lists their models. Name each model, its current or proposed value, and the Selectable efforts from its panel row. Empty input keeps a current value or accepts the panel proposal for an unassigned family. On a first run, state the panel defaults for the servable families before asking. On a rerun, state the parsed values without offering to reset customized role lanes.

When the registry serves none of the panel families, say so and run a registry-native first run instead: ask one selector per uncovered lane from the models `omp models` lists, each with its listed thinking levels as the effort choices. Do not offer a family or selector the registry cannot serve.

### 5. Probe the four requested pairs

Probe only the selected `provider:model@effort` pairs: the probed panel families plus any registry-native selector. Run one probe per family, even when two families share a provider. Do not enumerate or offer older models as substitutes. A failed probe writes nothing: report the failing pair and provider, stop, and keep the active config unchanged. A failed first run creates no artifact.

| Family | Pair source | omp route | Availability proof |
|---|---|---|---|
| Fable | Fable panel row + selected effort | native `task` lanes `pstack-<omp-role>` for fable-mapped roles | `omp models` lists the selector plus one-turn lane probe |
| Sol | Sol panel row + selected effort | `codex exec` CLI if installed, otherwise a named unconfigured family | `codex login status` plus one-turn probe |
| Grok | Grok panel row + selected effort | Grok CLI if installed, otherwise a named unconfigured family | `grok models` must list the requested model; one-turn probe |
| Opus | Opus panel row + selected effort | native `task` lanes `pstack-<omp-role>` for opus-mapped roles | `omp models` lists the selector plus one-turn lane probe |
| Registry-native | operator-chosen selector + selected effort | native `task` lanes `pstack-<omp-role>` | `omp models` lists the selector plus one-turn lane probe |

Use a tiny read-only probe that returns a unique marker. A login-status command alone proves credentials, not that the requested model and effort flags run. Record native and external results separately. Prove every requested selector in the registry first: `omp models` must list it, and one live `omp -p --no-extensions --model <provider>/<model>:<level>` marker probe must print the marker; a selector omp cannot resolve is a failed probe. Native lanes then prove themselves in a one-turn `task` dispatch of the mapped `pstack-<omp-role>` agent.

Receipts and native transcripts prove the requested effort and the route. They do not prove a provider's hidden applied reasoning depth. There is no implicit timeout, weaker-model fallback, or second mutable configuration source.

### 6. Render, preserving role families

Build the new sheet in memory. Do not write it yet.

- First run: start from the complete role assignments in step 7.
- Rerun: start from the normalized complete role map from step 2, preserving each loaded row's lane order and family (or alias) per lane.

After effort selection, ask whether to keep those role-to-family assignments or change named roles. Keeping them is the default. Apply only role changes the operator names; never offer a reset of a customized sheet to the first-run assignments. A changed role may use one of the four probed panel families, a registry-native selector that passed step 5, `inherit-parent`, or `auto`.

Require the final role map to contain at least one descriptor from each selected panel family; on a registry-native run, require one valid selector per uncovered lane. The sheet stores effort only in role descriptors, so an unassigned family's selection cannot persist without adding a second source of truth.

Rewrite every panel-family descriptor to `provider:model@<requested effort for that family>`. Leave `inherit-parent` and `auto` unchanged. An effort-only rerun cannot change a role's family. Changing Grok's effort updates every Grok occurrence and does not move a Sol role onto Grok. Refuse an unqualified slug, an unavailable route, a selector that is neither a probed panel family nor registry-listed, or a provider/model mismatch. Render the seven per-lane rows shown in the sheet format above: the lane name carries the omp role, its selector comes from that lane's assigned family, and each row's `:level` equals that selector's effort component. On a first run every lane takes the judgment family's selector; a rerun preserves each loaded lane's family, and the operator may point any lane at any probed family or registry-native selector.

### 7. Confirm and commit

Show the route table, then show every rendered role and descriptor. Ask for confirmation before writing.

Why and Reflect require the parent's live MCP surface. Keep their investigator, reviewer, and synthesizer roles on `inherit-parent` or `auto`; the bounded external runner deliberately omits ambient MCPs. `inherit-parent` and `auto` always validate, but say when they reduce a panel's provider diversity. For panel roles, one lane runs per entry. The list length is the fan-out count. `arena cross-judge pool` is a list from which Arena chooses a provider different from the parent and base candidate when possible. `swarm workers` is the default for every worker unless a race explicitly assigns another descriptor.

Every non-alias value must match `<provider>:<model>@<effort>` and must have passed step 5.

After the operator confirms, write the in-memory render from step 6. Never paste the example below as the result. It is only the complete first-run role map used to seed step 2; selected efforts and explicit role changes always replace its example values before writing.

```markdown
# pstack model configuration

Provider-qualified per-role choices. Read the installed pstack provider-dispatch reference before dispatching a configured role. Every documented role remains present. `inherit-parent` and `auto` use the parent model natively and still count as one panel lane.

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

### 8. Wire it in

`~/.omp/agent/config.yml` is live config, so the write itself is the wiring. Snapshot the file, merge only the seven `pstack-*` lane keys under `task.agentModelOverrides`, and note that changes apply to new omp sessions. Read the file back and compare it with the in-memory render. If the write or readback fails, restore the snapshot and report the failure. An unchanged rerun must produce a byte-identical config after normalization.

Do not copy the model sheet between machines without rerunning the probes; route availability can differ per host.

### 9. Behavioral smoke

Before declaring setup complete, run one small read-only mixed panel: all four chosen descriptors, distinct output/receipt paths, and an independent cross-judge. Launch native agents (omp `task` lanes) and every external process in the background with retained handles, then drain them. Verify the native transcript entries and every external receipt. A structural config check or unit test is not a substitute.

Report the config path, route table, requested-effort probe results, smoke results, and external elapsed/token/cost receipts. Re-running this skill re-probes and updates the same config. Do not claim the provider exposed hidden applied-effort observability.
