# ZHN-Dashboard_update — Evaluation Suite

Grounded evaluation suite for the Power BI report **ZHN-Dashboard_update**.

## Target object

| Property | Value |
| --- | --- |
| Report name | ZHN-Dashboard_update |
| Report ID | `f2184c01-51d2-49f5-a1ba-c9c9976518a9` |
| Workspace | ZHN-Operations (`17ef0e11-e0bc-4745-a9bf-3a9b140ee203`) |
| Semantic model | sm_hospital_operations (`ff7546f3-c842-4472-b6bb-d72329c82f89`) |

The report monitors hospital operational performance — bed occupancy, ED wait times,
staffing ratios, length of stay, encounters, and patient satisfaction — across the
hospitals North Campus, City General, and West Tower.

## Tier

**Quick Eval** — one multi-turn `sequence` conversation (8 turns).

## Files

| File | Type | What it covers |
| --- | --- | --- |
| `seq-capacity-drilldown.eval.yaml` | `sequence` | Opens the report, reviews headline KPIs, drills bed occupancy by hospital → North Campus units, then ED wait times and encounters/LOS. |

All `expected` values were grounded by live queries against the report's semantic model
(e.g. overall bed occupancy ≈94.2%, North Campus most occupied at ≈96.2%, North Campus ED
unit fully occupied at 100%, North Campus longest ED wait ≈30.5 min, Total Encounters 100,
Avg Length of Stay ≈0.64 days).

## How to run

> Run an evaluation on `my-evaluation-suites\zhn-dashboard-update`

The `eval-runner` agent discovers `seq-capacity-drilldown.eval.yaml`, executes the
conversation in one shared session, scores each turn, and writes a timestamped report into
a `reports/` subfolder (created on first run).
