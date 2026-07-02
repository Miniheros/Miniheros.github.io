/* =========================================================
   storage.js — data persistence layer
   All reads/writes go through Store, so swapping localStorage
   for Firebase/Supabase later means editing only this file.
   ========================================================= */

const Store = (() => {
  const DATA_PREFIX = "upsc.";
  const LOCAL_ONLY_KEYS = new Set(["upsc.lastExport", "upsc.lastImport"]);
  const KEYS = {
    user: "upsc.user",
    subjects: "upsc.subjects",
    theme: "upsc.theme",
    activity: "upsc.activity", // { 'YYYY-MM-DD': count }
    seedVersion: "upsc.seedVersion",
  };

  // Bump this when DEFAULT_SUBJECTS chapter lists change so existing
  // installs re-sync chapter lists (completion status preserved by title).
  // v3: merge in COMPLETED_SEED (chapter completion imported from backup).
  const SEED_VERSION = 3;

  let _id = 1;
  const uid = () => `c${Date.now().toString(36)}${(_id++).toString(36)}`;

  function decodeValue(raw) {
    try { return JSON.parse(raw); }
    catch { return raw; }
  }

  function collectData() {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(DATA_PREFIX) && !LOCAL_ONLY_KEYS.has(key)) {
        data[key] = decodeValue(localStorage.getItem(key));
      }
    }
    return data;
  }

  function dataKeys() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(DATA_PREFIX) && !LOCAL_ONLY_KEYS.has(key)) keys.push(key);
    }
    return keys;
  }

  function buildSnapshot() {
    return {
      app: "CSE-Tracker",
      version: 2,
      updatedAt: new Date().toISOString(),
      data: collectData(),
    };
  }

  function setRaw(key, value) {
    localStorage.setItem(key, value);
  }

  function removeRaw(key) {
    localStorage.removeItem(key);
  }

  function restoreSnapshot(backup) {
    const previous = {};
    dataKeys().forEach((key) => { previous[key] = localStorage.getItem(key); });

    try {
      dataKeys().forEach((key) => localStorage.removeItem(key));
      Object.entries(backup.data).forEach(([key, value]) => {
        if (!key.startsWith(DATA_PREFIX) || LOCAL_ONLY_KEYS.has(key)) return;
        const encoded = (!backup.version || backup.version < 2) && typeof value === "string"
          ? value
          : JSON.stringify(value);
        if (encoded === undefined) throw new Error(`Unsupported value for ${key}`);
        localStorage.setItem(key, encoded);
      });
      return buildSnapshot();
    } catch (error) {
      dataKeys().forEach((key) => localStorage.removeItem(key));
      Object.entries(previous).forEach(([key, value]) => localStorage.setItem(key, value));
      throw error;
    }
  }

  const read = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      console.warn("Store.read failed", key, e);
      return fallback;
    }
  };
  const write = (key, value) => {
    try { setRaw(key, JSON.stringify(value)); }
    catch (e) { console.warn("Store.write failed", key, e); }
  };

  /* ---- user ---- */
  const getUser = () => read(KEYS.user, null);
  const setUser = (user) => write(KEYS.user, user);
  const clearUser = () => removeRaw(KEYS.user);

  /* ---- subjects ---- */
  function seedSubjects() {
    const comp = (typeof COMPLETED_SEED !== "undefined") ? COMPLETED_SEED : {};
    const stamps = (typeof COMPLETED_STAMPS !== "undefined") ? COMPLETED_STAMPS : {};
    const subjects = DEFAULT_SUBJECTS.map((s, i) => {
      const doneSet = new Set(comp[s.name] || []);
      return {
        id: uid(),
        name: s.name,
        emoji: s.emoji,
        order: i,
        chapters: s.chapters.map((title) => {
          const done = doneSet.has(title);
          const ts = stamps[s.name + "||" + title] || null;
          return {
            id: uid(),
            title,
            done,
            completedAt: done ? (ts || Date.now()) : null,
            createdAt: Date.now(),
          };
        }),
      };
    });
    write(KEYS.subjects, subjects);
    // seed the activity counter so streak/stat tiles reflect imported progress
    try {
      let totalDone = 0;
      subjects.forEach((s) => s.chapters.forEach((c) => { if (c.done) totalDone++; }));
      if (totalDone > 0) {
        const a = read(KEYS.activity, {});
        const k = todayKey();
        if (!a[k]) { a[k] = totalDone; write(KEYS.activity, a); }
      }
    } catch (_) { /* non-fatal */ }
    return subjects;
  }

  const getSubjects = () => {
    const existing = read(KEYS.subjects, null);
    if (!existing) { write(KEYS.seedVersion, SEED_VERSION); return seedSubjects(); }
    const ver = read(KEYS.seedVersion, 1);
    if (ver < SEED_VERSION) {
      const migrated = migrateChapters(existing);
      write(KEYS.subjects, migrated);
      write(KEYS.seedVersion, SEED_VERSION);
      return migrated;
    }
    return existing;
  };

  // Re-sync chapter lists for seeded subjects to match DEFAULT_SUBJECTS,
  // preserving done/completedAt for chapters whose title still exists.
  function migrateChapters(existing) {
    const comp = (typeof COMPLETED_SEED !== "undefined") ? COMPLETED_SEED : {};
    const stamps = (typeof COMPLETED_STAMPS !== "undefined") ? COMPLETED_STAMPS : {};
    const seedByName = {};
    DEFAULT_SUBJECTS.forEach((s) => { seedByName[s.name] = s; });
    return existing.map((subj) => {
      const seed = seedByName[subj.name];
      if (!seed) return subj; // not a seeded subject → leave untouched
      const doneSet = new Set(comp[subj.name] || []);
      const oldByTitle = {};
      (subj.chapters || []).forEach((c) => { oldByTitle[c.title] = c; });
      const newChapters = seed.chapters.map((title) => {
        const prev = oldByTitle[title];
        const seedDone = doneSet.has(title);
        const seedTs = stamps[subj.name + "||" + title] || null;
        if (prev) {
          // keep the user's own progress; only fill in seed completion if the
          // user hadn't marked it done yet (never un-does a user's work)
          const done = !!prev.done || seedDone;
          return {
            id: prev.id, title, done,
            completedAt: done ? (prev.completedAt || seedTs || Date.now()) : null,
            createdAt: prev.createdAt || Date.now(),
          };
        }
        return {
          id: uid(), title, done: seedDone,
          completedAt: seedDone ? (seedTs || Date.now()) : null,
          createdAt: Date.now(),
        };
      });
      return { ...subj, chapters: newChapters };
    });
  }
  const setSubjects = (subjects) => write(KEYS.subjects, subjects);

  /* ---- theme ---- */
  const getTheme = () => read(KEYS.theme, "dark");
  const setTheme = (t) => write(KEYS.theme, t);

  /* ---- activity (for streak + today/week/month) ---- */
  const todayKey = () => new Date().toISOString().slice(0, 10);
  const getActivity = () => read(KEYS.activity, {});
  const bumpActivity = (delta = 1) => {
    const a = getActivity();
    const k = todayKey();
    a[k] = Math.max(0, (a[k] || 0) + delta);
    write(KEYS.activity, a);
    return a;
  };

  /* ---- export / import ---- */
  const exportAll = () => ({
    user: getUser(),
    subjects: getSubjects(),
    activity: getActivity(),
    exportedAt: new Date().toISOString(),
  });
  const importAll = (data) => {
    if (data.subjects) setSubjects(data.subjects);
    if (data.activity) write(KEYS.activity, data.activity);
    if (data.user) setUser(data.user);
  };

  return {
    uid, getUser, setUser, clearUser,
    getSubjects, setSubjects,
    getTheme, setTheme,
    getActivity, bumpActivity, todayKey,
    exportAll, importAll,
    setRaw, removeRaw, restoreSnapshot,
    getSnapshot: buildSnapshot,
  };
})();
