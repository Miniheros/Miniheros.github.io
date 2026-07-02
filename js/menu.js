/* =========================================================
   menu.js — Explore/menu modules
   Handles: Syllabus, About (Pattern/Dates/Calendar), Mains,
   Interview notes. Generic info-modal open/close + extras.
   ========================================================= */

const Menu = (() => {
  /* ---------- generic info modal open/close ---------- */
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
    // only release scroll lock if no other info modal is open
    if (!document.querySelector(".modal-backdrop.is-open")) {
      document.body.style.overflow = "";
    }
  }

  /* ---------- exam dates (dynamic via ExamDates; 2027 defaults) ---------- */
  // These fall back to the 2027 attempt when ExamDates isn't present, and
  // switch to the 2028 plan once the user activates it in the Calendar modal.
  function PRELIMS_DATE() {
    return (typeof ExamDates !== "undefined") ? ExamDates.prelimsDate() : new Date(2027, 4, 23);
  }
  function MAINS_DATE() {
    return (typeof ExamDates !== "undefined") ? ExamDates.mainsDate() : new Date(2027, 7, 20);
  }

  function daysLeft(target) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const t = new Date(target);
    t.setHours(0, 0, 0, 0);
    return Math.max(0, Math.round((t - today) / 86400000));
  }
  function fmtDateShort(d) {
    return `${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
  }
  function renderCountdowns() {
    const pDate = PRELIMS_DATE(), mDate = MAINS_DATE();
    const p = document.getElementById("prelimsCountdown");
    const m = document.getElementById("mainsCountdown");
    if (p) p.textContent = daysLeft(pDate);
    if (m) m.textContent = daysLeft(mDate);
    const pd = document.getElementById("prelimsCountdownDate");
    const md = document.getElementById("mainsCountdownDate");
    if (pd) pd.textContent = fmtDateShort(pDate);
    if (md) md.textContent = fmtDateShort(mDate);
  }

  /* ---------- calendar builder ---------- */
  const MONTH_NAMES = ["January","February","March","April","May","June","July",
    "August","September","October","November","December"];
  const WEEK = ["Su","Mo","Tu","We","Th","Fr","Sa"];

  function buildCalendar(year, month, highlightDays, opts) {
    opts = opts || {};
    const first = new Date(year, month, 1).getDay();
    const total = new Date(year, month + 1, 0).getDate();
    const now = new Date();
    const isThisMonth = now.getFullYear() === year && now.getMonth() === month;
    const todayNum = now.getDate();
    let cells = "";
    WEEK.forEach((w) => { cells += `<div class="cal-dow">${w}</div>`; });
    for (let i = 0; i < first; i++) cells += `<div class="cal-cell cal-cell--empty"></div>`;
    for (let d = 1; d <= total; d++) {
      const hot = highlightDays.includes(d) ? " cal-cell--hot" : "";
      const today = (opts.markToday && isThisMonth && d === todayNum) ? " cal-cell--today" : "";
      cells += `<div class="cal-cell${hot}${today}">${d}</div>`;
    }
    return `
      <div class="cal-title">${MONTH_NAMES[month]} ${year}${opts.subtitle ? `<span class="cal-subtitle">${opts.subtitle}</span>` : ""}</div>
      <div class="cal-grid">${cells}</div>`;
  }
  function renderCurrentMonth() {
    const el = document.getElementById("calCurrent");
    if (!el) return;
    const now = new Date();
    el.innerHTML = buildCalendar(now.getFullYear(), now.getMonth(), [], {
      markToday: true,
      subtitle: "Today",
    });
  }
  function renderCalendars() {
    renderCurrentMonth();
    const pDate = PRELIMS_DATE(), mDate = MAINS_DATE();
    const pDays = (typeof ExamDates !== "undefined") ? ExamDates.prelimsDays() : [23];
    const mDays = (typeof ExamDates !== "undefined") ? ExamDates.mainsDays() : [20, 21, 22, 28, 29];
    const may = document.getElementById("calMay");
    const aug = document.getElementById("calAug");
    // "calMay"/"calAug" are legacy ids — now they render whatever the current
    // plan's Prelims and Mains months are (2027 by default, 2028 if activated).
    if (may) may.innerHTML = buildCalendar(pDate.getFullYear(), pDate.getMonth(), pDays, { subtitle: "Prelims" });
    if (aug) aug.innerHTML = buildCalendar(mDate.getFullYear(), mDate.getMonth(), mDays, { subtitle: "Mains" });
    // let the exam-plan module refresh its button + marks UI too
    if (typeof ExamPlan !== "undefined" && ExamPlan.onCalendarOpen) ExamPlan.onCalendarOpen();
  }

  /* ---------- interview notes (persisted) ---------- */
  const TOPICS_KEY = "upsc.interviewTopics";   // [{id, name}]
  const NOTE_KEY_PREFIX = "upsc.interviewNotes."; // + topicId → [{id,text,createdAt,editedAt}]
  const LEGACY_NOTES_KEY = "upsc.interviewNotes"; // old flat array (migrated)
  let editingId = null;          // note being edited
  let currentTopicId = null;     // selected topic

  /* ---------- topics ---------- */
  function getTopics() {
    try { return JSON.parse(localStorage.getItem(TOPICS_KEY)) || []; } catch { return []; }
  }
  function setTopics(arr) { Store.setRaw(TOPICS_KEY, JSON.stringify(arr)); }

  // one-time migration: old flat notes → a "General" topic
  function migrateLegacyNotes() {
    if (localStorage.getItem(TOPICS_KEY)) return; // already migrated
    let legacy = [];
    try { legacy = JSON.parse(localStorage.getItem(LEGACY_NOTES_KEY)) || []; } catch {}
    const gid = "t" + Date.now().toString(36) + "gen";
    setTopics([{ id: gid, name: "General" }]);
    if (Array.isArray(legacy) && legacy.length) {
      const notes = legacy.map((n) => typeof n === "string"
        ? { id: "n" + Math.random().toString(36).slice(2), text: n, createdAt: Date.now(), editedAt: null }
        : n);
      Store.setRaw(NOTE_KEY_PREFIX + gid, JSON.stringify(notes));
      Store.removeRaw(LEGACY_NOTES_KEY); // remove old flat key (now migrated)
    }
  }

  /* ---------- notes (per topic) ---------- */
  function noteKey(topicId) { return NOTE_KEY_PREFIX + topicId; }
  function getNotes(topicId) {
    try { return JSON.parse(localStorage.getItem(noteKey(topicId))) || []; } catch { return []; }
  }
  function setNotes(topicId, arr) { Store.setRaw(noteKey(topicId), JSON.stringify(arr)); }
  function noteCount(topicId) { return getNotes(topicId).length; }
  function totalNoteCount() { return getTopics().reduce((s, t) => s + noteCount(t.id), 0); }

  // format helpers
  function fmtDate(ts) {
    const d = new Date(ts);
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${String(d.getDate()).padStart(2,"0")} ${months[d.getMonth()]} ${d.getFullYear()}`;
  }
  function fmtTime(ts) {
    const d = new Date(ts);
    let h = d.getHours(); const m = String(d.getMinutes()).padStart(2,"0");
    const ap = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${String(h).padStart(2,"0")}:${m} ${ap}`;
  }

  function updateNotesCount() {
    const el = document.getElementById("notesCount");
    if (el) el.textContent = totalNoteCount();
  }

  /* ---------- render topics sidebar ---------- */
  function renderTopics() {
    migrateLegacyNotes();
    const wrap = document.getElementById("topicList");
    const topics = getTopics();
    updateNotesCount();

    if (!topics.length) {
      wrap.innerHTML = `<div class="iv-topic-empty">No topics yet. Add one above ↑</div>`;
      currentTopicId = null;
      renderNotes();
      return;
    }
    if (!currentTopicId || !topics.find((t) => t.id === currentTopicId)) {
      currentTopicId = topics[0].id;
    }
    wrap.innerHTML = topics.map((t) => `
      <div class="iv-topic ${t.id === currentTopicId ? "is-active" : ""}" data-id="${t.id}">
        <button class="iv-topic-name" data-id="${t.id}">
          <span class="iv-topic-label">${escapeHTML(t.name)}</span>
          <span class="iv-topic-badge">${noteCount(t.id)}</span>
        </button>
        <button class="icon-btn icon-btn--danger iv-topic-del" data-id="${t.id}" aria-label="Delete topic" title="Delete topic">🗑</button>
      </div>`).join("");
    renderNotes();
  }

  /* ---------- render notes for current topic ---------- */
  function renderNotes() {
    const list = document.getElementById("notesList");
    const form = document.getElementById("noteAddForm");
    const title = document.getElementById("currentTopicTitle");
    updateNotesCount();

    if (!currentTopicId) {
      if (form) form.hidden = true;
      if (title) title.textContent = "Select a topic";
      list.innerHTML = `<li class="notes-empty"><span class="notes-empty-icon">📂</span><span>Create a topic on the left to start adding notes.</span></li>`;
      return;
    }
    const topic = getTopics().find((t) => t.id === currentTopicId);
    if (title) title.textContent = topic ? topic.name : "Topic";
    if (form) form.hidden = false;

    const notes = getNotes(currentTopicId).sort((a, b) => b.createdAt - a.createdAt);
    if (!notes.length) {
      list.innerHTML = `
        <li class="notes-empty">
          <span class="notes-empty-icon">📝</span>
          <span>No notes in this topic yet. Click <strong>Add Note</strong> to get started.</span>
        </li>`;
      return;
    }
    list.innerHTML = notes.map((n) => `
      <li class="note-card" data-id="${n.id}">
        <div class="note-main">
          <p class="note-text">${escapeHTML(n.text)}</p>
          <div class="note-meta">
            <span class="note-stamp">📅 ${fmtDate(n.createdAt)}</span>
            <span class="note-stamp">🕒 ${fmtTime(n.createdAt)}</span>
            ${n.editedAt ? `<span class="note-stamp note-stamp--edit">✏️ Last edited: ${fmtDate(n.editedAt)} · ${fmtTime(n.editedAt)}</span>` : ""}
          </div>
        </div>
        <div class="note-actions">
          <button class="icon-btn note-edit" data-id="${n.id}" aria-label="Edit note" title="Edit">✎</button>
          <button class="icon-btn icon-btn--danger note-del" data-id="${n.id}" aria-label="Delete note" title="Delete">🗑</button>
        </div>
      </li>`).join("");
  }

  /* ---------- topic actions ---------- */
  function addTopic() {
    const input = document.getElementById("newTopicInput");
    const name = input.value.trim();
    if (!name) { input.focus(); return; }
    const topics = getTopics();
    const id = "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    topics.push({ id, name });
    setTopics(topics);
    currentTopicId = id;
    input.value = "";
    renderTopics();
    input.focus();
  }
  function selectTopic(id) {
    currentTopicId = id;
    editingId = null;
    const btn = document.getElementById("saveNoteBtn");
    if (btn) btn.innerHTML = "＋ Add Note";
    renderTopics();
  }
  function deleteTopic(id) {
    const topic = getTopics().find((t) => t.id === id);
    ConfirmDialog.open({
      title: "Delete Topic?",
      message: `Delete "${topic ? topic.name : "this topic"}" and all its notes? This action cannot be undone.`,
      confirmLabel: "🗑️ Delete",
      onConfirm: () => {
        setTopics(getTopics().filter((t) => t.id !== id));
        Store.removeRaw(noteKey(id));
        if (currentTopicId === id) currentTopicId = null;
        renderTopics();
      },
    });
  }

  /* ---------- note actions ---------- */
  function saveNote() {
    if (!currentTopicId) return;
    const input = document.getElementById("newNoteInput");
    const btn = document.getElementById("saveNoteBtn");
    const v = input.value.trim();
    if (!v) { input.focus(); return; }
    const notes = getNotes(currentTopicId);

    if (editingId) {
      const note = notes.find((x) => x.id === editingId);
      if (note) { note.text = v; note.editedAt = Date.now(); }
      editingId = null;
      btn.innerHTML = "＋ Add Note";
      input.placeholder = "Write a note…";
    } else {
      notes.push({
        id: "n" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        text: v, createdAt: Date.now(), editedAt: null,
      });
    }
    setNotes(currentTopicId, notes);
    input.value = "";
    renderTopics();
    input.focus();
  }

  function startEditNote(id) {
    const note = getNotes(currentTopicId).find((x) => x.id === id);
    if (!note) return;
    editingId = id;
    const input = document.getElementById("newNoteInput");
    input.value = note.text;
    input.placeholder = "Editing note…";
    document.getElementById("saveNoteBtn").innerHTML = "✔ Update Note";
    input.focus();
    input.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function askDeleteNote(id) {
    ConfirmDialog.open({
      title: "Delete Note?",
      message: "Are you sure you want to delete this note? This action cannot be undone.",
      confirmLabel: "🗑️ Delete",
      onConfirm: () => {
        const card = document.querySelector(`.note-card[data-id="${id}"]`);
        const doRemove = () => { setNotes(currentTopicId, getNotes(currentTopicId).filter((x) => x.id !== id)); renderTopics(); };
        if (card) { card.classList.add("note-removing"); setTimeout(doRemove, 280); }
        else doRemove();
      },
    });
  }

  /* ---------- syllabus rendering ---------- */
  function escapeText(s) {
    return String(s).replace(/[&<>"']/g, (m) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  }

  // open a stage: prelims / mains / interview
  function openStage(stage) {
    closeModal("syllabusBackdrop");
    if (stage === "interview") return openInterviewStage();

    const data = SYLLABUS[stage];
    document.getElementById("stageTitle").textContent = data.title;
    document.getElementById("stageSub").textContent = data.sub || "";
    const grid = document.getElementById("stageGrid");
    grid.innerHTML = data.cards.map((c) => `
      <button class="about-tile" data-paper="${stage}:${c.id}">
        <span class="about-tile-icon">📄</span>
        <span class="about-tile-stack">
          <span class="about-tile-title">${escapeText(c.title)}</span>
          ${c.meta ? `<span class="about-tile-meta">${escapeText(c.meta)}</span>` : ""}
        </span>
        <span class="about-tile-go">Open →</span>
      </button>`).join("");
    // wire paper tiles
    grid.querySelectorAll("[data-paper]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const [st, id] = btn.dataset.paper.split(":");
        openPaper(st, id);
      });
    });
    openModal("stageBackdrop");
  }

  // open a single paper detail
  function openPaper(stage, id) {
    const card = SYLLABUS[stage].cards.find((c) => c.id === id);
    if (!card) return;
    closeModal("stageBackdrop");
    document.getElementById("paperTitle").textContent = card.title;
    document.getElementById("paperMeta").textContent = card.meta || "";
    const body = document.getElementById("paperBody");

    if (card.blank) {
      body.innerHTML = `
        <div class="chapter-empty">
          <span class="empty-emoji">📝</span>
          <p>This section is intentionally blank for now.</p>
        </div>`;
    } else {
      body.innerHTML = (card.sections || []).map((sec) => {
        if (sec.note) return `<p class="info-note">${escapeText(sec.note)}</p>`;
        const heading = sec.heading ? `<h3 class="info-h">${escapeText(sec.heading)}</h3>` : "";
        const lis = (sec.items || []).map((it) => `<li>${escapeText(it)}</li>`).join("");
        return `<section class="info-section">${heading}<ul class="syllabus-list">${lis}</ul></section>`;
      }).join("");
    }
    // paper back button returns to its stage
    const closeBtn = document.getElementById("paperClose");
    closeBtn.onclick = () => { closeModal("paperBackdrop"); openStage(stage); };
    openModal("paperBackdrop");
  }

  // interview stage — "Beyond Bookish Knowledge" trait cards
  function openInterviewStage() {
    const data = SYLLABUS.interview;
    document.getElementById("stageTitle").textContent = data.title;
    document.getElementById("stageSub").textContent = data.heading;
    const grid = document.getElementById("stageGrid");
    grid.innerHTML = `<div class="trait-grid">` + data.traits.map((t) => `
      <div class="trait-card">
        <h4 class="trait-name">${escapeText(t.name)}</h4>
        <p class="trait-desc">${escapeText(t.desc)}</p>
      </div>`).join("") + `</div>`;
    openModal("stageBackdrop");
  }

  /* ---------- routing from menu cards ---------- */
  function handleCard(moduleName) {
    switch (moduleName) {
      case "syllabus":
        openModal("syllabusBackdrop"); break;
      case "about":
        openModal("aboutBackdrop"); break;
      case "mains":
        if (typeof App !== "undefined" && App.show) App.show("mains");
        if (typeof Mains !== "undefined" && Mains.onShow) Mains.onShow();
        break;
      case "interview":
        renderTopics(); openModal("interviewBackdrop"); break;
      case "tracker":
        return false; // handled by App (switches to tracker view)
    }
    return true;
  }

  /* ---------- init ---------- */
  function init() {
    // syllabus stage tiles (data-stage)
    document.querySelectorAll("[data-stage]").forEach((btn) => {
      btn.addEventListener("click", () => openStage(btn.dataset.stage));
    });

    // close buttons (data-close) + optional data-back to reopen parent
    document.querySelectorAll("[data-close]").forEach((btn) => {
      btn.addEventListener("click", () => {
        closeModal(btn.dataset.close);
        if (btn.dataset.back) openModal(btn.dataset.back);
      });
    });
    // about sub-tiles (data-open)
    document.querySelectorAll("[data-open]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const parent = btn.closest(".modal-backdrop");
        if (parent) closeModal(parent.id);
        openModal(btn.dataset.open);
        if (btn.dataset.open === "calendarBackdrop") { renderCountdowns(); renderCalendars(); }
      });
    });
    // tiles that open a full-screen view (e.g. Exam Pattern)
    document.querySelectorAll("[data-view]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const parent = btn.closest(".modal-backdrop");
        if (parent) closeModal(parent.id);
        if (typeof App !== "undefined" && App.show) App.show(btn.dataset.view);
        if (typeof Pattern !== "undefined" && Pattern.onShow) Pattern.onShow();
      });
    });
    // backdrop click to close
    document.querySelectorAll(".info-modal").forEach((modal) => {
      const back = modal.closest(".modal-backdrop");
      back.addEventListener("click", (e) => { if (e.target === back) closeModal(back.id); });
    });

    // interview notes
    document.getElementById("saveNoteBtn").addEventListener("click", saveNote);
    document.getElementById("newNoteInput").addEventListener("keydown", (e) => {
      if (e.key === "Enter") saveNote();
    });
    // interview topics (left sidebar)
    document.getElementById("addTopicBtn").addEventListener("click", addTopic);
    document.getElementById("newTopicInput").addEventListener("keydown", (e) => {
      if (e.key === "Enter") addTopic();
    });
    document.getElementById("topicList").addEventListener("click", (e) => {
      const del = e.target.closest(".iv-topic-del");
      const name = e.target.closest(".iv-topic-name");
      if (del) deleteTopic(del.dataset.id);
      else if (name) selectTopic(name.dataset.id);
    });

    // collapsible stage cards in the Examination Pattern popup (delegated)
    const patternBody = document.getElementById("patternBody");
    if (patternBody) {
      patternBody.addEventListener("click", (e) => {
        const head = e.target.closest(".collapse-head");
        if (head && !head.classList.contains("collapse-head--static") && head.parentElement) {
          head.parentElement.classList.toggle("is-open");
        }
      });
    }
    // pattern back-to-top
    const patternTop = document.getElementById("patternTopBtn");
    if (patternTop) {
      patternTop.addEventListener("click", () => {
        document.getElementById("patternBody").scrollTo({ top: 0, behavior: "smooth" });
      });
    }
    document.getElementById("notesList").addEventListener("click", (e) => {
      const del = e.target.closest(".note-del");
      const edit = e.target.closest(".note-edit");
      if (del) askDeleteNote(del.dataset.id);
      else if (edit) startEditNote(edit.dataset.id);
    });

    // keep countdowns fresh daily
    renderCountdowns();
    setInterval(renderCountdowns, 60 * 1000);

    // Esc closes the topmost info modal
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        document.querySelectorAll(".modal-backdrop.is-open").forEach((b) => {
          if (b.querySelector(".info-modal")) closeModal(b.id);
        });
      }
    });
  }

  function openAbout() { openModal("aboutBackdrop"); }

  function refreshNotes() {
    if (document.getElementById("interviewBackdrop").classList.contains("is-open")) renderTopics();
  }

  function openSyllabusStage(stage) { openStage(stage); }

  return { init, handleCard, openAbout, refreshNotes, openSyllabusStage,
    refreshCalendars: () => { renderCountdowns(); renderCalendars(); } };
})();
