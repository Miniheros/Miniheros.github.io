/* =========================================================
   planner.js — Weekly To-Do Planner + Last Visited
   Self-contained module. Uses Store.setRaw/removeRaw + localStorage
   directly for its own keys so it never touches existing data shapes.
   ========================================================= */

const Planner = (() => {
  /* ---------- storage keys ---------- */
  const WEEKS_KEY   = "upsc.planner.weeks";     // { [weekStart]: { tasks:[...], completed:bool } }
  const PENDING_KEY = "upsc.planner.pending";   // [ {id,title,start,end,from} ]
  const LASTVIS_KEY = "upsc.lastVisited";       // [ {key,label,emoji,at} ] most-recent first

  const DAY_NAMES  = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const DAY_FULL   = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const MONTHS     = ["January","February","March","April","May","June","July",
    "August","September","October","November","December"];

  let selected = { weekStart: null, day: 0 };  // currently open day

  /* ---------- id ---------- */
  function uid() { return "tk" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  /* ---------- date helpers (Sunday-based weeks) ---------- */
  function startOfWeek(d = new Date()) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const dow = x.getDay(); // Sun=0 … Sat=6
    x.setDate(x.getDate() - dow);
    x.setHours(0, 0, 0, 0);
    return x;
  }
  function addDays(date, n) {
    const x = new Date(date);
    x.setDate(x.getDate() + n);
    return x;
  }
  function keyOf(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  function fromKey(k) {
    const [y, m, d] = k.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  function fmtRange(weekStartKey) {
    const s = fromKey(weekStartKey);
    const e = addDays(s, 6);
    const sm = MONTHS[s.getMonth()].slice(0, 3);
    const em = MONTHS[e.getMonth()].slice(0, 3);
    return `${s.getDate()} ${sm} – ${e.getDate()} ${em}`;
  }

  /* ---------- persistence ---------- */
  function readWeeks() {
    try { return JSON.parse(localStorage.getItem(WEEKS_KEY)) || {}; } catch { return {}; }
  }
  function writeWeeks(w) { Store.setRaw(WEEKS_KEY, JSON.stringify(w)); }

  function readPending() {
    try { return JSON.parse(localStorage.getItem(PENDING_KEY)) || []; } catch { return []; }
  }
  function writePending(p) { Store.setRaw(PENDING_KEY, JSON.stringify(p)); }

  function blankWeek() { return { tasks: {}, completed: false }; }

  function getWeek(weeks, weekKey) {
    if (!weeks[weekKey]) weeks[weekKey] = blankWeek();
    if (!weeks[weekKey].tasks) weeks[weekKey].tasks = {};
    return weeks[weekKey];
  }
  function dayTasks(week, day) {
    if (!week.tasks[day]) week.tasks[day] = [];
    return week.tasks[day];
  }

  /* ---------- week stats ---------- */
  function weekTaskArrays(week) {
    const all = [];
    for (let d = 0; d < 7; d++) (week.tasks[d] || []).forEach((t) => all.push(t));
    return all;
  }
  function weekStats(week) {
    const all = weekTaskArrays(week);
    const done = all.filter((t) => t.done).length;
    const total = all.length;
    const percent = total ? Math.round((done / total) * 100) : 0;
    return { done, total, percent };
  }

  /* ---------- rollover: move incomplete tasks from PAST weeks to pending ---------- */
  function rolloverPastWeeks() {
    const weeks = readWeeks();
    const pending = readPending();
    const currentKey = keyOf(startOfWeek());
    let changed = false;

    Object.keys(weeks).forEach((wk) => {
      if (wk >= currentKey) return; // only strictly-past weeks
      const week = weeks[wk];
      const all = weekTaskArrays(week);
      const incomplete = all.filter((t) => !t.done);
      if (incomplete.length) {
        incomplete.forEach((t) => {
          pending.push({
            id: t.id || uid(),
            title: t.title,
            start: t.start || "",
            end: t.end || "",
            from: wk,
          });
        });
      }
      // past weeks are archived away once processed
      delete weeks[wk];
      changed = true;
    });

    if (changed) { writeWeeks(weeks); writePending(pending); }
  }

  /* ---------- mark week completed automatically ---------- */
  function refreshWeekStatus(weekKey) {
    const weeks = readWeeks();
    const week = getWeek(weeks, weekKey);
    const st = weekStats(week);
    const wasCompleted = week.completed;
    week.completed = st.total > 0 && st.done === st.total;
    writeWeeks(weeks);
    return { completed: week.completed, justCompleted: week.completed && !wasCompleted, stats: st };
  }

  /* =========================================================
     RENDER — two weeks side by side
     ========================================================= */
  function render() {
    rolloverPastWeeks();
    const weeks = readWeeks();
    const thisKey = keyOf(startOfWeek());
    const nextKey = keyOf(addDays(startOfWeek(), 7));
    const wrap = document.getElementById("plannerWeeks");
    if (!wrap) return;

    wrap.innerHTML = [thisKey, nextKey]
      .map((wk, i) => weekCardHTML(getWeek(weeks, wk), wk, i === 0))
      .join("");

    renderPending();
    updateMenuStat();
  }

  function weekCardHTML(week, weekKey, isCurrent) {
    const st = weekStats(week);
    const completed = st.total > 0 && st.done === st.total;
    const label = isCurrent ? "This Week" : "Next Week";

    const days = DAY_NAMES.map((name, d) => {
      const tasks = week.tasks[d] || [];
      const total = tasks.length;
      const done = tasks.filter((t) => t.done).length;
      const dateNum = addDays(fromKey(weekKey), d).getDate();
      const allDone = total > 0 && done === total;
      return `
        <button class="planner-day ${allDone ? "is-done" : ""} ${total ? "" : "is-empty"}"
                data-week="${weekKey}" data-day="${d}">
          <span class="planner-day-name">${name}</span>
          <span class="planner-day-date">${dateNum}</span>
          <span class="planner-day-count">${total ? `${done}/${total}` : "—"}</span>
        </button>`;
    }).join("");

    return `
      <div class="planner-week ${completed ? "is-complete" : ""}">
        <div class="planner-week-head">
          <div class="planner-week-title">
            <span class="planner-week-label">${label}</span>
            <span class="planner-week-range">${fmtRange(weekKey)}</span>
          </div>
          ${completed
            ? `<span class="planner-badge planner-badge--done">✓ Completed</span>`
            : `<span class="planner-badge">${st.done}/${st.total} tasks</span>`}
        </div>
        <div class="planner-progress">
          <div class="linebar"><div class="linebar-fill" style="width:${st.percent}%"></div></div>
          <span class="planner-progress-pct">${st.percent}%</span>
        </div>
        <div class="planner-days">${days}</div>
      </div>`;
  }

  /* =========================================================
     RENDER — pending tasks
     ========================================================= */
  function renderPending() {
    const pending = readPending();
    const section = document.getElementById("plannerPending");
    const list = document.getElementById("pendingList");
    const count = document.getElementById("pendingCount");
    if (!section || !list) return;

    section.hidden = false;
    if (count) count.textContent = pending.length;

    if (!pending.length) {
      list.innerHTML = `
        <div class="pending-empty">
          <span class="pending-empty-icon">✅</span>
          <span>No missed tasks. Incomplete tasks from past weeks will appear here automatically.</span>
        </div>`;
      return;
    }

    list.innerHTML = pending.map((t) => `
      <div class="pending-card" data-id="${t.id}">
        <div class="pending-main">
          <span class="pending-title">${escapeHTML(t.title)}</span>
          <div class="pending-meta">
            ${timeMeta(t.start, t.end)}
            <span class="set-pill">from ${fmtRange(t.from)}</span>
          </div>
        </div>
        <div class="pending-actions">
          <button class="btn btn--ghost btn--sm" data-act="complete">✓ Completed</button>
          <button class="btn btn--primary btn--sm" data-act="add">＋ Current Week</button>
        </div>
      </div>`).join("");
  }

  function timeMeta(start, end) {
    if (!start && !end) return "";
    if (start && end) return `<span class="set-pill">🕒 ${start}–${end}</span>`;
    if (end) return `<span class="set-pill">⏰ by ${end}</span>`;
    return `<span class="set-pill">🕒 ${start}</span>`;
  }

  /* ---------- pending actions ---------- */
  function pendingComplete(id) {
    let pending = readPending();
    pending = pending.filter((t) => t.id !== id);
    writePending(pending);
    renderPending();
    updateMenuStat();
    App.toast("Task marked completed");
  }
  function pendingAddToCurrent(id) {
    const pending = readPending();
    const task = pending.find((t) => t.id === id);
    if (!task) return;
    const weeks = readWeeks();
    const thisKey = keyOf(startOfWeek());
    const week = getWeek(weeks, thisKey);
    // default to today's weekday within the current week
    const todayDow = new Date().getDay();
    dayTasks(week, todayDow).push({
      id: uid(), title: task.title, start: task.start || "", end: task.end || "",
      done: false, createdAt: Date.now(),
    });
    week.completed = false;
    writeWeeks(weeks);
    writePending(pending.filter((t) => t.id !== id));
    render();
    App.toast("Moved to current week");
  }

  /* =========================================================
     DAY MODAL — task list for a single day
     ========================================================= */
  function openDay(weekKey, day) {
    selected = { weekStart: weekKey, day: Number(day) };
    document.getElementById("taskTitleInput").value = "";
    document.getElementById("taskStartInput").value = "";
    document.getElementById("taskEndInput").value = "";
    renderDay();
    openModal("dayBackdrop");
  }

  function renderDay() {
    const { weekStart, day } = selected;
    const dateObj = addDays(fromKey(weekStart), day);
    const weeks = readWeeks();
    const week = getWeek(weeks, weekStart);
    const tasks = week.tasks[day] || [];

    const title = document.getElementById("dayTitle");
    const sub = document.getElementById("daySub");
    const list = document.getElementById("dayTaskList");

    title.textContent = `${DAY_FULL[day]} · ${dateObj.getDate()} ${MONTHS[dateObj.getMonth()].slice(0, 3)}`;

    const done = tasks.filter((t) => t.done).length;
    const wk = weekStats(week);
    sub.innerHTML = `${done}/${tasks.length} today · <span class="day-week-total">${wk.done}/${wk.total} this week</span>`;

    if (!tasks.length) {
      list.innerHTML = `
        <div class="chapter-empty">
          <span class="empty-emoji">🗒️</span>
          <p>No tasks for this day yet. Add one above.</p>
        </div>`;
      return;
    }

    list.innerHTML = tasks.map((t) => `
      <div class="task-row ${t.done ? "is-done" : ""}" data-id="${t.id}">
        <button class="task-check" data-act="toggle" aria-label="Toggle task">${t.done ? "☑" : "☐"}</button>
        <div class="task-main">
          <span class="task-title">${escapeHTML(t.title)}</span>
          ${(t.start || t.end) ? `<span class="task-time">${timeText(t.start, t.end)}</span>` : ""}
        </div>
        <button class="icon-btn icon-btn--danger" data-act="delete" title="Delete task" aria-label="Delete task">🗑</button>
      </div>`).join("");
  }

  function timeText(start, end) {
    if (start && end) return `🕒 ${start} – ${end}`;
    if (end) return `⏰ Deadline ${end}`;
    if (start) return `🕒 ${start}`;
    return "";
  }

  function addTask() {
    const titleEl = document.getElementById("taskTitleInput");
    const startEl = document.getElementById("taskStartInput");
    const endEl = document.getElementById("taskEndInput");
    const title = titleEl.value.trim();
    if (!title) { titleEl.focus(); return; }

    const weeks = readWeeks();
    const week = getWeek(weeks, selected.weekStart);
    dayTasks(week, selected.day).push({
      id: uid(), title, start: startEl.value || "", end: endEl.value || "",
      done: false, createdAt: Date.now(),
    });
    week.completed = false;
    writeWeeks(weeks);

    titleEl.value = ""; startEl.value = ""; endEl.value = "";
    renderDay();
    render();
    titleEl.focus();
  }

  function toggleTask(id) {
    const weeks = readWeeks();
    const week = getWeek(weeks, selected.weekStart);
    const list = dayTasks(week, selected.day);
    const t = list.find((x) => x.id === id);
    if (!t) return;
    t.done = !t.done;
    t.completedAt = t.done ? Date.now() : null;
    writeWeeks(weeks);

    const status = refreshWeekStatus(selected.weekStart);
    renderDay();
    render();
    if (status.justCompleted) {
      if (typeof Confetti !== "undefined") Confetti.fire();
      App.toast("🎉 Week complete — every task done!");
    }
  }

  function deleteTask(id) {
    const weeks = readWeeks();
    const week = getWeek(weeks, selected.weekStart);
    week.tasks[selected.day] = dayTasks(week, selected.day).filter((x) => x.id !== id);
    writeWeeks(weeks);
    refreshWeekStatus(selected.weekStart);
    renderDay();
    render();
  }

  /* =========================================================
     Menu stat + open/close helpers
     ========================================================= */
  function updateMenuStat() {
    const el = document.getElementById("menuPlannerStat");
    if (!el) return;
    const weeks = readWeeks();
    const st = weekStats(getWeek(weeks, keyOf(startOfWeek())));
    el.textContent = `${st.percent}% this week`;
  }

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

  function open() { render(); openModal("plannerBackdrop"); }

  /* =========================================================
     LAST VISITED
     ========================================================= */
  function recordVisit(key, label, emoji) {
    let list = [];
    try { list = JSON.parse(localStorage.getItem(LASTVIS_KEY)) || []; } catch {}
    list = list.filter((v) => v.key !== key);
    list.unshift({ key, label, emoji, at: Date.now() });
    list = list.slice(0, 8);
    Store.setRaw(LASTVIS_KEY, JSON.stringify(list));
  }
  function getVisits() {
    try { return JSON.parse(localStorage.getItem(LASTVIS_KEY)) || []; } catch { return []; }
  }
  function relTime(ts) {
    const diff = Date.now() - ts;
    const min = Math.floor(diff / 60000);
    if (min < 1) return "just now";
    if (min < 60) return `${min} min ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr} hr ago`;
    const day = Math.floor(hr / 24);
    if (day === 1) return "yesterday";
    return `${day} days ago`;
  }
  function openLastVisited() {
    const body = document.getElementById("lastVisitedBody");
    const visits = getVisits();
    if (!visits.length) {
      body.innerHTML = `
        <div class="chapter-empty">
          <span class="empty-emoji">🕘</span>
          <p>Nothing visited yet. Open a section and it'll show up here.</p>
        </div>`;
    } else {
      body.innerHTML = `<div class="lastvis-list">` + visits.map((v) => `
        <button class="lastvis-item" data-target="${v.key}">
          <span class="lastvis-emoji">${v.emoji || "•"}</span>
          <span class="lastvis-text">
            <span class="lastvis-label">${escapeHTML(v.label)}</span>
            <span class="lastvis-time">${relTime(v.at)}</span>
          </span>
          <span class="module-go">Open →</span>
        </button>`).join("") + `</div>`;
    }
    openModal("lastVisitedBackdrop");
  }

  // route a last-visited item back to its destination
  function goTo(key) {
    closeModal("lastVisitedBackdrop");
    switch (key) {
      case "syllabus": openModal("syllabusBackdrop"); break;
      case "about": openModal("aboutBackdrop"); break;
      case "tracker": if (typeof Tracker !== "undefined") Tracker.renderAll(); App.show("tracker"); break;
      case "mains": App.show("mains"); if (typeof Mains !== "undefined" && Mains.onShow) Mains.onShow(); break;
      case "interview": if (typeof Menu !== "undefined") Menu.refreshNotes(); openModal("interviewBackdrop"); break;
      case "planner": open(); break;
      default: break;
    }
  }

  /* =========================================================
     INIT
     ========================================================= */
  function init() {
    // planner modal
    document.getElementById("plannerClose").addEventListener("click", () => closeModal("plannerBackdrop"));
    document.getElementById("plannerBackdrop").addEventListener("click", (e) => {
      if (e.target.id === "plannerBackdrop") closeModal("plannerBackdrop");
    });

    // click a day tile
    document.getElementById("plannerWeeks").addEventListener("click", (e) => {
      const day = e.target.closest(".planner-day");
      if (day) openDay(day.dataset.week, day.dataset.day);
    });

    // pending actions
    document.getElementById("pendingList").addEventListener("click", (e) => {
      const card = e.target.closest(".pending-card");
      const btn = e.target.closest("[data-act]");
      if (!card || !btn) return;
      if (btn.dataset.act === "complete") pendingComplete(card.dataset.id);
      if (btn.dataset.act === "add") pendingAddToCurrent(card.dataset.id);
    });

    // day modal
    document.getElementById("dayClose").addEventListener("click", () => closeModal("dayBackdrop"));
    document.getElementById("dayBackdrop").addEventListener("click", (e) => {
      if (e.target.id === "dayBackdrop") closeModal("dayBackdrop");
    });
    document.getElementById("taskAddBtn").addEventListener("click", addTask);
    document.getElementById("taskTitleInput").addEventListener("keydown", (e) => {
      if (e.key === "Enter") addTask();
    });
    document.getElementById("dayTaskList").addEventListener("click", (e) => {
      const row = e.target.closest(".task-row");
      const btn = e.target.closest("[data-act]");
      if (!row || !btn) return;
      if (btn.dataset.act === "toggle") toggleTask(row.dataset.id);
      if (btn.dataset.act === "delete") deleteTask(row.dataset.id);
    });

    // last visited
    document.getElementById("lastVisitedClose").addEventListener("click", () => closeModal("lastVisitedBackdrop"));
    document.getElementById("lastVisitedBackdrop").addEventListener("click", (e) => {
      if (e.target.id === "lastVisitedBackdrop") closeModal("lastVisitedBackdrop");
    });
    document.getElementById("lastVisitedBody").addEventListener("click", (e) => {
      const item = e.target.closest(".lastvis-item");
      if (item) goTo(item.dataset.target);
    });

    // Esc closes planner-family modals
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      ["dayBackdrop", "plannerBackdrop", "lastVisitedBackdrop"].forEach((id) => {
        const m = document.getElementById(id);
        if (m && m.classList.contains("is-open")) closeModal(id);
      });
    });

    updateMenuStat();
  }

  return { init, open, openLastVisited, recordVisit };
})();
