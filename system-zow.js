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

document.querySelectorAll(".site-section, .product-card, .plan-grid article, .operation-grid article, .trust-grid article, .faq-shell, .lead-form").forEach((item) => {
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
