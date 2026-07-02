/* =========================================================
   tracker.js — subject grid, dashboard stats, progress math
   ========================================================= */

const Tracker = (() => {
  let subjects = [];
  let subjectFilter = "all";
  let subjectQuery = "";

  /* ---------- helpers ---------- */
  // Subjects excluded from Prelims Progress (Mains-only / Optional / Essay)
  // Subjects excluded from Prelims Progress entirely
  const NON_PRELIMS = [
    "Essay", "Ethics", "Anthropology Optional",
    "International Relations", "Internal Security", "Disaster Management",
    "Agriculture", "Society",
  ];
  const isPrelims = (s) => !NON_PRELIMS.includes(s.name);

  const pct = (done, total) => (total === 0 ? 0 : Math.round((done / total) * 100));
  const doneCount = (s) => s.chapters.filter((c) => c.done).length;

  const overall = () => {
    let total = 0, done = 0;
    const prelims = subjects.filter(isPrelims);
    prelims.forEach((s) => { total += s.chapters.length; done += doneCount(s); });
    return { total, done, remaining: total - done, percent: pct(done, total), subjects: prelims.length };
  };

  /* ---------- streak + activity ---------- */
  function streakDays() {
    const a = Store.getActivity();
    let streak = 0;
    const d = new Date();
    // count back from today while activity > 0
    for (;;) {
      const key = d.toISOString().slice(0, 10);
      if (a[key] && a[key] > 0) { streak++; d.setDate(d.getDate() - 1); }
      else break;
    }
    return streak;
  }
  const todayCount = () => Store.getActivity()[Store.todayKey()] || 0;
  function rangeCount(days) {
    const a = Store.getActivity();
    let sum = 0;
    const d = new Date();
    for (let i = 0; i < days; i++) {
      sum += a[d.toISOString().slice(0, 10)] || 0;
      d.setDate(d.getDate() - 1);
    }
    return sum;
  }

  /* ---------- SVG ring builder ---------- */
  function ringSVG(percent, size = 64, stroke = 6) {
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const offset = c - (percent / 100) * c;
    return `
      <svg viewBox="0 0 ${size} ${size}">
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="var(--amber)"/>
            <stop offset="100%" stop-color="var(--green)"/>
          </linearGradient>
        </defs>
        <circle class="ring-track" cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke-width="${stroke}"/>
        <circle class="ring-fill" cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke-width="${stroke}"
          stroke-dasharray="${c}" stroke-dashoffset="${offset}"/>
      </svg>
      <div class="ring-text">${percent}%</div>`;
  }

  /* ---------- dashboard stats ---------- */
  function renderStats() {
    const o = overall();
    const grid = document.getElementById("statsGrid");
    const cards = [
      { label: "Total subjects", value: o.subjects },
      { label: "Total chapters", value: o.total },
      { label: "Completed", value: o.done, cls: "stat-card--green" },
      { label: "Remaining", value: o.remaining },
      { label: "Overall", value: `${o.percent}<small>%</small>`, cls: "stat-card--accent", bar: o.percent },
      { label: "Daily streak", value: `${streakDays()}<small> d</small>` },
      { label: "Today", value: todayCount() },
      { label: "This week", value: rangeCount(7) },
      { label: "This month", value: rangeCount(30) },
    ];
    grid.innerHTML = cards.map((c) => `
      <div class="stat-card ${c.cls || ""}">
        <div class="stat-label">${c.label}</div>
        <div class="stat-value">${c.value}</div>
        ${c.bar != null ? `<div class="stat-bar"><div class="stat-bar-fill" style="width:${c.bar}%"></div></div>` : ""}
      </div>`).join("");

    // menu page mirror
    const menuStat = document.getElementById("menuOverallStat");
    if (menuStat) menuStat.textContent = `${o.percent}% complete`;
  }

  /* ---------- filtering ---------- */
  function visibleSubjects() {
    let list = subjects.filter(isPrelims);
    if (subjectQuery) {
      const q = subjectQuery.toLowerCase();
      list = list.filter((s) => s.name.toLowerCase().includes(q));
    }
    switch (subjectFilter) {
      case "completed":
        list = list.filter((s) => s.chapters.length > 0 && doneCount(s) === s.chapters.length); break;
      case "incomplete":
        list = list.filter((s) => doneCount(s) < s.chapters.length || s.chapters.length === 0); break;
      case "recent":
        list.sort((a, b) => {
          const am = Math.max(0, ...a.chapters.map((c) => c.createdAt || 0));
          const bm = Math.max(0, ...b.chapters.map((c) => c.createdAt || 0));
          return bm - am;
        }); break;
      case "alpha":
        list.sort((a, b) => a.name.localeCompare(b.name)); break;
      default:
        list.sort((a, b) => a.order - b.order);
    }
    return list;
  }

  /* ---------- subject cards ---------- */
  function renderSubjects() {
    const grid = document.getElementById("subjectGrid");
    const list = visibleSubjects();

    if (!list.length) {
      grid.innerHTML = `
        <div class="empty-state">
          <span class="empty-emoji">🔍</span>
          <div class="empty-title">Nothing here yet</div>
          <p>No subjects match this view. Try a different filter or search.</p>
        </div>`;
      return;
    }

    grid.innerHTML = list.map((s, i) => {
      const total = s.chapters.length;
      const done = doneCount(s);
      const p = pct(done, total);
      const complete = total > 0 && done === total;
      return `
        <div class="subject-card ${complete ? "is-complete" : ""}" data-id="${s.id}"
             tabindex="0" role="button" style="animation-delay:${Math.min(i, 10) * 35}ms"
             aria-label="${s.name}, ${done} of ${total} chapters done">
          <div class="subject-top">
            <div>
              <div class="subject-emoji">${s.emoji || "📘"}</div>
              <h3 class="subject-name">${escapeHTML(s.name)}</h3>
            </div>
            <div class="ring" style="--size:64px">${ringSVG(p, 64, 6)}</div>
          </div>
          <div class="subject-counts">
            <div class="count-block count-block--done">
              <span class="count-num">${done}</span>
              <span class="count-lbl">Done</span>
            </div>
            <div class="count-block">
              <span class="count-num">${total - done}</span>
              <span class="count-lbl">Left</span>
            </div>
            <div class="count-block">
              <span class="count-num">${total}</span>
              <span class="count-lbl">Total</span>
            </div>
          </div>
          <div class="linebar"><div class="linebar-fill" style="width:${p}%"></div></div>
        </div>`;
    }).join("");

    // wire clicks
    grid.querySelectorAll(".subject-card").forEach((card) => {
      const open = () => Popup.open(card.dataset.id);
      card.addEventListener("click", open);
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
      });
    });
  }

  function renderAll() { renderStats(); renderSubjects(); }

  /* ---------- public mutations (called by Popup) ---------- */
  function getSubject(id) { return subjects.find((s) => s.id === id); }

  function toggleChapter(subjectId, chapterId) {
    const s = getSubject(subjectId);
    const c = s.chapters.find((ch) => ch.id === chapterId);
    if (!c) return null;
    const wasComplete = s.chapters.length > 0 && doneCount(s) === s.chapters.length;
    c.done = !c.done;
    c.completedAt = c.done ? Date.now() : null; // timestamp for sync + display
    Store.bumpActivity(c.done ? 1 : -1);
    persist();
    // The subject cards + stats sit BEHIND the open chapter modal, so there's
    // no need to re-render (and re-animate) them on every toggle. Popup does a
    // surgical row update itself; we just mark the background dirty and refresh
    // it once when the modal closes. This removes the multi-second stagger lag.
    if (_modalOpen) { _bgDirty = true; }
    else { renderAll(); }
    // refresh derived Revision/Mock modules if present (cheap: only if a panel is active)
    if (typeof Prelims !== "undefined" && Prelims.refresh) Prelims.refresh();
    const nowComplete = s.chapters.length > 0 && doneCount(s) === s.chapters.length;
    return { chapter: c, justCompletedSubject: !wasComplete && nowComplete };
  }

  // Popup tells us when its modal opens/closes so we can defer background work.
  let _modalOpen = false;
  let _bgDirty = false;
  function setModalOpen(open) {
    _modalOpen = !!open;
    if (!_modalOpen && _bgDirty) { _bgDirty = false; renderAll(); }
  }

  function addChapter(subjectId, title) {
    const s = getSubject(subjectId);
    s.chapters.push({ id: Store.uid(), title, done: false, createdAt: Date.now() });
    persist(); renderAll();
  }
  function editChapter(subjectId, chapterId, title) {
    const c = getSubject(subjectId).chapters.find((ch) => ch.id === chapterId);
    if (c) { c.title = title; persist(); renderAll(); }
  }
  function deleteChapter(subjectId, chapterId) {
    const s = getSubject(subjectId);
    const c = s.chapters.find((ch) => ch.id === chapterId);
    if (c && c.done) Store.bumpActivity(-1);
    s.chapters = s.chapters.filter((ch) => ch.id !== chapterId);
    persist(); renderAll();
  }

  function persist() { Store.setSubjects(subjects); }

  /* ---------- init + wiring ---------- */
  function init() {
    subjects = Store.getSubjects();

    document.getElementById("subjectSearch").addEventListener("input", (e) => {
      subjectQuery = e.target.value.trim();
      renderSubjects();
    });
    document.getElementById("subjectFilters").addEventListener("click", (e) => {
      const btn = e.target.closest(".chip");
      if (!btn) return;
      document.querySelectorAll("#subjectFilters .chip").forEach((c) => c.classList.remove("is-active"));
      btn.classList.add("is-active");
      subjectFilter = btn.dataset.filter;
      renderSubjects();
    });

    renderAll();
  }

  // all completed chapters across Prelims subjects (for Revision/Mock sync)
  function completedPrelimsChapters() {
    const out = [];
    subjects.filter(isPrelims).forEach((s) => {
      s.chapters.forEach((c) => {
        if (c.done) out.push({ chapterId: c.id, title: c.title, subject: s.name, emoji: s.emoji || "📘", completedAt: c.completedAt || null });
      });
    });
    return out.sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
  }

  // all chapter titles for a Prelims subject by name (for note chapter dropdown)
  function prelimsChapterTitles(subjectName) {
    const s = subjects.find((x) => x.name === subjectName && isPrelims(x));
    return s ? s.chapters.map((c) => c.title) : [];
  }

  // re-fetch subjects from storage (used after an import)
  function reload() {
    subjects = Store.getSubjects();
    renderAll();
  }

  return {
    init, renderAll, reload, getSubject, getSubjectStats: (id) => {
      const s = getSubject(id); const d = doneCount(s);
      return { done: d, total: s.chapters.length, percent: pct(d, s.chapters.length) };
    },
    toggleChapter, addChapter, editChapter, deleteChapter, ringSVG,
    completedPrelimsChapters, prelimsChapterTitles, setModalOpen,
  };
})();

/* small shared util */
function escapeHTML(str) {
  return String(str).replace(/[&<>"']/g, (m) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]  ));
}

/* shared date/time formatters (e.g. "12 July 2026", "02:45 PM") */
const _MONTHS_LONG = ["January","February","March","April","May","June","July",
  "August","September","October","November","December"];
function fmtDateLong(ts) {
  const d = new Date(ts);
  return `${d.getDate()} ${_MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
}
function fmtTimeShort(ts) {
  const d = new Date(ts);
  let h = d.getHours(); const m = String(d.getMinutes()).padStart(2,"0");
  const ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12;
  return `${String(h).padStart(2,"0")}:${m} ${ap}`;
}
