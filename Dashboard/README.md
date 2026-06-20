# Fabric IQ Eval — Dashboard

A **pure client-side** dashboard for browsing your evaluation history. No backend, no build
step, no dependencies — just three static files. Point it at a folder of eval suites and it
reads every `reports/eval-report-*.json` sidecar to show how your evaluations trend over time and
lets you drill into individual questions.

## How to run

Just open `index.html` in a modern browser (Chrome, Edge, or any Chromium-based browser):

- **Double-click `index.html`**, or
- drag it into a browser tab.

Then click **Choose eval folder…** and pick a folder that contains your suites — for example the
repo's `examples` folder, or a single suite folder like `examples/Lightweight`. The browser reads
the files locally; nothing is uploaded anywhere.

> The folder picker uses the directory `<input>` (`webkitdirectory`), which works even when the
> page is opened directly from disk (`file://`). Your browser may show a one-time "upload files to
> this site?" confirmation — that's the standard prompt for reading a local folder; the files stay
> on your machine.

## What it reads

It scans the chosen folder **recursively** for files named `eval-report-*.json` (the machine-
readable sidecars written by the `eval-runner` agent — see `../docs/format-reference.md`). The
human-readable `.md` reports are ignored. Each JSON file is treated as one **run** with a
timestamp, so you can have many runs per suite and watch quality evolve.

## What it shows

### Overview (default — aggregate)
- **KPI cards** — number of runs, latest average score, latest pass rate, question counts, each
  with the delta versus the previous run.
- **Score & pass-rate over time** — a line chart of every run's average score and pass rate, so
  you can see the evolution of your evaluations across changes.
- **Latest run by suite** — per-suite totals, pass/fail, and average score.
- **All runs** — a table of every run (newest first). Click a row to jump straight to that run's
  questions.

### Questions (drill-down — per question)
- Pick any run (defaults to the latest), search by id / question text, or show **failures only**.
- Each question is a card showing its score, pass/fail, and a **sparkline** of its score across
  all runs. Expand a card to see:
  - the **rationale** for the score and the effective pass threshold,
  - the **expected** vs **actual** answer side by side,
  - every **assertion** with an individual ✓ / ✗,
  - a **score-history chart** for that exact question across all runs (when it appears in 2+ runs).

Use the **Eval folder** dropdown at the top to scope everything to a single suite folder, or keep
it on *All folders* to see the whole history together.

## Files

| File          | Purpose                                              |
| ------------- | ---------------------------------------------------- |
| `index.html`  | Page structure.                                      |
| `styles.css`  | Styling (dark dashboard theme).                      |
| `app.js`      | All logic: folder reading, aggregation, SVG charts.  |

## Notes & limitations

- Identity of a question across runs is keyed by *suite-folder + file + id*, so renaming a
  question's `id` (or moving its folder) starts a new history line.
- Charts are hand-drawn inline SVG (no chart library), so the app works fully offline.
- Malformed or non-conforming JSON files are skipped; the count of skipped files is shown next to
  the tabs.
- The File System Access API (`showDirectoryPicker`) is intentionally **not** used because it does
  not work over `file://`; the directory `<input>` does.
