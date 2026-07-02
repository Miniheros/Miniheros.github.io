/* =========================================================
   confetti.js — tiny canvas confetti (no dependencies)
   Fires when a subject reaches 100%.
   ========================================================= */

const Confetti = (() => {
  const canvas = document.getElementById("confetti");
  const ctx = canvas.getContext("2d");
  let pieces = [];
  let raf = null;

  const colors = ["#e0a458", "#2f9e6b", "#587ce0", "#f0c98b", "#6ee0a6"];

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener("resize", resize);
  resize();

  function spawn() {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const count = reduce ? 0 : 140;
    for (let i = 0; i < count; i++) {
      pieces.push({
        x: canvas.width / 2 + (Math.random() - 0.5) * 200,
        y: canvas.height / 2,
        vx: (Math.random() - 0.5) * 12,
        vy: Math.random() * -14 - 4,
        size: Math.random() * 7 + 4,
        color: colors[(Math.random() * colors.length) | 0],
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        life: 0,
      });
    }
    if (!raf) loop();
  }

  function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach((p) => {
      p.vy += 0.35; // gravity
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      p.life += 1;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    });
    pieces = pieces.filter((p) => p.y < canvas.height + 40 && p.life < 240);
    if (pieces.length) {
      raf = requestAnimationFrame(loop);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      raf = null;
    }
  }

  return { fire: spawn };
})();
