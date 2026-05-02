const publicApiBase = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
  ? "http://localhost:4174/api"
  : "/api";

const form = document.querySelector("#publicConsultForm");
const message = document.querySelector("#publicConsultMessage");
const result = document.querySelector("#publicConsultResult");
const codeInput = document.querySelector("#lookupCode");

const params = new URLSearchParams(window.location.search);
const codeFromUrl = params.get("codigo") || params.get("code") || "";
const companySlug = decodeURIComponent(window.location.pathname.replace(/^\/consulta\/?/, "").split("/")[0] || "");
if (codeFromUrl) codeInput.value = codeFromUrl;

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  message.textContent = "Consultando...";
  message.className = "public-consult-message";
  result.hidden = true;
  result.innerHTML = "";

  const payload = {
    code: form.code.value.trim(),
    ci: form.ci.value.trim(),
    companySlug
  };

  try {
    const response = await fetch(`${publicApiBase}/public/documents/lookup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "No se pudo consultar el documento");
    renderResult(data.document);
    message.textContent = "Documento encontrado.";
    message.classList.add("is-success");
  } catch (error) {
    message.textContent = error.message;
    message.classList.add("is-error");
  }
});

function renderResult(documentItem) {
  result.hidden = false;
  result.innerHTML = `
    <div class="public-result-status">${escapeHtml(documentItem.status)}</div>
    <dl>
      <div><dt>Empresa</dt><dd>${escapeHtml(documentItem.companyName)}</dd></div>
      <div><dt>Codigo</dt><dd>${escapeHtml(documentItem.code)}</dd></div>
      <div><dt>Solicitante</dt><dd>${escapeHtml(documentItem.applicantName || "Registrado")}</dd></div>
      <div><dt>Referencia</dt><dd>${escapeHtml(documentItem.reference || documentItem.subject || "Sin referencia")}</dd></div>
      <div><dt>Area actual</dt><dd>${escapeHtml(documentItem.currentArea)}</dd></div>
      <div><dt>Recepcion</dt><dd>${formatPublicDate(documentItem.receivedAt)}</dd></div>
      <div><dt>Ultima actualizacion</dt><dd>${formatPublicDate(documentItem.updatedAt)}</dd></div>
    </dl>
  `;
}

function formatPublicDate(value) {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-BO", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
