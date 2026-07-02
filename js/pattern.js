/* =========================================================
   pattern.js — Complete Exam Pattern view
   Sticky nav + scroll-spy + scroll progress bar + back-to-top
   ========================================================= */

const Pattern = (() => {
  let scroller, progress, nav, sections = [], navLinks = [];

  function onShow() {
    // reset scroll position and progress each time the view opens
    if (scroller) {
      scroller.scrollTop = 0;
      updateProgress();
      updateSpy();
    }
    // trigger reveal animations
    revealOnScroll();
  }

  function updateProgress() {
    if (!scroller || !progress) return;
    const max = scroller.scrollHeight - scroller.clientHeight;
    const pct = max > 0 ? (scroller.scrollTop / max) * 100 : 0;
    progress.style.width = pct + "%";
  }

  function updateSpy() {
    if (!scroller || !sections.length) return;
    const top = scroller.scrollTop;
    const offset = 120; // account for sticky nav height
    let current = sections[0].id;
    sections.forEach((sec) => {
      if (sec.offsetTop - offset <= top) current = sec.id;
    });
    navLinks.forEach((a) => {
      a.classList.toggle("is-active", a.dataset.target === current);
    });
  }

  function revealOnScroll() {
    if (!scroller) return;
    const trigger = scroller.clientHeight * 0.9;
    scroller.querySelectorAll(".reveal").forEach((el) => {
      const rectTop = el.offsetTop - scroller.scrollTop;
      if (rectTop < trigger) el.classList.add("is-visible");
    });
  }

  function smoothScrollTo(id) {
    const el = document.getElementById(id);
    if (el && scroller) {
      scroller.scrollTo({ top: el.offsetTop - 90, behavior: "smooth" });
    }
  }

  function init() {
    scroller = document.getElementById("patternScroll");
    progress = document.getElementById("patternProgress");
    nav = document.getElementById("patternNav");
    if (!scroller) return;

    sections = Array.from(scroller.querySelectorAll(".pattern-section"));
    navLinks = Array.from(document.querySelectorAll(".pnav-link"));

    // nav link clicks → smooth scroll within the view
    navLinks.forEach((a) => {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        smoothScrollTo(a.dataset.target);
      });
    });

    // scroll listener: progress + spy + reveal (throttled via rAF)
    let ticking = false;
    scroller.addEventListener("scroll", () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        updateProgress();
        updateSpy();
        revealOnScroll();
        ticking = false;
      });
    }, { passive: true });

    // back to top
    const topBtn = document.getElementById("patternTopBtn");
    if (topBtn) topBtn.addEventListener("click", () => {
      scroller.scrollTo({ top: 0, behavior: "smooth" });
    });

    // back to About (returns to menu and reopens About popup)
    const back = document.getElementById("patternBack");
    if (back) back.addEventListener("click", () => {
      if (typeof App !== "undefined" && App.show) App.show("menu");
      if (typeof Menu !== "undefined" && Menu.openAbout) Menu.openAbout();
    });
  }

  return { init, onShow };
})();
