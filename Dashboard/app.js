/*
 * Fabric IQ Eval — local dashboard
 * Pure client-side. Reads eval-report-*.json sidecars from a chosen folder
 * (via a <input webkitdirectory>) and renders evaluation history.
 * No backend, no dependencies.
 */
(function () {
  "use strict";

  // ---------- State ----------
  const state = {
    runs: [],            // [{ key, relPath, fileName, dir, dirName, timestamp, model, summary, results }]
    byQuestion: new Map(), // questionKey -> [{ run, result }] sorted by time
    dirFilter: "all",
    tab: "overview",
    skipped: 0,
  };

  // ---------- DOM ----------
  const $ = (sel) => document.querySelector(sel);
  const el = {
    folderInput: $("#folderInput"),
    folderLabel: $("#folderLabel"),
    intro: $("#intro"),
    dashboard: $("#dashboard"),
    dirFilter: $("#dirFilter"),
    skipNote: $("#skipNote"),
    tabs: document.querySelectorAll(".tab"),
    viewOverview: $("#view-overview"),
    viewQuestions: $("#view-questions"),
    kpis: $("#kpis"),
    trendChart: $("#trendChart"),
    suiteTable: $("#suiteTable"),
    runsTable: $("#runsTable"),
    runSelect: $("#runSelect"),
    qSearch: $("#qSearch"),
    failOnly: $("#failOnly"),
    questionsList: $("#questionsList"),
  };

  // ---------- Utilities ----------
  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function truncate(s, n) {
    s = String(s || "");
    return s.length > n ? s.slice(0, n - 1) + "…" : s;
  }
  function parseTs(s) {
    // run.timestamp like "2026-06-20T07:13:18" (local, no tz)
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  function fmtTs(d) {
    if (!d) return "—";
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  function fmtShort(d) {
    if (!d) return "";
    const p = (n) => String(n).padStart(2, "0");
    return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  function round1(n) { return Math.round(n * 10) / 10; }
  function scoreColor(score) {
    if (score >= 85) return "var(--good)";
    if (score >= 70) return "var(--warn)";
    return "var(--bad)";
  }
  function scorePill(score) {
    const c = scoreColor(score);
    return `<span class="score-pill" style="background:${c}1f;color:${c}">${Math.round(score)}</span>`;
  }
  function passBadge(passed) {
    return passed
      ? '<span class="badge badge-pass">PASS</span>'
      : '<span class="badge badge-fail">FAIL</span>';
  }

  // Derive the suite/eval-folder path of a report from its relative path.
  function deriveDir(relPath) {
    const parts = relPath.split("/");
    const idx = parts.lastIndexOf("reports");
    let dir;
    if (idx > 0) dir = parts.slice(0, idx).join("/");
    else dir = parts.slice(0, -1).join("/");
    const name = dir.split("/").pop();
    return { dir: dir || "(root)", dirName: name || "(root)" };
  }
  function questionKey(dir, r) {
    return `${dir}::${r.file || ""}::${r.id || ""}`;
  }

  // ---------- Loading ----------
  el.folderInput.addEventListener("change", async (e) => {
    const files = Array.from(e.target.files || []).filter((f) =>
      /eval-report-.*\.json$/i.test(f.name)
    );
    if (!files.length) {
      alert("No eval-report-*.json files found in that folder.");
      return;
    }
    await loadFiles(files);
  });

  async function loadFiles(files) {
    const runs = [];
    let skipped = 0;
    for (const f of files) {
      try {
        const text = await f.text();
        const data = JSON.parse(text);
        if (!data || !data.run || !Array.isArray(data.results)) { skipped++; continue; }
        const relPath = f.webkitRelativePath || f.name;
        const { dir, dirName } = deriveDir(relPath);
        runs.push({
          key: relPath,
          relPath,
          fileName: f.name,
          dir,
          dirName,
          timestamp: parseTs(data.run.timestamp),
          rawTimestamp: data.run.timestamp,
          model: data.run.model || "",
          inputFolder: data.run.input_folder || "",
          filesEvaluated: data.run.files_evaluated || [],
          summary: data.summary || {},
          results: data.results || [],
        });
      } catch (err) {
        skipped++;
      }
    }

    runs.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    state.runs = runs;
    state.skipped = skipped;
    state.dirFilter = "all";
    buildQuestionIndex();

    // Folder label = the common top-level folder name.
    const top = (runs[0] && runs[0].relPath.split("/")[0]) || "folder";
    el.folderLabel.textContent = `${top} — ${runs.length} report${runs.length === 1 ? "" : "s"}`;
    el.skipNote.textContent = skipped ? `${skipped} file(s) skipped (unreadable or malformed)` : "";

    el.intro.classList.add("hidden");
    el.dashboard.classList.remove("hidden");

    populateDirFilter();
    render();
  }

  function buildQuestionIndex() {
    const map = new Map();
    for (const run of state.runs) {
      for (const r of run.results) {
        const k = questionKey(run.dir, r);
        if (!map.has(k)) map.set(k, []);
        map.get(k).push({ run, result: r });
      }
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => (a.run.timestamp || 0) - (b.run.timestamp || 0));
    }
    state.byQuestion = map;
  }

  // ---------- Filtering helpers ----------
  function filteredRuns() {
    if (state.dirFilter === "all") return state.runs;
    return state.runs.filter((r) => r.dir === state.dirFilter);
  }

  function populateDirFilter() {
    const dirs = Array.from(new Set(state.runs.map((r) => r.dir)));
    const opts = ['<option value="all">All folders</option>'];
    for (const d of dirs) {
      const name = d.split("/").pop() || d;
      opts.push(`<option value="${escapeHtml(d)}">${escapeHtml(name)}</option>`);
    }
    el.dirFilter.innerHTML = opts.join("");
    el.dirFilter.value = state.dirFilter;
  }

  // ---------- Rendering ----------
  function render() {
    if (state.tab === "overview") {
      el.viewOverview.classList.remove("hidden");
      el.viewQuestions.classList.add("hidden");
      renderOverview();
    } else {
      el.viewOverview.classList.add("hidden");
      el.viewQuestions.classList.remove("hidden");
      renderQuestions();
    }
  }

  function renderOverview() {
    const runs = filteredRuns();
    if (!runs.length) {
      el.kpis.innerHTML = "";
      el.trendChart.innerHTML = '<p class="empty">No runs for this folder.</p>';
      el.suiteTable.innerHTML = "";
      el.runsTable.innerHTML = "";
      return;
    }

    const latest = runs[runs.length - 1];
    const prev = runs.length > 1 ? runs[runs.length - 2] : null;

    const passRate = (run) => {
      const t = run.summary.total || 0;
      return t ? (100 * (run.summary.passed || 0)) / t : 0;
    };
    const totalQuestions = runs.reduce((a, r) => a + (r.summary.total || 0), 0);

    // KPIs
    const avgDelta = prev ? (latest.summary.average_score || 0) - (prev.summary.average_score || 0) : null;
    const prDelta = prev ? passRate(latest) - passRate(prev) : null;
    el.kpis.innerHTML = [
      kpiCard("Runs", runs.length, null),
      kpiCard("Latest avg score", round1(latest.summary.average_score || 0), avgDelta, ""),
      kpiCard("Latest pass rate", round1(passRate(latest)) + "%", prDelta, "pp"),
      kpiCard("Questions (latest)", latest.summary.total || 0, null),
      kpiCard("Questions (all runs)", totalQuestions, null),
    ].join("");

    // Trend chart
    const scorePts = runs.map((r) => ({ x: r.timestamp, y: r.summary.average_score || 0, label: `Avg score · ${fmtTs(r.timestamp)}` }));
    const passPts = runs.map((r) => ({ x: r.timestamp, y: passRate(r), label: `Pass rate · ${fmtTs(r.timestamp)}` }));
    el.trendChart.innerHTML = lineChartSVG([
      { color: "var(--score)", points: scorePts, name: "Avg score" },
      { color: "var(--pass)", points: passPts, name: "Pass rate" },
    ], { showXLabels: true });

    // Latest run by suite
    const bySuite = new Map();
    for (const r of latest.results) {
      const s = r.suite || "(unnamed)";
      if (!bySuite.has(s)) bySuite.set(s, { total: 0, passed: 0, sum: 0 });
      const o = bySuite.get(s);
      o.total++; o.passed += r.passed ? 1 : 0; o.sum += r.score || 0;
    }
    let suiteRows = "";
    for (const [s, o] of bySuite) {
      suiteRows += `<tr>
        <td>${escapeHtml(s)}</td>
        <td class="num">${o.total}</td>
        <td class="num" style="color:var(--good)">${o.passed}</td>
        <td class="num" style="color:var(--bad)">${o.total - o.passed}</td>
        <td class="num">${scorePill(o.sum / o.total)}</td>
      </tr>`;
    }
    el.suiteTable.innerHTML = `<table>
      <thead><tr><th>Suite</th><th class="num">Q's</th><th class="num">Pass</th><th class="num">Fail</th><th class="num">Avg</th></tr></thead>
      <tbody>${suiteRows}</tbody></table>
      <p class="empty" style="text-align:left;padding:8px 14px 14px;color:var(--text-faint)">
        Latest run: ${fmtTs(latest.timestamp)} · ${escapeHtml(latest.model)}</p>`;

    // All runs table (newest first)
    let runRows = "";
    for (let i = runs.length - 1; i >= 0; i--) {
      const r = runs[i];
      runRows += `<tr class="row-click" data-run="${escapeHtml(r.key)}">
        <td>${fmtTs(r.timestamp)}</td>
        <td>${escapeHtml(r.dirName)}</td>
        <td>${escapeHtml(truncate(r.filesEvaluated.join(", "), 48))}</td>
        <td class="num">${r.summary.total || 0}</td>
        <td class="num" style="color:var(--good)">${r.summary.passed || 0}</td>
        <td class="num" style="color:var(--bad)">${r.summary.failed || 0}</td>
        <td class="num">${scorePill(r.summary.average_score || 0)}</td>
      </tr>`;
    }
    el.runsTable.innerHTML = `<table>
      <thead><tr><th>When</th><th>Folder</th><th>Files</th><th class="num">Q's</th><th class="num">Pass</th><th class="num">Fail</th><th class="num">Avg</th></tr></thead>
      <tbody>${runRows}</tbody></table>`;

    // Clicking a run jumps to the Questions tab for that run.
    el.runsTable.querySelectorAll(".row-click").forEach((tr) => {
      tr.addEventListener("click", () => {
        switchTab("questions");
        el.runSelect.value = tr.getAttribute("data-run");
        renderQuestions();
      });
    });
  }

  function kpiCard(label, value, delta, unit) {
    let deltaHtml = "";
    if (delta != null && isFinite(delta)) {
      const r = round1(delta);
      const cls = r > 0 ? "delta-up" : r < 0 ? "delta-down" : "delta-flat";
      const arrow = r > 0 ? "▲" : r < 0 ? "▼" : "▬";
      deltaHtml = `<div class="kpi-delta ${cls}">${arrow} ${r > 0 ? "+" : ""}${r}${unit || ""} vs prev</div>`;
    }
    return `<div class="kpi">
      <div class="kpi-label">${escapeHtml(label)}</div>
      <div class="kpi-value">${escapeHtml(String(value))}</div>
      ${deltaHtml}
    </div>`;
  }

  function renderQuestions() {
    const runs = filteredRuns();
    if (!runs.length) {
      el.runSelect.innerHTML = "";
      el.questionsList.innerHTML = '<p class="empty">No runs for this folder.</p>';
      return;
    }

    // Run selector (newest first); preserve current selection if still valid.
    const prevSel = el.runSelect.value;
    const opts = [];
    for (let i = runs.length - 1; i >= 0; i--) {
      const r = runs[i];
      opts.push(`<option value="${escapeHtml(r.key)}">${fmtTs(r.timestamp)} · ${escapeHtml(r.dirName)} · avg ${round1(r.summary.average_score || 0)}</option>`);
    }
    el.runSelect.innerHTML = opts.join("");
    if (prevSel && runs.some((r) => r.key === prevSel)) el.runSelect.value = prevSel;
    else el.runSelect.value = runs[runs.length - 1].key;

    drawQuestionCards();
  }

  function drawQuestionCards() {
    const run = state.runs.find((r) => r.key === el.runSelect.value);
    if (!run) { el.questionsList.innerHTML = '<p class="empty">Select a run.</p>'; return; }

    const term = (el.qSearch.value || "").trim().toLowerCase();
    const failOnly = el.failOnly.checked;

    let results = run.results.slice();
    if (failOnly) results = results.filter((r) => !r.passed);
    if (term) results = results.filter((r) =>
      (r.id || "").toLowerCase().includes(term) ||
      (r.question || "").toLowerCase().includes(term) ||
      (r.suite || "").toLowerCase().includes(term)
    );

    if (!results.length) {
      el.questionsList.innerHTML = '<p class="empty">No questions match the current filter.</p>';
      return;
    }

    el.questionsList.innerHTML = results.map((r, i) => qcardHtml(run, r, i)).join("");

    // Wire expand/collapse
    el.questionsList.querySelectorAll(".qcard-head").forEach((head) => {
      head.addEventListener("click", () => {
        const card = head.closest(".qcard");
        const open = card.classList.toggle("open");
        if (open && !card.dataset.rendered) {
          renderDetail(card);
          card.dataset.rendered = "1";
        }
      });
    });
  }

  function qcardHtml(run, r, idx) {
    const k = questionKey(run.dir, r);
    const history = state.byQuestion.get(k) || [];
    const turn = r.turn_index ? `<span class="badge badge-type">turn ${r.turn_index}</span>` : "";
    return `<div class="qcard" data-key="${escapeHtml(k)}" data-run="${escapeHtml(run.key)}" data-id="${escapeHtml(r.id)}">
      <div class="qcard-head">
        <div>${scorePill(r.score || 0)}</div>
        <div class="qcard-q">
          <div class="qcard-id">${escapeHtml(r.id)} · ${escapeHtml(r.suite || "")} ${turn}</div>
          <div class="qcard-text">${escapeHtml(r.question)}</div>
        </div>
        <div class="qcard-meta">
          ${sparklineSVG(history)}
          ${passBadge(r.passed)}
        </div>
        <div class="chev">▶</div>
      </div>
      <div class="qcard-body"></div>
    </div>`;
  }

  function renderDetail(card) {
    const runKey = card.getAttribute("data-run");
    const id = card.getAttribute("data-id");
    const k = card.getAttribute("data-key");
    const run = state.runs.find((r) => r.key === runKey);
    const r = run.results.find((x) => x.id === id);
    const history = state.byQuestion.get(k) || [];
    const body = card.querySelector(".qcard-body");

    const assertions = (r.assertions || []).map((a) => {
      const ok = a.passed;
      return `<li>
        <span class="assert-mark ${ok ? "assert-pass" : "assert-fail"}">${ok ? "✓" : "✗"}</span>
        <span>${escapeHtml(a.text)}</span>
      </li>`;
    }).join("") || '<li style="color:var(--text-faint)">No assertions on this item.</li>';

    const errBanner = r.error
      ? `<div class="error-banner"><strong>Error:</strong> ${escapeHtml(r.error)}</div>`
      : "";

    // Per-question score history chart (across all runs in this folder)
    let historyChart = "";
    if (history.length > 1) {
      const pts = history.map((h) => ({
        x: h.run.timestamp,
        y: h.result.score || 0,
        label: `${h.result.score} · ${fmtTs(h.run.timestamp)}`,
      }));
      historyChart = `<div class="mini-chart-wrap">
        <h4>Score history (${history.length} runs)</h4>
        ${lineChartSVG([{ color: "var(--score)", points: pts, name: "Score" }], { height: 200, showXLabels: true })}
      </div>`;
    }

    body.innerHTML = `
      ${errBanner}
      <div class="mini-chart-wrap" style="margin-top:14px">
        <h4>Rationale · threshold ${r.pass_threshold != null ? r.pass_threshold : 70}</h4>
        <div class="detail-text rationale">${escapeHtml(r.rationale || "—")}</div>
      </div>
      <div class="detail-grid">
        <div class="detail-block">
          <h4>Expected</h4>
          <div class="detail-text">${escapeHtml(r.expected || "—")}</div>
        </div>
        <div class="detail-block">
          <h4>Actual</h4>
          <div class="detail-text">${escapeHtml(r.actual || "—")}</div>
        </div>
      </div>
      <div class="mini-chart-wrap">
        <h4>Assertions</h4>
        <ul class="assertions">${assertions}</ul>
      </div>
      ${historyChart}
    `;
  }

  // ---------- SVG charts (no dependencies) ----------
  function lineChartSVG(series, opts) {
    opts = opts || {};
    const W = 820, H = opts.height || 320;
    const padL = 40, padR = 16, padT = 14, padB = 56;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const yMin = 0, yMax = 100;

    const all = [];
    series.forEach((s) => s.points.forEach((p) => { if (p.x) all.push(p); }));
    if (!all.length) return '<p class="empty">No data to plot.</p>';

    const times = all.map((p) => p.x.getTime());
    let tmin = Math.min.apply(null, times), tmax = Math.max.apply(null, times);
    const single = tmin === tmax;
    const xScale = (t) => single ? padL + plotW / 2 : padL + ((t - tmin) / (tmax - tmin)) * plotW;
    const yScale = (v) => padT + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

    let svg = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img">`;

    // y gridlines + labels
    [0, 25, 50, 75, 100].forEach((v) => {
      const y = yScale(v);
      svg += `<line class="grid-line" x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" />`;
      svg += `<text class="axis-text" x="${padL - 6}" y="${(y + 3).toFixed(1)}" text-anchor="end">${v}</text>`;
    });

    // x labels (sample to <=12)
    const uniqTimes = Array.from(new Set(times)).sort((a, b) => a - b);
    let labelTimes = uniqTimes;
    if (uniqTimes.length > 12) {
      labelTimes = [];
      const step = (uniqTimes.length - 1) / 11;
      for (let i = 0; i < 12; i++) labelTimes.push(uniqTimes[Math.round(i * step)]);
    }
    labelTimes.forEach((t) => {
      const x = xScale(t);
      const txt = fmtShort(new Date(t));
      svg += `<text class="axis-text" x="${x.toFixed(1)}" y="${H - padB + 18}" text-anchor="end" transform="rotate(-35 ${x.toFixed(1)} ${H - padB + 18})">${escapeHtml(txt)}</text>`;
    });

    // series
    series.forEach((s) => {
      const pts = s.points.filter((p) => p.x).slice().sort((a, b) => a.x - b.x);
      if (!pts.length) return;
      const coords = pts.map((p) => `${xScale(p.x.getTime()).toFixed(1)},${yScale(p.y).toFixed(1)}`);
      if (coords.length > 1) {
        svg += `<polyline class="series-line" stroke="${s.color}" points="${coords.join(" ")}" />`;
      }
      pts.forEach((p) => {
        const cx = xScale(p.x.getTime()), cy = yScale(p.y);
        svg += `<circle class="series-dot" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${coords.length === 1 ? 5 : 3.5}" fill="${s.color}">`;
        svg += `<title>${escapeHtml((s.name ? s.name + ": " : "") + Math.round(p.y) + "  (" + fmtTs(p.x) + ")")}</title></circle>`;
      });
    });

    svg += `</svg>`;
    return svg;
  }

  function sparklineSVG(history) {
    if (!history || history.length < 2) return '<span class="spark" style="width:130px"></span>';
    const W = 130, H = 30, pad = 3;
    const pts = history.map((h) => h.result.score || 0);
    const n = pts.length;
    const xs = (i) => pad + (i / (n - 1)) * (W - 2 * pad);
    const ys = (v) => H - pad - (v / 100) * (H - 2 * pad);
    const coords = pts.map((v, i) => `${xs(i).toFixed(1)},${ys(v).toFixed(1)}`);
    const last = history[history.length - 1];
    const lastColor = last.result.passed ? "var(--good)" : "var(--bad)";
    return `<svg class="spark" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      <polyline fill="none" stroke="var(--score)" stroke-width="1.8" points="${coords.join(" ")}" />
      <circle cx="${xs(n - 1).toFixed(1)}" cy="${ys(pts[n - 1]).toFixed(1)}" r="2.8" fill="${lastColor}" />
      <title>Score history: ${pts.join(" → ")}</title>
    </svg>`;
  }

  // ---------- Events ----------
  function switchTab(tab) {
    state.tab = tab;
    el.tabs.forEach((t) => t.classList.toggle("is-active", t.dataset.tab === tab));
    render();
  }
  el.tabs.forEach((t) => t.addEventListener("click", () => switchTab(t.dataset.tab)));

  el.dirFilter.addEventListener("change", () => {
    state.dirFilter = el.dirFilter.value;
    render();
  });
  el.runSelect.addEventListener("change", drawQuestionCards);
  el.qSearch.addEventListener("input", drawQuestionCards);
  el.failOnly.addEventListener("change", drawQuestionCards);
})();
