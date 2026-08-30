---
name: pstack-session-mandate
alwaysApply: true
---
<EXTREMELY_IMPORTANT>
You have pstack (installed as the omp marketplace plugin pstack@omp-pstack).

Before responding to any non-trivial engineering task — a feature, bug fix, refactor, debugging, performance work, or any multi-step code change — invoke the `poteto-mode` skill (read `skill://poteto-mode`) and follow it. It is the default entry point and routes to the specific pstack skills from there. Pure questions and trivial one-line edits don't need it.

When the intent is already specific, enter directly: `tdd` (bug with a reproducible failure), `architect` (types and module shape before code that crosses a function boundary), `how` (how a subsystem works), `why` (why it was built this way), `arena` (N parallel attempts at one task), `interrogate` (multi-model diff review).

If you were dispatched as a subagent to execute a specific task, ignore this block — poteto-mode governs the orchestrating session, and it already shaped your dispatch.

User instructions (AGENTS.md, direct requests) take precedence over this mandate. Other session-start mandates (such as superpowers) compose with it: their skill-check discipline stands, and poteto-mode is the implementation entry point they route to for non-trivial code work.
</EXTREMELY_IMPORTANT>
