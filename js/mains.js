/* =========================================================
   mains.js — Mains Progress (7 cards, per-topic notes)
   Each topic has its own notes list (add/delete/timestamps),
   persisted in localStorage, deletes via shared ConfirmDialog.
   ========================================================= */

const Mains = (() => {
  const NOTE_KEY_PREFIX = "upsc.mainsNotes."; // + topicId

  /* ---------- card / topic definitions ---------- */
  const CARDS = [
    {
      id: "general", icon: "🗂️", title: "General",
      kind: "topics", // uses subtopic system (default mode)
      topics: [
        { id: "answer-writing", label: "Answer Writing", icon: "✍️" },
        { id: "current-affairs", label: "Current Affairs", icon: "📰" },
        { id: "quotes-examples", label: "Quotes & Examples", icon: "💬" },
        { id: "data-reports", label: "Data, Reports & Committees", icon: "📊" },
        { id: "diagrams-maps", label: "Diagrams & Maps", icon: "🗺️" },
        { id: "misc", label: "Miscellaneous", icon: "📎" },
      ],
    },
    {
      id: "essay", icon: "✍️", title: "Essay", notesMode: "notes",
      kind: "single", // a single notes area, no topic buttons
      topics: [{ id: "essay", label: "Essay" }],
    },
    {
      id: "lang", icon: "🗣️", title: "Language Papers", notesMode: "notes",
      kind: "topics",
      topics: [
        { id: "paper-a", label: "Language Paper A", icon: "📄" },
        { id: "paper-b", label: "Language Paper B (English)", icon: "📄" },
      ],
    },
    {
      id: "gs1", icon: "📜", title: "GS Paper I",
      kind: "topics",
      topics: [
        { id: "heritage", label: "Indian Heritage & Culture", icon: "🏛️" },
        { id: "modern", label: "Modern Indian History", icon: "📖" },
        { id: "freedom", label: "Freedom Struggle", icon: "⛓️" },
        { id: "post-ind", label: "Post-Independence India", icon: "🇮🇳" },
        { id: "world", label: "World History", icon: "🌍" },
        { id: "society", label: "Indian Society", icon: "👥" },
        { id: "geography", label: "Geography (Indian & World)", icon: "🗺️" },
      ],
    },
    {
      id: "gs2", icon: "⚖️", title: "GS Paper II",
      kind: "topics",
      topics: [
        { id: "constitution", label: "Indian Constitution", icon: "📕" },
        { id: "polity", label: "Polity", icon: "🏛️" },
        { id: "governance", label: "Governance", icon: "🏢" },
        { id: "social-justice", label: "Social Justice", icon: "🤝" },
        { id: "ir", label: "International Relations (IR)", icon: "🌐" },
      ],
    },
    {
      id: "gs3", icon: "📈", title: "GS Paper III",
      kind: "topics",
      topics: [
        { id: "economy", label: "Indian Economy", icon: "💰" },
        { id: "agriculture", label: "Agriculture", icon: "🌾" },
        { id: "scitech", label: "Science & Technology", icon: "🔬" },
        { id: "environment", label: "Environment & Ecology", icon: "🌱" },
        { id: "biodiversity", label: "Biodiversity", icon: "🦋" },
        { id: "disaster", label: "Disaster Management", icon: "🌪️" },
        { id: "security", label: "Internal Security", icon: "🛡️" },
      ],
    },
    {
      id: "gs4", icon: "🧭", title: "GS Paper IV",
      kind: "topics",
      topics: [
        { id: "ethics", label: "Ethics", icon: "⚖️" },
        { id: "human-values", label: "Human Values", icon: "💛" },
        { id: "attitude", label: "Attitude", icon: "🧠" },
        { id: "ei", label: "Emotional Intelligence", icon: "❤️" },
        { id: "thinkers", label: "Moral Thinkers & Philosophers", icon: "🕊️" },
        { id: "aptitude", label: "Aptitude & Foundational Values", icon: "🎯" },
        { id: "civil-values", label: "Public/Civil Service Values", icon: "🏛️" },
        { id: "probity", label: "Probity in Governance", icon: "🔍" },
        { id: "case-studies", label: "Case Studies", icon: "📝" },
      ],
    },
    {
      id: "anthro", icon: "🧬", title: "Anthropology (Optional)",
      kind: "topics",
      topics: [
        { id: "paper-1", label: "Anthropology Paper I", icon: "📘" },
        { id: "paper-2", label: "Anthropology Paper II", icon: "📗" },
      ],
    },
  ];

  /* ---------- date helpers ---------- */
  function fmtDate(ts) {
    const d = new Date(ts);
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${String(d.getDate()).padStart(2,"0")} ${months[d.getMonth()]} ${d.getFullYear()}`;
  }
  function fmtTime(ts) {
    const d = new Date(ts);
    let h = d.getHours(); const m = String(d.getMinutes()).padStart(2,"0");
    const ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12;
    return `${String(h).padStart(2,"0")}:${m} ${ap}`;
  }

  /* ---------- notes storage (per topic) ---------- */
  function key(topicId) { return NOTE_KEY_PREFIX + topicId; }
  function getNotes(topicId) {
    try { return JSON.parse(localStorage.getItem(key(topicId))) || []; } catch { return []; }
  }
  function setNotes(topicId, arr) { Store.setRaw(key(topicId), JSON.stringify(arr)); }
  function noteCount(topicId) { return getNotes(topicId).length; }

  /* ---------- render the view (cards + nav) ---------- */
  function renderView() {
    const nav = document.getElementById("mainsNav");
    const wrap = document.getElementById("mainsScroll");

    nav.innerHTML = CARDS.map((c, i) =>
      `<a href="#mcard-${c.id}" class="pnav-link ${i === 0 ? "is-active" : ""}" data-target="mcard-${c.id}">${c.icon} ${escapeHTML(c.title)}</a>`
    ).join("") +
      `<button class="pnav-link pnav-syllabus" id="mainsSyllabusBtn" type="button">📚 Syllabus</button>`;

    wrap.innerHTML = `<p class="pattern-intro reveal">Capture and organise your Mains preparation, paper by paper. GS & Optional topics open a Topic → Subtopic system; Essay and Language papers keep quick notes.</p>` +
      CARDS.map((c) => {
        const mode = c.notesMode || "subtopics";
        const topicsHTML = c.topics.map((t) => {
          let cntLabel;
          if (mode === "notes") {
            const cnt = noteCount(`${c.id}:${t.id}`);
            cntLabel = cnt ? cnt + (cnt === 1 ? " note" : " notes") : "0 notes";
          } else {
            const cnt = (typeof Subtopics !== "undefined") ? Subtopics.count(`${c.id}:${t.id}`) : 0;
            cntLabel = cnt ? cnt + (cnt === 1 ? " subtopic" : " subtopics") : "0 subtopics";
          }
          return `
            <button class="mtopic" data-card="${c.id}" data-topic="${t.id}" data-label="${escapeHTML(t.label)}" data-mode="${mode}">
              <span class="mtopic-icon">${t.icon || "📝"}</span>
              <span class="mtopic-body">
                <span class="mtopic-label">${escapeHTML(t.label)}</span>
                <span class="mtopic-count">${cntLabel}</span>
              </span>
            </button>`;
        }).join("");
        return `
          <section class="pattern-section reveal mcard glass" id="mcard-${c.id}">
            <h2 class="pattern-h"><span class="pattern-h-icon">${c.icon}</span> ${escapeHTML(c.title)}</h2>
            <div class="mtopic-grid">${topicsHTML}</div>
          </section>`;
      }).join("");

    // reveal sections
    wrap.querySelectorAll(".reveal").forEach((el) => el.classList.add("is-visible"));
  }

  /* ---------- topic notes modal ---------- */
  let currentTopicId = null;

  function openTopic(cardId, topicId, label) {
    currentTopicId = `${cardId}:${topicId}`;
    document.getElementById("topicNotesTitle").textContent = label;
    renderTopicNotes();
    const m = document.getElementById("topicNotesBackdrop");
    m.classList.add("is-open"); m.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    document.getElementById("topicNoteInput").focus();
  }
  function closeTopic() {
    const m = document.getElementById("topicNotesBackdrop");
    m.classList.remove("is-open"); m.setAttribute("aria-hidden", "true");
    if (!document.querySelector(".modal-backdrop.is-open")) document.body.style.overflow = "";
    currentTopicId = null;
    renderView(); // refresh counts on cards
  }

  function renderTopicNotes() {
    if (!currentTopicId) return;
    const notes = getNotes(currentTopicId).sort((a, b) => b.createdAt - a.createdAt);
    document.getElementById("topicNotesCount").textContent = notes.length;
    const list = document.getElementById("topicNotesList");
    if (!notes.length) {
      list.innerHTML = `<li class="notes-empty"><span class="notes-empty-icon">📝</span><span>No notes yet. Click <strong>Add Note</strong> to get started.</span></li>`;
      return;
    }
    list.innerHTML = notes.map((n) => `
      <li class="note-card" data-id="${n.id}">
        <div class="note-main">
          <p class="note-text">${escapeHTML(n.text)}</p>
          <div class="note-meta">
            <span class="note-stamp">📅 ${fmtDate(n.createdAt)}</span>
            <span class="note-stamp">🕒 ${fmtTime(n.createdAt)}</span>
          </div>
        </div>
        <div class="note-actions">
          <button class="icon-btn icon-btn--danger note-del" data-id="${n.id}" aria-label="Delete note">🗑</button>
        </div>
      </li>`).join("");
  }

  function addTopicNote() {
    const input = document.getElementById("topicNoteInput");
    const v = input.value.trim();
    if (!v || !currentTopicId) { input.focus(); return; }
    const notes = getNotes(currentTopicId);
    notes.push({ id: "n" + Date.now().toString(36) + Math.random().toString(36).slice(2,5),
      text: v, createdAt: Date.now() });
    setNotes(currentTopicId, notes);
    input.value = "";
    renderTopicNotes();
    input.focus();
  }
  function deleteTopicNote(id) {
    ConfirmDialog.open({
      title: "Delete Note?",
      message: "Are you sure you want to delete this note? This action cannot be undone.",
      confirmLabel: "🗑️ Delete",
      onConfirm: () => {
        const card = document.querySelector(`#topicNotesList .note-card[data-id="${id}"]`);
        const doRemove = () => { setNotes(currentTopicId, getNotes(currentTopicId).filter((x) => x.id !== id)); renderTopicNotes(); };
        if (card) { card.classList.add("note-removing"); setTimeout(doRemove, 280); }
        else doRemove();
      },
    });
  }

  /* ---------- scroll spy (reuse pattern style) ---------- */
  function initSpy() {
    const scroller = document.getElementById("mainsScroll");
    if (!scroller) return;
    let ticking = false;
    scroller.addEventListener("scroll", () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const sections = Array.from(scroller.querySelectorAll(".pattern-section"));
        const links = Array.from(document.querySelectorAll("#mainsNav .pnav-link"));
        const top = scroller.scrollTop, offset = 120;
        let current = sections.length ? sections[0].id : null;
        sections.forEach((s) => { if (s.offsetTop - offset <= top) current = s.id; });
        links.forEach((a) => a.classList.toggle("is-active", a.dataset.target === current));
        ticking = false;
      });
    }, { passive: true });
  }

  /* ---------- show (called from menu) ---------- */
  function onShow() { renderView(); }

  /* ---------- init ---------- */
  function init() {
    renderView();
    initSpy();

    // nav smooth scroll + syllabus shortcut
    document.getElementById("mainsNav").addEventListener("click", (e) => {
      const syl = e.target.closest("#mainsSyllabusBtn");
      if (syl) {
        if (typeof Menu !== "undefined" && Menu.openSyllabusStage) Menu.openSyllabusStage("mains");
        return;
      }
      const a = e.target.closest(".pnav-link");
      if (!a) return;
      e.preventDefault();
      const el = document.getElementById(a.dataset.target);
      const scroller = document.getElementById("mainsScroll");
      if (el && scroller) scroller.scrollTo({ top: el.offsetTop - 20, behavior: "smooth" });
    });

    // topic button clicks
    document.getElementById("mainsScroll").addEventListener("click", (e) => {
      const btn = e.target.closest(".mtopic");
      if (!btn) return;
      if (btn.dataset.mode === "notes") {
        openTopic(btn.dataset.card, btn.dataset.topic, btn.dataset.label);
      } else if (typeof Subtopics !== "undefined") {
        Subtopics.open(`${btn.dataset.card}:${btn.dataset.topic}`, btn.dataset.label);
      }
    });

    // back to menu
    document.getElementById("mainsBack").addEventListener("click", () => {
      if (typeof App !== "undefined" && App.show) App.show("menu");
    });

    // topic notes modal
    document.getElementById("topicNoteAddBtn").addEventListener("click", addTopicNote);
    document.getElementById("topicNoteInput").addEventListener("keydown", (e) => { if (e.key === "Enter") addTopicNote(); });
    document.getElementById("topicNotesClose").addEventListener("click", closeTopic);
    document.getElementById("topicNotesBackdrop").addEventListener("click", (e) => {
      if (e.target.id === "topicNotesBackdrop") closeTopic();
    });
    document.getElementById("topicNotesList").addEventListener("click", (e) => {
      const del = e.target.closest(".note-del");
      if (del) deleteTopicNote(del.dataset.id);
    });
  }

  return { init, onShow };
})();
