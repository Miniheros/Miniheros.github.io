/* =========================================================
   resilience.js — keep the app alive & feeling smooth
   Loaded FIRST. Pure vanilla, defensive, never throws.
   - Global error + promise-rejection guards so one failing
     module can never blank the whole page.
   - Smooth :active feedback on touch without 300ms delay.
   - Marks the document as JS-ready for progressive enhancement.
   ========================================================= */
(function () {
  "use strict";

  /* ---------- 1. Global safety nets ---------- */
  // Swallow uncaught errors so the UI keeps working. We log to console
  // for debugging but never surface a broken/blank screen to the user.
  try {
    window.addEventListener("error", function (e) {
      // Ignore benign ResizeObserver noise and cross-origin script errors.
      var msg = (e && e.message) || "";
      if (/ResizeObserver loop|Script error/i.test(msg)) return;
      // eslint-disable-next-line no-console
      if (window.console && console.warn) console.warn("[handled error]", msg);
      // Do not call preventDefault on real errors during dev? We keep the
      // page usable — returning true prevents the default "uncaught" break.
      return true;
    });

    window.addEventListener("unhandledrejection", function (e) {
      if (window.console && console.warn) console.warn("[handled rejection]", e && e.reason);
    });
  } catch (_) { /* no-op */ }

  /* ---------- 2. Environment flags for CSS ---------- */
  try {
    var root = document.documentElement;
    root.classList.add("js");

    // Coarse pointer (touch) vs fine (mouse) — lets CSS drop hover transforms.
    var coarse = false;
    try { coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches; } catch (_) {}
    if (coarse) root.classList.add("is-touch"); else root.classList.add("is-fine");

    // iOS/iPadOS detection for safe-area + momentum tweaks.
    var ua = navigator.userAgent || "";
    var iOS = /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    if (iOS) root.classList.add("is-ios");
  } catch (_) { /* no-op */ }

  /* ---------- 3. Smooth active-press feedback on touch ---------- */
  // Adds a class on touchstart so CSS can give an instant, Apple-like
  // press response (no reliance on :hover which sticks on mobile).
  try {
    var PRESSABLE = ".btn, .module-card, .subject-card, .set-card, .about-tile, " +
      ".ptab, .planner-day, .lastvis-item, .mscore-card, .chip, .pnav-link, " +
      ".icon-btn, .modal-close, .theme-toggle";

    document.addEventListener("touchstart", function (e) {
      var t = e.target && e.target.closest && e.target.closest(PRESSABLE);
      if (t) t.classList.add("is-pressed");
    }, { passive: true });

    var clearPressed = function () {
      var els = document.querySelectorAll(".is-pressed");
      for (var i = 0; i < els.length; i++) els[i].classList.remove("is-pressed");
    };
    document.addEventListener("touchend", clearPressed, { passive: true });
    document.addEventListener("touchcancel", clearPressed, { passive: true });
    // Also clear on scroll so a press that turns into a scroll doesn't stick.
    document.addEventListener("scroll", function () {
      if (document.querySelector(".is-pressed")) clearPressed();
    }, { passive: true, capture: true });
  } catch (_) { /* no-op */ }

  /* ---------- 4. Keep :root --vh accurate on mobile ---------- */
  // Mobile browsers change viewport height when the URL bar hides/shows.
  // Expose a stable --vh so full-height panes don't jump or get clipped.
  try {
    var setVH = function () {
      try {
        var vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty("--vh", vh + "px");
      } catch (_) {}
    };
    setVH();
    var vhTimer = null;
    window.addEventListener("resize", function () {
      if (vhTimer) return;
      vhTimer = window.requestAnimationFrame ?
        requestAnimationFrame(function () { vhTimer = null; setVH(); }) :
        setTimeout(function () { vhTimer = null; setVH(); }, 100);
    }, { passive: true });
    window.addEventListener("orientationchange", setVH, { passive: true });
  } catch (_) { /* no-op */ }
})();
