/* =========================================================
   mockscore.js — Prelims Mock Score log
   Self-contained. Stores an array of mock attempts under its own key.
   Each entry: {id, name, date(YYYY-MM-DD), score, totalQ, attempted,
                correct, max, notes, createdAt}
   ========================================================= */

const MockScores = (() => {
  const KEY = "upsc.prelims.mockScores";

  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  let editingId = null;
  let linkCtx = null; // { subject, chapterId, chapterTitle } when opened from Mock Sets

  /* ---------- helpers ---------- */
  function uid() { return "ms" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function read() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } }
  function write(arr) { Store.setRaw(KEY, JSON.stringify(arr)); }
  function esc(s) { return (typeof escapeHTML === "function") ? escapeHTML(s) : String(s == null ? "" : s); }

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function fmtDate(key) {
    if (!key) return "—";
    const [y, m, d] = key.split("-").map(Number);
    if (!y || !m || !d) return key;
    return `${d} ${MONTHS[m - 1]} ${y}`;
  }
  function num(v) {
    if (v === "" || v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  /* =========================================================
     Modal open/close + form
     ========================================================= */
  function openModal(id) {
    const m = document.getElementById(id);
    if (!m) return;
    m.classList.add("is-open");
    m.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }
  function closeModal(id) {
    const m = document.getElementById(id);
    if (!m) return;
    m.classList.remove("is-open");
    m.setAttribute("aria-hidden", "true");
    if (!document.querySelector(".modal-backdrop.is-open")) document.body.style.overflow = "";
  }

  function fillForm(entry) {
    document.getElementById("mscoreName").value = entry ? (entry.name || "") : "";
    document.getElementById("mscoreDate").value = entry ? (entry.date || todayKey()) : todayKey();
    document.getElementById("mscoreScore").value = entry && entry.score != null ? entry.score : "";
    document.getElementById("mscoreTotalQ").value = entry && entry.totalQ != null ? entry.totalQ : "";
    document.getElementById("mscoreAttempted").value = entry && entry.attempted != null ? entry.attempted : "";
    document.getElementById("mscoreCorrect").value = entry && entry.correct != null ? entry.correct : "";
    document.getElementById("mscoreDuration").value = entry && entry.durationMin != null ? entry.durationMin : "";
    document.getElementById("mscoreMax").value = entry && entry.max != null ? entry.max : "";
    document.getElementById("mscoreNotes").value = entry ? (entry.notes || "") : "";
  }

  function setContext(text) {
    const el = document.getElementById("mscoreContext");
    if (el) el.textContent = text || "Log a full mock test attempt.";
  }

  function openAdd() {
    editingId = null;
    linkCtx = null;
    document.getElementById("mscoreTitle").textContent = "🎯 Add Mock Score";
    document.getElementById("mscoreSave").textContent = "Save Mock";
    setContext(null);
    fillForm(null);
    openModal("mscoreBackdrop");
    setTimeout(() => document.getElementById("mscoreScore").focus(), 60);
  }

  // Opened from Mock Sets → tag the entry to a subject/chapter.
  function openForChapter(ctx) {
    editingId = null;
    linkCtx = ctx || null;
    document.getElementById("mscoreTitle").textContent = "🎯 Add Mock Score";
    document.getElementById("mscoreSave").textContent = "Save Mock";
    setContext(ctx ? `${ctx.subject} · ${ctx.chapterTitle}` : null);
    fillForm(null);
    openModal("mscoreBackdrop");
    setTimeout(() => document.getElementById("mscoreScore").focus(), 60);
  }

  function openEdit(id) {
    const entry = read().find((m) => m.id === id);
    if (!entry) return;
    editingId = id;
    linkCtx = null;
    document.getElementById("mscoreTitle").textContent = "✏️ Edit Mock Score";
    document.getElementById("mscoreSave").textContent = "Update Mock";
    setContext(entry.chapterTitle ? `${entry.subject} · ${entry.chapterTitle}` : null);
    fillForm(entry);
    openModal("mscoreBackdrop");
  }

  function save() {
    const date = document.getElementById("mscoreDate").value || todayKey();
    const score = num(document.getElementById("mscoreScore").value);
    const totalQ = num(document.getElementById("mscoreTotalQ").value);
    const attempted = num(document.getElementById("mscoreAttempted").value);

    // Minimum required: score + a date. Nudge if score missing.
    if (score === null) {
      const el = document.getElementById("mscoreScore");
      el.focus();
      el.classList.add("field-input--err");
      setTimeout(() => el.classList.remove("field-input--err"), 1200);
      return;
    }

    const data = {
      name: document.getElementById("mscoreName").value.trim(),
      date,
      score,
      totalQ,
      attempted,
      correct: num(document.getElementById("mscoreCorrect").value),
      durationMin: num(document.getElementById("mscoreDuration").value),
      max: num(document.getElementById("mscoreMax").value),
      notes: document.getElementById("mscoreNotes").value.trim(),
    };

    const arr = read();
    let savedEntry = null;
    if (editingId) {
      const i = arr.findIndex((m) => m.id === editingId);
      if (i >= 0) { arr[i] = Object.assign({}, arr[i], data); savedEntry = arr[i]; }
    } else {
      // carry chapter link if opened from Mock Sets
      const base = { id: uid(), createdAt: Date.now() };
      if (linkCtx) {
        base.subject = linkCtx.subject;
        base.chapterId = linkCtx.chapterId;
        base.chapterTitle = linkCtx.chapterTitle;
        if (!data.name) data.name = linkCtx.chapterTitle;
      }
      savedEntry = Object.assign(base, data);
      arr.push(savedEntry);
    }
    write(arr);

    // If linked to a chapter, sync the Mock Sets count/date.
    if (savedEntry && savedEntry.chapterId && typeof Prelims !== "undefined" && Prelims.syncChapterMock) {
      Prelims.syncChapterMock(savedEntry.chapterId, savedEntry.date);
    }

    editingId = null;
    linkCtx = null;
    closeModal("mscoreBackdrop");
    render();
    if (typeof App !== "undefined" && App.toast) App.toast("Mock saved");
  }

  function remove(id) {
    const doDelete = () => { write(read().filter((m) => m.id !== id)); render(); };
    if (typeof ConfirmDialog !== "undefined" && ConfirmDialog.open) {
      ConfirmDialog.open({
        title: "Delete this mock?",
        message: "This mock attempt will be permanently removed.",
        confirmLabel: "🗑️ Delete",
        onConfirm: doDelete,
      });
    } else {
      doDelete();
    }
  }

  /* =========================================================
     Render list + summary
     ========================================================= */
  function render() {
    const list = document.getElementById("mscoreList");
    const summary = document.getElementById("mscoreSummary");
    if (!list) return;

    const arr = read().slice().sort((a, b) => {
      // newest attempt date first; fall back to createdAt
      if (a.date !== b.date) return (b.date || "").localeCompare(a.date || "");
      return (b.createdAt || 0) - (a.createdAt || 0);
    });

    if (summary) {
      if (!arr.length) {
        summary.innerHTML = `<span class="mscore-summary-empty">No mocks logged yet.</span>`;
      } else {
        const scores = arr.map((m) => m.score).filter((s) => s != null);
        const best = scores.length ? Math.max(...scores) : null;
        const avg = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length) : null;
        const latest = arr[0].score;
        summary.innerHTML = `
          <span class="mscore-stat"><span class="mscore-stat-label">Mocks</span><span class="mscore-stat-val">${arr.length}</span></span>
          <span class="mscore-stat"><span class="mscore-stat-label">Latest</span><span class="mscore-stat-val">${fmtScore(latest)}</span></span>
          <span class="mscore-stat"><span class="mscore-stat-label">Best</span><span class="mscore-stat-val">${fmtScore(best)}</span></span>
          <span class="mscore-stat"><span class="mscore-stat-label">Average</span><span class="mscore-stat-val">${avg != null ? fmtScore(Math.round(avg * 100) / 100) : "—"}</span></span>`;
      }
    }

    if (!arr.length) {
      list.innerHTML = `
        <div class="chapter-empty">
          <span class="empty-emoji">🎯</span>
          <p>No mock scores yet. Click <strong>＋ Add Mock</strong> to log your first attempt.</p>
        </div>`;
      return;
    }

    list.innerHTML = arr.map((m) => mockCard(m)).join("");
  }

  function fmtScore(s) { return s == null ? "—" : String(s); }

  function mockCard(m) {
    const chips = [];
    if (m.totalQ != null || m.attempted != null) {
      const a = m.attempted != null ? m.attempted : "—";
      const t = m.totalQ != null ? m.totalQ : "—";
      chips.push(`<span class="set-pill">📝 Attempted ${a}/${t}</span>`);
    }
    if (m.correct != null) chips.push(`<span class="set-pill">✓ ${m.correct} correct</span>`);
    if (m.attempted != null && m.correct != null) {
      const wrong = Math.max(0, m.attempted - m.correct);
      chips.push(`<span class="set-pill">✗ ${wrong} wrong</span>`);
    }
    if (m.durationMin != null) chips.push(`<span class="set-pill">⏱ ${fmtDuration(m.durationMin)}</span>`);
    if (m.chapterTitle) chips.push(`<span class="set-pill set-pill--next">🔗 ${esc(m.subject || "")}</span>`);
    const maxTxt = m.max != null ? ` <span class="mscore-max">/ ${m.max}</span>` : "";

    return `
      <div class="mscore-card" data-id="${m.id}">
        <div class="mscore-card-score">
          <span class="mscore-card-value">${fmtScore(m.score)}${maxTxt}</span>
          <span class="mscore-card-date">${fmtDate(m.date)}</span>
        </div>
        <div class="mscore-card-main">
          ${m.name ? `<span class="mscore-card-name">${esc(m.name)}</span>` : `<span class="mscore-card-name mscore-card-name--dim">Mock attempt</span>`}
          <div class="mscore-card-meta">${chips.join("")}</div>
          ${m.notes ? `<p class="mscore-card-notes">${esc(m.notes)}</p>` : ""}
        </div>
        <div class="mscore-card-actions">
          <button class="icon-btn" data-act="edit" title="Edit" aria-label="Edit mock">✏️</button>
          <button class="icon-btn icon-btn--danger" data-act="del" title="Delete" aria-label="Delete mock">🗑</button>
        </div>
      </div>`;
  }

  function fmtDuration(min) {
    if (min == null) return "";
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  }

  /* =========================================================
     INIT
     ========================================================= */
  function init() {
    const addBtn = document.getElementById("mscoreAddBtn");
    if (addBtn) addBtn.addEventListener("click", openAdd);

    const saveBtn = document.getElementById("mscoreSave");
    if (saveBtn) saveBtn.addEventListener("click", save);

    const closeBtn = document.getElementById("mscoreClose");
    if (closeBtn) closeBtn.addEventListener("click", () => { editingId = null; closeModal("mscoreBackdrop"); });

    const back = document.getElementById("mscoreBackdrop");
    if (back) back.addEventListener("click", (e) => {
      if (e.target.id === "mscoreBackdrop") { editingId = null; closeModal("mscoreBackdrop"); }
    });

    // Enter on score/attempted fields saves
    ["mscoreScore", "mscoreAttempted", "mscoreName"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener("keydown", (e) => { if (e.key === "Enter") save(); });
    });

    // list actions
    const list = document.getElementById("mscoreList");
    if (list) list.addEventListener("click", (e) => {
      const card = e.target.closest(".mscore-card");
      const btn = e.target.closest("[data-act]");
      if (!card || !btn) return;
      if (btn.dataset.act === "edit") openEdit(card.dataset.id);
      else if (btn.dataset.act === "del") remove(card.dataset.id);
    });

    // Esc closes the mock modal
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      const m = document.getElementById("mscoreBackdrop");
      if (m && m.classList.contains("is-open")) { editingId = null; closeModal("mscoreBackdrop"); }
    });

    // Re-render whenever the Mock Scores tab is activated.
    const tabs = document.getElementById("prelimsTabs");
    if (tabs) tabs.addEventListener("click", (e) => {
      const t = e.target.closest(".ptab");
      if (t && t.dataset.ptab === "mockscore") render();
    });

    render();
  }

  return { init, render, openAdd, openForChapter };
})();
