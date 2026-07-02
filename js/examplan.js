/* =========================================================
   examplan.js — Exam plan (2027 → 2028), marks log, and
   countdown warnings (popups + blinking banner).
   Self-contained. Stores its own keys; menu.js reads dates
   from the ExamDates accessor below.
   ========================================================= */

/* ---------- ExamDates: shared date source (2027 defaults) ---------- */
const ExamDates = (() => {
  const KEY = "upsc.examPlan";
  // Defaults = the fixed 2027 attempt.
  const DEFAULTS = {
    prelims: "2027-05-23",
    mains: "2027-08-20",
    prelimsDays: [23],
    mainsDays: [20, 21, 22, 28, 29],
    label: "2027",
    activated2028: false,
  };

  function read() {
    try {
      const v = JSON.parse(localStorage.getItem(KEY));
      if (v && v.prelims && v.mains) return Object.assign({}, DEFAULTS, v);
    } catch (_) {}
    return Object.assign({}, DEFAULTS);
  }
  function write(v) { try { Store.setRaw(KEY, JSON.stringify(v)); } catch (_) {} }

  function toDate(iso) {
    // parse YYYY-MM-DD as a LOCAL date (avoid UTC shift)
    const [y, m, d] = String(iso).split("-").map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  }
  // Typical UPSC Mains span: start, +1, +2, then +8, +9 (two weekends).
  // We only keep the days that stay within the Mains month so the calendar
  // highlight never bleeds into a different month grid.
  function computeMainsDays(mainsIso) {
    const start = toDate(mainsIso);
    const month = start.getMonth();
    const offsets = [0, 1, 2, 8, 9];
    const days = [];
    offsets.forEach((off) => {
      const d = new Date(start); d.setDate(d.getDate() + off);
      if (d.getMonth() === month) days.push(d.getDate());
    });
    return days.length ? days : [start.getDate()];
  }

  return {
    get: read,
    prelimsDate: () => toDate(read().prelims),
    mainsDate: () => toDate(read().mains),
    prelimsDays: () => read().prelimsDays || [read().prelimsDate().getDate?.() || 1],
    mainsDays: () => read().mainsDays || [20],
    label: () => read().label || "2027",
    isActivated2028: () => !!read().activated2028,
    setPlan(prelimsIso, mainsIso, label) {
      const v = read();
      v.prelims = prelimsIso;
      v.mains = mainsIso;
      v.prelimsDays = [toDate(prelimsIso).getDate()];
      v.mainsDays = computeMainsDays(mainsIso);
      v.label = label || v.label;
      if (label === "2028") v.activated2028 = true;
      write(v);
    },
    reset() { write(Object.assign({}, DEFAULTS)); },
  };
})();

/* ---------- ExamPlan: UI (button, marks, warnings, banner) ---------- */
const ExamPlan = (() => {
  const MARKS_KEY_PREFIX = "upsc.examMarks.";     // + label (e.g. 2027)
  const WARN_PREF_KEY = "upsc.warnEnabled";       // "1"/"0"
  const WARN_SEEN_PREFIX = "upsc.warnSeen.";      // + label + "." + exam + "." + milestone
  const MONTHS = ["January","February","March","April","May","June","July",
    "August","September","October","November","December"];

  const POPUP_MILESTONES = [90, 60, 30, 21, 14];  // one-time popups
  const BANNER_MAX = 10;                           // blinking banner from 10 → 0

  /* ---------- small utils ---------- */
  function warnEnabled() { return localStorage.getItem(WARN_PREF_KEY) !== "0"; }
  function setWarnEnabled(on) { try { Store.setRaw(WARN_PREF_KEY, on ? "1" : "0"); } catch (_) {} }
  function num(v) {
    if (v === "" || v == null) return null;
    const n = Number(v); return Number.isFinite(n) ? n : null;
  }
  function daysUntil(date) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const t = new Date(date); t.setHours(0, 0, 0, 0);
    return Math.round((t - today) / 86400000);
  }
  function fmtDate(d) { return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`; }

  function openModal(id) {
    const m = document.getElementById(id); if (!m) return;
    m.classList.add("is-open"); m.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }
  function closeModal(id) {
    const m = document.getElementById(id); if (!m) return;
    m.classList.remove("is-open"); m.setAttribute("aria-hidden", "true");
    if (!document.querySelector(".modal-backdrop.is-open")) document.body.style.overflow = "";
  }

  /* =========================================================
     2028 plan button
     ========================================================= */
  // Unlock rule: clickable only AFTER the 2027 Prelims (24 May 2027+),
  // i.e. once the current Prelims date has passed. Uses the *default* 2027
  // prelims as the gate so it works even before activation.
  function planUnlocked() {
    const gate = new Date(2027, 4, 23); // 23 May 2027
    return daysUntil(gate) < 0;         // strictly after 23 May 2027
  }

  function refreshPlanButton() {
    const btn = document.getElementById("execute2028Btn");
    const note = document.getElementById("plan2028Note");
    if (!btn) return;
    const activated = ExamDates.isActivated2028();
    if (activated) {
      btn.textContent = "✅ 2028 Plan Active — Edit dates";
      btn.disabled = false;
      if (note) note.textContent = `Prelims ${fmtDate(ExamDates.prelimsDate())} · Mains ${fmtDate(ExamDates.mainsDate())}`;
      return;
    }
    if (planUnlocked()) {
      btn.disabled = false;
      btn.textContent = "🚀 Execute 2028 Plan";
      if (note) note.textContent = "Set your 2028 attempt dates.";
    } else {
      btn.disabled = true;
      btn.textContent = "🔒 Execute 2028 Plan";
      if (note) note.textContent = "Unlocks 24 May 2027 (after the 2027 Prelims).";
    }
  }

  function openPlanModal() {
    if (!ExamDates.isActivated2028() && !planUnlocked()) return;
    const cur = ExamDates.get();
    // prefill: if already 2028, show current; else suggest +1 year from 2027
    const pIn = document.getElementById("plan2028Prelims");
    const mIn = document.getElementById("plan2028Mains");
    if (ExamDates.isActivated2028()) {
      pIn.value = cur.prelims; mIn.value = cur.mains;
    } else {
      pIn.value = "2028-05-21"; mIn.value = "2028-08-18";
    }
    const resetBtn = document.getElementById("plan2028Reset");
    if (resetBtn) resetBtn.hidden = !ExamDates.isActivated2028();
    const warn = document.getElementById("plan2028Warn");
    if (warn) warn.hidden = true;
    openModal("plan2028Backdrop");
  }

  function savePlan() {
    const p = document.getElementById("plan2028Prelims").value;
    const m = document.getElementById("plan2028Mains").value;
    const warn = document.getElementById("plan2028Warn");
    const showWarn = (msg) => { if (warn) { warn.textContent = msg; warn.hidden = false; } };

    if (!p || !m) { showWarn("Please pick both a Prelims and a Mains date."); return; }
    const pd = new Date(p), md = new Date(m);
    if (md <= pd) { showWarn("Mains must be after Prelims. Check the dates."); return; }

    ExamDates.setPlan(p, m, "2028");
    // reset the "seen" warning flags so 2028 milestones can fire fresh
    closeModal("plan2028Backdrop");
    if (typeof Menu !== "undefined" && Menu.refreshCalendars) Menu.refreshCalendars();
    refreshPlanButton();
    renderMarks();
    renderBanner();
    if (typeof App !== "undefined" && App.toast) App.toast("2028 plan activated");
  }

  function resetPlan() {
    ExamDates.reset();
    closeModal("plan2028Backdrop");
    if (typeof Menu !== "undefined" && Menu.refreshCalendars) Menu.refreshCalendars();
    refreshPlanButton();
    renderMarks();
    renderBanner();
    if (typeof App !== "undefined" && App.toast) App.toast("Reverted to 2027 plan");
  }

  /* =========================================================
     Marks section (enabled after each exam date passes)
     ========================================================= */
  function marksKey() { return MARKS_KEY_PREFIX + ExamDates.label(); }
  function readMarks() { try { return JSON.parse(localStorage.getItem(marksKey())) || {}; } catch { return {}; } }
  function writeMarks(o) { try { Store.setRaw(marksKey(), JSON.stringify(o)); } catch (_) {} }

  const PRELIMS_FIELDS = ["markPrelimsGS", "markCSAT"];
  const MAINS_FIELDS = ["markEssay", "markGS1", "markGS2", "markGS3", "markGS4", "markOpt1", "markOpt2"];

  function prelimsPassed() { return daysUntil(ExamDates.prelimsDate()) < 0; }
  function mainsPassed() { return daysUntil(ExamDates.mainsDate()) < 0; }

  function renderMarks() {
    const yearLabel = document.getElementById("marksYearLabel");
    if (yearLabel) yearLabel.textContent = ExamDates.label();

    const data = readMarks();
    const pPassed = prelimsPassed();
    const mPassed = mainsPassed();

    // fill values + enable/disable
    PRELIMS_FIELDS.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.value = data[id] != null ? data[id] : "";
      el.disabled = !pPassed;
    });
    MAINS_FIELDS.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.value = data[id] != null ? data[id] : "";
      el.disabled = !mPassed;
    });

    // lock badges
    const pLock = document.getElementById("prelimsLock");
    const mLock = document.getElementById("mainsLock");
    if (pLock) {
      pLock.textContent = pPassed ? "✓ Open" : "🔒 Unlocks after Prelims";
      pLock.classList.toggle("is-open", pPassed);
    }
    if (mLock) {
      mLock.textContent = mPassed ? "✓ Open" : "🔒 Unlocks after Mains";
      mLock.classList.toggle("is-open", mPassed);
    }

    // hint + save button visibility
    const hint = document.getElementById("marksHint");
    if (hint) {
      if (!pPassed && !mPassed) hint.textContent = "Marks entry unlocks after each exam date passes.";
      else if (pPassed && !mPassed) hint.textContent = "Prelims marks are open. Mains unlocks after the Mains exam.";
      else hint.textContent = "Enter the marks you scored, then Save.";
    }
    const saveBtn = document.getElementById("marksSaveBtn");
    if (saveBtn) saveBtn.hidden = !(pPassed || mPassed);

    updateMainsTotal();
  }

  function updateMainsTotal() {
    const row = document.getElementById("mainsTotalRow");
    const val = document.getElementById("mainsTotalVal");
    if (!row || !val) return;
    if (!mainsPassed()) { row.hidden = true; return; }
    let sum = 0, any = false;
    MAINS_FIELDS.forEach((id) => {
      const el = document.getElementById(id);
      const n = el ? num(el.value) : null;
      if (n != null) { sum += n; any = true; }
    });
    row.hidden = !any;
    val.textContent = any ? String(Math.round(sum * 100) / 100) + " / 1750" : "—";
  }

  function saveMarks() {
    const data = readMarks();
    PRELIMS_FIELDS.concat(MAINS_FIELDS).forEach((id) => {
      const el = document.getElementById(id);
      if (!el || el.disabled) return;
      const n = num(el.value);
      if (n == null) delete data[id]; else data[id] = n;
    });
    writeMarks(data);
    if (typeof App !== "undefined" && App.toast) App.toast("Marks saved");
    renderMarks();
  }

  // called by menu.js when the calendar modal opens
  function onCalendarOpen() {
    refreshPlanButton();
    renderMarks();
  }

  /* =========================================================
     Warnings — popups (90/60/30/21/14) + blinking banner (10→0)
     ========================================================= */
  function warnSeenKey(exam, milestone) {
    return WARN_SEEN_PREFIX + ExamDates.label() + "." + exam + "." + milestone;
  }
  function hasSeen(exam, milestone) { return localStorage.getItem(warnSeenKey(exam, milestone)) === "1"; }
  function markSeen(exam, milestone) { try { Store.setRaw(warnSeenKey(exam, milestone), "1"); } catch (_) {} }

  // Queue so two popups (e.g. Prelims + Mains) don't overlap.
  let _popupQueue = [];
  let _popupOpen = false;

  function enqueuePopup(payload) { _popupQueue.push(payload); if (!_popupOpen) showNextPopup(); }
  function showNextPopup() {
    if (!_popupQueue.length) { _popupOpen = false; return; }
    _popupOpen = true;
    const { emoji, title, msg } = _popupQueue.shift();
    document.getElementById("examWarnEmoji").textContent = emoji;
    document.getElementById("examWarnTitle").textContent = title;
    document.getElementById("examWarnMsg").textContent = msg;
    openModal("examWarnBackdrop");
  }
  function dismissPopup() {
    closeModal("examWarnBackdrop");
    setTimeout(showNextPopup, 260);
  }

  function checkPopups() {
    if (!warnEnabled()) return;
    [["Prelims", ExamDates.prelimsDate()], ["Mains", ExamDates.mainsDate()]].forEach(([exam, date]) => {
      const d = daysUntil(date);
      if (d < 0) return; // already passed
      // fire the milestone popup once, if today is at/inside a milestone we
      // haven't shown yet. We show the *largest* unseen milestone <= d? No —
      // we want each milestone to fire on its day. Fire when d <= milestone
      // and not seen, choosing the milestone matching current d best.
      POPUP_MILESTONES.forEach((ms) => {
        if (d <= ms && !hasSeen(exam, ms) && d > BANNER_MAX) {
          // only fire the milestone if we're within its window but still
          // above the banner range (banner handles <=10). Mark seen so it
          // won't repeat, and only actually POPUP the tightest one.
          markSeen(exam, ms);
          if (ms === smallestUnseenAtOrAbove(exam, d)) {
            enqueuePopup(popupContent(exam, d, ms));
          }
        }
      });
    });
  }

  // find the milestone that best represents "today" for a popup
  function smallestUnseenAtOrAbove(exam, d) {
    // the milestone we just crossed = smallest milestone >= d
    let chosen = null;
    POPUP_MILESTONES.forEach((ms) => { if (d <= ms) { if (chosen == null || ms < chosen) chosen = ms; } });
    return chosen;
  }

  function popupContent(exam, d, ms) {
    const emoji = d <= 21 ? "⏰" : (d <= 60 ? "📆" : "🗓️");
    const title = `${d} days to ${exam}`;
    const lines = {
      90: `90-day mark for ${exam}. Lock your revision cycle and start timed practice.`,
      60: `Two months to ${exam}. Prioritise weak areas and full-length mocks.`,
      30: `One month to ${exam}. Revise, don't learn new. Trust your prep.`,
      21: `Three weeks to ${exam}. Tighten revision and simulate exam-day timing.`,
      14: `Two weeks to ${exam}. Consolidate notes and stay steady.`,
    };
    return { emoji, title, msg: lines[ms] || `${d} days to ${exam}. Stay consistent.` };
  }

  /* ---------- blinking banner (10 → 0 days + exam day) ---------- */
  function renderBanner() {
    const el = document.getElementById("examBanner");
    if (!el) return;
    if (!warnEnabled()) { el.hidden = true; el.innerHTML = ""; return; }

    // pick the nearest upcoming exam within the banner window (<=10 days).
    const candidates = [["Prelims", ExamDates.prelimsDate()], ["Mains", ExamDates.mainsDate()]]
      .map(([exam, date]) => ({ exam, date, d: daysUntil(date) }))
      .filter((c) => c.d >= 0 && c.d <= BANNER_MAX)
      .sort((a, b) => a.d - b.d);

    if (!candidates.length) { el.hidden = true; el.innerHTML = ""; return; }
    const c = candidates[0];
    let text;
    if (c.d === 0) text = `🔴 Today is your ${c.exam} exam. Stay calm — you've prepared for this. All the best!`;
    else if (c.d === 1) text = `⚠️ 1 day left for ${c.exam}. Final light revision & rest well.`;
    else text = `⚠️ ${c.d} days left for ${c.exam} (${fmtDate(c.date)}). Revise & simulate.`;

    el.innerHTML = `<span class="exam-banner-text">${text}</span>`;
    el.classList.toggle("exam-banner--today", c.d === 0);
    el.hidden = false;
  }

  // run all warning checks (called when menu shows)
  function runWarnings() {
    renderBanner();
    checkPopups();
  }

  /* =========================================================
     Settings
     ========================================================= */
  function refreshToggle() {
    const t = document.getElementById("warnToggle");
    if (!t) return;
    const on = warnEnabled();
    t.classList.toggle("is-on", on);
    t.setAttribute("aria-checked", on ? "true" : "false");
  }
  function toggleWarnings() {
    setWarnEnabled(!warnEnabled());
    refreshToggle();
    renderBanner();
    if (typeof App !== "undefined" && App.toast) {
      App.toast(warnEnabled() ? "Exam warnings on" : "Exam warnings off");
    }
  }

  /* =========================================================
     INIT
     ========================================================= */
  function init() {
    // 2028 plan
    const ex = document.getElementById("execute2028Btn");
    if (ex) ex.addEventListener("click", openPlanModal);
    const pClose = document.getElementById("plan2028Close");
    if (pClose) pClose.addEventListener("click", () => closeModal("plan2028Backdrop"));
    const pBack = document.getElementById("plan2028Backdrop");
    if (pBack) pBack.addEventListener("click", (e) => { if (e.target.id === "plan2028Backdrop") closeModal("plan2028Backdrop"); });
    const pSave = document.getElementById("plan2028Save");
    if (pSave) pSave.addEventListener("click", savePlan);
    const pReset = document.getElementById("plan2028Reset");
    if (pReset) pReset.addEventListener("click", resetPlan);

    // marks
    const msave = document.getElementById("marksSaveBtn");
    if (msave) msave.addEventListener("click", saveMarks);
    document.querySelectorAll(".marks-mains-input").forEach((el) =>
      el.addEventListener("input", updateMainsTotal));

    // settings
    const sBtn = document.getElementById("settingsBtn");
    if (sBtn) sBtn.addEventListener("click", () => { refreshToggle(); openModal("settingsBackdrop"); });
    const sClose = document.getElementById("settingsClose");
    if (sClose) sClose.addEventListener("click", () => closeModal("settingsBackdrop"));
    const sBack = document.getElementById("settingsBackdrop");
    if (sBack) sBack.addEventListener("click", (e) => { if (e.target.id === "settingsBackdrop") closeModal("settingsBackdrop"); });
    const wTog = document.getElementById("warnToggle");
    if (wTog) wTog.addEventListener("click", toggleWarnings);

    // warning popup dismiss
    const wDismiss = document.getElementById("examWarnDismiss");
    if (wDismiss) wDismiss.addEventListener("click", dismissPopup);
    const wBack = document.getElementById("examWarnBackdrop");
    if (wBack) wBack.addEventListener("click", (e) => { if (e.target.id === "examWarnBackdrop") dismissPopup(); });

    // Esc closes these modals
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      ["plan2028Backdrop", "settingsBackdrop", "examWarnBackdrop"].forEach((id) => {
        const m = document.getElementById(id);
        if (m && m.classList.contains("is-open")) closeModal(id);
      });
    });

    refreshToggle();
    renderBanner();
    // keep banner fresh across midnight / long sessions
    setInterval(renderBanner, 60 * 1000);
  }

  return { init, onCalendarOpen, runWarnings, renderBanner };
})();
