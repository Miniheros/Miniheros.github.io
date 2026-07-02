/* =========================================================
   backup.js — Export / Import all app data (manual sync)
   Export builds one current JSON snapshot of every upsc.* data key.
   Import validates and restores that snapshot
   transactionally, then reloads the app from the restored data.
   ========================================================= */

const Backup = (() => {
  const PREFIX = "upsc.";
  const EXPORT_STAMP = "upsc.lastExport"; // stored locally (not part of synced data)
  const IMPORT_STAMP = "upsc.lastImport";
  const APP_TAG = "CSE-Tracker";
  const LEGACY_TAGS = ["UPSC-CSE-Tracker"]; // accept older backups too

  /* ---------- date format ---------- */
  function fmt(ts) {
    if (!ts) return "—";
    const d = new Date(ts);
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    let h = d.getHours(); const m = String(d.getMinutes()).padStart(2,"0");
    const ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12;
    return `${String(d.getDate()).padStart(2,"0")} ${months[d.getMonth()]} ${d.getFullYear()}, ${String(h).padStart(2,"0")}:${m} ${ap}`;
  }

  function renderStamps() {
    const ex = document.getElementById("lastExportStamp");
    const im = document.getElementById("lastImportStamp");
    if (ex) ex.textContent = fmt(parseInt(localStorage.getItem(EXPORT_STAMP), 10) || 0);
    if (im) im.textContent = fmt(parseInt(localStorage.getItem(IMPORT_STAMP), 10) || 0);
  }

  /* ---------- export ---------- */
  function exportData() {
    const snapshot = Store.getSnapshot();
    const payload = { ...snapshot, exportedAt: Date.now() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const d = new Date();
    const stamp = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}-${String(d.getHours()).padStart(2,"0")}${String(d.getMinutes()).padStart(2,"0")}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `cse-tracker-backup-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    localStorage.setItem(EXPORT_STAMP, String(Date.now()));
    renderStamps();
    if (typeof App !== "undefined" && App.toast) App.toast("Backup exported");
  }

  /* ---------- import ---------- */
  function importFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      let parsed;
      try { parsed = JSON.parse(e.target.result); } catch {
        ConfirmDialog.open({ title: "Invalid file", message: "This file isn't a valid backup (couldn't read JSON).", confirmLabel: "OK", onConfirm: () => {} });
        return;
      }
      if (!isValidBackup(parsed)) {
        ConfirmDialog.open({ title: "Invalid file", message: "This doesn't look like a CSE Tracker backup file.", confirmLabel: "OK", onConfirm: () => {} });
        return;
      }
      const keys = Object.keys(parsed.data);
      const whenStr = parsed.exportedAt ? fmt(parsed.exportedAt) : "unknown date";
      ConfirmDialog.open({
        title: "Import this backup?",
        message: `This will replace your current data on this device with the backup (${keys.length} items, exported ${whenStr}). This cannot be undone. Continue?`,
        confirmLabel: "⬆ Import",
        onConfirm: () => applyImport(parsed),
      });
    };
    reader.readAsText(file);
  }

  function isValidBackup(parsed) {
    if (!parsed || (parsed.app !== APP_TAG && !LEGACY_TAGS.includes(parsed.app))) return false;
    if (!parsed.data || typeof parsed.data !== "object" || Array.isArray(parsed.data)) return false;
    return Object.keys(parsed.data).every((key) => key.startsWith(PREFIX));
  }

  function applyImport(backup) {
    try {
      Store.restoreSnapshot(backup);
      localStorage.setItem(IMPORT_STAMP, String(Date.now()));
      if (typeof App !== "undefined" && App.toast) App.toast("Backup imported. Reloading...");
      setTimeout(() => window.location.reload(), 350);
    } catch (error) {
      console.error("Backup import failed", error);
      ConfirmDialog.open({
        title: "Import failed",
        message: "Your existing data was kept. The backup could not be stored on this device.",
        confirmLabel: "OK",
        onConfirm: () => {},
      });
    }
  }

  /* ---------- panel open/close ---------- */
  function togglePanel(force) {
    const panel = document.getElementById("backupPanel");
    const open = force !== undefined ? force : panel.hidden;
    panel.hidden = !open;
    document.getElementById("backupWidget").classList.toggle("is-open", open);
    if (open) renderStamps();
  }

  /* ---------- init ---------- */
  function init() {
    // Remove the older duplicated snapshot; current exports are built on demand.
    localStorage.removeItem("cseTracker.dataSnapshot");
    renderStamps();
    const toggle = document.getElementById("backupToggle");
    const close = document.getElementById("backupPanelClose");
    if (toggle) toggle.addEventListener("click", () => togglePanel());
    if (close) close.addEventListener("click", () => togglePanel(false));

    const exportBtn = document.getElementById("exportBtn");
    if (exportBtn) exportBtn.addEventListener("click", exportData);

    const importBtn = document.getElementById("importBtn");
    const fileInput = document.getElementById("importFile");
    if (importBtn && fileInput) {
      importBtn.addEventListener("click", () => fileInput.click());
      fileInput.addEventListener("change", (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) importFile(file);
        fileInput.value = ""; // allow re-importing same file
      });
    }
  }

  return { init, exportData, renderStamps };
})();
