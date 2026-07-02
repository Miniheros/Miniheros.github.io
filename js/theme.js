/* =========================================================
   theme.js — dark / light mode toggle
   ========================================================= */

const Theme = (() => {
  const apply = (t) => {
    document.documentElement.setAttribute("data-theme", t);
    Store.setTheme(t);
  };
  const toggle = () => {
    const cur = document.documentElement.getAttribute("data-theme");
    apply(cur === "dark" ? "light" : "dark");
  };
  const init = () => {
    apply(Store.getTheme());
    const btn = document.getElementById("themeToggle");
    if (btn) btn.addEventListener("click", toggle);
  };
  return { init, toggle, apply };
})();
