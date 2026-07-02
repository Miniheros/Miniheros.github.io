/* =========================================================
   login.js — welcome screen + simulated auth (localStorage)
   - cycling typed greeting in many languages
   - fixed name "Adarsh", auto date line
   - User ID + password (password = today's date DDMMYYYY)
   ========================================================= */

const Login = (() => {
  const USER_ID = "miniheros";

  /* ---------- date helpers ---------- */
  const MONTHS = ["January","February","March","April","May","June","July",
    "August","September","October","November","December"];
  const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

  function pad(n) { return String(n).padStart(2, "0"); }

  // "26 June 2026 : Friday"
  function dateLine(d = new Date()) {
    return `${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()} : ${DAYS[d.getDay()]}`;
  }
  // today's password "26062026"
  function todayPassword(d = new Date()) {
    return `${pad(d.getDate())}${pad(d.getMonth() + 1)}${d.getFullYear()}`;
  }

  function renderDate() {
    const el = document.getElementById("introDate");
    if (el) el.textContent = dateLine();
  }
  // re-check the date roughly every minute so it rolls over at midnight
  function startDateTicker() {
    renderDate();
    setInterval(renderDate, 60 * 1000);
  }

  /* ---------- typing animation ---------- */
  const GREETINGS = [
    "Hello",        // English
    "नमस्ते",        // Hindi
    "नमस्कारः",      // Sanskrit
    "Hallo",        // German
    "Bonjour",      // French
    "Hola",         // Spanish
    "Ciao",         // Italian
    "こんにちは",     // Japanese
    "안녕하세요",      // Korean
    "Olá",          // Portuguese
    "Привет",       // Russian
    "Hallo",        // Dutch
    "Merhaba",      // Turkish
    "Γεια σας",     // Greek
    "Hej",          // Swedish
  ];

  function startTyping() {
    const target = document.getElementById("typedGreeting");
    if (!target) return;

    // respect reduced motion: just show the first greeting, no animation
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      target.textContent = GREETINGS[0];
      return;
    }

    let wordIndex = 0;
    let charIndex = 0;
    let deleting = false;

    const TYPE_SPEED = 110;    // ms per char typed
    const DELETE_SPEED = 55;   // ms per char deleted
    const HOLD = 1300;         // pause when fully typed
    const GAP = 250;           // pause before next word

    function tick() {
      const word = GREETINGS[wordIndex];

      if (!deleting) {
        charIndex++;
        target.textContent = word.slice(0, charIndex);
        if (charIndex === word.length) {
          deleting = true;
          return setTimeout(tick, HOLD);
        }
        return setTimeout(tick, TYPE_SPEED);
      } else {
        charIndex--;
        target.textContent = word.slice(0, charIndex);
        if (charIndex === 0) {
          deleting = false;
          wordIndex = (wordIndex + 1) % GREETINGS.length;
          return setTimeout(tick, GAP);
        }
        return setTimeout(tick, DELETE_SPEED);
      }
    }
    tick();
  }

  /* ---------- open / close ---------- */
  function openLogin() {
    sessionStorage.setItem("upsc.loginOpen", "1");
    const o = document.getElementById("loginOverlay");
    o.classList.add("is-open");
    o.setAttribute("aria-hidden", "false");
    const u = document.getElementById("loginUserInput");
    if (!u.value) u.value = USER_ID; // prefill default user id
    u.focus();
  }
  function closeLogin() {
    sessionStorage.removeItem("upsc.loginOpen");
    const o = document.getElementById("loginOverlay");
    o.classList.remove("is-open");
    o.setAttribute("aria-hidden", "true");
  }

  /* ---------- submit ---------- */
  function submit() {
    const userId = document.getElementById("loginUserInput").value.trim();
    const pass = document.getElementById("loginPassInput").value.trim();
    const remember = document.getElementById("rememberMe").checked;
    const err = document.getElementById("loginError");

    if (userId.toLowerCase() !== USER_ID) {
      err.textContent = "Incorrect User ID.";
      return;
    }
    if (pass !== todayPassword()) {
      err.textContent = "Incorrect password.";
      return;
    }
    err.textContent = "";

    const user = { name: "Adarsh", userId: USER_ID, remember, loginAt: Date.now() };
    Store.setUser(user);
    closeLogin();
    App.onLogin(user);
  }

  function initPasswordPeek() {
    const input = document.getElementById("loginPassInput");
    const button = document.getElementById("passwordPeek");
    const reveal = () => {
      input.type = "text";
      button.classList.add("is-revealing");
      button.setAttribute("aria-label", "Release to hide password");
    };
    const hide = () => {
      input.type = "password";
      button.classList.remove("is-revealing");
      button.setAttribute("aria-label", "Hold to show password");
    };

    button.addEventListener("pointerdown", (e) => { e.preventDefault(); reveal(); });
    ["pointerup", "pointerleave", "pointercancel", "blur"].forEach((event) =>
      button.addEventListener(event, hide));
    button.addEventListener("keydown", (e) => {
      if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); reveal(); }
    });
    button.addEventListener("keyup", hide);
  }

  /* ---------- init ---------- */
  function init() {
    startDateTicker();
    startTyping();
    initPasswordPeek();

    document.getElementById("getStartedBtn").addEventListener("click", openLogin);
    document.getElementById("loginClose").addEventListener("click", closeLogin);
    document.getElementById("loginSubmit").addEventListener("click", submit);

    document.getElementById("loginOverlay").addEventListener("click", (e) => {
      if (e.target.id === "loginOverlay") closeLogin();
    });
    ["loginUserInput", "loginPassInput"].forEach((id) =>
      document.getElementById(id).addEventListener("keydown", (e) => {
        if (e.key === "Enter") submit();
      }));

    if (sessionStorage.getItem("upsc.loginOpen") === "1") openLogin();
  }

  return { init, openLogin };
})();
