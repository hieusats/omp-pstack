# omp-pstack

[![CI](https://github.com/hieusats/omp-pstack/actions/workflows/ci.yml/badge.svg)](https://github.com/hieusats/omp-pstack/actions/workflows/ci.yml)
[![Latest release](https://img.shields.io/github/v/release/hieusats/omp-pstack)](https://github.com/hieusats/omp-pstack/releases/latest)
[![MIT license](https://img.shields.io/github/license/hieusats/omp-pstack)](LICENSE)

**omp-pstack brings [Lauren Tan (@poteto)](https://x.com/poteto)'s [pstack](https://github.com/cursor/plugins/tree/main/pstack) to omp (Oh My Pi).** It stays close to her original work and translates only the parts that depend on Cursor. Since 2.0.0 this is an omp-only distribution. The Claude Code and Codex targets are gone.

Lauren built pstack from the skills she uses to ship code at Cursor. In a [55-minute interview with Denis Labelle](https://x.com/DenisLabelle/status/2091337807939706928), she says that she shipped 1,000 pull requests in one month after steadily improving how her agents work and verify their results.

> If you want to go fast, go deep first.

omp-pstack is an unofficial community project. If Cursor is your main coding environment, use [Lauren's original pstack](https://github.com/cursor/plugins/tree/main/pstack). If omp is your main coding environment, use this repository.

## What pstack does

pstack is a plugin for coding agents. It is not a new model or a hosted service. It gives your agent engineering rules, step-by-step workflows for different kinds of work, focused skills, and small local tools.

The normal entry point is `poteto-mode`. You give it a task in plain language. It then:

- reads the task and chooses a workflow that fits
- learns how the current system works before changing it
- compares designs when the choice matters
- favors small, simple changes over extra machinery
- asks several models to challenge important decisions when useful
- runs the code and checks real behavior instead of stopping at "the tests pass"
- carries the work through review, continuous integration (CI), and a ready-to-merge pull request when asked

How pstack routes a task from plain language to a review-ready pull request:

```text
                   +-----------+
                   | YOUR TASK |
                   +-----------+
                         |
                         v
                  +-------------+
                  | POTETO-MODE |  <-- chooses the playbook
                  +-------------+
                         |
   +------------+--------+---+-------------+
   v            v            v             v
+-----+   +-----------+   +-----+   +-------------+
| HOW |   | ARCHITECT |   | TDD |   | INTERROGATE |
+-----+   +-----------+   +-----+   +-------------+
   |            |            |             |
   +------------+--------+---+-------------+
                         |
                         v
                 +----------------+
                 | REAL-APP PROOF |  <-- runs the product
                 +----------------+
                         |
                         v
                +-----------------+
                | REVIEW-READY PR |
                +-----------------+
```

pstack does not ask you to trust an agent on day one. It helps the agent leave evidence you can inspect. Start with supervised work. Let it run more work in parallel only after its checks have earned that trust in your own repositories.

## Install

You need a current omp installation. For the full four-model review, install and sign in to the claude, codex, and Grok command-line tools. [Bun](https://bun.sh) runs the small local tool that starts models outside the app you are using. You can still use the core workflows with fewer models.

```shell
omp plugin marketplace add hieusats/omp-pstack
omp plugin install pstack@omp-pstack
```

omp discovers the skills under flat names (`/skill:architect`, `skill://poteto-mode`) and the nine agents natively. The startup mandate ships as an always-apply rule (`rules/pstack-session-mandate.md`) that omp injects into every session automatically. See [docs/omp.md](docs/omp.md). Then run setup-pstack to map the model lanes in `~/.omp/agent/config.yml`.

## Get started

Setup has two steps.

### 1. Set up the models

Ask omp:

```text
Use the setup-pstack skill to configure pstack models.
```

Setup checks the models you can actually run, shows how each one will start, and asks before saving the choices. The current default group uses Fable 5, GPT-5.6 Sol, Grok 4.6, and Opus 5.

### 2. Use poteto-mode

Start any task that needs careful engineering with `poteto-mode`:

```text
/skill:poteto-mode Add saved filters to search. Keep the design simple, verify it in the real app, and open a pull request.
```

For that feature, poteto-mode should first understand how search works today. It should decide how the data should be represented before writing code, implement the smallest complete version, run the feature the way a user would, review the result, and prepare the pull request.

That is the main workflow. The other skills are there when poteto-mode needs them or when you want to call one directly.

## Useful skills

| Skill | Use it when |
| --- | --- |
| `how` | You want a clear explanation of how part of the system works. |
| `why` | You want evidence for why the system was built that way. |
| `architect` | A change crosses a function or module boundary and the design needs to be settled first. |
| `arena` | You want several complete attempts, followed by a comparison of their best parts. |
| `interrogate` | You want different models to try to break a design or diff. |
| `create-verification-skill` | Your project has no repeatable way for an agent to prove real behavior. |
| `maintain-verification-skill` | The project's verification instructions no longer match the product. |
| `babysit` | A pull request needs CI failures and review comments handled until it is ready. |
| `reflect` | A hard task is finished and its lessons should improve the next run. |

Invoke a skill as `/skill:<name>` (for example `/skill:architect`) or ask for it by name. See the [technical reference](docs/reference.md) for the full list.

## Models and token use

Some pstack workflows use one model. Skills such as `architect`, `arena`, and `interrogate` can run several models in parallel. Each model run uses the subscription and token allowance of its own command-line tool.

`setup-pstack` lets you choose the models, one requested effort per model family, and how many run in parallel. Lane agents mapped in `~/.omp/agent/config.yml` run as native omp task agents. Other models run through their own command-line tools. omp-pstack does not quietly replace a failed model with a weaker one.

Grok takes part in a multi-model review as an external lane.

## Learn more

Lauren's [pstack guide](https://github.com/cursor/plugins/tree/main/pstack/docs/guide) walks through a real task, verification, and longer unattended runs. It uses Cursor's interface, but the ideas are the same. Use the translated skill invocations above in omp.

This repository also keeps:

- [the original README](README-UPSTREAM.md), unchanged
- [the technical reference](docs/reference.md) for every skill, dependency, and omp detail
- [the omp-specific doc](docs/omp.md) for install, the session mandate, and model lanes
- [the upstream sync record](UPSTREAM.md) and update process
- [the change record](CHANGES.md) for every adaptation
- [the attribution record](NOTICE.md) for pstack and the imported Cursor Team Kit skills

## Staying close to Lauren's pstack

omp-pstack 2.1.2 tracks pstack 0.14.5 at Cursor commit [`6fecddba65801f9b9c08b8b328d998ee5b09d290`](https://github.com/cursor/plugins/commit/6fecddba65801f9b9c08b8b328d998ee5b09d290).

The two projects have separate version numbers. The pstack version identifies Lauren's upstream content. The omp-pstack version identifies the omp package built from it.

In this repository, "upstream" means Lauren's original pstack. omp-pstack does not promise instant updates. It records the exact version it follows, reviews new changes in order, and changes only what omp requires. New pstack behavior belongs in Lauren's project first whenever possible.

## Contributing

Fixes for the omp distribution and help bringing over new pstack releases are welcome. Search [GitHub Issues](https://github.com/hieusats/omp-pstack/issues) before opening a new issue. For larger behavior changes, explain why the change belongs here instead of Lauren's original project.

Read [UPSTREAM.md](UPSTREAM.md) before changing content brought over from Lauren's pstack. Pull requests must keep one omp-first skill tree and pass the repository's tests, type checks, plugin validation, and static checks.

## License

MIT. pstack was created by Lauren Tan. omp-pstack builds on Michael Denyer's [pstack-claude](https://github.com/michael-denyer/pstack-claude) port and includes attributed MIT-licensed work from Cursor Team Kit. See [NOTICE.md](NOTICE.md) and the preserved license files for details.
