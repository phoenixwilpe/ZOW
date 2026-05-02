const siteApiBase = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
  ? "http://localhost:4174/api"
  : "/api";

const leadForm = document.querySelector("#leadForm");
const leadMessage = document.querySelector("#leadMessage");

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
