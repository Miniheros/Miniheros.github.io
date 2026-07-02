/* =========================================================
   app.js — application controller
   Wires modules together, handles view routing + niceties.
   ========================================================= */

const App = (() => {
  let toastTimer = null;

  /* ---------- view routing ---------- */
  const views = ["intro", "menu", "tracker", "pattern", "mains"];
  function show(view) {
    views.forEach((v) =>
      document.getElementById(`view-${v}`).classList.toggle("is-active", v === view));
    window.scrollTo({ top: 0 });
    if (view === "menu" && typeof ExamPlan !== "undefined" && ExamPlan.runWarnings) {
      // slight delay so the menu paints before any popup appears
      setTimeout(() => { try { ExamPlan.runWarnings(); } catch (_) {} }, 500);
    }
  }

  /* ---------- name propagation ---------- */
  function setName(name) {
    const display = name || "Adarsh";
    // introName is fixed to "Adarsh" on the welcome screen; only menu/tracker update
    ["menuName", "trackerName"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.textContent = display;
    });
  }

  /* ---------- toast ---------- */
  function toast(msg) {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("is-visible"), 2600);
  }

  /* ---------- auth flow ---------- */
  function onLogin(user) {
    sessionStorage.setItem("upsc.authenticated", "1");
    setName(user.name);
    Tracker.renderAll();
    show("menu");
    toast(`Welcome, ${user.name.split(" ")[0]} 👋`);
  }
  function logout() {
    sessionStorage.removeItem("upsc.authenticated");
    Store.clearUser();
    show("intro");
  }

  /* ---------- scroll to top ---------- */
  function initScrollTop() {
    const btn = document.getElementById("scrollTop");
    window.addEventListener("scroll", () => {
      btn.classList.toggle("is-visible", window.scrollY > 400);
    });
    btn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  /* ---------- keyboard shortcuts ---------- */
  function initShortcuts() {
    document.addEventListener("keydown", (e) => {
      // ignore while typing
      const typing = /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName);
      if (e.key === "Escape") {
        if (document.getElementById("modalBackdrop").classList.contains("is-open")) Popup.close();
      }
      if (typing) return;
      if (e.key === "t" || e.key === "T") Theme.toggle();
      if (e.key === "/") {
        const search = document.getElementById("subjectSearch");
        if (document.getElementById("view-tracker").classList.contains("is-active")) {
          e.preventDefault(); search.focus();
        }
      }
    });
  }

  /* ---------- menu module cards ---------- */
  function initMenu() {
    document.getElementById("menuGrid").addEventListener("click", (e) => {
      const card = e.target.closest(".module-card");
      if (!card || card.classList.contains("module-card--soon")) return;
      const mod = card.dataset.module;
      if (mod === "tracker") {
        recordVisit("tracker");
        Tracker.renderAll();
        show("tracker");
        return;
      }
      if (mod === "planner") {
        recordVisit("planner");
        if (typeof Planner !== "undefined") Planner.open();
        return;
      }
      recordVisit(mod);
      // Syllabus / About / Mains / Interview open as popups
      Menu.handleCard(mod);
    });
    document.getElementById("logoutBtn").addEventListener("click", logout);
    document.getElementById("backToMenu").addEventListener("click", () => show("menu"));
    const lvBtn = document.getElementById("lastVisitedBtn");
    if (lvBtn) lvBtn.addEventListener("click", () => {
      if (typeof Planner !== "undefined") Planner.openLastVisited();
    });
  }

  /* ---------- last-visited recorder ---------- */
  const VISIT_META = {
    syllabus:  { label: "Syllabus", emoji: "📜" },
    about:     { label: "About CSE Examination", emoji: "🏛️" },
    tracker:   { label: "Prelims Progress", emoji: "📚" },
    mains:     { label: "Mains Progress", emoji: "📝" },
    interview: { label: "Interview Progress", emoji: "🎙️" },
    planner:   { label: "Weekly Planner", emoji: "🗓️" },
  };
  function recordVisit(mod) {
    const meta = VISIT_META[mod];
    if (meta && typeof Planner !== "undefined") Planner.recordVisit(mod, meta.label, meta.emoji);
  }

  /* ---------- boot ---------- */
  let _booted = false;
  // Run an init step in isolation: if one module throws, the rest still boot.
  function safe(label, fn) {
    try { if (typeof fn === "function") fn(); }
    catch (err) { if (window.console && console.warn) console.warn("[init skipped: " + label + "]", err); }
  }
  function init() {
    if (_booted) return;
    _booted = true;
    safe("Theme", () => Theme.init());
    safe("ConfirmDialog", () => ConfirmDialog.init());

    safe("Tracker", () => Tracker.init());
    safe("Popup", () => Popup.init());
    safe("Login", () => Login.init());
    safe("Menu", () => Menu.init());
    safe("Pattern", () => Pattern.init());
    safe("Prelims", () => Prelims.init());
    safe("MockScores", () => { if (typeof MockScores !== "undefined") MockScores.init(); });
    safe("Mains", () => Mains.init());
    safe("Subtopics", () => { if (typeof Subtopics !== "undefined") Subtopics.init(); });
    safe("Backup", () => { if (typeof Backup !== "undefined") Backup.init(); });
    safe("Planner", () => { if (typeof Planner !== "undefined") Planner.init(); });
    safe("ExamPlan", () => { if (typeof ExamPlan !== "undefined") ExamPlan.init(); });
    safe("initMenu", () => initMenu());
    safe("initScrollTop", () => initScrollTop());
    safe("initShortcuts", () => initShortcuts());

    // resume session if remembered
    try {
      const user = Store.getUser();
      const authenticated = sessionStorage.getItem("upsc.authenticated") === "1";
      if (user && user.remember && authenticated) {
        setName(user.name);
        Tracker.renderAll();
        show("menu");
      } else {
        if (user) setName(user.name);
        show("intro");
      }
    } catch (err) {
      if (window.console && console.warn) console.warn("[session resume failed]", err);
      try { show("intro"); } catch (_) {}
    }
  }

  return { init, show, toast, onLogin, setName };
})();

document.addEventListener("DOMContentLoaded", App.init);
