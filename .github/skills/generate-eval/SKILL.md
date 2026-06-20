---
name: generate-eval
description: >
  Generate (author) an evaluation suite of *.eval.yaml question files for a Power BI report or
  semantic model, grounding every expected answer by querying the live object via FabricIQ. Use
  when the user wants to: (1) generate or create an eval set/suite for an object, (2) author
  evaluation questions for a report or semantic model, (3) build a Quick/Solid/Custom eval.
  Triggers: "generate an evaluation suite for", "create an eval set for", "author evals for",
  "build me a quick/solid/custom eval for", "make evaluation questions for".
---

# Generate Evaluation

Author a folder of `*.eval.yaml` files for a target object (a Power BI **report** or **semantic
model**), with **grounded** expected answers, and save it under `my-evaluation-suites/`.

## When to use
- The user names a target object (report/semantic model — by name, name+workspace, or URL) and
  asks to generate, author, create, or build an evaluation suite or eval questions for it. The
  suite is **primarily aimed at FabricIQ targets** (Power BI reports, semantic models, dashboards)
  but is tool-agnostic.

## How it works
This skill delegates to the **`eval-generator`** agent
(`.github/agents/eval-generator.agent.md`), which owns the full workflow. The schema for the
files it writes is defined in `docs/format-reference.md`.

## Workflow Steps
1. **Capture the target and any context.** Get the target object from the user (name,
   name+workspace, or URL) plus any extra context (tenant, environment). If the target is
   missing, ask for it.
2. **Pick the complexity tier.** Ask the user which they want (if not already stated):
   - **Quick Eval** — one multi-turn conversation, 5–20 turns.
   - **Solid Eval** — 5–15 multi-turn conversations, each 5–20 turns, covering different areas.
   - **Custom Eval** — ask the user for counts (how many conversations, how many individual
     questions) and which areas/topics to cover.
3. **Invoke `eval-generator`.** Hand it the target, the tier (and Custom parameters), and any
   extra context, verbatim. The agent will:
   - Resolve the target to concrete IDs (workspace/report/semantic model).
   - Inspect its real structure (visuals/fields or tables/measures) enough to author questions.
   - Draft multi-turn conversations that start from scratch (find the object) and include
     realistic follow-up/drill-down turns.
   - **Ground every `expected` answer** by querying the live object; add focused `assertions`.
   - Write `my-evaluation-suites/<slug>/` with `seq-*.eval.yaml` (and `individual.eval.yaml` for
     Custom) plus a suite `README.md` — never overwriting an existing folder.
4. **Report back.** Surface the resolved object(s), the tier, the files written, and the command
   to run the new suite (`Run an evaluation on my-evaluation-suites\<slug>`).

## Guardrails
- Never fabricate values, IDs, or labels — every `expected`/`assertion` must come from a real
  tool result obtained while inspecting the object.
- Every conversation must start from scratch with a "find the object" opening turn.
- Emit YAML conformant to `docs/format-reference.md` (sequence → `turns:`, individual →
  `questions:`).
- Never overwrite an existing suite folder or file; choose a unique slug.
- If the target cannot be resolved or its type is unclear, stop and ask the user.
