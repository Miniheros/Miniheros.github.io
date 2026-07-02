/* =========================================================
   subtopics.js — Topic → Subtopic management (Mains GS/Optional)
   Popup 1: subtopics list (search + add)
   Popup 2: add/edit form (name, type, data, unlimited PYQs, links)
   Popup 3: view detail (+ edit, delete subtopic)
   All persisted in localStorage under upsc.subtopics.<topicId>
   ========================================================= */

const Subtopics = (() => {
  const KEY_PREFIX = "upsc.subtopics.";

  let currentTopicId = null;   // "card:topic"
  let currentTopicLabel = "";
  let currentSubId = null;     // subtopic being viewed/edited
  let editing = false;         // form in edit mode vs add mode
  let listQuery = "";

  /* ---------- date helpers ---------- */
  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  function fmtDate(ts) { const d = new Date(ts); return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; }
  function fmtTime(ts) { const d = new Date(ts); let h=d.getHours(); const m=String(d.getMinutes()).padStart(2,"0"); const ap=h>=12?"PM":"AM"; h=h%12||12; return `${String(h).padStart(2,"0")}:${m} ${ap}`; }

  /* ---------- storage ---------- */
  function keyFor(topicId) { return KEY_PREFIX + topicId; }
  function getList(topicId) { try { return JSON.parse(localStorage.getItem(keyFor(topicId))) || []; } catch { return []; } }
  function setList(topicId, arr) { Store.setRaw(keyFor(topicId), JSON.stringify(arr)); }
  function count(topicId) { return getList(topicId).length; }
  function getSub(id) { return getList(currentTopicId).find((s) => s.id === id) || null; }

  /* ---------- modal helpers ---------- */
  function openM(id) { const m=document.getElementById(id); m.classList.add("is-open"); m.setAttribute("aria-hidden","false"); document.body.style.overflow="hidden"; }
  function closeM(id) { const m=document.getElementById(id); m.classList.remove("is-open"); m.setAttribute("aria-hidden","true"); if(!document.querySelector(".modal-backdrop.is-open")) document.body.style.overflow=""; }

  /* =====================================================
     POPUP 1 — subtopics list
     ===================================================== */
  function open(topicId, label) {
    currentTopicId = topicId;
    currentTopicLabel = label;
    listQuery = "";
    const search = document.getElementById("subtopicSearch");
    if (search) search.value = "";
    renderList();
    openM("subtopicsBackdrop");
  }

  function renderList() {
    document.getElementById("subtopicsTitle").textContent = currentTopicLabel;
    let subs = getList(currentTopicId).slice().sort((a, b) => b.createdAt - a.createdAt);
    if (listQuery) {
      const q = listQuery.toLowerCase();
      subs = subs.filter((s) => s.name.toLowerCase().includes(q));
    }
    document.getElementById("subtopicsCount").textContent = getList(currentTopicId).length;

    const wrap = document.getElementById("subtopicsList");
    if (!subs.length) {
      wrap.innerHTML = `<div class="notes-empty"><span class="notes-empty-icon">🗂️</span><span>${listQuery ? "No subtopics match your search." : "No subtopics yet. Click <strong>+ Add Subtopic</strong> to create one."}</span></div>`;
      return;
    }
    wrap.innerHTML = subs.map((s) => `
      <button class="subt-item" data-id="${s.id}">
        <span class="subt-item-name">${escapeHTML(s.name)}</span>
        <span class="subt-item-meta">
          <span class="subt-type-chip subt-type-${typeClass(s.type)}">${escapeHTML(s.type)}</span>
          ${s.pyqs && s.pyqs.length ? `<span class="subt-pyq-chip">${s.pyqs.length} PYQ${s.pyqs.length===1?"":"s"}</span>` : ""}
        </span>
      </button>`).join("");
  }
  function typeClass(type) {
    if (type === "Static") return "static";
    if (type === "Current Affairs (CA)") return "ca";
    return "both";
  }

  /* =====================================================
     POPUP 2 — add / edit form
     ===================================================== */
  function openForm(editId) {
    editing = !!editId;
    currentSubId = editId || null;
    document.getElementById("subtFormTitle").textContent = editing ? "Edit Subtopic" : "Add Subtopic";
    document.getElementById("subtFormSub").textContent = currentTopicLabel;

    const sub = editing ? getSub(editId) : null;
    document.getElementById("subtName").value = sub ? sub.name : "";
    document.getElementById("subtType").value = sub ? sub.type : "Static";
    document.getElementById("subtData").value = sub ? sub.data : "";
    document.getElementById("subtLinks").value = sub ? sub.links : "";
    renderPyqEditor(sub ? sub.pyqs : []);

    openM("subtopicFormBackdrop");
    // when editing from the detail popup, close detail so the form is in front
    if (editing) closeM("subtopicViewBackdrop");
    document.getElementById("subtName").focus();
  }

  function renderPyqEditor(pyqs) {
    const ed = document.getElementById("pyqEditor");
    ed.innerHTML = (pyqs || []).map((p, i) => pyqRow(p, i)).join("");
  }
  function pyqRow(p, i) {
    return `
      <div class="pyq-row" data-i="${i}">
        <input type="text" class="field-input pyq-year" placeholder="Year" value="${p ? escapeHTML(p.year) : ""}" />
        <input type="text" class="field-input pyq-marks" placeholder="Marks" value="${p ? escapeHTML(p.marks) : ""}" />
        <textarea class="field-input pyq-q" rows="2" placeholder="Question…">${p ? escapeHTML(p.question) : ""}</textarea>
        <button class="icon-btn icon-btn--danger pyq-del" title="Remove PYQ" aria-label="Remove PYQ">🗑</button>
      </div>`;
  }
  function addPyqRow() {
    const ed = document.getElementById("pyqEditor");
    ed.insertAdjacentHTML("beforeend", pyqRow(null, ed.children.length));
    const rows = ed.querySelectorAll(".pyq-row");
    rows[rows.length - 1].querySelector(".pyq-year").focus();
  }
  function collectPyqs() {
    const rows = document.querySelectorAll("#pyqEditor .pyq-row");
    const out = [];
    rows.forEach((r) => {
      const year = r.querySelector(".pyq-year").value.trim();
      const marks = r.querySelector(".pyq-marks").value.trim();
      const question = r.querySelector(".pyq-q").value.trim();
      if (year || marks || question) out.push({ year, marks, question });
    });
    return out;
  }

  function saveForm() {
    const name = document.getElementById("subtName").value.trim();
    if (!name) { document.getElementById("subtName").focus(); return; }
    const type = document.getElementById("subtType").value;
    const data = document.getElementById("subtData").value.trim();
    const links = document.getElementById("subtLinks").value.trim();
    const pyqs = collectPyqs();

    const list = getList(currentTopicId);
    if (editing && currentSubId) {
      const sub = list.find((s) => s.id === currentSubId);
      if (sub) { sub.name = name; sub.type = type; sub.data = data; sub.links = links; sub.pyqs = pyqs; sub.editedAt = Date.now(); }
    } else {
      const id = "st" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      list.push({ id, name, type, data, links, pyqs, createdAt: Date.now(), editedAt: null });
      currentSubId = id;
    }
    setList(currentTopicId, list);
    closeM("subtopicFormBackdrop");
    renderList();
    refreshMains();
    // after edit: reopen the detail popup (now in front) showing updated content
    if (editing) openDetail(currentSubId);
  }

  /* =====================================================
     POPUP 3 — view detail
     ===================================================== */
  function openDetail(id) {
    currentSubId = id;
    renderDetail();
    openM("subtopicViewBackdrop");
  }
  function renderDetail() {
    const s = getSub(currentSubId);
    if (!s) { closeM("subtopicViewBackdrop"); return; }
    document.getElementById("subtViewTitle").textContent = s.name;
    const stamps = `📅 Added: ${fmtDate(s.createdAt)}` + (s.editedAt ? ` &nbsp;·&nbsp; ✏️ Last edited: ${fmtDate(s.editedAt)} · ${fmtTime(s.editedAt)}` : "");
    document.getElementById("subtViewStamps").innerHTML = stamps;

    const body = document.getElementById("subtViewBody");
    const pyqsHTML = (s.pyqs && s.pyqs.length)
      ? s.pyqs.map((p) => `
          <div class="pyq-card">
            <div class="pyq-head"><span class="pyq-year-badge">${escapeHTML(p.year || "—")}</span><span class="pyq-marks-badge">${escapeHTML(p.marks || "—")} Marks</span></div>
            <p class="pyq-question">${escapeHTML(p.question || "")}</p>
          </div>`).join("")
      : `<p class="subt-empty-line">No PYQs added.</p>`;

    body.innerHTML = `
      <div class="subt-section">
        <h3 class="subt-h">🏷️ Type</h3>
        <span class="subt-type-chip subt-type-${typeClass(s.type)}">${escapeHTML(s.type)}</span>
      </div>
      <div class="subt-section">
        <h3 class="subt-h">📖 Data / Knowledge</h3>
        ${s.data ? `<div class="subt-prose">${escapeHTML(s.data).replace(/\n/g,"<br>")}</div>` : `<p class="subt-empty-line">No data added.</p>`}
      </div>
      <div class="subt-section">
        <h3 class="subt-h">📝 PYQs <span class="subt-h-count">${s.pyqs ? s.pyqs.length : 0}</span></h3>
        <div class="pyq-list">${pyqsHTML}</div>
      </div>
      <div class="subt-section">
        <h3 class="subt-h">🔗 Interlinkage</h3>
        ${s.links ? `<div class="subt-prose">${escapeHTML(s.links).replace(/\n/g,"<br>")}</div>` : `<p class="subt-empty-line">No interlinkage added.</p>`}
      </div>`;
  }

  function deleteSub() {
    const s = getSub(currentSubId);
    if (!s) return;
    ConfirmDialog.open({
      title: "Delete Subtopic?",
      message: `Are you sure you want to delete "${s.name}"? This will remove its data, PYQs and interlinkage. This action cannot be undone.`,
      confirmLabel: "🗑️ Delete",
      onConfirm: () => {
        setList(currentTopicId, getList(currentTopicId).filter((x) => x.id !== currentSubId));
        closeM("subtopicViewBackdrop");
        renderList();
        refreshMains();
      },
    });
  }

  function refreshMains() { if (typeof Mains !== "undefined" && Mains.onShow) Mains.onShow(); }

  /* ---------- init ---------- */
  function init() {
    // Popup 1
    document.getElementById("subtopicsClose").addEventListener("click", () => { closeM("subtopicsBackdrop"); refreshMains(); });
    document.getElementById("subtopicsBackdrop").addEventListener("click", (e) => { if (e.target.id === "subtopicsBackdrop") { closeM("subtopicsBackdrop"); refreshMains(); } });
    document.getElementById("addSubtopicBtn").addEventListener("click", () => openForm(null));
    document.getElementById("subtopicSearch").addEventListener("input", (e) => { listQuery = e.target.value.trim(); renderList(); });
    document.getElementById("subtopicsList").addEventListener("click", (e) => {
      const item = e.target.closest(".subt-item");
      if (item) openDetail(item.dataset.id);
    });

    // Popup 2
    document.getElementById("subtFormClose").addEventListener("click", () => closeM("subtopicFormBackdrop"));
    document.getElementById("subtFormCancel").addEventListener("click", () => closeM("subtopicFormBackdrop"));
    document.getElementById("subtFormSave").addEventListener("click", saveForm);
    document.getElementById("addPyqBtn").addEventListener("click", addPyqRow);
    document.getElementById("pyqEditor").addEventListener("click", (e) => {
      const del = e.target.closest(".pyq-del");
      if (del) {
        const row = del.closest(".pyq-row");
        // if the row has content, confirm; if empty, just remove
        const hasContent = ["pyq-year","pyq-marks","pyq-q"].some((c) => row.querySelector("."+c).value.trim());
        if (hasContent) {
          ConfirmDialog.open({
            title: "Delete PYQ?",
            message: "Are you sure you want to delete this PYQ? This action cannot be undone.",
            confirmLabel: "🗑️ Delete",
            onConfirm: () => row.remove(),
          });
        } else { row.remove(); }
      }
    });

    // Popup 3
    document.getElementById("subtViewClose").addEventListener("click", () => closeM("subtopicViewBackdrop"));
    document.getElementById("subtopicViewBackdrop").addEventListener("click", (e) => { if (e.target.id === "subtopicViewBackdrop") closeM("subtopicViewBackdrop"); });
    document.getElementById("subtEditBtn").addEventListener("click", () => openForm(currentSubId));
    document.getElementById("subtDeleteBtn").addEventListener("click", deleteSub);
  }

  return { init, open, count };
})();
