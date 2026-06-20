# Evaluation Framework — Format Reference

This is the authoritative specification for the two file types the framework reads
(`*.eval.yaml`) and the report it writes (Markdown + JSON sidecar). It is written to be
human-editable and is the contract a future *question-generator* skill will target.

---

## 1. Eval files (`*.eval.yaml`)

An **eval file** is a YAML document describing a set of questions and their known
(expected) answers. There are two kinds, distinguished by the `type` field:

| `type`       | Grouping            | Execution context                              | File convention            |
| ------------ | ------------------- | ---------------------------------------------- | -------------------------- |
| `individual` | standalone questions | each question runs in a **fresh, isolated** session | `individual.eval.yaml`     |
| `sequence`   | one conversation     | all turns run in **one shared** session, in order   | `seq-<name>.eval.yaml`     |

A folder may contain **one** `individual` file and **any number** of `sequence` files.
You may also split individual questions across multiple `individual` files if you prefer;
the runner discovers every `*.eval.yaml` in the folder.

### 1.1 Top-level fields (both types)

| Field         | Required | Type   | Description                                                        |
| ------------- | -------- | ------ | ------------------------------------------------------------------ |
| `suite`       | yes      | string | Human-readable name of the set; shown in the report.              |
| `type`        | yes      | enum   | `individual` or `sequence`.                                       |
| `description` | no       | string | Free text describing the intent of the set.                       |
| `defaults`    | no       | map    | Default settings applied to every item (see below).               |
| `questions`   | type=individual | list | Required when `type: individual`. List of question items.   |
| `turns`       | type=sequence   | list | Required when `type: sequence`. Ordered list of turn items.  |

`defaults` keys:

| Key              | Type | Default | Description                                          |
| ---------------- | ---- | ------- | ---------------------------------------------------- |
| `pass_threshold` | int  | `70`    | Minimum `score` (0–100) counted as a pass.           |

### 1.2 Item fields (a `question` or a `turn`)

| Field            | Required | Type         | Description                                                                 |
| ---------------- | -------- | ------------ | --------------------------------------------------------------------------- |
| `id`             | yes      | string       | Stable identifier, unique within the file. Appears in the report.           |
| `question`       | yes      | string       | The prompt sent to Copilot.                                                 |
| `expected`       | yes      | string       | The known/golden answer (free text).                                        |
| `assertions`     | no       | list[string] | Natural-language checks the judge must verify; **all** should hold.         |
| `pass_threshold` | no       | int          | Per-item override of the suite/default threshold.                           |
| `tags`           | no       | list[string] | Free labels for filtering/grouping in the report.                           |

**`assertions` are scoring checks, not instructions to the answer.** They are evaluated by the
judge **after** the answer is produced, e.g. *"States a dollar figure close to $4.2 million."*
They are never shown to the answering agent. Any grounding/context the answerer should receive
(e.g. *"answer only from the RetailPulse report, not external data"*) must be written directly
into the `question` text.

### 1.3 Execution semantics

- **`type: individual`** — for each item the runner starts a **brand-new isolated session**
  (no memory of any other question, answer, or tool state). This simulates a user opening a
  fresh Copilot session per question.
- **`type: sequence`** — the runner starts **one** session and sends each `turn` in order on
  that same session. Turn *N* can rely on context established in turns *1 … N-1*. Each turn
  is still scored individually against its own `expected`/`assertions`.

### 1.4 Minimal examples

Individual:
```yaml
suite: My Individual Questions
type: individual
defaults:
  pass_threshold: 70
questions:
  - id: q1
    question: "What is 2 + 2?"
    expected: "4"
```

Sequence:
```yaml
suite: My Conversation
type: sequence
turns:
  - id: t1
    question: "Remember the number 7."
    expected: "Acknowledges and stores the number 7."
  - id: t2
    question: "What number did I ask you to remember?"
    expected: "7"
    assertions:
      - "Recalls the value from the previous turn"
```

---

## 2. Report files

After a run, the framework writes two files into `<input-folder>/reports/`:

- `eval-report-YYYYMMDD-HHMMSS.md` — human-readable.
- `eval-report-YYYYMMDD-HHMMSS.json` — machine-readable sidecar (same timestamp).

Timestamps (local time, 24-hour) ensure earlier reports are **never overwritten**.

### 2.1 Markdown report structure

1. **Run header** — timestamp, input folder, files evaluated, Copilot model/version.
2. **Summary table** — one row per suite: `# questions`, `# pass`, `# fail`, `average score`,
   plus a grand-total row.
3. **Per-item detail** — for every question/turn: `id`, question, expected, actual, `score`
   (0–100), pass/fail vs threshold, rationale, and a per-assertion pass/fail list.

### 2.2 JSON sidecar schema

```json
{
  "run": {
    "timestamp": "YYYY-MM-DDTHH:MM:SS",
    "input_folder": "string",
    "model": "string",
    "files_evaluated": ["string"]
  },
  "summary": {
    "total": 0,
    "passed": 0,
    "failed": 0,
    "average_score": 0.0
  },
  "results": [
    {
      "suite": "string",
      "type": "individual | sequence",
      "file": "string",
      "id": "string",
      "turn_index": 0,
      "question": "string",
      "expected": "string",
      "actual": "string",
      "score": 0,
      "pass_threshold": 70,
      "passed": true,
      "rationale": "string",
      "assertions": [
        { "text": "string", "passed": true }
      ],
      "error": null
    }
  ]
}
```

Notes:
- `turn_index` is `0` for individual questions; for sequence turns it is the 1-based order.
- `error` is `null` on success; on a parse/execution failure it holds a short message and
  `score` is `0`, `passed` is `false`.

---

## 3. Authoring guidelines

Eval files can be hand-written or produced by the **`generate-eval`** skill (the
`eval-generator` agent). When generated, the agent inspects the live target object (a Power BI
report or semantic model) and **grounds every `expected` answer by actually querying it** — so
the golden values, IDs, and counts are real, never fabricated. The same guidelines apply whether
you author by hand or generate:

- Keep `expected` answers concise but specific enough to judge against.
- Prefer **2–4 focused `assertions`** over one long one; each becomes a visible pass/fail.
- Pin grounding (which report, which data source, time range, etc.) directly in the `question`
  text — there is no separate constraints field.
- Give every item a meaningful, stable `id` — it is how results are tracked across reports.
- Raise `pass_threshold` for items where partial answers should not count as a pass.
