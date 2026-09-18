import "./styles.css";
import { posts, questions, testimonials } from "./toolData.js";

const app = document.querySelector("#app");
const path = window.location.pathname.replace(/\/$/, "") || "/";

const capturePage = `
<main class="capture-shell"><section class="hero" aria-labelledby="page-title">
  <div class="hero-copy">
    <a class="brand reveal r1" href="/lead-magnet"><span class="brand-mark">✦</span><span>Cuídate Bien</span></a>
    <p class="eyebrow reveal r2">DIAGNÓSTICO GRATUITO · 3 MINUTOS</p>
    <h1 id="page-title" class="reveal r3">¿Cuál es tu <em>Zona de Bienestar</em> con tu cachorro?</h1>
    <p class="intro reveal r4">Descubrí si tu espacio acompaña el descanso, el juego y la convivencia que ambos necesitan, y qué áreas conviene ajustar primero.</p>
    <div class="benefits reveal r5" aria-label="Qué vas a descubrir">
      <div><span>01</span><p>Qué está funcionando hoy en tu espacio.</p></div>
      <div><span>02</span><p>Dónde aparecen roces o sobreestimulación.</p></div>
      <div><span>03</span><p>Cuál es el siguiente ajuste más útil para ambos.</p></div>
    </div>
    <blockquote class="reveal r6">“Un espacio más claro no exige una casa perfecta. Empieza por entender qué necesita cada uno.”</blockquote>
  </div>
  <aside class="form-card reveal r3" aria-labelledby="form-title">
    <span class="card-glow" aria-hidden="true"></span><p class="card-kicker">TU PRIMER PASO</p>
    <h2 id="form-title">Recibí el acceso a tu diagnóstico</h2>
    <p class="card-copy">Completá tus datos y empezá a identificar tu zona de bienestar.</p>
    <form id="lead-form" novalidate>
      <label for="name">Tu nombre</label><input id="name" type="text" autocomplete="name" placeholder="¿Cómo te llamás?" required><p class="field-error" id="name-error" aria-live="polite"></p>
      <label for="email">Tu mejor email</label><input id="email" type="email" autocomplete="email" inputmode="email" placeholder="nombre@ejemplo.com" required><p class="field-error" id="email-error" aria-live="polite"></p>
      <label class="consent" for="consent"><input id="consent" type="checkbox" required><span>Quiero recibir mi acceso y contenidos útiles de Cuídate Bien. Puedo darme de baja cuando quiera.</span></label>
      <button id="submit" type="submit" disabled><span class="button-label">Descubrir mi zona</span><span class="button-arrow">→</span></button>
      <p class="privacy-note">⌁ Tus datos se usan únicamente para enviarte el acceso y contenidos relacionados.</p>
    </form>
  </aside>
</section></main>`;

const toolPage = `
<main class="tool-shell">
  <header class="tool-header">
    <a class="brand" href="/lead-magnet"><span class="brand-mark">✦</span><span>Cuídate Bien</span></a>
    <nav class="tool-tabs" aria-label="Secciones del diagnóstico" role="tablist">
      <button class="tab is-active" id="scanner-tab" role="tab" aria-selected="true" aria-controls="scanner-panel" data-tab="scanner">Descubrí tu zona</button>
      <button class="tab" id="insights-tab" role="tab" aria-selected="false" aria-controls="insights-panel" data-tab="insights">Claves para convivir mejor</button>
    </nav>
  </header>
  <section class="tab-panel" id="scanner-panel" role="tabpanel" aria-labelledby="scanner-tab">
    <div class="scanner-intro" id="scanner-intro">
      <p class="eyebrow">ESCÁNER · 2 MINUTOS</p>
      <h1>¿Cuál es tu <em>Zona de Bienestar</em>?</h1>
      <p>Respondé tres preguntas y descubrí qué tan bien acompaña tu espacio la convivencia con tu cachorro, más el ajuste que puede ayudarte ahora.</p>
      <button class="primary-action" id="start-scan">Empezar el escáner <span>→</span></button>
      <p class="small-note">Sin respuestas correctas ni casas perfectas. Solo una mirada clara sobre lo que sucede hoy.</p>
    </div>
    <div class="scanner-card is-hidden" id="scanner-card" aria-live="polite"></div>
    <div class="analysis-card is-hidden" id="analysis-card" aria-live="assertive">
      <div class="analysis-orbit" aria-hidden="true"><span></span><span></span><span></span></div>
      <p class="eyebrow">ANALIZANDO TUS RESPUESTAS</p><h2>Estamos identificando tu zona...</h2>
      <p>Cruzamos espacio, rutina y el ajuste que hoy necesita más atención.</p>
    </div>
    <div class="result-wrap is-hidden" id="result-wrap" aria-live="polite"></div>
  </section>
  <section class="tab-panel is-hidden" id="insights-panel" role="tabpanel" aria-labelledby="insights-tab">
    <div class="insights-heading"><p class="eyebrow">IDEAS PARA APLICAR HOY</p><h1>Claves para convivir mejor</h1><p>Entendé qué hay detrás de los roces cotidianos y cómo convertir tu espacio en un aliado.</p></div>
    <div class="post-nav" aria-label="Elegir artículo"></div>
    <article class="post-card" id="post-card" aria-live="polite"></article>
  </section>
</main>`;

if (path === "/") window.location.replace("/lead-magnet");
else if (path === "/lead-magnet") { app.innerHTML = capturePage; setupForm(); }
else if (path === "/herramienta") { app.innerHTML = toolPage; setupTool(); }
else app.innerHTML = `<main class="placeholder-shell"><section class="placeholder-card"><p class="eyebrow">404</p><h1>Esta página no existe</h1><a class="text-link" href="/lead-magnet">Ir al diagnóstico</a></section></main>`;

function setupForm() {
  const form = document.querySelector("#lead-form");
  const consent = document.querySelector("#consent");
  const submit = document.querySelector("#submit");
  const nameInput = document.querySelector("#name");
  const emailInput = document.querySelector("#email");
  consent.addEventListener("change", () => { submit.disabled = !consent.checked; });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const validName = name.length >= 2;
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    fieldState(nameInput, "name-error", validName, "Escribí tu nombre para continuar.");
    fieldState(emailInput, "email-error", validEmail, "Ingresá un email válido.");
    if (!validName || !validEmail || !consent.checked) return;
    submit.disabled = true; submit.classList.add("is-loading");
    submit.querySelector(".button-label").textContent = "Enviando...";
    try {
      await fetch("/api/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email }) });
    } catch (error) { console.warn("No se pudo confirmar el registro antes de redirigir.", error); }
    finally { window.location.assign("/herramienta"); }
  });
}

function fieldState(input, errorId, valid, message) {
  input.setAttribute("aria-invalid", String(!valid));
  document.querySelector(`#${errorId}`).textContent = valid ? "" : message;
}

function setupTool() {
  const productUrl = import.meta.env.VITE_PRODUCT_URL || "/zca";
  const state = { step: 0, answers: [], testimonial: 0, post: 0 };
  const scannerIntro = document.querySelector("#scanner-intro");
  const scannerCard = document.querySelector("#scanner-card");
  const analysisCard = document.querySelector("#analysis-card");
  const resultWrap = document.querySelector("#result-wrap");

  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.dataset.tab;
      document.querySelectorAll("[data-tab]").forEach((tab) => {
        const active = tab === button;
        tab.classList.toggle("is-active", active);
        tab.setAttribute("aria-selected", String(active));
      });
      document.querySelector("#scanner-panel").classList.toggle("is-hidden", target !== "scanner");
      document.querySelector("#insights-panel").classList.toggle("is-hidden", target !== "insights");
    });
  });

  document.querySelector("#start-scan").addEventListener("click", () => {
    state.step = 0;
    state.answers = [];
    scannerIntro.classList.add("is-hidden");
    scannerCard.classList.remove("is-hidden");
    renderQuestion();
  });

  function renderQuestion() {
    const question = questions[state.step];
    scannerCard.innerHTML = `
      <div class="progress-meta"><span>Pregunta ${state.step + 1} de ${questions.length}</span><span>${Math.round((state.step / questions.length) * 100)}%</span></div>
      <div class="progress-track"><span style="width:${(state.step / questions.length) * 100}%"></span></div>
      <div class="question-copy question-enter"><p class="eyebrow">${question.eyebrow}</p><h2>${question.title}</h2><p>${question.hint}</p></div>
      <div class="answer-grid">${question.options.map((option, index) => `
        <button class="answer-option" data-answer="${index}"><span class="answer-radio"></span><span><strong>${option.label}</strong><small>${option.detail}</small></span></button>
      `).join("")}</div>
      ${state.step > 0 ? '<button class="back-action" id="previous-question">← Volver a la pregunta anterior</button>' : ""}`;
    scannerCard.querySelectorAll("[data-answer]").forEach((button) => {
      button.addEventListener("click", () => selectAnswer(Number(button.dataset.answer)));
    });
    scannerCard.querySelector("#previous-question")?.addEventListener("click", () => {
      state.step -= 1;
      state.answers.pop();
      renderQuestion();
    });
  }

  function selectAnswer(optionIndex) {
    state.answers[state.step] = optionIndex;
    scannerCard.querySelectorAll(".answer-option").forEach((button, index) => button.classList.toggle("is-selected", index === optionIndex));
    window.setTimeout(() => {
      if (state.step < questions.length - 1) {
        state.step += 1;
        renderQuestion();
      } else {
        scannerCard.classList.add("is-hidden");
        analysisCard.classList.remove("is-hidden");
        window.setTimeout(showResult, 2000);
      }
    }, 280);
  }

  function showResult() {
    const result = calculateResult(state.answers);
    analysisCard.classList.add("is-hidden");
    resultWrap.classList.remove("is-hidden");
    resultWrap.innerHTML = `
      <section class="result-card result-enter">
        <p class="eyebrow">TU RESULTADO</p><div class="result-badge">${result.icon}</div>
        <p class="result-label">Tu zona actual es</p><h2>${result.name}</h2><p class="result-lead">${result.summary}</p>
        <div class="result-detail"><h3>El ajuste que más puede ayudarte</h3><p>${result.improvement}</p><p>${result.action}</p></div>
        <div class="result-cta"><p>Tu resultado es un punto de partida. Podés convertirlo en un plan claro para tus espacios y rutinas.</p><a class="primary-action" href="${escapeAttribute(productUrl)}">Conocer el Sistema de Zonificación Creativa con Mascota™ <span>→</span></a></div>
        <div class="share-row"><p>Compartí este diagnóstico</p><div><a class="share-button whatsapp" id="share-whatsapp" target="_blank" rel="noopener">WhatsApp</a><button class="share-button" id="copy-link">Copiar enlace</button></div><span class="copy-status" id="copy-status" aria-live="polite"></span></div>
        <button class="back-action restart" id="restart-scan">↻ Volver a hacer el escáner</button>
      </section>
      ${testimonialSection()}`;
    setupResultActions(result);
    setupCarousel(state);
    resultWrap.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  }

  function setupResultActions(result) {
    const shareText = `Mi resultado en ¿Cuál es tu Zona de Bienestar?™ fue: ${result.name}. Descubrí tu zona acá:`;
    const currentUrl = window.location.href;
    document.querySelector("#share-whatsapp").href = `https://wa.me/?text=${encodeURIComponent(`${shareText} ${currentUrl}`)}`;
    document.querySelector("#copy-link").addEventListener("click", async () => {
      const status = document.querySelector("#copy-status");
      try {
        await navigator.clipboard.writeText(currentUrl);
        status.textContent = "Enlace copiado";
      } catch {
        const helper = document.createElement("textarea");
        helper.value = currentUrl;
        document.body.appendChild(helper);
        helper.select();
        document.execCommand("copy");
        helper.remove();
        status.textContent = "Enlace copiado";
      }
    });
    document.querySelector("#restart-scan").addEventListener("click", () => {
      state.step = 0;
      state.answers = [];
      resultWrap.classList.add("is-hidden");
      resultWrap.innerHTML = "";
      scannerIntro.classList.remove("is-hidden");
      scannerIntro.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "center" });
    });
  }

  renderPostNavigation(state);
  renderPost(state.post, state, productUrl);
}

function calculateResult(answerIndexes) {
  const selected = answerIndexes.map((answer, index) => questions[index].options[answer]);
  const total = selected.reduce((sum, option) => sum + option.score, 0);
  const weakestScore = Math.min(...selected.map((option) => option.score));
  const weakestIndex = selected.findIndex((option) => option.score === weakestScore);
  const improvements = [
    {
      detail: "Hoy varias actividades compiten en los mismos lugares. Eso vuelve menos previsible el descanso, el juego y tu propio tiempo de concentración.",
      action: "Empezá con un solo límite visible: definí un rincón de calma con una superficie estable y mantenelo libre de juego intenso durante siete días.",
    },
    {
      detail: "La conexión depende demasiado de cómo venga el día. Esa variación puede aumentar la demanda de atención porque tu cachorro no sabe cuándo llegará el próximo momento juntos.",
      action: "Elegí dos momentos breves que puedas sostener incluso en un día ocupado y asociá cada uno con una actividad sencilla y reconocible.",
    },
    {
      detail: "El punto con más fricción todavía no tiene una función clara. Cuando el descanso, el paso y la actividad se superponen, ambos necesitan estar corrigiendo sobre la marcha.",
      action: "Observá durante dos días cuándo aparece el roce y mové solo un elemento: una manta, una cesta o una barrera visual que vuelva más clara la función del lugar.",
    },
  ];
  const zones = total <= 2
    ? { icon: "△", name: "Zona de Alerta Compartida", summary: "Tu casa está intentando resolver demasiadas necesidades al mismo tiempo. No significa que esté mal: hoy necesita referencias más claras para que ambos puedan bajar la guardia." }
    : total <= 4
      ? { icon: "◇", name: "Zona en Transición", summary: "Ya existen buenas bases, pero todavía dependen de la improvisación. Un ajuste concreto puede convertir esfuerzos sueltos en una convivencia más previsible." }
      : { icon: "✦", name: "Zona de Bienestar Sostenible", summary: "Tu espacio y tu rutina ya ofrecen señales útiles para ambos. El siguiente paso es proteger esa base para que también funcione en los días más exigentes." };
  return { ...zones, improvement: improvements[weakestIndex].detail, action: improvements[weakestIndex].action };
}

function renderPostNavigation(state) {
  const nav = document.querySelector(".post-nav");
  nav.innerHTML = posts.map((post, index) => `<button class="post-pill ${index === state.post ? "is-active" : ""}" data-post="${index}"><span>${String(index + 1).padStart(2, "0")}</span>${post.label}</button>`).join("");
  nav.querySelectorAll("[data-post]").forEach((button) => button.addEventListener("click", () => {
    state.post = Number(button.dataset.post);
    renderPostNavigation(state);
    renderPost(state.post, state, import.meta.env.VITE_PRODUCT_URL || "/zca");
  }));
}

function renderPost(index, state, productUrl) {
  const post = posts[index];
  const card = document.querySelector("#post-card");
  card.innerHTML = `<div class="post-icon" aria-hidden="true">${post.icon}</div><p class="eyebrow">${post.label}</p><h2>${post.title}</h2>
    <div class="post-section">${post.why.map((paragraph) => `<p>${paragraph}</p>`).join("")}</div>
    <div class="post-section outcome">${post.what.map((paragraph) => `<p>${paragraph}</p>`).join("")}</div>
    <div class="post-section solution"><p>${post.how}</p><a class="primary-action" href="${escapeAttribute(productUrl)}">Ver el sistema completo <span>→</span></a></div>
    <div class="post-pagination"><button id="previous-post" ${index === 0 ? "disabled" : ""}>← Anterior</button><span>${index + 1} / ${posts.length}</span><button id="next-post" ${index === posts.length - 1 ? "disabled" : ""}>Siguiente →</button></div>`;
  card.querySelector("#previous-post").addEventListener("click", () => changePost(index - 1));
  card.querySelector("#next-post").addEventListener("click", () => changePost(index + 1));
  function changePost(nextIndex) {
    if (nextIndex < 0 || nextIndex >= posts.length) return;
    state.post = nextIndex;
    renderPostNavigation(state);
    renderPost(nextIndex, state, productUrl);
    card.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  }
}

function testimonialSection() {
  return `<section class="testimonials" aria-labelledby="testimonial-title"><p class="eyebrow">EXPERIENCIAS REALES</p><h2 id="testimonial-title">Una mirada clara cambia la convivencia</h2>
    <div class="testimonial-carousel"><button class="carousel-arrow" id="testimonial-prev" aria-label="Testimonio anterior">←</button><div class="testimonial-viewport" id="testimonial-viewport"></div><button class="carousel-arrow" id="testimonial-next" aria-label="Testimonio siguiente">→</button></div>
    <div class="carousel-dots" id="testimonial-dots" aria-label="Elegir testimonio"></div></section>`;
}

function setupCarousel(state) {
  const viewport = document.querySelector("#testimonial-viewport");
  const dots = document.querySelector("#testimonial-dots");
  let touchStart = null;
  const draw = () => {
    const item = testimonials[state.testimonial];
    viewport.innerHTML = `<figure class="testimonial-card"><div class="avatar ${item.tone}">${item.initials}</div><blockquote>“${item.text}”</blockquote><figcaption>${item.name}</figcaption></figure>`;
    dots.innerHTML = testimonials.map((_, index) => `<button class="carousel-dot ${index === state.testimonial ? "is-active" : ""}" data-testimonial="${index}" aria-label="Ver testimonio ${index + 1}"></button>`).join("");
    dots.querySelectorAll("[data-testimonial]").forEach((dot) => dot.addEventListener("click", () => { state.testimonial = Number(dot.dataset.testimonial); draw(); }));
  };
  const move = (amount) => { state.testimonial = (state.testimonial + amount + testimonials.length) % testimonials.length; draw(); };
  document.querySelector("#testimonial-prev").addEventListener("click", () => move(-1));
  document.querySelector("#testimonial-next").addEventListener("click", () => move(1));
  viewport.addEventListener("touchstart", (event) => { touchStart = event.changedTouches[0].clientX; }, { passive: true });
  viewport.addEventListener("touchend", (event) => {
    if (touchStart === null) return;
    const delta = event.changedTouches[0].clientX - touchStart;
    if (Math.abs(delta) > 45) move(delta < 0 ? 1 : -1);
    touchStart = null;
  }, { passive: true });
  draw();
}

function escapeAttribute(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

