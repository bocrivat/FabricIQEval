---
name: run-eval
description: >
  Run a validation/evaluation of Copilot CLI answers against a folder of authored questions
  and expected answers, then write a timestamped report. Use when the user wants to: (1) run
  or execute an eval set, (2) score Copilot's answers against expected answers, (3) validate
  answers for a questions folder. Triggers: "run an evaluation", "run the eval set",
  "evaluate the questions in", "validate Copilot against", "score the answers for".
---

# Run Evaluation

Execute the evaluation framework over a folder of `*.eval.yaml` files and produce a
timestamped Markdown + JSON report.

## When to use
- The user points at a folder of authored questions + expected answers and asks to run,
  execute, score, or validate them. The suite is **primarily aimed at validating FabricIQ
  answers** (Power BI reports, semantic models, dashboards) but is tool-agnostic and works for
  any tool or topic.

## How it works
This skill delegates to the **`eval-runner`** agent
(`.github/agents/eval-runner.agent.md`), which owns the full workflow. The schema for eval
files and reports is defined in `docs/format-reference.md`.

## Workflow Steps
1. **Resolve the folder and run context.** Get the eval folder path from the user; ask if it is
   missing or does not exist. Also capture any **extra context** in the invocation beyond the
   folder path (e.g. *"…for Fabric workspace ABC"* — a workspace, dataset, environment, tenant,
   time range, or target tool).
2. **Invoke `eval-runner`.** Hand it the folder path **and any extra run context, verbatim**, so
   the agent can forward that context to the sub-agents that actually answer the questions. The
   agent will:
   - Discover and validate every `*.eval.yaml` in the folder.
   - Execute `individual` questions in **isolated** sub-sessions (one fresh sub-agent each).
   - Execute each `sequence` file's turns in **one shared** sub-session, in order.
   - Judge each answer 0–100 with a rationale and per-assertion pass/fail.
   - Write `reports/eval-report-<timestamp>.md` and `.json` (never overwriting prior reports).
3. **Report back.** Surface the summary (total / pass / fail / average score) and the paths
   to the new report files.

## Guardrails
- Expected answers and assertions must never be passed into an answering sub-agent's prompt.
- Extra run context (e.g. a Fabric workspace name) **must** be forwarded to the answering
  sub-agents — it is not golden material.
- Reports are append-only via timestamped filenames; assume prior reports already exist.
- If no `*.eval.yaml` files are found, stop and tell the user.
