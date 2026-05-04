const siteApiBase = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
  ? "http://localhost:4174/api"
  : "/api";

const leadForm = document.querySelector("#leadForm");
const leadMessage = document.querySelector("#leadMessage");
const planSelect = leadForm?.querySelector('select[name="plan"]');
const leadMessageField = leadForm?.querySelector('textarea[name="message"]');
const leadNameField = leadForm?.querySelector('input[name="name"]');
const siteHeader = document.querySelector(".site-header");
const scrollProgress = document.querySelector(".site-scroll-progress");
const navLinks = [...document.querySelectorAll("[data-nav-link]")];
const planLabels = {
  mensual: "Mensual",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual"
};
const navSections = navLinks
  .map((link) => ({ link, target: document.querySelector(link.getAttribute("href")) }))
  .filter((item) => item.target);

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    const target = document.querySelector(link.getAttribute("href"));
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

const revealObserver = "IntersectionObserver" in window
  ? new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.14 }
    )
  : null;

document.querySelectorAll(".site-section, .product-card, .plan-grid article, .operation-grid article, .trust-grid article, .faq-shell, .implementation-flow article, .launch-cta, .lead-form").forEach((item) => {
  item.classList.add("reveal-item");
  revealObserver?.observe(item);
});

document.querySelectorAll("[data-plan-request]").forEach((button) => {
  button.addEventListener("click", (event) => {
    const plan = button.dataset.plan;
    const contactSection = document.querySelector("#contacto");
    event.preventDefault();
    if (planSelect && plan) planSelect.value = plan;
    if (leadMessageField && !leadMessageField.value.trim()) {
      leadMessageField.value = `Me interesa el plan ${planLabels[plan] || plan} para mi empresa.`;
    }
    contactSection?.scrollIntoView({ behavior: "smooth", block: "start" });
    leadForm?.classList.add("is-highlighted");
    window.setTimeout(() => leadForm?.classList.remove("is-highlighted"), 1400);
    window.setTimeout(() => leadNameField?.focus({ preventScroll: true }), 520);
  });
});

function updateNavigationState() {
  const maxScroll = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
  const progress = Math.min(Math.max(window.scrollY / maxScroll, 0), 1);
  scrollProgress?.style.setProperty("--scroll-progress", progress);
  siteHeader?.classList.toggle("is-scrolled", window.scrollY > 16);

  const marker = window.scrollY + Math.round(window.innerHeight * 0.35);
  let activeItem = navSections[0];
  navSections.forEach((item) => {
    if (item.target.offsetTop <= marker) activeItem = item;
  });
  navLinks.forEach((link) => link.classList.toggle("is-active", link === activeItem?.link));
}

updateNavigationState();
window.addEventListener("scroll", updateNavigationState, { passive: true });

navLinks.forEach((link) => {
  link.addEventListener("pointermove", (event) => {
    const rect = link.getBoundingClientRect();
    link.style.setProperty("--mx", `${event.clientX - rect.left}px`);
    link.style.setProperty("--my", `${event.clientY - rect.top}px`);
  });
});

document.querySelector(".holo-panel")?.addEventListener("pointermove", (event) => {
  const panel = event.currentTarget;
  const rect = panel.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width - 0.5) * 10;
  const y = ((event.clientY - rect.top) / rect.height - 0.5) * -10;
  panel.style.setProperty("--tilt-x", `${y}deg`);
  panel.style.setProperty("--tilt-y", `${x}deg`);
});

document.querySelector(".holo-panel")?.addEventListener("pointerleave", (event) => {
  event.currentTarget.style.removeProperty("--tilt-x");
  event.currentTarget.style.removeProperty("--tilt-y");
});

const heroCanvas = document.querySelector("#zowHeroCanvas");
const heroContext = heroCanvas?.getContext("2d");
let heroNodes = [];
let heroAnimation = 0;

function resizeHeroCanvas() {
  if (!heroCanvas || !heroContext) return;
  const rect = heroCanvas.getBoundingClientRect();
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  heroCanvas.width = Math.max(1, Math.floor(rect.width * pixelRatio));
  heroCanvas.height = Math.max(1, Math.floor(rect.height * pixelRatio));
  heroContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  heroNodes = Array.from({ length: 46 }, (_, index) => ({
    angle: (Math.PI * 2 * index) / 46,
    layer: index % 4,
    speed: 0.002 + (index % 7) * 0.00028,
    pulse: Math.random() * Math.PI * 2
  }));
}

function drawHeroCanvas() {
  if (!heroCanvas || !heroContext) return;
  const rect = heroCanvas.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;
  const cx = width * 0.5;
  const cy = height * 0.5;
  heroContext.clearRect(0, 0, width, height);
  heroContext.save();
  heroContext.translate(cx, cy);

  const time = performance.now();
  const rings = [0.25, 0.39, 0.53, 0.67].map((scale) => Math.min(width, height) * scale);
  rings.forEach((radius, index) => {
    heroContext.beginPath();
    heroContext.ellipse(0, 0, radius * 0.92, radius * 0.36, (time * 0.00022) + index * 0.52, 0, Math.PI * 2);
    heroContext.strokeStyle = `rgba(${index % 2 ? "0,184,217" : "37,99,235"}, ${0.11 + index * 0.03})`;
    heroContext.lineWidth = 1;
    heroContext.stroke();
  });

  const projected = heroNodes.map((node) => {
    const radius = rings[node.layer];
    const angle = node.angle + time * node.speed;
    const depth = Math.sin(angle + node.layer) * 0.46 + 0.54;
    return {
      x: Math.cos(angle) * radius * 0.92,
      y: Math.sin(angle) * radius * 0.34 + (depth - 0.5) * 42,
      size: 2.2 + depth * 3.8 + Math.sin(time * 0.003 + node.pulse) * 0.7,
      alpha: 0.26 + depth * 0.56
    };
  });

  projected.forEach((point, index) => {
    for (let other = index + 1; other < projected.length; other += 1) {
      const target = projected[other];
      const distance = Math.hypot(point.x - target.x, point.y - target.y);
      if (distance > 116) continue;
      heroContext.beginPath();
      heroContext.moveTo(point.x, point.y);
      heroContext.lineTo(target.x, target.y);
      heroContext.strokeStyle = `rgba(0,184,217,${(1 - distance / 116) * 0.18})`;
      heroContext.lineWidth = 1;
      heroContext.stroke();
    }
  });

  projected.forEach((point) => {
    const gradient = heroContext.createRadialGradient(point.x, point.y, 0, point.x, point.y, point.size * 5);
    gradient.addColorStop(0, `rgba(255,255,255,${point.alpha})`);
    gradient.addColorStop(0.28, `rgba(0,184,217,${point.alpha * 0.82})`);
    gradient.addColorStop(1, "rgba(37,99,235,0)");
    heroContext.fillStyle = gradient;
    heroContext.beginPath();
    heroContext.arc(point.x, point.y, point.size * 5, 0, Math.PI * 2);
    heroContext.fill();
    heroContext.fillStyle = `rgba(255,255,255,${Math.min(point.alpha + 0.15, 0.95)})`;
    heroContext.beginPath();
    heroContext.arc(point.x, point.y, Math.max(point.size * 0.56, 1.4), 0, Math.PI * 2);
    heroContext.fill();
  });

  heroContext.restore();
  heroAnimation = requestAnimationFrame(drawHeroCanvas);
}

if (heroCanvas && heroContext) {
  resizeHeroCanvas();
  drawHeroCanvas();
  window.addEventListener("resize", resizeHeroCanvas, { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) cancelAnimationFrame(heroAnimation);
    else drawHeroCanvas();
  });
}

leadForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  leadMessage.textContent = "Enviando solicitud...";
  const formData = new FormData(leadForm);
  const payload = Object.fromEntries(formData.entries());

  try {
    const response = await fetch(`${siteApiBase}/leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "No se pudo registrar la solicitud");
    leadForm.reset();
    leadMessage.textContent = "Solicitud registrada. Te contactaremos pronto.";
    leadMessage.classList.add("is-success");
  } catch (error) {
    leadMessage.textContent = error.message;
    leadMessage.classList.remove("is-success");
  }
});
