---
name: run-evaluation
description: Kick off an evaluation run over a folder of authored questions and expected answers.
---

# Run Evaluation

Run the Copilot CLI validation framework against an eval folder, or a specific eval file, and produce a timestamped
report. The framework is primarily aimed at validating **FabricIQ** answers (Power BI reports,
semantic models, dashboards, soon the rest of Fabric up to Ontologies) but is tool-agnostic and works for any tool or topic.

## Examples

Running over a folder of eval files:

> Run an evaluation on `examples\retailpulse-eval`.

Running over a specific eval file:

> Run an evaluation on @examples\retailpulse-eval\conversation.eval.yaml

Passing extra run context (forwarded to the answering sub-agents):

> Run an evaluation on `examples\retailpulse-eval` for Fabric workspace ABC.

See `docs/format-reference.md` for the eval-file and report schemas.
