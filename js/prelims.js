/* =========================================================
   prelims.js — Prelims Progress modules
   Tabs: Chapter Completion (tracker.js) · Revision · Mock · CSAT
   Revision & Mock are DERIVED from completed chapters (one-way sync).
   ========================================================= */

const Prelims = (() => {
  const REV_KEY = "upsc.revisionSets";   // { chapterId: {count, lastDate, nextDate} }
  const MOCK_KEY = "upsc.mockSets";       // { chapterId: {count, lastDate} }
  const CSAT_KEY = "upsc.csatTopics";     // [ {id, text, done, completedAt} ]
  const REVISION_GAP_DAYS = 14;

  /* ---------- storage helpers ---------- */
  const readObj = (k) => { try { return JSON.parse(localStorage.getItem(k)) || {}; } catch { return {}; } };
  const readArr = (k) => { try { return JSON.parse(localStorage.getItem(k)) || []; } catch { return []; } };
  const write = (k, v) => Store.setRaw(k, JSON.stringify(v));

  /* ---------- date helpers (reuse global fmtDateLong) ---------- */
  function parseDateInput(val) {
    // val = "YYYY-MM-DD" from <input type=date>; return ms at local noon
    const [y, m, d] = val.split("-").map(Number);
    return new Date(y, m - 1, d, 12, 0, 0).getTime();
  }
  function addDays(ts, days) { return ts + days * 86400000; }
  function todayInputValue() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }

  /* ---------- shared modal helpers ---------- */
  function openModal(id) {
    const m = document.getElementById(id);
    m.classList.add("is-open"); m.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }
  function closeModal(id) {
    const m = document.getElementById(id);
    m.classList.remove("is-open"); m.setAttribute("aria-hidden", "true");
    if (!document.querySelector(".modal-backdrop.is-open")) document.body.style.overflow = "";
  }

  // generic date prompt → resolves via callback
  let _dateCb = null;
  function promptDate(title, msg, cb) {
    document.getElementById("dateTitle").textContent = title;
    document.getElementById("dateMsg").textContent = msg;
    document.getElementById("dateInput").value = todayInputValue();
    _dateCb = cb;
    openModal("dateBackdrop");
  }
  // generic confirm prompt → delegates to shared ConfirmDialog
  function promptConfirm(title, msg, cb, confirmLabel) {
    ConfirmDialog.open({ title, message: msg, confirmLabel: confirmLabel || "🗑️ Delete", onConfirm: cb });
  }

  /* ---------- tab switching ---------- */
  function showTab(name) {
    document.querySelectorAll(".ptab").forEach((t) =>
      t.classList.toggle("is-active", t.dataset.ptab === name));
    document.querySelectorAll(".ppanel").forEach((p) =>
      p.classList.toggle("is-active", p.id === "ppanel-" + name));
    if (name === "revision") renderRevision();
    if (name === "mock") renderMock();
    if (name === "csat") renderCSAT();
    if (name === "notes") renderSubjNotes();
  }

  /* ========================================================
     REVISION SETS (derived from completed chapters)
     ======================================================== */
  /* ---------- group completed chapters by subject ---------- */
  function groupBySubject() {
    const completed = Tracker.completedPrelimsChapters();
    const map = new Map();
    completed.forEach((c) => {
      if (!map.has(c.subject)) map.set(c.subject, { subject: c.subject, emoji: c.emoji, chapters: [] });
      map.get(c.subject).chapters.push(c);
    });
    return Array.from(map.values());
  }

  // small ring (reuse Tracker.ringSVG)
  function subjectRing(pct) { return `<div class="ring" style="--size:56px">${Tracker.ringSVG(pct, 56, 5)}</div>`; }

  /* ========================================================
     REVISION SETS — subject cards → detail modal
     ======================================================== */
  function renderRevision() {
    const wrap = document.getElementById("revisionList");
    const groups = groupBySubject();
    const data = readObj(REV_KEY);

    if (!groups.length) {
      wrap.innerHTML = emptyState("🔁", "No chapters to revise yet. Complete chapters in Chapter Completion and they'll appear here automatically.");
      return;
    }
    wrap.innerHTML = `<div class="subject-grid">` + groups.map((g) => {
      const total = g.chapters.length;
      const revised = g.chapters.filter((c) => (data[c.chapterId] || {}).count > 0).length;
      const totalRevs = g.chapters.reduce((sum, c) => sum + ((data[c.chapterId] || {}).count || 0), 0);
      const pct = total ? Math.round((revised / total) * 100) : 0;
      return `
        <div class="subject-card" data-subject="${escapeHTML(g.subject)}" data-mode="rev" tabindex="0" role="button">
          <div class="subject-top">
            <div>
              <div class="subject-emoji">${g.emoji}</div>
              <h3 class="subject-name">${escapeHTML(g.subject)}</h3>
            </div>
            ${subjectRing(pct)}
          </div>
          <div class="subject-counts">
            <div class="count-block count-block--done"><span class="count-num">${revised}</span><span class="count-lbl">Revised</span></div>
            <div class="count-block"><span class="count-num">${total}</span><span class="count-lbl">Chapters</span></div>
            <div class="count-block"><span class="count-num">${totalRevs}</span><span class="count-lbl">Total Revs</span></div>
          </div>
          <div class="linebar"><div class="linebar-fill" style="width:${pct}%"></div></div>
        </div>`;
    }).join("") + `</div>`;
  }

  function addRevision(chapterId) {
    promptDate("Add Revision", "Enter the revision date:", (ts) => {
      const data = readObj(REV_KEY);
      const r = data[chapterId] || { count: 0, lastDate: null, nextDate: null };
      r.count += 1;
      r.lastDate = ts;
      r.nextDate = addDays(ts, REVISION_GAP_DAYS);
      data[chapterId] = r;
      write(REV_KEY, data);
      renderSetDetail();   // refresh open modal
      renderRevision();    // refresh cards behind
    });
  }

  /* ========================================================
     MOCK SETS (derived from completed chapters)
     ======================================================== */
  function renderMock() {
    const wrap = document.getElementById("mockList");
    const groups = groupBySubject();
    const data = readObj(MOCK_KEY);

    if (!groups.length) {
      wrap.innerHTML = emptyState("📝", "No chapters for mocks yet. Complete chapters in Chapter Completion and they'll appear here automatically.");
      return;
    }
    wrap.innerHTML = `<div class="subject-grid">` + groups.map((g) => {
      const total = g.chapters.length;
      const attempted = g.chapters.filter((c) => (data[c.chapterId] || {}).count > 0).length;
      const totalMocks = g.chapters.reduce((sum, c) => sum + ((data[c.chapterId] || {}).count || 0), 0);
      const pct = total ? Math.round((attempted / total) * 100) : 0;
      return `
        <div class="subject-card" data-subject="${escapeHTML(g.subject)}" data-mode="mock" tabindex="0" role="button">
          <div class="subject-top">
            <div>
              <div class="subject-emoji">${g.emoji}</div>
              <h3 class="subject-name">${escapeHTML(g.subject)}</h3>
            </div>
            ${subjectRing(pct)}
          </div>
          <div class="subject-counts">
            <div class="count-block count-block--done"><span class="count-num">${attempted}</span><span class="count-lbl">Attempted</span></div>
            <div class="count-block"><span class="count-num">${total}</span><span class="count-lbl">Chapters</span></div>
            <div class="count-block"><span class="count-num">${totalMocks}</span><span class="count-lbl">Total Mocks</span></div>
          </div>
          <div class="linebar"><div class="linebar-fill" style="width:${pct}%"></div></div>
        </div>`;
    }).join("") + `</div>`;
  }

  function addMock(chapterId) {
    // Integrated flow: open the full Mock Score form tagged to this chapter.
    if (typeof MockScores !== "undefined" && MockScores.openForChapter) {
      const group = groupBySubject().find((g) => g.subject === currentSet.subject);
      const chapter = group && group.chapters.find((c) => c.chapterId === chapterId);
      MockScores.openForChapter({
        subject: currentSet.subject,
        chapterId,
        chapterTitle: chapter ? chapter.title : "",
      });
      return;
    }
    // Fallback: legacy date-only prompt.
    promptDate("Add Mock", "Enter the mock test date:", (ts) => {
      const data = readObj(MOCK_KEY);
      const m = data[chapterId] || { count: 0, lastDate: null };
      m.count += 1;
      m.lastDate = ts;
      data[chapterId] = m;
      write(MOCK_KEY, data);
      renderSetDetail();
      renderMock();
    });
  }

  // Called by MockScores after a chapter-linked score is saved.
  function syncChapterMock(chapterId, dateKey) {
    const data = readObj(MOCK_KEY);
    const m = data[chapterId] || { count: 0, lastDate: null };
    m.count += 1;
    m.lastDate = dateKey ? parseDateInput(dateKey) : Date.now();
    data[chapterId] = m;
    write(MOCK_KEY, data);
    // refresh any open detail modal + the cards behind
    if (currentSet.mode === "mock") renderSetDetail();
    renderMock();
  }

  function resetSet(chapterId) {
    const isRev = currentSet.mode === "rev";
    const label = isRev ? "revision count" : "mock count";
    promptConfirm("Reset count?", `Are you sure you want to reset the ${label} for this chapter? This action cannot be undone.`, () => {
      const key = isRev ? REV_KEY : MOCK_KEY;
      const data = readObj(key);
      delete data[chapterId];
      write(key, data);
      renderSetDetail();
      if (isRev) renderRevision(); else renderMock();
    }, "↺ Reset");
  }

  /* ========================================================
     SET DETAIL MODAL (chapters within a subject)
     ======================================================== */
  let currentSet = { subject: null, mode: null }; // mode: 'rev' | 'mock'

  function openSetDetail(subject, mode) {
    currentSet = { subject, mode };
    renderSetDetail();
    openModal("setBackdrop");
  }

  function renderSetDetail() {
    if (!currentSet.subject) return;
    const { subject, mode } = currentSet;
    const group = groupBySubject().find((g) => g.subject === subject);
    if (!group) { closeModal("setBackdrop"); return; }

    document.getElementById("setTitle").textContent = `${group.emoji} ${subject}`;
    document.getElementById("setSub").textContent =
      mode === "rev" ? "Revision Sets · chapter-wise" : "Mock Sets · chapter-wise";

    const data = readObj(mode === "rev" ? REV_KEY : MOCK_KEY);
    const body = document.getElementById("setBody");

    body.innerHTML = `<div class="setlist">` + group.chapters.map((c) => {
      const r = data[c.chapterId] || { count: 0, lastDate: null, nextDate: null };
      const countPill = mode === "rev"
        ? `<span class="set-pill set-pill--count">🔁 ${r.count} revision${r.count === 1 ? "" : "s"}</span>`
        : `<span class="set-pill set-pill--count">📝 ${r.count} mock${r.count === 1 ? "" : "s"}</span>`;
      const lastPill = r.lastDate
        ? `<span class="set-pill">Last${mode === "mock" ? " mock" : ""}: ${fmtDateLong(r.lastDate)}</span>`
        : `<span class="set-pill set-pill--muted">${mode === "rev" ? "Not revised yet" : "No mock yet"}</span>`;
      const nextPill = (mode === "rev" && r.nextDate)
        ? `<span class="set-pill set-pill--next">Next suggested: ${fmtDateLong(r.nextDate)}</span>` : "";
      const btnLabel = mode === "rev" ? "＋ Add Revision" : "＋ Add Mock";
      const act = mode === "rev" ? "add-rev" : "add-mock";
      const hasData = r.count > 0;
      return `
        <div class="set-card" data-id="${c.chapterId}">
          <div class="set-main">
            <h4 class="set-title">${escapeHTML(c.title)}</h4>
            <div class="set-meta">${countPill}${lastPill}${nextPill}</div>
          </div>
          <div class="set-actions">
            <button class="btn btn--primary btn--sm set-add" data-act="${act}" data-id="${c.chapterId}">${btnLabel}</button>
            ${hasData ? `<button class="icon-btn icon-btn--danger set-reset" data-act="reset" data-id="${c.chapterId}" title="Reset count" aria-label="Reset count">↺</button>` : ""}
          </div>
        </div>`;
    }).join("") + `</div>`;
  }

  /* ========================================================
     CSAT (independent topic checklist)
     ======================================================== */
  let csatEditingId = null;

  function getCSAT() { return readArr(CSAT_KEY); }
  function setCSAT(arr) { write(CSAT_KEY, arr); }

  function renderCSAT() {
    const wrap = document.getElementById("csatList");
    const topics = getCSAT().sort((a, b) => (b.completedAt || b.createdAt || 0) - (a.completedAt || a.createdAt || 0));
    if (!topics.length) {
      wrap.innerHTML = emptyState("🧮", "No CSAT topics yet. Add a topic above to start tracking.");
      return;
    }
    wrap.innerHTML = topics.map((t) => `
      <div class="set-card ${t.done ? "set-card--done" : ""}" data-id="${t.id}">
        <div class="set-main">
          <h4 class="set-title">${t.done ? "✓ " : ""}${escapeHTML(t.text)}</h4>
          ${t.done && t.completedAt
            ? `<div class="set-meta"><span class="set-pill set-pill--next">📅 ${fmtDateLong(t.completedAt)}</span><span class="set-pill">🕒 ${fmtTimeShort(t.completedAt)}</span></div>`
            : `<span class="set-subject">Not completed</span>`}
        </div>
        <div class="set-actions">
          <button class="btn-complete ${t.done ? "is-done" : ""}" data-act="csat-toggle" data-id="${t.id}">${t.done ? "Completed" : "Mark done"}</button>
          <button class="icon-btn" data-act="csat-edit" data-id="${t.id}" aria-label="Edit topic">✎</button>
          <button class="icon-btn icon-btn--danger" data-act="csat-del" data-id="${t.id}" aria-label="Delete topic">🗑</button>
        </div>
      </div>`).join("");
  }

  function saveCSAT() {
    const input = document.getElementById("csatInput");
    const btn = document.getElementById("csatAddBtn");
    const v = input.value.trim();
    if (!v) { input.focus(); return; }
    const topics = getCSAT();
    if (csatEditingId) {
      const t = topics.find((x) => x.id === csatEditingId);
      if (t) t.text = v;
      csatEditingId = null;
      btn.innerHTML = "＋ Add Topic";
      input.placeholder = "Add a CSAT topic…";
    } else {
      topics.push({ id: "t" + Date.now().toString(36) + Math.random().toString(36).slice(2,5),
        text: v, done: false, completedAt: null, createdAt: Date.now() });
    }
    setCSAT(topics);
    input.value = "";
    renderCSAT();
    input.focus();
  }
  function toggleCSAT(id) {
    const topics = getCSAT();
    const t = topics.find((x) => x.id === id);
    if (t) { t.done = !t.done; t.completedAt = t.done ? Date.now() : null; }
    setCSAT(topics);
    renderCSAT();
  }
  function editCSAT(id) {
    const t = getCSAT().find((x) => x.id === id);
    if (!t) return;
    csatEditingId = id;
    const input = document.getElementById("csatInput");
    input.value = t.text; input.placeholder = "Editing topic…";
    document.getElementById("csatAddBtn").innerHTML = "✔ Update";
    input.focus();
  }
  function deleteCSAT(id) {
    promptConfirm("Delete Topic?", "Are you sure you want to delete this CSAT topic? This action cannot be undone.", () => {
      const card = document.querySelector(`#csatList .set-card[data-id="${id}"]`);
      const doRemove = () => { setCSAT(getCSAT().filter((x) => x.id !== id)); renderCSAT(); };
      if (card) { card.classList.add("set-removing"); setTimeout(doRemove, 280); }
      else doRemove();
    });
  }

  /* ========================================================
     SUBJECT NOTES — one subject at a time, multiple chapter notes
     ======================================================== */
  const SUBJNOTE_KEY = "upsc.subjectNotes"; // { subjectName: [ {id, chapter, text, createdAt, editedAt} ] }
  let subjnoteEditingId = null;
  let subjnoteQuery = "";

  // Prelims subject names + "General" (whole-Prelims notes)
  const PRELIMS_SUBJECTS = [
    "Polity", "Economy", "Geography", "Environment",
    "Modern History", "Ancient History", "Medieval History",
    "Art & Culture", "Science & Technology",
  ];
  const NOTE_SUBJECTS = ["General (whole Prelims)", ...PRELIMS_SUBJECTS];

  function getSubjNotes() { try { return JSON.parse(localStorage.getItem(SUBJNOTE_KEY)) || {}; } catch { return {}; } }
  function setSubjNotes(o) { write(SUBJNOTE_KEY, o); }
  function currentSubject() {
    const sel = document.getElementById("notesSubject");
    return sel ? sel.value : NOTE_SUBJECTS[0];
  }

  function populateSubjectSelect() {
    const sel = document.getElementById("notesSubject");
    if (!sel || sel.options.length) return; // populate once
    sel.innerHTML = NOTE_SUBJECTS.map((s) => `<option value="${escapeHTML(s)}">${escapeHTML(s)}</option>`).join("");
  }

  // chapter dropdown options for the currently selected subject
  function populateChapterSelect() {
    const sel = document.getElementById("subjnoteChapter");
    if (!sel) return;
    const subject = currentSubject();
    let opts = [`<option value="">General (whole subject)</option>`];
    if (subject !== NOTE_SUBJECTS[0]) {
      const titles = Tracker.prelimsChapterTitles(subject);
      opts = opts.concat(titles.map((t) => `<option value="${escapeHTML(t)}">${escapeHTML(t)}</option>`));
    }
    sel.innerHTML = opts.join("");
  }

  function renderSubjNotes() {
    populateSubjectSelect();
    populateChapterSelect();
    const subject = currentSubject();
    const all = getSubjNotes();
    let notes = (all[subject] || []).slice().sort((a, b) => b.createdAt - a.createdAt);

    if (subjnoteQuery) {
      const q = subjnoteQuery.toLowerCase();
      notes = notes.filter((n) =>
        n.text.toLowerCase().includes(q) || (n.chapter || "").toLowerCase().includes(q));
    }

    const wrap = document.getElementById("subjnoteList");
    if (!notes.length) {
      wrap.innerHTML = emptyState("📒", subjnoteQuery
        ? "No notes match your search."
        : `No notes for ${escapeHTML(subject)} yet. Add one above.`);
      return;
    }
    wrap.innerHTML = notes.map((n) => `
      <div class="set-card" data-id="${n.id}">
        <div class="set-main">
          <span class="subjnote-chip">${n.chapter ? escapeHTML(n.chapter) : (subject === NOTE_SUBJECTS[0] ? "General" : "Whole subject")}</span>
          <p class="note-text">${escapeHTML(n.text)}</p>
          <div class="set-meta">
            <span class="set-pill">📅 ${fmtDateLong(n.createdAt)}</span>
            <span class="set-pill">🕒 ${fmtTimeShort(n.createdAt)}</span>
            ${n.editedAt ? `<span class="set-pill set-pill--next">✏️ Edited: ${fmtDateLong(n.editedAt)} · ${fmtTimeShort(n.editedAt)}</span>` : ""}
          </div>
        </div>
        <div class="set-actions">
          <button class="icon-btn" data-act="sn-edit" data-id="${n.id}" aria-label="Edit note">✎</button>
          <button class="icon-btn icon-btn--danger" data-act="sn-del" data-id="${n.id}" aria-label="Delete note">🗑</button>
        </div>
      </div>`).join("");
  }

  function saveSubjNote() {
    const subject = currentSubject();
    const chapInput = document.getElementById("subjnoteChapter");
    const textInput = document.getElementById("subjnoteText");
    const btn = document.getElementById("subjnoteAddBtn");
    const text = textInput.value.trim();
    if (!text) { textInput.focus(); return; }
    const chapter = chapInput.value.trim();
    const all = getSubjNotes();
    if (!all[subject]) all[subject] = [];

    if (subjnoteEditingId) {
      const note = all[subject].find((x) => x.id === subjnoteEditingId);
      if (note) { note.text = text; note.chapter = chapter; note.editedAt = Date.now(); }
      subjnoteEditingId = null;
      btn.innerHTML = "＋ Add Note";
    } else {
      all[subject].push({
        id: "sn" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
        chapter, text, createdAt: Date.now(), editedAt: null,
      });
    }
    setSubjNotes(all);
    chapInput.value = ""; textInput.value = "";
    renderSubjNotes();
    textInput.focus();
  }

  function editSubjNote(id) {
    const subject = currentSubject();
    const note = (getSubjNotes()[subject] || []).find((x) => x.id === id);
    if (!note) return;
    subjnoteEditingId = id;
    document.getElementById("subjnoteChapter").value = note.chapter || "";
    document.getElementById("subjnoteText").value = note.text;
    document.getElementById("subjnoteAddBtn").innerHTML = "✔ Update";
    document.getElementById("subjnoteText").focus();
  }

  function deleteSubjNote(id) {
    const subject = currentSubject();
    promptConfirm("Delete Note?", "Are you sure you want to delete this note? This action cannot be undone.", () => {
      const all = getSubjNotes();
      if (all[subject]) all[subject] = all[subject].filter((x) => x.id !== id);
      setSubjNotes(all);
      renderSubjNotes();
    });
  }

  /* ---------- shared empty state ---------- */
  function emptyState(icon, msg) {
    return `<div class="notes-empty"><span class="notes-empty-icon">${icon}</span><span>${msg}</span></div>`;
  }

  /* ---------- refresh (called when chapters change) ---------- */
  function refresh() {
    const revActive = document.getElementById("ppanel-revision").classList.contains("is-active");
    const mockActive = document.getElementById("ppanel-mock").classList.contains("is-active");
    if (revActive) renderRevision();
    if (mockActive) renderMock();
  }

  /* ---------- init ---------- */
  function init() {
    // tab clicks
    const tabs = document.getElementById("prelimsTabs");
    if (tabs) tabs.addEventListener("click", (e) => {
      const t = e.target.closest(".ptab");
      if (t) showTab(t.dataset.ptab);
    });

    // syllabus shortcut → Prelims syllabus
    const sylBtn = document.getElementById("prelimsSyllabusBtn");
    if (sylBtn) sylBtn.addEventListener("click", () => {
      if (typeof Menu !== "undefined" && Menu.openSyllabusStage) Menu.openSyllabusStage("prelims");
    });

    // revision + mock: clicking a subject card opens its chapter detail modal
    function wireCards(listId, mode) {
      const list = document.getElementById(listId);
      list.addEventListener("click", (e) => {
        const card = e.target.closest(".subject-card");
        if (card) openSetDetail(card.dataset.subject, card.dataset.mode);
      });
      list.addEventListener("keydown", (e) => {
        const card = e.target.closest(".subject-card");
        if (card && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault(); openSetDetail(card.dataset.subject, card.dataset.mode);
        }
      });
    }
    wireCards("revisionList", "rev");
    wireCards("mockList", "mock");

    // add-revision / add-mock buttons live inside the detail modal body
    document.getElementById("setBody").addEventListener("click", (e) => {
      const rev = e.target.closest("[data-act='add-rev']");
      const mock = e.target.closest("[data-act='add-mock']");
      const reset = e.target.closest("[data-act='reset']");
      if (rev) addRevision(rev.dataset.id);
      else if (mock) addMock(mock.dataset.id);
      else if (reset) resetSet(reset.dataset.id);
    });
    document.getElementById("setClose").addEventListener("click", () => closeModal("setBackdrop"));
    document.getElementById("setBackdrop").addEventListener("click", (e) => {
      if (e.target.id === "setBackdrop") closeModal("setBackdrop");
    });

    // CSAT
    document.getElementById("csatAddBtn").addEventListener("click", saveCSAT);
    document.getElementById("csatInput").addEventListener("keydown", (e) => { if (e.key === "Enter") saveCSAT(); });
    document.getElementById("csatList").addEventListener("click", (e) => {
      const el = e.target.closest("[data-act]");
      if (!el) return;
      const id = el.dataset.id;
      if (el.dataset.act === "csat-toggle") toggleCSAT(id);
      else if (el.dataset.act === "csat-edit") editCSAT(id);
      else if (el.dataset.act === "csat-del") deleteCSAT(id);
    });

    // subject notes
    document.getElementById("subjnoteAddBtn").addEventListener("click", saveSubjNote);
    document.getElementById("subjnoteText").addEventListener("keydown", (e) => { if (e.key === "Enter") saveSubjNote(); });
    document.getElementById("subjnoteChapter").addEventListener("keydown", (e) => { if (e.key === "Enter") document.getElementById("subjnoteText").focus(); });
    document.getElementById("notesSubject").addEventListener("change", () => { subjnoteEditingId = null; document.getElementById("subjnoteAddBtn").innerHTML = "＋ Add Note"; renderSubjNotes(); });
    document.getElementById("notesSearch").addEventListener("input", (e) => { subjnoteQuery = e.target.value.trim(); renderSubjNotes(); });
    document.getElementById("subjnoteList").addEventListener("click", (e) => {
      const el = e.target.closest("[data-act]");
      if (!el) return;
      if (el.dataset.act === "sn-edit") editSubjNote(el.dataset.id);
      else if (el.dataset.act === "sn-del") deleteSubjNote(el.dataset.id);
    });

    // date prompt buttons
    document.getElementById("dateSave").addEventListener("click", () => {
      const val = document.getElementById("dateInput").value;
      if (!val) { document.getElementById("dateInput").focus(); return; }
      const cb = _dateCb; _dateCb = null;
      closeModal("dateBackdrop");
      if (cb) cb(parseDateInput(val));
    });
    document.getElementById("dateCancel").addEventListener("click", () => { _dateCb = null; closeModal("dateBackdrop"); });
    document.getElementById("dateBackdrop").addEventListener("click", (e) => {
      if (e.target.id === "dateBackdrop") { _dateCb = null; closeModal("dateBackdrop"); }
    });
  }

  return { init, showTab, refresh, renderRevision, renderMock, renderCSAT, syncChapterMock };
})();
