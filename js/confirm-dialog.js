/* =========================================================
   confirm-dialog.js — single shared confirmation modal
   Usage: ConfirmDialog.open({ title, message, confirmLabel, onConfirm })
   ========================================================= */

const ConfirmDialog = (() => {
  let pendingCb = null;

  function open({ title, message, confirmLabel, onConfirm }) {
    document.getElementById("confirmTitle").textContent = title || "Are you sure?";
    document.getElementById("confirmMsg").textContent = message || "This action cannot be undone.";
    const delBtn = document.getElementById("confirmDelete");
    delBtn.innerHTML = confirmLabel || "🗑️ Delete";
    pendingCb = onConfirm || null;

    const m = document.getElementById("confirmBackdrop");
    m.classList.add("is-open");
    m.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function close() {
    const m = document.getElementById("confirmBackdrop");
    m.classList.remove("is-open");
    m.setAttribute("aria-hidden", "true");
    if (!document.querySelector(".modal-backdrop.is-open")) document.body.style.overflow = "";
  }

  function init() {
    document.getElementById("confirmDelete").addEventListener("click", () => {
      const cb = pendingCb; pendingCb = null;
      close();
      if (cb) cb();
    });
    document.getElementById("confirmCancel").addEventListener("click", () => { pendingCb = null; close(); });
    document.getElementById("confirmBackdrop").addEventListener("click", (e) => {
      if (e.target.id === "confirmBackdrop") { pendingCb = null; close(); }
    });
  }

  return { init, open, close };
})();
