---
name: generate-evaluation
description: Generate (author) an evaluation suite of *.eval.yaml files for a Power BI report or semantic model, with grounded expected answers.
---

# Generate Evaluation

Author a new evaluation suite for a target object (a Power BI **report** or **semantic model**)
and save it under `my-evaluation-suites/`. The generator inspects the object's real structure,
drafts realistic multi-turn conversations, and **grounds every expected answer by querying the
live object** via FabricIQ. Primarily aimed at **FabricIQ** targets, but tool-agnostic.

## Examples

By name:

> Generate an evaluation suite for the Retail Pulse report.

By name + workspace:

> Create a Solid eval for the Sales semantic model in workspace Contoso.

By URL:

> Build a Quick eval for https://app.powerbi.com/groups/<ws-id>/reports/<report-id>.

Custom tier:

> Generate a Custom eval for the Retail Pulse report: 3 conversations and 5 individual
> questions, covering revenue, margin, and regional breakdowns.

## Complexity tiers

- **Quick Eval** — one multi-turn conversation (5–20 turns).
- **Solid Eval** — multiple conversations (5–15), each 5–20 turns, covering different areas.
- **Custom Eval** — you specify how many conversations, how many individual questions, and which
  areas to cover.

Every conversation starts from scratch (it first finds the object), and includes realistic
follow-ups a real user would ask (e.g. "show me Growth by Region", "drill into the cities in WA
state"). Expected answers are real, grounded values.

See `docs/format-reference.md` for the eval-file schema, and run the result with the
`run-evaluation` prompt.
