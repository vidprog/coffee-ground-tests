(() => {
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  const screens = {
    home: $("#screen-home"),
    quiz: $("#screen-quiz"),
    result: $("#screen-result")
  };

  let state = { test: null, index: 0, scores: {}, result: null };

  /* ── Навігація ─────────────────────────── */
  function show(name) {
    Object.values(screens).forEach((s) => s.classList.remove("is-active"));
    screens[name].classList.add("is-active");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ── Тема ──────────────────────────────── */
  const THEME_KEY = "theme";
  let onThemeChange = null; // сюди підписуються зорі, щоб перефарбуватися

  /** Кольори зір беремо з CSS-змінних поточної теми: трійки RGB без прозорості. */
  function starTone() {
    const css = getComputedStyle(document.documentElement);
    return {
      gold: css.getPropertyValue("--star-gold").trim(),
      pale: css.getPropertyValue("--star-pale").trim()
    };
  }

  function applyTheme(name) {
    document.documentElement.dataset.theme = name;
    const btn = $("#theme-toggle");
    const light = name === "light";
    btn.textContent = light ? "☀️" : "🌙";
    btn.setAttribute("aria-pressed", String(light));
    btn.setAttribute("aria-label", light ? "Увімкнути темну тему" : "Увімкнути світлу тему");
    if (onThemeChange) onThemeChange();
  }

  function toggleTheme() {
    const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch (e) {
      // приватний режим — тему міняємо, але не памʼятаємо
    }
    applyTheme(next);
  }

  /* ── Головна ───────────────────────────── */
  function renderHome() {
    const grid = $("#test-grid");
    grid.innerHTML = "";
    TESTS.forEach((test) => {
      const card = document.createElement("button");
      card.className = "test-card";
      card.type = "button";
      card.innerHTML = `
        <span class="icon">${test.icon}</span>
        <h3>${test.title}</h3>
        <p>${test.subtitle}</p>
        <span class="go">${test.questions.length} питань</span>`;
      card.addEventListener("click", () => startTest(test));
      grid.appendChild(card);
    });
    show("home");
  }

  /* ── Проходження ───────────────────────── */
  function startTest(test) {
    state = { test, index: 0, scores: {}, result: null };
    Object.keys(test.results).forEach((key) => (state.scores[key] = 0));
    $("#quiz-name").textContent = test.title;
    renderQuestion();
    show("quiz");
  }

  function renderQuestion() {
    const { test, index } = state;
    const question = test.questions[index];

    $("#q-index").textContent = `Питання ${index + 1} з ${test.questions.length}`;
    $("#q-text").textContent = question.q;

    const moons = $("#moons");
    moons.innerHTML = "";
    test.questions.forEach((_, i) => {
      const moon = document.createElement("span");
      moon.className = "moon" + (i < index ? " done" : i === index ? " current" : "");
      moons.appendChild(moon);
    });

    const box = $("#options");
    box.innerHTML = "";
    shuffle(question.options.slice()).forEach((opt) => {
      const btn = document.createElement("button");
      btn.className = "option";
      btn.type = "button";
      btn.textContent = opt.t;
      btn.addEventListener("click", () => pick(btn, opt));
      box.appendChild(btn);
    });

    const card = $("#question-card");
    card.style.animation = "none";
    void card.offsetWidth;
    card.style.animation = "";
  }

  function pick(btn, opt) {
    if (btn.closest(".options").dataset.locked) return;
    btn.closest(".options").dataset.locked = "1";
    btn.classList.add("picked");
    state.scores[opt.r] = (state.scores[opt.r] || 0) + 1;

    setTimeout(() => {
      delete $("#options").dataset.locked;
      state.index += 1;
      if (state.index < state.test.questions.length) renderQuestion();
      else renderResult();
    }, 320);
  }

  /* ── Результат ─────────────────────────── */
  function renderResult() {
    const { test, scores } = state;
    const best = Object.keys(scores).reduce((a, b) =>
      scores[b] > scores[a] ? b : a
    );
    const res = test.results[best];
    state.result = res;

    $("#result-emoji").textContent = res.emoji;
    $("#result-title").textContent = res.title;
    $("#result-text").textContent = res.text;
    $("#result-advice").textContent = res.advice;

    const traits = $("#result-traits");
    traits.innerHTML = "";
    res.traits.forEach((t) => {
      const span = document.createElement("span");
      span.className = "trait";
      span.textContent = t;
      traits.appendChild(span);
    });

    show("result");
  }

  function copyResult() {
    const { test, result } = state;
    if (!result) return;
    const text =
      `☕ Тести на кавовій гущі — «${test.title}»\n\n` +
      `${result.emoji} ${result.title}\n${result.text}\n\n` +
      `Порада від Всесвіту: ${result.advice}`;

    const done = () => toast("Скопійовано ✦ тепер це твоя карма");
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
    } else {
      fallbackCopy(text, done);
    }
  }

  function fallbackCopy(text, done) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); done(); }
    catch { toast("Гуща не дала скопіювати. Спробуй ще"); }
    ta.remove();
  }

  let toastTimer;
  function toast(msg) {
    let el = document.querySelector(".toast");
    if (!el) {
      el = document.createElement("div");
      el.className = "toast";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2400);
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /* ── Дії ───────────────────────────────── */
  document.addEventListener("click", (e) => {
    const action = e.target.closest("[data-action]")?.dataset.action;
    if (!action) return;
    if (action === "home") renderHome();
    if (action === "retry") startTest(state.test);
    if (action === "copy") copyResult();
    if (action === "theme") toggleTheme();
  });

  /* ── Зоряне небо ───────────────────────── */
  function initStars() {
    const canvas = $("#stars");
    const ctx = canvas.getContext("2d");
    let stars = [];
    let tone = starTone();
    const still = matchMedia("(prefers-reduced-motion: reduce)");

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = innerWidth * dpr;
      canvas.height = innerHeight * dpr;
      canvas.style.width = innerWidth + "px";
      canvas.style.height = innerHeight + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round((innerWidth * innerHeight) / 9000);
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * innerWidth,
        y: Math.random() * innerHeight,
        r: Math.random() * 1.3 + 0.3,
        a: Math.random(),
        s: Math.random() * 0.012 + 0.003,
        gold: Math.random() > 0.82
      }));
      // Зміна розміру скидає canvas. У статичному режимі кадрів, які його
      // відновили б, не буде — тому малюємо небо одразу.
      if (still.matches) drawStatic();
    }

    function draw() {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      stars.forEach((st) => {
        st.a += st.s;
        const alpha = 0.25 + Math.abs(Math.sin(st.a)) * 0.7;
        ctx.beginPath();
        ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
        ctx.fillStyle = st.gold
          ? `rgba(${tone.gold},${alpha})`
          : `rgba(${tone.pale},${alpha * 0.8})`;
        ctx.fill();
      });
      requestAnimationFrame(draw);
    }

    resize();
    addEventListener("resize", resize);

    // Так само після зміни теми: нові кольори підхопити нема чому.
    onThemeChange = () => {
      tone = starTone();
      if (still.matches) {
        ctx.clearRect(0, 0, innerWidth, innerHeight);
        drawStatic();
      }
    };

    if (!still.matches) draw(); // статичне небо вже намальовано в resize()

    function drawStatic() {
      stars.forEach((st) => {
        ctx.beginPath();
        ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
        ctx.fillStyle = st.gold ? `rgba(${tone.gold},.7)` : `rgba(${tone.pale},.6)`;
        ctx.fill();
      });
    }
  }

  /* ── Старт ─────────────────────────────── */
  $("#year").textContent = new Date().getFullYear();
  applyTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
  renderHome();
  initStars();
})();
