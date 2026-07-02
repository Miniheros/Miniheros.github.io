# CSE Progress Tracker

A premium, responsive, single-page web app to track your CSE preparation chapter-by-chapter. Pure **HTML + CSS + vanilla JavaScript** — no backend, no build step. All progress is saved in your browser via `localStorage` and survives refreshes and browser restarts. Deploy free on **GitHub Pages**.

---

## Features

- **Welcome → Login → Menu → Subject Tracker** flow, all in one fast single-page app.
- "Hello, _your name_" landing page; your name flows through every screen.
- Simulated login (name + email + password) stored locally, with **Remember me** to auto-resume.
- **Menu page** with one module card now (Subject Progress Tracker) and a scalable grid ready for more.
- **17 CSE subjects** pre-loaded with starter chapters — Polity, Economy, Geography, Environment, Modern/Ancient/Medieval History, Art & Culture, Sci & Tech, IR, Internal Security, Disaster Management, Agriculture, Society, Ethics, Essay, Anthropology Optional.
- Each subject card: total / completed / remaining chapters, **circular progress ring** + **linear bar**, live percentage.
- **Chapter modal**: mark complete (grey → green button, text turns dark green, **no strikethrough**), **edit**, **delete**, and **+ Add new chapter**.
- **Dashboard stats**: total subjects, chapters, completed, remaining, overall %, daily streak, today / this week / this month.
- **Search** subjects and chapters; **filters** (all / in-progress / completed / recently added / A–Z).
- **Dark & light mode** (remembered), glassmorphism UI, smooth animations.
- **Confetti** when a subject reaches 100%.
- Keyboard shortcuts: `T` toggle theme, `/` focus search, `Esc` close modal.
- Scroll-to-top button, accessible focus states, reduced-motion support.
- Full JSON backup and restore. Every export is built from the latest app data, and older backup files remain importable.

## Screenshots

> _Add screenshots here after deploying._
> `assets/images/intro.png`, `assets/images/tracker.png`, `assets/images/modal.png`

---

## Folder structure

```
/index.html
/css
    style.css        # tokens, theme, buttons, intro, login, menu, topbar
    dashboard.css    # stats + subject cards + progress
    popup.css        # chapter modal
    responsive.css   # tablet & mobile
/js
    data.js          # seed subjects, chapters, quotes  (edit me to change defaults)
    storage.js       # localStorage data layer (swap here for Firebase later)
    theme.js         # dark/light toggle
    confetti.js      # 100% celebration
    tracker.js       # subject grid, stats, progress math
    popup.js         # chapter modal logic
    login.js         # simulated auth
    app.js           # routing + boot + shortcuts
/assets
    icons/  images/
README.md
```

---

## Local usage

No server needed. Either:

- Double-click `index.html`, **or**
- Run a tiny local server (recommended): `python3 -m http.server` then open `http://localhost:8000`.

---

## Deploy to GitHub Pages

1. Create a new GitHub repository and upload all files (keep the folder structure).
2. Repo **Settings → Pages**.
3. Under **Build and deployment → Source**, choose **Deploy from a branch**.
4. Pick branch `main` and folder `/ (root)`, then **Save**.
5. Wait ~1 minute; your site is live at `https://<username>.github.io/<repo>/`.

All paths are relative, so nothing breaks after deployment.

---

## Customization guide

- **Change starting subjects/chapters** → edit `js/data.js` (`DEFAULT_SUBJECTS`). To re-seed after editing, clear site data or run `localStorage.clear()` in the browser console.
- **Change colors / fonts** → edit the `:root` and `[data-theme]` tokens at the top of `css/style.css`.
- **Change quotes** → `QUOTES` array in `js/data.js`.

---

## Future expansion

The menu is a card grid — add new modules (Prelims PYQ Tracker, Mains PYQ, Daily Planner, Revision Tracker, Current Affairs, Notes, Test Series, Analytics, etc.) by adding a `.module-card` in `index.html` and a handler in `app.js → initMenu()`. The `storage.js` layer is the single place that talks to storage, so migrating to **Firebase/Supabase** for cross-device sync means rewriting only that file — the rest of the app calls `Store.*` and is untouched.

---

## Notes

- Login is **simulated** (client-side only). It's a session gate, not real security.
- Data lives in the browser it was entered in; it does **not** sync across devices until you wire a backend into `storage.js`.
