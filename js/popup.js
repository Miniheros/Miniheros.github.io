/* =========================================================
   popup.js — chapter modal
   ========================================================= */

const Popup = (() => {
  let currentId = null;
  let cFilter = "all";
  let cQuery = "";

  const el = {
    backdrop: () => document.getElementById("modalBackdrop"),
    name: () => document.getElementById("modalSubjectName"),
    progressText: () => document.getElementById("modalProgressText"),
    ring: () => document.getElementById("modalRing"),
    list: () => document.getElementById("chapterList"),
  };

  /* ---------- open / close ---------- */
  function open(subjectId) {
    currentId = subjectId;
    cFilter = "all"; cQuery = "";
    document.getElementById("chapterSearch").value = "";
    document.querySelectorAll("#chapterFilters .chip").forEach((c, i) =>
      c.classList.toggle("is-active", i === 0));
    resetAddForm();
    render();
    if (Tracker.setModalOpen) Tracker.setModalOpen(true);
    const b = el.backdrop();
    b.classList.add("is-open");
    b.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function close() {
    const b = el.backdrop();
    b.classList.remove("is-open");
    b.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    currentId = null;
    if (Tracker.setModalOpen) Tracker.setModalOpen(false);
  }

  /* ---------- render ---------- */
  function visibleChapters(subject) {
    let list = [...subject.chapters];
    if (cQuery) {
      const q = cQuery.toLowerCase();
      list = list.filter((c) => c.title.toLowerCase().includes(q));
    }
    if (cFilter === "completed") list = list.filter((c) => c.done);
    if (cFilter === "incomplete") list = list.filter((c) => !c.done);
    return list;
  }

  function render() {
    const s = Tracker.getSubject(currentId);
    if (!s) return;
    const st = Tracker.getSubjectStats(currentId);

    el.name().textContent = s.name;
    el.progressText().textContent = `${st.done} / ${st.total} chapters · ${st.percent}%`;
    el.ring().innerHTML = Tracker.ringSVG(st.percent, 58, 6);

    const list = visibleChapters(s);
    const wrap = el.list();

    if (!s.chapters.length) {
      wrap.innerHTML = `
        <div class="chapter-empty">
          <span class="empty-emoji">📭</span>
          <p>No chapters yet. Add your first one below.</p>
        </div>`;
      return;
    }
    if (!list.length) {
      wrap.innerHTML = `<div class="chapter-empty"><span class="empty-emoji">🔍</span><p>No chapters match.</p></div>`;
      return;
    }

    wrap.innerHTML = list.map((c, i) => `
      <div class="chapter-row ${c.done ? "is-done" : ""}" data-id="${c.id}" style="animation-delay:${Math.min(i, 12) * 18}ms">
        <span class="chapter-check">${c.done ? "☑" : "☐"}</span>
        <span class="chapter-namewrap">
          <span class="chapter-name">${escapeHTML(c.title)}</span>
          ${c.done && c.completedAt ? `<span class="chapter-stamp">📅 ${fmtDateLong(c.completedAt)} · 🕒 ${fmtTimeShort(c.completedAt)}</span>` : ""}
        </span>
        <div class="chapter-actions">
          <button class="btn-complete ${c.done ? "is-done" : ""}" data-act="toggle">
            ${c.done ? "Completed" : "Mark done"}
          </button>
          <button class="icon-btn" data-act="edit" title="Edit" aria-label="Edit chapter">✎</button>
          <button class="icon-btn icon-btn--danger" data-act="delete" title="Delete" aria-label="Delete chapter">🗑</button>
        </div>
      </div>`).join("");
  }

  /* ---------- surgical updates (avoid full re-render / re-animation) ---------- */
  // Update just the header progress text + ring, no list churn.
  function updateHeader() {
    const st = Tracker.getSubjectStats(currentId);
    el.progressText().textContent = `${st.done} / ${st.total} chapters · ${st.percent}%`;
    el.ring().innerHTML = Tracker.ringSVG(st.percent, 58, 6);
  }

  // Update a single chapter row in place: checkbox, done-class, button, stamp.
  // Returns true if the row is still visible under the current filter,
  // false if the filter now excludes it (in which case we remove it).
  function updateRow(chapterId) {
    const row = el.list().querySelector(`.chapter-row[data-id="${chapterId}"]`);
    if (!row) return false;
    const s = Tracker.getSubject(currentId);
    const c = s && s.chapters.find((x) => x.id === chapterId);
    if (!c) { row.remove(); return false; }

    // If the active filter would now hide this row, drop it out (animated).
    const hiddenByFilter =
      (cFilter === "completed" && !c.done) || (cFilter === "incomplete" && c.done);
    if (hiddenByFilter) {
      row.classList.add("row-leaving");
      setTimeout(() => { if (row.parentNode) row.remove(); ensureNotEmpty(); }, 200);
      return false;
    }

    // toggle done styling
    row.classList.toggle("is-done", !!c.done);
    const check = row.querySelector(".chapter-check");
    if (check) check.textContent = c.done ? "☑" : "☐";
    const btn = row.querySelector('[data-act="toggle"]');
    if (btn) {
      btn.classList.toggle("is-done", !!c.done);
      btn.textContent = c.done ? "Completed" : "Mark done";
    }
    // completion stamp
    let stamp = row.querySelector(".chapter-stamp");
    const wrap = row.querySelector(".chapter-namewrap");
    if (c.done && c.completedAt) {
      const html = `📅 ${fmtDateLong(c.completedAt)} · 🕒 ${fmtTimeShort(c.completedAt)}`;
      if (stamp) stamp.innerHTML = html;
      else if (wrap) {
        stamp = document.createElement("span");
        stamp.className = "chapter-stamp";
        stamp.innerHTML = html;
        wrap.appendChild(stamp);
      }
    } else if (stamp) {
      stamp.remove();
    }
    return true;
  }

  // If a filtered view becomes empty after removing a row, show the empty note.
  function ensureNotEmpty() {
    const wrap = el.list();
    if (!wrap.querySelector(".chapter-row")) {
      wrap.innerHTML = `<div class="chapter-empty"><span class="empty-emoji">🔍</span><p>No chapters match.</p></div>`;
    }
  }

  /* ---------- row actions (event delegation) ---------- */
  function onListClick(e) {
    const row = e.target.closest(".chapter-row");
    if (!row) return;
    const chapterId = row.dataset.id;
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (!act) return;

    if (act === "toggle") {
      const res = Tracker.toggleChapter(currentId, chapterId);
      // Surgical, instant update — no full list re-render, no re-animation.
      updateHeader();
      const stillVisible = updateRow(chapterId);
      if (res?.chapter.done && stillVisible) {
        const liveRow = el.list().querySelector(`.chapter-row[data-id="${chapterId}"]`);
        if (liveRow) {
          liveRow.classList.remove("just-done");
          // restart the little pop without re-animating the whole list
          void liveRow.offsetWidth;
          liveRow.classList.add("just-done");
        }
      }
      if (res?.justCompletedSubject) {
        Confetti.fire();
        App.toast(`🎉 ${Tracker.getSubject(currentId).name} complete — every chapter done!`);
      }
    }

    if (act === "edit") startEdit(row, chapterId);

    if (act === "delete") {
      const c = Tracker.getSubject(currentId).chapters.find((x) => x.id === chapterId);
      ConfirmDialog.open({
        title: "Delete Chapter?",
        message: `Are you sure you want to delete "${c.title}"? This action cannot be undone.`,
        confirmLabel: "🗑️ Delete",
        onConfirm: () => {
          Tracker.deleteChapter(currentId, chapterId);
          render();
          App.toast("Chapter deleted");
        },
      });
    }
  }

  /* ---------- inline edit ---------- */
  function startEdit(row, chapterId) {
    const nameSpan = row.querySelector(".chapter-name");
    const current = nameSpan.textContent;
    const input = document.createElement("input");
    input.className = "chapter-name-input";
    input.value = current;
    nameSpan.replaceWith(input);
    input.focus();
    input.select();

    const commit = () => {
      const v = input.value.trim();
      if (v) Tracker.editChapter(currentId, chapterId, v);
      render();
    };
    input.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") commit();
      if (ev.key === "Escape") render();
    });
    input.addEventListener("blur", commit);
  }

  /* ---------- add chapter (always-visible input) ---------- */
  function resetAddForm() {
    const input = document.getElementById("newChapterInput");
    if (input) input.value = "";
  }
  function saveNewChapter() {
    const input = document.getElementById("newChapterInput");
    const v = input.value.trim();
    if (!v) { input.focus(); return; }
    Tracker.addChapter(currentId, v);
    input.value = "";
    render();
    App.toast("Chapter added");
    input.focus();
  }

  /* ---------- init ---------- */
  function init() {
    document.getElementById("modalClose").addEventListener("click", close);
    el.backdrop().addEventListener("click", (e) => { if (e.target === el.backdrop()) close(); });
    el.list().addEventListener("click", onListClick);

    document.getElementById("chapterSearch").addEventListener("input", (e) => {
      cQuery = e.target.value.trim(); render();
    });
    document.getElementById("chapterFilters").addEventListener("click", (e) => {
      const btn = e.target.closest(".chip");
      if (!btn) return;
      document.querySelectorAll("#chapterFilters .chip").forEach((c) => c.classList.remove("is-active"));
      btn.classList.add("is-active");
      cFilter = btn.dataset.cfilter; render();
    });

    document.getElementById("saveChapterBtn").addEventListener("click", saveNewChapter);
    document.getElementById("newChapterInput").addEventListener("keydown", (e) => {
      if (e.key === "Enter") saveNewChapter();
    });
  }

  return { init, open, close };
})();
