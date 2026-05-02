const STORAGE_KEY = "zowCorrespondencia.documents";
const USERS_KEY = "zowCorrespondencia.users";
const UNITS_KEY = "zowCorrespondencia.units";
const SESSION_KEY = "zowCorrespondencia.session";
const TOKEN_KEY = "zowCorrespondencia.token";
const API_BASE_URL = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
  ? "http://localhost:4174/api"
  : "/api";

const defaultUnits = [
  { id: "unit-admin", name: "Administracion del Sistema", code: "ADM" },
  { id: "unit-window", name: "Recepcion", code: "VU", level: "principal", parentUnitId: "" },
  { id: "unit-legal", name: "Asesoria Legal", code: "AL", level: "secundaria", parentUnitId: "" },
  { id: "unit-finance", name: "Administracion y Finanzas", code: "AF", level: "secundaria", parentUnitId: "" },
  { id: "unit-purchases", name: "Compras", code: "COM", level: "subarea", parentUnitId: "unit-finance" },
  { id: "unit-tech", name: "Direccion de Tecnologia e Innovacion", code: "DTI", level: "secundaria", parentUnitId: "" }
];

const defaultUsers = [
  {
    id: "user-system-owner",
    name: "Encargado de Sistema",
    username: "sistema@zow.com",
    role: "admin",
    unitId: "unit-admin",
    position: "Encargado de sistema",
    active: true,
    protected: true
  },
  {
    id: "user-admin",
    name: "Administrador General",
    username: "admin@zow.com",
    role: "admin",
    unitId: "unit-admin",
    position: "Administrador del sistema",
    active: true
  },
  {
    id: "user-window",
    name: "Recepcion Principal ZOW",
    username: "recepcion@zow.com",
    role: "recepcion_principal",
    unitId: "unit-window",
    position: "Recepcion documental principal",
    active: true
  },
  {
    id: "user-reception-legal",
    name: "Recepcion Legal",
    username: "recepcion.legal@zow.com",
    role: "recepcion_secundaria",
    unitId: "unit-legal",
    position: "Recepcion interna de area",
    active: true
  },
  {
    id: "user-legal",
    name: "Responsable Legal",
    username: "legal@zow.com",
    role: "funcionario",
    unitId: "unit-legal",
    position: "Encargado de area",
    active: true
  },
  {
    id: "user-secretary-legal",
    name: "Secretario Legal",
    username: "secretario@zow.com",
    role: "supervisor",
    unitId: "unit-legal",
    position: "Jefe de area secundaria",
    active: true
  },
  {
    id: "user-finance",
    name: "Responsable Finanzas",
    username: "finanzas@zow.com",
    role: "funcionario",
    unitId: "unit-finance",
    position: "Encargado de area",
    active: true
  },
  {
    id: "user-purchases",
    name: "Responsable Compras",
    username: "compras@zow.com",
    role: "funcionario",
    unitId: "unit-purchases",
    position: "Encargado de area",
    active: true
  },
  {
    id: "user-tech",
    name: "Responsable Tecnologia",
    username: "tecnologia@zow.com",
    role: "funcionario",
    unitId: "unit-tech",
    position: "Encargado de area",
    active: true
  },
  {
    id: "user-director-tech",
    name: "Director Tecnologia",
    username: "director@zow.com",
    role: "supervisor",
    unitId: "unit-tech",
    position: "Jefe de sub area",
    active: true
  },
  {
    id: "user-supervisor",
    name: "Supervisor Institucional",
    username: "supervisor@zow.com",
    role: "supervisor",
    unitId: "unit-admin",
    position: "Supervisor",
    active: true
  }
];

const defaultDocuments = [
  {
    id: "doc-1",
    direction: "Entrante",
    year: "2026",
    type: "Oficio",
    code: "ENT-2026-0001",
    internalNumber: "GADSC-DMO-018/2026",
    reference: "Certificacion presupuestaria",
    subject: "Solicitud de certificacion presupuestaria para adquisicion",
    contact: "Direccion Municipal de Obras",
    sender: "Direccion Municipal de Obras",
    receiver: "Administracion y Finanzas",
    sourceUnitId: "external",
    targetUnitId: "unit-finance",
    currentUnitId: "unit-finance",
    createdByUnitId: "unit-window",
    receivedByReception: true,
    area: "Administracion y Finanzas",
    owner: "Mariela Rojas",
    position: "Jefa de Unidad",
    priority: "Alta",
    status: "Derivado",
    dueDate: "2026-04-30",
    fileRef: "oficio-001.pdf",
    attachments: "Informe tecnico y proforma",
    copies: "Archivo Central",
    via: "Secretaria General",
    isResponse: false,
    isExternal: true,
    hasDigitalFile: false,
    physicalReceived: false,
    createdAt: "2026-04-24T09:35:00",
    history: [
      {
        date: "2026-04-24T09:35:00",
        status: "Recibido",
        owner: "Recepcion Principal",
        comment: "Documento registrado con respaldo digital."
      },
      {
        date: "2026-04-24T10:05:00",
        status: "Derivado",
        owner: "Administracion y Finanzas",
        comment: "Se deriva para revision presupuestaria."
      }
    ]
  },
  {
    id: "doc-2",
    direction: "Entrante",
    year: "2026",
    type: "Solicitud",
    code: "ENT-2026-0002",
    internalNumber: "UT-044/2026",
    reference: "Informe de avance contractual",
    subject: "Pedido de informe sobre avance de contrato de servicios",
    contact: "Unidad de Transparencia",
    sender: "Unidad de Transparencia",
    receiver: "Asesoria Legal",
    sourceUnitId: "external",
    targetUnitId: "unit-legal",
    currentUnitId: "unit-legal",
    createdByUnitId: "unit-window",
    receivedByReception: true,
    area: "Asesoria Legal",
    owner: "Daniel Vargas",
    position: "Asesor legal",
    priority: "Normal",
    status: "En revision",
    dueDate: "2026-05-03",
    fileRef: "solicitud-transparencia.pdf",
    attachments: "Sin anexos",
    copies: "",
    via: "",
    isResponse: false,
    isExternal: false,
    hasDigitalFile: true,
    physicalReceived: true,
    createdAt: "2026-04-25T11:12:00",
    history: [
      {
        date: "2026-04-25T11:12:00",
        status: "Recibido",
        owner: "Recepcion Principal",
        comment: "Ingreso por correspondencia externa."
      },
      {
        date: "2026-04-25T12:20:00",
        status: "En revision",
        owner: "Asesoria Legal",
        comment: "Se revisa alcance de la respuesta."
      }
    ]
  },
  {
    id: "doc-3",
    direction: "Saliente",
    year: "2026",
    type: "Carta",
    code: "SAL-2026-0001",
    internalNumber: "COMP-009/2026",
    reference: "Respuesta a cotizacion",
    subject: "Respuesta a solicitud de cotizacion institucional",
    contact: "Proveedor Andina SRL",
    sender: "Compras",
    receiver: "Proveedor Andina SRL",
    sourceUnitId: "unit-purchases",
    targetUnitId: "external",
    currentUnitId: "unit-purchases",
    createdByUnitId: "unit-purchases",
    receivedByReception: true,
    area: "Compras",
    owner: "Luis Mercado",
    position: "Responsable de compras",
    priority: "Normal",
    status: "Atendido",
    dueDate: "2026-04-26",
    fileRef: "respuesta-cotizacion.pdf",
    attachments: "Cuadro comparativo",
    copies: "Contabilidad",
    via: "Direccion Administrativa",
    isResponse: true,
    isExternal: true,
    hasDigitalFile: true,
    physicalReceived: true,
    createdAt: "2026-04-23T15:00:00",
    history: [
      {
        date: "2026-04-23T15:00:00",
        status: "Recibido",
        owner: "Compras",
        comment: "Documento de salida preparado."
      },
      {
        date: "2026-04-24T08:45:00",
        status: "Atendido",
        owner: "Luis Mercado",
        comment: "Enviado por correo institucional con acuse."
      }
    ]
  },
  {
    id: "doc-4",
    direction: "Entrante",
    year: "2026",
    type: "Factura",
    code: "ENT-2026-0003",
    internalNumber: "FAC-4481",
    reference: "Mantenimiento de equipos",
    subject: "Factura por mantenimiento preventivo de equipos",
    contact: "TecnoServicios Bolivia",
    sender: "TecnoServicios Bolivia",
    receiver: "Contabilidad",
    sourceUnitId: "external",
    targetUnitId: "unit-finance",
    currentUnitId: "unit-finance",
    createdByUnitId: "unit-window",
    receivedByReception: true,
    area: "Contabilidad",
    owner: "Carla Molina",
    position: "Contadora",
    priority: "Urgente",
    status: "Archivado",
    dueDate: "2026-04-25",
    fileRef: "factura-4481.pdf",
    attachments: "Orden de servicio",
    copies: "",
    via: "",
    isResponse: false,
    isExternal: true,
    hasDigitalFile: true,
    physicalReceived: true,
    createdAt: "2026-04-22T14:15:00",
    history: [
      {
        date: "2026-04-22T14:15:00",
        status: "Recibido",
        owner: "Recepcion Principal",
        comment: "Factura recibida con orden de servicio."
      },
      {
        date: "2026-04-25T16:10:00",
        status: "Archivado",
        owner: "Archivo Central",
        comment: "Proceso concluido y respaldado."
      }
    ]
  },
  {
    id: "doc-5",
    direction: "Saliente",
    year: "2026",
    type: "Memo",
    code: "SAL-2026-0002",
    internalNumber: "SDGI-DTI-027/2026",
    reference: "Actualizacion de inventario de equipos",
    subject: "Comunicacion interna pendiente de recepcion fisica por el area de Sistemas",
    contact: "Unidad de Sistemas",
    sender: "Direccion de Tecnologia e Innovacion",
    receiver: "Unidad de Sistemas",
    sourceUnitId: "unit-tech",
    targetUnitId: "external",
    currentUnitId: "unit-tech",
    createdByUnitId: "unit-tech",
    receivedByReception: false,
    area: "Unidad de Sistemas",
    owner: "Roxana Pena",
    position: "Profesional de soporte",
    priority: "Normal",
    status: "Reservado",
    dueDate: "2026-05-02",
    fileRef: "Pendiente de adjunto",
    attachments: "Planilla de inventario",
    copies: "Archivo Central",
    via: "",
    isResponse: false,
    isExternal: false,
    hasDigitalFile: false,
    physicalReceived: false,
    createdAt: "2026-04-26T10:20:00",
    history: [
      {
        date: "2026-04-26T10:20:00",
        status: "Reservado",
        owner: "Direccion de Tecnologia e Innovacion",
        comment: "Comunicacion saliente heredada de datos demo. Flujo principal actual centrado en recepcion y derivacion."
      }
    ]
  },
  {
    id: "doc-6",
    direction: "Entrante",
    year: "2026",
    type: "Carta",
    code: "ENT-2026-0004",
    internalNumber: "EXT-118/2026",
    reference: "Solicitud de inspeccion tecnica",
    subject: "Solicitud externa pendiente de derivacion desde Recepcion",
    contact: "Asociacion de Vecinos Central",
    sender: "Asociacion de Vecinos Central",
    receiver: "Por definir",
    sourceUnitId: "external",
    targetUnitId: "",
    currentUnitId: "unit-window",
    createdByUnitId: "unit-window",
    receivedByReception: true,
    area: "Recepcion Principal",
    owner: "Recepcion Principal",
    position: "Recepcion documental",
    priority: "Normal",
    status: "En recepcion",
    dueDate: "2026-05-04",
    fileRef: "Pendiente de adjunto",
    attachments: "Croquis de ubicacion",
    copies: "",
    via: "",
    isResponse: false,
    isExternal: true,
    hasDigitalFile: false,
    physicalReceived: true,
    createdAt: "2026-04-27T08:30:00",
    history: [
      {
        date: "2026-04-27T08:30:00",
        status: "En recepcion",
        owner: "Recepcion Principal",
        comment: "Documento recibido fisicamente. Pendiente definir unidad responsable y derivar."
      }
    ]
  }
];

let units = loadUnits();
let users = loadUsers();
let documents = loadDocuments();
let currentUser = loadSession();
let selectedId = documents[0]?.id ?? null;
let activeView = "dashboard";
let movementCache = {};
let organizationSettings = { companyName: "Empresa sin configurar", taxId: "", phone: "", address: "", logoUrl: "", logoName: "" };
let notifications = [];
let editingUserId = null;
let companies = [];
let saasSystems = [];

const loginScreen = document.querySelector("#loginScreen");
const loginForm = document.querySelector("#loginForm");
const loginError = document.querySelector("#loginError");
const sidebar = document.querySelector("#sidebar");
const appShell = document.querySelector("#appShell");
const listEl = document.querySelector("#documentList");
const searchInput = document.querySelector("#searchInput");
const statusFilter = document.querySelector("#statusFilter");
const resultCount = document.querySelector("#resultCount");
const viewTitle = document.querySelector("#viewTitle");
const viewEyebrow = document.querySelector("#viewEyebrow");
const workflowPanel = document.querySelector("#workflowPanel");
const emptyDetail = document.querySelector("#emptyDetail");
const detailEl = document.querySelector("#documentDetail");
const modal = document.querySelector("#documentModal");
const deriveModal = document.querySelector("#deriveModal");
const uploadModal = document.querySelector("#uploadModal");
const documentForm = document.querySelector("#documentForm");
const movementForm = document.querySelector("#movementForm");
const uploadForm = document.querySelector("#uploadForm");
const notificationBtn = document.querySelector("#notificationBtn");

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const username = normalizeUsernameInput("#loginUsername");
  const password = documentWindowValue("#loginPassword");

  try {
    const session = await apiRequest("/auth/login", {
      method: "POST",
      auth: false,
      body: { username, password }
    });

    currentUser = normalizeApiUser(session.user);
    sessionStorage.setItem(TOKEN_KEY, session.token);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(currentUser));
    await loadRemoteConfig();
  } catch (error) {
    loginError.textContent = error.message || "No se pudo iniciar sesion.";
    return;
  }

  loginForm.reset();
  loginError.textContent = "";
  activeView = getDefaultViewForRole(currentUser.role);
  selectedId = getFilteredDocuments()[0]?.id ?? documents[0]?.id ?? null;
  render();
});

document.querySelector("#logoutBtn").addEventListener("click", () => {
  currentUser = null;
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  render();
});

document.querySelector("#openNewDocument").addEventListener("click", () => {
  if (!canCreateDocuments()) return;
  syncUnitSelects();
  documentForm.reset();
  document.querySelector("#docDueDate").valueAsDate = new Date(Date.now() + 3 * 86400000);
  document.querySelector("#docDirection").value = "Entrante";
  document.querySelector("#docYear").value = String(new Date().getFullYear());
  document.querySelector("#docType").value = "Carpeta documental";
  document.querySelector("#docArea").value = "";
  document.querySelector("#docOwner").value = "Recepcion";
  document.querySelector("#docPosition").value = currentUser?.position ?? "Recepcion documental";
  document.querySelector("#docPriority").value = "Normal";
  document.querySelector("#docReceiver").value = "Por definir";
  document.querySelector("#docSubject").value = "";
  document.querySelector("#docSender").value = "";
  document.querySelector("#docInternalNumber").value = "";
  document.querySelector("#docAttachments").value = "";
  document.querySelector("#docCopies").value = "";
  document.querySelector("#docVia").value = "";
  document.querySelector("#docIsResponse").checked = false;
  document.querySelector("#docIsExternal").checked = true;
  document.querySelector("#docHasDigital").checked = false;
  document.querySelector("#docApplicantName").value = "";
  document.querySelector("#docApplicantCi").value = "";
  document.querySelector("#docApplicantPhone").value = "";
  document.querySelector("#docSheetCount").value = "1";
  configureDocumentForm();
  modal.showModal();
});

document.querySelector("#closeModal").addEventListener("click", () => modal.close());
document.querySelector("#cancelModal").addEventListener("click", () => modal.close());
document.querySelector("#closeDeriveModal").addEventListener("click", () => deriveModal.close());
document.querySelector("#cancelDeriveModal").addEventListener("click", () => deriveModal.close());
document.querySelector("#closeUploadModal").addEventListener("click", () => uploadModal.close());
document.querySelector("#cancelUploadModal").addEventListener("click", () => uploadModal.close());
document.querySelector("#docReference").addEventListener("input", () => {
  if (isReceptionPrincipal()) {
    document.querySelector("#docSubject").value = documentWindowValue("#docReference");
  }
});
document.querySelector("#seedDataBtn").addEventListener("click", () => {
  documents = structuredClone(defaultDocuments);
  users = structuredClone(defaultUsers);
  units = structuredClone(defaultUnits);
  selectedId = documents[0].id;
  persistAll();
  render();
});

notificationBtn.addEventListener("click", () => {
  activeView = "dashboard";
  searchInput.value = "";
  statusFilter.value = "all";
  selectedId = notifications[0]?.id ?? selectedId;
  render();
});

document.querySelectorAll(".nav-item").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach((item) => item.classList.remove("is-active"));
    button.classList.add("is-active");
    activeView = button.dataset.view;
    render();
  });
});

document.querySelectorAll(".nav-group-toggle").forEach((button) => {
  button.addEventListener("click", () => {
    const group = button.closest(".nav-group");
    const isOpen = group.classList.toggle("is-open");
    button.setAttribute("aria-expanded", String(isOpen));
  });
});

searchInput.addEventListener("input", render);
statusFilter.addEventListener("change", render);

document.querySelectorAll("[data-action]").forEach((button) => {
  button.addEventListener("click", async () => {
    const selectedDocument = getSelectedDocument();
    if (!selectedDocument || !canChangeStatus(selectedDocument, button.dataset.action)) return;

    if (sessionStorage.getItem(TOKEN_KEY)) {
      const response = await apiRequest(`/documents/${selectedDocument.id}/status`, {
        method: "PATCH",
        body: { status: button.dataset.action }
      });
      upsertDocument(normalizeApiDocument(response.document));
      movementCache[selectedDocument.id] = null;
      render();
      return;
    }

    updateDocument(selectedDocument.id, {
      status: button.dataset.action,
      history: [
        ...selectedDocument.history,
        createHistoryItem(button.dataset.action, selectedDocument.owner, `Estado actualizado a ${button.dataset.action}.`)
      ]
    });
  });
});

document.querySelectorAll("[data-special-action]").forEach((button) => {
  button.addEventListener("click", async () => {
    const selectedDocument = getSelectedDocument();
    if (!selectedDocument) return;

    if (button.dataset.specialAction === "digital") {
      if (!canAttachDigital(selectedDocument)) return;
      uploadForm.reset();
      document.querySelector("#uploadModalTitle").textContent = selectedDocument.hasDigitalFile
        ? "Adjuntar otro documento escaneado"
        : "Adjuntar documento escaneado";
      uploadModal.showModal();
    }

    if (button.dataset.specialAction === "control") {
      printControlSheet(selectedDocument);
    }

    if (button.dataset.specialAction === "physical") {
      if (!canReceivePhysical()) return;
      if (sessionStorage.getItem(TOKEN_KEY)) {
        const response = await apiRequest(`/documents/${selectedDocument.id}/physical-received`, { method: "PATCH" });
        upsertDocument(normalizeApiDocument(response.document));
        movementCache[selectedDocument.id] = null;
        render();
        return;
      }

      updateDocument(selectedDocument.id, {
        physicalReceived: true,
        status: selectedDocument.status === "Reservado" ? "Recibido" : selectedDocument.status,
        history: [
          ...selectedDocument.history,
          createHistoryItem("Recepcion fisica", selectedDocument.owner, "Se confirmo la recepcion fisica del documento.")
        ]
      });
    }

    if (button.dataset.specialAction === "download") {
      if (!selectedDocument.hasDigitalFile) return;
      await downloadDigitalFile(selectedDocument);
    }
  });
});

document.querySelector("[data-derive-action]").addEventListener("click", () => {
  const selectedDocument = getSelectedDocument();
  if (!selectedDocument || !canDeriveDocument(selectedDocument)) return;
  syncUnitSelects();
  document.querySelector("#movementDateTime").value = formatDateTime(new Date().toISOString());
  deriveModal.showModal();
});

movementForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const selectedDocument = getSelectedDocument();
  if (!selectedDocument || !canDeriveDocument(selectedDocument)) return;

  const movementOwner = getSelectedUnitIds("#movementOwner");
  const movementComment = documentWindowValue("#movementComment").trim();
  const movementInstruction = documentWindowValue("#movementInstruction");
  const movementDays = documentWindowValue("#movementDays");
  const derivedAt = new Date().toISOString();
  const targetUnits = movementOwner.map((unitId) => units.find((unit) => unit.id === unitId)).filter(Boolean);
  const primaryTarget = targetUnits[0];
  const nextOwner = targetUnits.length === 1
    ? users.find((user) => user.unitId === primaryTarget.id && user.active)?.name ?? primaryTarget.name
    : `${targetUnits.length} unidades derivadas`;

  if (!targetUnits.length) {
    alert("Selecciona al menos una unidad destino.");
    return;
  }

  if (sessionStorage.getItem(TOKEN_KEY)) {
    const response = await apiRequest(`/documents/${selectedDocument.id}/derive`, {
      method: "POST",
      body: {
        toUnitIds: movementOwner,
        instructionType: movementInstruction,
        dueDays: Number(movementDays || 0),
        comment: movementComment
      }
    });
    upsertDocument(normalizeApiDocument(response.document));
    movementCache[selectedDocument.id] = null;
    movementForm.reset();
    deriveModal.close();
    render();
    return;
  }

  updateDocument(selectedDocument.id, {
    status: primaryTarget ? "Derivado" : selectedDocument.status,
    area: targetUnits.length === 1 ? primaryTarget.name : `${targetUnits.length} unidades derivadas`,
    currentUnitId: primaryTarget?.id || selectedDocument.currentUnitId,
    targetUnitId: primaryTarget?.id || selectedDocument.targetUnitId,
    owner: nextOwner || selectedDocument.owner,
    history: [
      ...selectedDocument.history,
      createHistoryItem(
        primaryTarget ? "Derivado" : selectedDocument.status,
        nextOwner || selectedDocument.owner,
        `${movementInstruction}. Derivado a ${targetUnits.map((unit) => unit.name).join(", ")} el ${formatDateTime(derivedAt)}. Plazo: ${movementDays || 0} dias. ${
          movementComment || "Movimiento registrado sin comentario adicional."
        }`
      )
    ]
  });

  movementForm.reset();
  deriveModal.close();
});

uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const selectedDocument = getSelectedDocument();
  if (!selectedDocument || !canAttachDigital(selectedDocument)) return;

  const files = [...document.querySelector("#digitalFile").files].slice(0, 1);
  const comment = documentWindowValue("#digitalFileComment").trim();
  const uploadedAt = new Date().toISOString();

  if (!files.length) return;

  if (sessionStorage.getItem(TOKEN_KEY)) {
    const formData = new FormData();
    files.forEach((file) => formData.append("digitalFiles", file));
    formData.append("comment", comment);
    const response = await apiRequest(`/documents/${selectedDocument.id}/digital-file`, {
      method: "POST",
      body: formData
    });
    upsertDocument(normalizeApiDocument(response.document));
    movementCache[selectedDocument.id] = null;
    uploadForm.reset();
    uploadModal.close();
    render();
    return;
  }

  updateDocument(selectedDocument.id, {
    hasDigitalFile: true,
    fileRef: mergeFileNames(selectedDocument.fileRef, files.map((file) => file.name)),
    digitalFileName: mergeFileNames(selectedDocument.digitalFileName, files.map((file) => file.name)),
    digitalFileSize: files.reduce((total, file) => total + file.size, 0),
    digitalAttachedAt: uploadedAt,
    history: [
      ...selectedDocument.history,
      createHistoryItem(
        "Archivo digital",
        currentUser.name,
        `${files.map((file) => file.name).join(", ")} adjuntado el ${formatDateTime(uploadedAt)}. ${comment || "Sin observaciones."}`
      )
    ]
  });

  uploadForm.reset();
  uploadModal.close();
});

documentForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const direction = "Entrante";
  const year = documentWindowValue("#docYear");
  const code = buildNextCode(direction, year);
  const now = new Date().toISOString();
  const applicantName = documentWindowValue("#docApplicantName").trim();
  const applicantCi = documentWindowValue("#docApplicantCi").trim();
  const applicantPhone = documentWindowValue("#docApplicantPhone").trim();
  const sheetCount = Number(documentWindowValue("#docSheetCount") || 0);
  const sender = documentWindowValue("#docSender").trim() || applicantName;
  const receiver = documentWindowValue("#docReceiver").trim();
  const hasDigitalFile = document.querySelector("#docHasDigital").checked;
  const selectedFiles = [...document.querySelector("#docFile").files];
  const hasDigitalAttachment = selectedFiles.length > 0 || hasDigitalFile;
  const selectedTargetUnitId = documentWindowValue("#docArea");
  const targetUnit = units.find((unit) => unit.id === selectedTargetUnitId);
  const receptionUnit = getReceptionUnit();
  const currentUnit = getCurrentUnit();
  const isIncoming = direction === "Entrante";
  const newDocument = {
    id: crypto.randomUUID(),
    direction,
    year,
    type: documentWindowValue("#docType"),
    code,
    internalNumber: documentWindowValue("#docInternalNumber").trim(),
    reference: documentWindowValue("#docReference").trim(),
    subject: documentWindowValue("#docSubject").trim(),
    applicantName,
    applicantCi,
    applicantPhone,
    sheetCount,
    receivedAt: now,
    contact: isIncoming ? sender : receiver,
    sender: isIncoming ? sender : currentUnit?.name ?? sender,
    receiver: isIncoming ? targetUnit?.name ?? receiver : receiver,
    sourceUnitId: isIncoming ? "external" : currentUser.unitId,
    targetUnitId: isIncoming ? selectedTargetUnitId : "external",
    currentUnitId: isIncoming ? receptionUnit?.id : currentUser.unitId,
    createdByUnitId: currentUser.unitId,
    receivedByReception: isIncoming,
    area: isIncoming ? receptionUnit?.name ?? "Recepcion Principal" : currentUnit?.name ?? targetUnit?.name ?? "",
    owner: documentWindowValue("#docOwner").trim(),
    position: documentWindowValue("#docPosition").trim(),
    priority: documentWindowValue("#docPriority"),
    status: "En recepcion",
    dueDate: documentWindowValue("#docDueDate"),
    fileRef: selectedFiles.length ? selectedFiles.map((file) => file.name).join(", ") : "Pendiente de adjunto",
    digitalFileName: selectedFiles.map((file) => file.name).join(", "),
    digitalFileSize: selectedFiles.reduce((total, file) => total + file.size, 0),
    digitalAttachedAt: selectedFiles.length ? now : "",
    attachments: documentWindowValue("#docAttachments").trim() || "Sin anexos",
    copies: documentWindowValue("#docCopies").trim(),
    via: documentWindowValue("#docVia").trim(),
    isResponse: document.querySelector("#docIsResponse").checked,
    isExternal: document.querySelector("#docIsExternal").checked,
    hasDigitalFile: hasDigitalAttachment,
    physicalReceived: isIncoming,
    createdAt: now,
    history: [
      createHistoryItem(
        "En recepcion",
        documentWindowValue("#docOwner").trim(),
        "Documento recibido por Recepcion. Pendiente de derivacion a la unidad responsable."
      )
    ]
  };

  if (sessionStorage.getItem(TOKEN_KEY)) {
    const formData = new FormData();
    formData.append("direction", direction);
    formData.append("year", year);
    formData.append("type", documentWindowValue("#docType"));
    formData.append("code", code);
    formData.append("internalNumber", documentWindowValue("#docInternalNumber").trim());
    formData.append("reference", documentWindowValue("#docReference").trim());
    formData.append("subject", documentWindowValue("#docSubject").trim());
    formData.append("applicantName", applicantName);
    formData.append("applicantCi", applicantCi);
    formData.append("applicantPhone", applicantPhone);
    formData.append("sheetCount", String(sheetCount));
    formData.append("sender", sender);
    formData.append("receiver", isIncoming ? targetUnit?.name ?? receiver : receiver);
    formData.append("targetUnitId", isIncoming ? selectedTargetUnitId : "external");
    formData.append("priority", documentWindowValue("#docPriority"));
    formData.append("dueDate", documentWindowValue("#docDueDate"));
    selectedFiles.forEach((file) => formData.append("digitalFiles", file));

    const response = await apiRequest("/documents", { method: "POST", body: formData });
    const savedDocument = normalizeApiDocument(response.document);
    upsertDocument(savedDocument);
    selectedId = savedDocument.id;
    documentForm.reset();
    modal.close();
    render();
    if (isReceptionPrincipal() && direction === "Entrante") {
      printControlSheet(savedDocument);
    }
    return;
  }

  documents = [newDocument, ...documents];
  selectedId = newDocument.id;
  persistDocuments();
  documentForm.reset();
  modal.close();
  render();
  if (isReceptionPrincipal() && direction === "Entrante") {
    printControlSheet(newDocument);
  }
});

function loadDocuments() {
  const saved = localStorage.getItem(STORAGE_KEY);
  const source = saved ? JSON.parse(saved) : structuredClone(defaultDocuments);
  return source.map(normalizeDocument);
}

function loadUnits() {
  const saved = localStorage.getItem(UNITS_KEY);
  return saved ? JSON.parse(saved) : structuredClone(defaultUnits);
}

function loadUsers() {
  const saved = localStorage.getItem(USERS_KEY);
  let loadedUsers = [];

  try {
    loadedUsers = saved ? JSON.parse(saved) : structuredClone(defaultUsers);
  } catch {
    loadedUsers = structuredClone(defaultUsers);
  }

  const requiredUsers = defaultUsers.filter((user) => user.protected || user.role === "admin");
  const mergedUsers = [...loadedUsers];

  requiredUsers.forEach((requiredUser) => {
    const existingIndex = mergedUsers.findIndex(
      (user) => user.id === requiredUser.id || user.username === requiredUser.username
    );

    if (existingIndex === -1) {
      mergedUsers.push(structuredClone(requiredUser));
      return;
    }

    mergedUsers[existingIndex] = {
      ...requiredUser,
      ...mergedUsers[existingIndex],
      role: "admin",
      unitId: "unit-admin",
      active: true,
      protected: requiredUser.protected || mergedUsers[existingIndex].protected
    };
  });

  localStorage.setItem(USERS_KEY, JSON.stringify(mergedUsers));
  return mergedUsers.map(normalizeApiUser);
}

function loadSession() {
  const saved = sessionStorage.getItem(SESSION_KEY);
  if (!saved) return null;

  try {
    return JSON.parse(saved);
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    return null;
  }
}

async function apiRequest(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = sessionStorage.getItem(TOKEN_KEY);

  if (options.auth !== false && token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let body = options.body;
  if (body && !(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method || "GET",
    headers,
    body
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Error de servidor");
  }
  return payload;
}

async function downloadDigitalFile(documentItem) {
  const token = sessionStorage.getItem(TOKEN_KEY);
  if (!token) return;

  const response = await fetch(`${API_BASE_URL}/documents/${documentItem.id}/digital-file`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    alert(payload.error || "No se pudo descargar el archivo digital.");
    return;
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = documentItem.digitalFileName || `${documentItem.code}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function loadRemoteConfig() {
  const settingsResponse = await apiRequest("/settings");
  organizationSettings = settingsResponse.settings;

  if (isZowOwner()) {
    const systemsResponse = await apiRequest("/systems");
    saasSystems = systemsResponse.systems || [];
    const companiesResponse = await apiRequest("/companies");
    companies = companiesResponse.companies || [];
    units = [];
    users = [];
    documents = [];
    notifications = [];
    return;
  }

  const unitsResponse = await apiRequest("/units");
  units = unitsResponse.units.map(normalizeApiUnit);

  if (isAdmin()) {
    const usersResponse = await apiRequest("/users");
    users = usersResponse.users.map(normalizeApiUser);
  }

  const documentsResponse = await apiRequest("/documents");
  documents = documentsResponse.documents.map(normalizeApiDocument);

  if (["recepcion_secundaria", "funcionario", "supervisor"].includes(currentUser.role)) {
    const notificationsResponse = await apiRequest("/notifications");
    notifications = notificationsResponse.notifications || [];
  } else {
    notifications = [];
  }
}

function normalizeApiUnit(unit) {
  return {
    id: unit.id,
    name: unit.name,
    code: unit.code,
    parentUnitId: unit.parentUnitId ?? unit.parent_unit_id ?? "",
    level: unit.level || "secundaria",
    active: unit.is_active !== 0
  };
}

function normalizeApiUser(user) {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
    companyId: user.companyId ?? user.company_id ?? "",
    companyName: user.companyName ?? user.company_name ?? "",
    unitId: user.unitId ?? user.unit_id,
    unitName: user.unitName ?? user.unit_name,
    position: user.position || "",
    ci: user.ci || "",
    phone: user.phone || "",
    active: user.active ?? user.is_active !== 0,
    protected: Boolean(user.protected ?? user.is_protected)
  };
}

function normalizeApiDocument(documentItem) {
  const currentUnit = units.find((unit) => unit.id === documentItem.current_unit_id);
  const targetUnit = units.find((unit) => unit.id === documentItem.target_unit_id);
  return {
    id: documentItem.id,
    direction: documentItem.direction,
    year: documentItem.year,
    type: documentItem.type,
    code: documentItem.code,
    internalNumber: documentItem.internal_number,
    reference: documentItem.reference,
    subject: documentItem.subject,
    applicantName: documentItem.applicant_name || documentItem.sender || "",
    applicantCi: documentItem.applicant_ci || "",
    applicantPhone: documentItem.applicant_phone || "",
    sheetCount: Number(documentItem.sheet_count || 0),
    receivedAt: documentItem.received_at || documentItem.created_at,
    contact: documentItem.direction === "Entrante" ? documentItem.sender : documentItem.receiver,
    sender: documentItem.sender,
    receiver: documentItem.receiver || targetUnit?.name || "",
    sourceUnitId: documentItem.source_unit_id,
    targetUnitId: documentItem.target_unit_id,
    currentUnitId: documentItem.current_unit_id,
    createdByUnitId: documentItem.created_by_unit_id,
    area: currentUnit?.name || documentItem.owner_name || "",
    owner: documentItem.owner_name,
    priority: documentItem.priority,
    status: documentItem.status,
    dueDate: documentItem.due_date,
    fileRef: documentItem.digital_file_names || documentItem.digital_file_name || "Pendiente de adjunto",
    digitalFileName: documentItem.digital_file_names || documentItem.digital_file_name || "",
    digitalFileSize: documentItem.digital_file_size || 0,
    digitalFileCount: Number(documentItem.digital_file_count || (documentItem.digital_file_name ? 1 : 0)),
    digitalAttachedAt: documentItem.digital_attached_at || "",
    attachments: documentItem.sheet_count ? `${documentItem.sheet_count} hoja(s)` : "Sin anexos",
    hasDigitalFile: Boolean(documentItem.has_digital_file),
    physicalReceived: Boolean(documentItem.physical_received),
    createdAt: documentItem.created_at,
    history: movementCache[documentItem.id] || []
  };
}

function normalizeApiMovement(movement) {
  const toUnit = units.find((unit) => unit.id === movement.to_unit_id);
  const fromName = movement.from_unit_name || "Registro inicial";
  const toName = movement.to_unit_name || toUnit?.name || currentUser?.name || "Sistema";
  const userName = movement.created_by_name || "Sistema";
  return {
    date: movement.derived_at,
    status: movement.status,
    owner: toName,
    comment: `${movement.instruction_type}. De ${fromName} para ${toName}. Registrado por ${userName} el ${formatDateTime(movement.derived_at)}. ${movement.comment || "Sin comentario."}`
  };
}

function upsertDocument(documentItem) {
  documents = [documentItem, ...documents.filter((item) => item.id !== documentItem.id)];
}

function normalizeDocument(item) {
  const currentUnitId = item.currentUnitId ?? resolveUnitIdByName(item.area);
  const targetUnitId = item.targetUnitId ?? resolveUnitIdByName(item.receiver);
  return {
    year: "2026",
    internalNumber: "",
    reference: item.subject ?? "",
    applicantName: item.applicantName ?? item.sender ?? item.contact ?? "",
    applicantCi: item.applicantCi ?? "",
    applicantPhone: item.applicantPhone ?? "",
    sheetCount: item.sheetCount ?? 0,
    receivedAt: item.receivedAt ?? item.createdAt,
    sender: item.contact ?? "",
    receiver: item.area ?? "",
    sourceUnitId: item.direction === "Saliente" ? resolveUnitIdByName(item.sender) : "external",
    targetUnitId: targetUnitId ?? (item.direction === "Entrante" ? currentUnitId : "external"),
    currentUnitId: currentUnitId ?? getReceptionUnit()?.id,
    createdByUnitId: item.direction === "Entrante" ? getReceptionUnit()?.id : currentUnitId,
    receivedByReception: item.direction === "Entrante",
    position: "",
    attachments: "Sin anexos",
    copies: "",
    via: "",
    isResponse: false,
    isExternal: item.direction === "Saliente" ? false : true,
    hasDigitalFile: item.fileRef && item.fileRef !== "Pendiente de adjunto",
    physicalReceived: item.direction === "Entrante",
    ...item
  };
}

function persistDocuments() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(documents));
}

function persistUsers() {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function persistUnits() {
  localStorage.setItem(UNITS_KEY, JSON.stringify(units));
}

function persistAll() {
  persistDocuments();
  persistUsers();
  persistUnits();
}

function documentWindowValue(selector) {
  return document.querySelector(selector).value;
}

function normalizeUsernameInput(selector) {
  return documentWindowValue(selector).trim().toLowerCase();
}

function getSelectedUnitIds(selector) {
  return [...document.querySelector(selector).selectedOptions].map((option) => option.value).filter(Boolean);
}

function configureDocumentForm() {
  const simpleReception = isReceptionPrincipal();
  const hiddenForReception = [
    "#docDirection",
    "#docYear",
    "#docInternalNumber",
    "#docSubject",
    "#docSender",
    "#docReceiver",
    "#docArea",
    "#docOwner",
    "#docPosition",
    "#docPriority",
    "#docDueDate",
    "#docAttachments",
    "#docCopies",
    "#docVia",
    "#docIsResponse",
    "#docIsExternal",
    "#docHasDigital"
  ];

  hiddenForReception.forEach((selector) => {
    const field = document.querySelector(selector);
    const wrapper = field?.closest("label");
    if (!field || !wrapper) return;
    wrapper.classList.toggle("hidden", simpleReception);
    field.required = !simpleReception && field.hasAttribute("data-required-default");
  });

  ["#docDirection", "#docYear", "#docType", "#docReference", "#docApplicantName", "#docApplicantCi", "#docApplicantPhone", "#docSheetCount"].forEach(
    (selector) => {
      const field = document.querySelector(selector);
      if (field && !field.hasAttribute("data-required-default") && field.required) {
        field.setAttribute("data-required-default", "true");
      }
    }
  );

  if (simpleReception) {
    document.querySelector("#docReference").closest("label")?.classList.add("span-2");
    document.querySelector("#docFile").closest("label")?.classList.add("span-2");
  }
}

function getSelectedDocument() {
  return documents.find((item) => item.id === selectedId);
}

function getCurrentUnit() {
  return units.find((item) => item.id === currentUser?.unitId);
}

function getReceptionUnit() {
  return units.find((item) => ["VU", "REC"].includes(item.code)) ?? units.find((item) => item.name === "Recepcion");
}

function resolveUnitIdByName(name) {
  return units.find((unit) => unit.name === name)?.id;
}

function isAdmin() {
  return currentUser?.role === "admin";
}

function isZowOwner() {
  return currentUser?.role === "zow_owner";
}

function isReceptionPrincipal() {
  return currentUser?.role === "recepcion_principal";
}

function isReceptionSecondary() {
  return currentUser?.role === "recepcion_secundaria";
}

function isReceptionRole() {
  return isReceptionPrincipal() || isReceptionSecondary();
}

function isSupervisor() {
  return currentUser?.role === "supervisor";
}

function canCreateDocuments() {
  return Boolean(currentUser) && isReceptionPrincipal();
}

function canModifyDocument(documentItem) {
  if (!currentUser) return false;
  if (isAdmin()) return false;
  if (isReceptionPrincipal() || isReceptionSecondary()) return documentItem.status !== "Archivado";
  if (currentUser.role === "supervisor") return true;
  if (sessionStorage.getItem(TOKEN_KEY)) return documentItem.status !== "Archivado";
  return documentItem.currentUnitId === currentUser.unitId && documentItem.status !== "Archivado";
}

function canDeriveDocument(documentItem) {
  if (!currentUser || !documentItem) return false;
  if (documentItem.status === "Archivado" && currentUser.role !== "supervisor") return false;
  if (isAdmin()) return false;
  if (isReceptionRole()) return true;
  if (sessionStorage.getItem(TOKEN_KEY) && ["recepcion_secundaria", "funcionario", "supervisor"].includes(currentUser.role)) return true;
  return documentItem.currentUnitId === currentUser.unitId;
}

function canChangeStatus(documentItem, status) {
  if (!currentUser || !documentItem) return false;
  if (isAdmin()) return false;
  if (documentItem.status === "Archivado") {
    return currentUser.role === "supervisor" && status === "En revision";
  }
  if (isReceptionPrincipal()) return status === "En revision" || status === "Recibido";
  if (isReceptionSecondary()) return ["En revision", "Recibido", "Atendido"].includes(status);
  return ["En revision", "Atendido", "Archivado", "Vencido"].includes(status);
}

function canAttachDigital(documentItem) {
  if (!currentUser || !documentItem) return false;
  if (isAdmin()) return false;
  if (documentItem.status === "Archivado") return currentUser.role === "supervisor";
  return isReceptionRole() || ["funcionario", "supervisor"].includes(currentUser.role);
}

function canReceivePhysical() {
  return isReceptionRole();
}

function canViewDocument(documentItem) {
  if (!currentUser) return false;
  if (isAdmin() || isReceptionPrincipal()) return true;
  if (sessionStorage.getItem(TOKEN_KEY)) return true;
  return documentItem.currentUnitId === currentUser.unitId;
}

function canAccessRoles(roleList) {
  if (!roleList || !currentUser) return true;
  return roleList.split(",").map((role) => role.trim()).includes(currentUser.role);
}

function isViewAllowed(view) {
  const item = document.querySelector(`.nav-item[data-view="${view}"]`);
  return Boolean(item && canAccessRoles(item.dataset.roles));
}

function getDefaultViewForRole(role) {
  if (role === "zow_owner") return "zowAdmin";
  return role === "admin" ? "admin" : "dashboard";
}

function updateDocument(id, patch) {
  documents = documents.map((item) => (item.id === id ? { ...item, ...patch } : item));
  persistDocuments();
  render();
}

function createHistoryItem(status, owner, comment) {
  return {
    date: new Date().toISOString(),
    status,
    owner,
    comment
  };
}

function buildNextCode(direction, year = "2026") {
  const month = String(new Date().getMonth() + 1).padStart(2, "0");
  const prefix = `${month}-${year}`;
  const count = documents.filter((item) => String(item.code || "").startsWith(`${prefix}-`)).length + 1;
  return `${prefix}-${String(count).padStart(4, "0")}`;
}

function getFilteredDocuments() {
  const term = searchInput.value.trim().toLowerCase();
  const status = statusFilter.value;

  return documents
    .filter(canViewDocument)
    .filter((item) => {
      if (activeView === "inbox") return item.direction === "Entrante";
      if (activeView === "pendingDerivation") return item.direction === "Entrante" && item.status === "En recepcion";
      if (activeView === "derivedDocuments") return item.status === "Derivado";
      if (activeView === "pendingReceipt") return !item.physicalReceived;
      if (activeView === "tracking") return true;
      if (activeView === "archive") return item.status === "Archivado";
      if (activeView === "reports") return true;
      return item.status !== "Archivado";
    })
    .filter((item) => (status === "all" ? true : normalizeStatus(item.status) === normalizeStatus(status)))
    .filter((item) => {
      if (!term) return true;
      return [
        item.code,
        item.internalNumber,
        item.reference,
        item.subject,
        item.applicantName,
        item.applicantCi,
        item.applicantPhone,
        item.contact,
        item.owner,
        item.area,
        item.type
      ]
        .join(" ")
        .toLowerCase()
        .includes(term);
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function normalizeStatus(status) {
  return status.replace(/\s+/g, " ").trim();
}

function mergeFileNames(currentValue, newNames) {
  const currentNames = String(currentValue || "")
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name && name !== "Pendiente de adjunto" && name !== "Pendiente de escaneo");
  return [...currentNames, ...newNames].join(", ");
}

function render() {
  renderSession();
  if (!currentUser) return;
  if (sessionStorage.getItem(TOKEN_KEY)) {
    loadRemoteConfig()
      .then(() => {
        renderSession();
        renderMetrics();
        renderWorkflowPanel();
        renderViewHeading();
        renderList();
        renderDetail();
        enhanceInterface();
      })
      .catch(() => {
        renderMetrics();
        renderWorkflowPanel();
        renderViewHeading();
        renderList();
        renderDetail();
        enhanceInterface();
      });
    return;
  }
  renderMetrics();
  renderWorkflowPanel();
  renderViewHeading();
  renderList();
  renderDetail();
  enhanceInterface();
}

async function renderWithRemoteData() {
  renderSession();
  if (!currentUser) return;
  await loadRemoteConfig();
  renderMetrics();
  renderWorkflowPanel();
  renderViewHeading();
  renderList();
  renderDetail();
  enhanceInterface();
}

function renderSession() {
  const loggedIn = Boolean(currentUser);
  loginScreen.classList.toggle("hidden", loggedIn);
  sidebar.classList.toggle("hidden", !loggedIn);
  appShell.classList.toggle("hidden", !loggedIn);

  if (!loggedIn) return;

  const unit = getCurrentUnit();
  document.body.classList.toggle("app-zow-panel", isZowOwner());
  const brandLogo = document.querySelector("#sidebarBrandLogo");
  if (brandLogo) {
    brandLogo.src = isZowOwner()
      ? "assets/brand/zow-systems-logo-transparent.png"
      : "assets/brand/zow-correspondencia-login-logo-transparent.png";
    brandLogo.alt = isZowOwner() ? "ZOW Systems" : "Correspondencia ZOW";
  }
  document.querySelector("#currentAreaLabel").textContent = `${unit?.name ?? "Sin unidad asignada"} / ${organizationSettings.companyName || "Empresa sin configurar"}`;
  document.querySelector("#companyNameTitle").textContent = isZowOwner() ? "Panel ZOW SaaS" : "Correspondencia ZOW";
  document.querySelector("#currentUserBadge").textContent = `${currentUser.name} / ${roleLabel(currentUser.role)}`;
  document.querySelector("#sessionRole").textContent = roleLabel(currentUser.role);
  document.querySelector("#sessionUnit").textContent = isZowOwner() ? "ZOW SaaS" : unit?.name ?? "Sin unidad";
  document.querySelector("#openNewDocument").classList.toggle("hidden", !canCreateDocuments());
  notificationBtn.classList.toggle("hidden", !["recepcion_secundaria", "funcionario", "supervisor"].includes(currentUser.role) || notifications.length === 0);
  document.querySelector("#notificationCount").textContent = notifications.length;
  document.querySelector("#seedDataBtn").classList.toggle("hidden", Boolean(sessionStorage.getItem(TOKEN_KEY)));
  document.querySelectorAll("[data-admin-only]").forEach((item) => item.classList.toggle("hidden", !isAdmin()));
  document.querySelectorAll("[data-zow-owner-only]").forEach((item) => item.classList.toggle("hidden", !isZowOwner()));
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.toggle("hidden", !canAccessRoles(item.dataset.roles));
  });
  document.querySelectorAll(".nav-group").forEach((group) => {
    const hasVisibleItems = [...group.querySelectorAll(".nav-item")].some((item) => !item.classList.contains("hidden"));
    const roleAllowed = canAccessRoles(group.dataset.roles);
    group.classList.toggle("hidden", !hasVisibleItems || !roleAllowed);
  });
  syncUnitSelects();

  if (!isViewAllowed(activeView)) {
    activeView = getDefaultViewForRole(currentUser.role);
  }

  const configMode = activeView === "admin" || activeView === "zowAdmin";
  document.querySelector(".filter-panel")?.classList.toggle("hidden", configMode);
  document.querySelector(".content-grid")?.classList.toggle("admin-mode", configMode);

  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.toggle("is-active", item.dataset.view === activeView);
  });
  document.querySelector(".nav-item.is-active")?.closest(".nav-group")?.classList.add("is-open");
  document.querySelectorAll(".nav-group").forEach((group) => {
    group.querySelector(".nav-group-toggle")?.setAttribute("aria-expanded", String(group.classList.contains("is-open")));
  });
}

function syncUnitSelects() {
  const destinationUnits = units.filter((unit) => unit.id !== "unit-admin" && unit.id !== currentUser?.unitId);
  const documentUnits = units.filter((unit) => unit.id !== "unit-admin");
  const options = [
    `<option value="">Seleccionar unidad</option>`,
    ...documentUnits
      .map((unit) => `<option value="${unit.id}">${escapeHtml(unit.name)}</option>`)
  ].join("");

  const movementSelect = document.querySelector("#movementOwner");
  const docAreaSelect = document.querySelector("#docArea");
  if (movementSelect) {
    movementSelect.innerHTML = destinationUnits
      .map((unit) => `<option value="${unit.id}">${escapeHtml(unit.name)}</option>`)
      .join("");
  }
  if (docAreaSelect) docAreaSelect.innerHTML = options;
}

function roleLabel(role) {
  const labels = {
    zow_owner: "Duenio SaaS ZOW",
    admin: "Encargado de sistema",
    recepcion_principal: "Recepcion principal",
    recepcion_secundaria: "Recepcion secundaria",
    funcionario: "Funcionario",
    supervisor: "Secretario / Director",
    ventas_admin: "Administrador ventas",
    cajero: "Cajero",
    almacen: "Almacen",
    vendedor: "Vendedor"
  };
  return labels[role] ?? role;
}

function areaLevelLabel(level) {
  const labels = {
    principal: "Area principal",
    secundaria: "Area secundaria",
    subarea: "Sub area"
  };
  return labels[level] ?? "Area secundaria";
}

function renderMetrics() {
  const visibleDocuments = documents.filter(canViewDocument);
  const metricCards = document.querySelectorAll(".metrics article span");

  if (isZowOwner()) {
    metricCards[0].textContent = "Empresas activas";
    metricCards[1].textContent = "Empresas suspendidas";
    metricCards[2].textContent = "Usuarios totales";
    metricCards[3].textContent = "Documentos totales";
    document.querySelector("#lastMetric").textContent = companies.filter((company) => company.status === "active").length;
    document.querySelector("#outboxMetric").textContent = companies.filter((company) => company.status === "suspended").length;
    document.querySelector("#inboxMetric").textContent = companies.reduce((total, company) => total + Number(company.user_count || 0), 0);
    document.querySelector("#digitalMetric").textContent = companies.reduce((total, company) => total + Number(company.document_count || 0), 0);
    return;
  }

  if (isAdmin()) {
    const operativeUnits = units.filter((unit) => unit.id !== "unit-admin").length;
    const secondaryUnits = units.filter((unit) => unit.level === "secundaria").length;
    const subUnits = units.filter((unit) => unit.level === "subarea").length;
    const activeUsers = users.filter((user) => user.active).length;
    metricCards[0].textContent = "Areas registradas";
    metricCards[1].textContent = "Areas secundarias";
    metricCards[2].textContent = "Sub areas";
    metricCards[3].textContent = "Usuarios activos";
    document.querySelector("#lastMetric").textContent = operativeUnits;
    document.querySelector("#outboxMetric").textContent = secondaryUnits;
    document.querySelector("#inboxMetric").textContent = subUnits;
    document.querySelector("#digitalMetric").textContent = activeUsers;
    return;
  }

  metricCards[0].textContent = "Ultimo correlativo";
  metricCards[1].textContent = "Total derivadas";
  metricCards[2].textContent = "Total recibidas";
  metricCards[3].textContent = "Sin archivo digital";
  const lastCode = visibleDocuments
    .map((item) => item.code)
    .sort()
    .at(-1);

  document.querySelector("#lastMetric").textContent = lastCode?.split("-").at(-1) ?? "0";
  document.querySelector("#outboxMetric").textContent = visibleDocuments.filter((item) => item.status === "Derivado").length;
  document.querySelector("#inboxMetric").textContent = visibleDocuments.filter((item) => item.direction === "Entrante").length;
  document.querySelector("#digitalMetric").textContent = visibleDocuments.filter((item) => !item.hasDigitalFile).length;
}

function renderViewHeading() {
  const labels = {
    dashboard: currentUser?.role === "admin"
      ? ["Sistema", "Centro de configuracion"]
      : currentUser?.role === "funcionario"
      ? ["Correo", "Bandeja de entrada de la unidad"]
      : ["Correo", "Correspondencia recibida y pendiente"],
    pendingDerivation: ["Correspondencia sin derivar", "Registrada y pendiente de envio"],
    derivedDocuments: ["Correspondencia derivada", "Documentacion enviada a otras areas"],
    inbox: ["Recepcion central", "Toda la correspondencia recibida"],
    pendingReceipt: ["Notas por recibir", "Pendientes de entrega fisica"],
    tracking: ["Seguimiento", "Buscar por codigo de seguimiento"],
    archive: ["Archivo digital", "Tramites archivados"],
    reports: ["Reportes", "Recibidas, derivadas y archivadas por area"],
    admin: ["Sistema", "Configuracion de Correspondencia ZOW"],
    zowAdmin: ["ZOW SaaS", "Empresas y planes"]
  };
  const label = labels[activeView] ?? labels.dashboard;
  viewEyebrow.textContent = label[0];
  viewTitle.textContent = label[1];
}

function renderWorkflowPanel() {
  if (isZowOwner() && activeView === "zowAdmin") {
    workflowPanel.innerHTML = `
      <div>
        <strong>Panel comercial ZOW</strong>
        <span>Registra empresas que pagan el servicio, crea su encargado inicial y controla plan, estado y limites.</span>
      </div>
      <button class="primary-button" type="button" id="showCompanyForm">Nueva empresa</button>
    `;
    workflowPanel.classList.remove("hidden");
    document.querySelector("#showCompanyForm")?.addEventListener("click", () => renderZowAdmin("new"));
    return;
  }

  if (isAdmin() && activeView === "dashboard") {
    workflowPanel.innerHTML = `
      <div>
        <strong>Consola del sistema</strong>
        <span>Configura empresa, areas y credenciales. La operacion diaria queda separada para Recepcion y las unidades.</span>
      </div>
      <button class="primary-button" type="button" id="goAdminConfig">Abrir configuracion</button>
    `;
    workflowPanel.classList.remove("hidden");
    document.querySelector("#goAdminConfig")?.addEventListener("click", () => {
      activeView = "admin";
      render();
    });
    return;
  }

  if (currentUser?.role === "funcionario" && activeView === "dashboard") {
    workflowPanel.innerHTML = `
      <div>
        <strong>Trabajo de la unidad</strong>
        <span>${notifications.length ? `Tienes ${notifications.length} documento(s) nuevo(s) derivado(s).` : `Aqui solo aparecen los documentos derivados a ${escapeHtml(getCurrentUnit()?.name ?? "tu unidad")}.`}</span>
      </div>
      ${renderNotificationList()}
    `;
    workflowPanel.classList.remove("hidden");
    bindNotificationItems();
    return;
  }

  if (currentUser?.role === "supervisor" && activeView === "dashboard") {
    workflowPanel.innerHTML = `
      <div>
        <strong>Bandeja de jefatura</strong>
        <span>${notifications.length ? `Tienes ${notifications.length} documento(s) nuevo(s) para revisar.` : "Sin documentos nuevos derivados."}</span>
      </div>
      ${renderNotificationList()}
    `;
    workflowPanel.classList.remove("hidden");
    bindNotificationItems();
    return;
  }

  if (isReceptionPrincipal() && activeView === "dashboard") {
    workflowPanel.innerHTML = `
      <div>
        <strong>Recepcion central</strong>
        <span>Registra toda documentacion entrante, adjunta el digital y deriva a la unidad responsable. Las areas solo veran lo que les derive Recepcion.</span>
      </div>
      <button class="primary-button" type="button" id="quickIncomingDoc">Registrar entrante</button>
    `;
    workflowPanel.classList.remove("hidden");
    document.querySelector("#quickIncomingDoc")?.addEventListener("click", () => document.querySelector("#openNewDocument").click());
    return;
  }

  if (isReceptionSecondary() && activeView === "dashboard") {
    workflowPanel.innerHTML = `
      <div>
        <strong>Recepcion interna de area</strong>
        <span>${notifications.length ? `Tienes ${notifications.length} documento(s) nuevo(s) para recibir.` : "Recibe documentacion derivada a tu area, confirma fisico si corresponde y deriva internamente."}</span>
      </div>
      ${renderNotificationList()}
    `;
    workflowPanel.classList.remove("hidden");
    bindNotificationItems();
    return;
  }

  const panels = {
    dashboard: `
      <div>
        <strong>Flujo recomendado</strong>
        <span>1. Registrar ingreso / 2. Adjuntar digital / 3. Imprimir hoja de control / 4. Derivar y hacer seguimiento.</span>
      </div>
      <button class="ghost-button" type="button" id="manualBtn">Manual del sistema</button>
    `,
    pendingReceipt: `
      <div>
        <strong>Revision anticipada</strong>
        <span>Notas enviadas al area que aun no fueron entregadas fisicamente.</span>
      </div>
    `,
    tracking: `
      <div>
        <strong>Seguimiento por codigo</strong>
        <span>Busca el codigo de seguimiento para ver cada movimiento y responsable.</span>
      </div>
    `,
    reports: `
      <div>
        <strong>Generador de reportes</strong>
        <span>Filtra por area y rango de fechas para exportar PDF o Excel en la version productiva.</span>
      </div>
      <form class="report-form">
        <select aria-label="Tipo de reporte">
          <option>Recibidas por area</option>
          <option>Derivadas por area</option>
          <option>Archivadas por area</option>
        </select>
        <input type="text" placeholder="Area" />
        <input type="date" />
        <input type="date" />
        <button class="ghost-button" type="button">PDF</button>
        <button class="ghost-button" type="button">Excel</button>
      </form>
    `,
    admin: `
      <div>
        <strong>Configuracion inicial de empresa</strong>
        <span>Usa esta consola para crear unidades, encargados por area, usuarios operativos y permisos base.</span>
      </div>
      <div class="admin-actions">
        <button class="ghost-button" type="button" id="showUnitForm">Nueva unidad</button>
        <button class="primary-button" type="button" id="showUserForm">Nuevo usuario</button>
      </div>
    `
  };

  workflowPanel.innerHTML = panels[activeView] ?? "";
  workflowPanel.classList.toggle("hidden", !panels[activeView]);

  document.querySelector("#manualBtn")?.addEventListener("click", () => {
    window.open("C:/Users/WWW/Downloads/manualCorrespondencia.pdf", "_blank");
  });

  document.querySelector("#showUserForm")?.addEventListener("click", () => renderAdmin("user"));
  document.querySelector("#showUnitForm")?.addEventListener("click", () => renderAdmin("unit"));
}

function renderNotificationList() {
  if (!notifications.length) return "";
  return `
    <div class="notification-list">
      ${notifications
        .slice(0, 5)
        .map(
          (item) => `
            <button class="notification-item" type="button" data-notification-doc="${item.id}">
              <strong>${escapeHtml(item.code)}</strong>
              <span>${escapeHtml(item.applicant_name || item.subject || item.reference || "Documento derivado")}</span>
            </button>
          `
        )
        .join("")}
    </div>
  `;
}

function bindNotificationItems() {
  document.querySelectorAll("[data-notification-doc]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedId = button.dataset.notificationDoc;
      markDocumentSeen(selectedId);
      render();
    });
  });
}

function renderList() {
  if (activeView === "zowAdmin") {
    resultCount.textContent = `${companies.length} empresa${companies.length === 1 ? "" : "s"}`;
    renderZowAdmin();
    return;
  }

  if (activeView === "admin") {
    resultCount.textContent = "Configuracion";
    renderAdmin();
    return;
  }

  const filtered = getFilteredDocuments();
  if (selectedId && !filtered.some((item) => item.id === selectedId)) {
    selectedId = filtered[0]?.id ?? null;
  }
  resultCount.textContent = `${filtered.length} registro${filtered.length === 1 ? "" : "s"}`;

  if (!filtered.length) {
    listEl.innerHTML = `<div class="empty-state"><strong>No hay documentos</strong><span>Ajusta los filtros o registra uno nuevo.</span></div>`;
    return;
  }

  listEl.innerHTML = filtered
    .map(
      (item) => `
        <article class="doc-card ${item.id === selectedId ? "is-selected" : ""}" data-id="${item.id}">
          <div class="doc-card-header">
            <span class="code-pill">${item.code}</span>
            <span class="status-pill ${statusClass(item.status)}">${item.status}</span>
          </div>
          <h3>${escapeHtml(item.subject)}</h3>
          <div class="doc-meta">
            <span>${item.direction} / ${item.type}</span>
            <span>Solicitante: ${escapeHtml(item.applicantName || "Sin registrar")}</span>
            <span>CI: ${escapeHtml(item.applicantCi || "Sin CI")}</span>
            <span>${escapeHtml(item.reference)}</span>
            <span>${escapeHtml(item.area)}</span>
            <span>${formatDate(item.dueDate)}</span>
            <span class="priority-pill ${item.priority.toLowerCase()}">${item.priority}</span>
            <span class="file-pill ${item.hasDigitalFile ? "ready" : "pending"}">
              ${item.hasDigitalFile ? "Digital subido" : "Sin digital"}
            </span>
            <span class="file-pill ${item.physicalReceived ? "ready" : "pending"}">
              ${item.physicalReceived ? "Fisico recibido" : "Por recibir"}
            </span>
          </div>
        </article>
      `
    )
    .join("");

  document.querySelectorAll(".doc-card").forEach((card) => {
    card.addEventListener("click", () => {
      selectedId = card.dataset.id;
      markDocumentSeen(selectedId);
      render();
    });
  });
}

function renderZowAdmin(mode = "overview") {
  const activeCompanies = companies.filter((company) => company.status === "active").length;
  const suspendedCompanies = companies.filter((company) => company.status === "suspended").length;
  const totalUsers = companies.reduce((total, company) => total + Number(company.user_count || 0), 0);

  listEl.innerHTML = `
    <section class="setup-overview">
      <article>
        <span>Empresas activas</span>
        <strong>${activeCompanies}</strong>
      </article>
      <article>
        <span>Suspendidas</span>
        <strong>${suspendedCompanies}</strong>
      </article>
      <article>
        <span>Usuarios creados</span>
        <strong>${totalUsers}</strong>
      </article>
    </section>

    <section class="cloud-safe-note">
      <strong>Datos protegidos en la nube</strong>
      <span>Empresas, usuarios, areas y documentos se leen desde PostgreSQL/Supabase. Un deploy de Vercel no debe borrar estos registros.</span>
    </section>

    <div class="admin-tabs" role="tablist" aria-label="ZOW SaaS">
      <button class="${mode === "overview" ? "is-active" : ""}" type="button" data-zow-tab="overview">Empresas</button>
      <button class="${mode === "new" ? "is-active" : ""}" type="button" data-zow-tab="new">Nueva empresa</button>
    </div>

    ${mode === "new" ? renderCompanyCreatePanel() : renderCompanyListPanel()}
  `;

  emptyDetail.classList.add("hidden");
  detailEl.classList.add("hidden");
  document.querySelectorAll("[data-zow-tab]").forEach((button) => {
    button.addEventListener("click", () => renderZowAdmin(button.dataset.zowTab));
  });
  document.querySelector("#zowCompanyForm")?.addEventListener("submit", handleZowCompanySubmit);
  document.querySelector("#zowCompanyEditForm")?.addEventListener("submit", handleZowCompanyEditSubmit);
  document.querySelectorAll("[data-company-systems]").forEach((button) => {
    button.addEventListener("click", () => renderCompanySystemsPanel(button.dataset.companySystems));
  });
  document.querySelectorAll("[data-company-edit]").forEach((button) => {
    button.addEventListener("click", () => renderCompanyEditPanel(button.dataset.companyEdit));
  });
  document.querySelectorAll("[data-company-status]").forEach((button) => {
    button.addEventListener("click", async () => {
      const company = companies.find((item) => item.id === button.dataset.companyId);
      if (!company) return;
      await apiRequest(`/companies/${company.id}/status`, {
        method: "PATCH",
        body: { status: button.dataset.companyStatus }
      });
      await loadRemoteConfig();
      renderMetrics();
      renderZowAdmin();
    });
  });
}

async function renderCompanySystemsPanel(companyId) {
  const company = companies.find((item) => item.id === companyId);
  if (!company) return;
  const response = await apiRequest(`/companies/${companyId}/systems`);
  const activeIds = response.systems.filter((system) => system.access_status === "active").map((system) => system.id);
  listEl.innerHTML = `
    <section class="admin-panel">
      <div class="admin-panel-head">
        <div>
          <p class="eyebrow">Accesos SaaS</p>
          <h3>${escapeHtml(company.name)}</h3>
        </div>
      </div>
      <form class="admin-form" id="companySystemsForm">
        <fieldset class="system-checks">
          <legend>Sistemas habilitados</legend>
          ${response.systems
            .map(
              (system) => `
                <label class="check-row">
                  <input type="checkbox" data-company-system-check value="${escapeHtml(system.id)}" ${activeIds.includes(system.id) ? "checked" : ""} />
                  ${escapeHtml(system.name)}
                </label>
              `
            )
            .join("")}
        </fieldset>
        <div class="modal-actions">
          <button class="ghost-button" type="button" id="backCompanies">Volver</button>
          <button class="primary-button" type="submit">Guardar accesos</button>
        </div>
      </form>
    </section>
  `;
  document.querySelector("#backCompanies")?.addEventListener("click", () => renderZowAdmin());
  document.querySelector("#companySystemsForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await apiRequest(`/companies/${companyId}/systems`, {
      method: "PATCH",
      body: {
        systems: getCheckedValues("[data-company-system-check]"),
        plan: company.plan
      }
    });
    await loadRemoteConfig();
    renderMetrics();
    renderZowAdmin();
  });
}

function renderCompanyListPanel() {
  if (!companies.length) {
    return `<div class="empty-state"><strong>No hay empresas registradas</strong><span>Crea la primera empresa cliente para entregar su encargado de sistema.</span></div>`;
  }

  return `
    <section class="admin-panel">
      <div class="admin-panel-head">
        <div>
          <p class="eyebrow">Clientes SaaS</p>
          <h3>Empresas registradas</h3>
        </div>
      </div>
      <div class="admin-list">
        ${companies
          .map(
            (company) => `
              <article class="admin-row">
                <div>
                  <strong>${escapeHtml(company.name)}</strong>
                  <span>${escapeHtml(company.contact_name || "Sin contacto")} / ${escapeHtml(company.contact_email || "Sin email")}</span>
                  <span>Plan ${escapeHtml(company.plan)} / Usuarios ${company.user_count || 0}/${company.max_users} / Areas ${company.unit_count || 0}/${company.max_units}</span>
                  <span>Sistemas: ${escapeHtml(company.systems || "Sin sistemas activos")}</span>
                </div>
                <div class="admin-row-meta">
                  <span>${escapeHtml(company.slug)}</span>
                  <span class="${company.status === "active" ? "ok-text" : "danger-text"}">${companyStatusLabel(company.status)}</span>
                  <span>${company.document_count || 0} documentos</span>
                </div>
                <button class="ghost-button" type="button" data-company-id="${company.id}" data-company-status="${company.status === "active" ? "suspended" : "active"}">
                  ${company.status === "active" ? "Suspender" : "Activar"}
                </button>
                <button class="ghost-button" type="button" data-company-edit="${company.id}">
                  Editar
                </button>
                <button class="ghost-button" type="button" data-company-systems="${company.id}">
                  Sistemas
                </button>
              </article>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderCompanyEditPanel(companyId) {
  const company = companies.find((item) => item.id === companyId);
  if (!company) return renderZowAdmin();

  listEl.innerHTML = `
    <section class="admin-panel">
      <div class="admin-panel-head">
        <div>
          <p class="eyebrow">Cliente SaaS</p>
          <h3>Editar empresa y credencial</h3>
        </div>
      </div>
      <form class="admin-form" id="zowCompanyEditForm" data-company-id="${escapeHtml(company.id)}">
        <div class="form-grid">
          <label>
            Nombre de empresa
            <input id="zowEditCompanyName" type="text" value="${escapeHtml(company.name || "")}" required />
          </label>
          <label>
            Identificador
            <input id="zowEditCompanySlug" type="text" value="${escapeHtml(company.slug || "")}" required />
          </label>
          <label>
            Plan
            <select id="zowEditCompanyPlan">
              <option value="basico" ${company.plan === "basico" ? "selected" : ""}>Basico</option>
              <option value="profesional" ${company.plan === "profesional" ? "selected" : ""}>Profesional</option>
              <option value="institucional" ${company.plan === "institucional" ? "selected" : ""}>Institucional</option>
            </select>
          </label>
          <label>
            Estado
            <select id="zowEditCompanyStatus">
              <option value="active" ${company.status === "active" ? "selected" : ""}>Activo</option>
              <option value="suspended" ${company.status === "suspended" ? "selected" : ""}>Suspendido</option>
              <option value="cancelled" ${company.status === "cancelled" ? "selected" : ""}>Cancelado</option>
            </select>
          </label>
          <label>
            Max. usuarios
            <input id="zowEditMaxUsers" type="number" min="1" value="${Number(company.max_users || 10)}" required />
          </label>
          <label>
            Max. areas
            <input id="zowEditMaxUnits" type="number" min="2" value="${Number(company.max_units || 10)}" required />
          </label>
          <label>
            Almacenamiento MB
            <input id="zowEditStorageMb" type="number" min="100" value="${Number(company.storage_mb || 1024)}" required />
          </label>
          <label>
            Contacto comercial
            <input id="zowEditContactName" type="text" value="${escapeHtml(company.contact_name || "")}" />
          </label>
          <label>
            Email contacto
            <input id="zowEditContactEmail" type="email" value="${escapeHtml(company.contact_email || "")}" />
          </label>
          <label>
            Celular contacto
            <input id="zowEditContactPhone" type="tel" value="${escapeHtml(company.contact_phone || "")}" />
          </label>
          <label>
            Usuario encargado
            <input id="zowEditAdminUsername" type="email" value="${escapeHtml(company.admin_username || "")}" required />
          </label>
          <label>
            Nueva contrasena opcional
            <input id="zowEditAdminPassword" type="password" autocomplete="new-password" placeholder="Dejar vacio para mantenerla" />
          </label>
          <label class="span-2">
            Nombre del encargado
            <input id="zowEditAdminName" type="text" value="${escapeHtml(company.admin_name || "Encargado de Sistema")}" required />
          </label>
        </div>
        <div class="modal-actions">
          <button class="ghost-button" type="button" id="cancelCompanyEdit">Volver</button>
          <button class="primary-button" type="submit">Guardar empresa y credencial</button>
        </div>
      </form>
    </section>
  `;
  document.querySelector("#cancelCompanyEdit")?.addEventListener("click", () => renderZowAdmin());
  document.querySelector("#zowCompanyEditForm")?.addEventListener("submit", handleZowCompanyEditSubmit);
  enhanceInterface();
}

function renderCompanyCreatePanel() {
  return `
    <section class="admin-panel">
      <div class="admin-panel-head">
        <div>
          <p class="eyebrow">Alta de cliente</p>
          <h3>Nueva empresa SaaS</h3>
        </div>
      </div>
      <form class="admin-form" id="zowCompanyForm">
        <div class="form-grid">
          <label>
            Nombre de empresa
            <input id="zowCompanyName" type="text" required />
          </label>
          <label>
            Identificador
            <input id="zowCompanySlug" type="text" placeholder="empresa-cliente" />
          </label>
          <label>
            Plan
            <select id="zowCompanyPlan">
              <option value="basico">Basico</option>
              <option value="profesional">Profesional</option>
              <option value="institucional">Institucional</option>
            </select>
          </label>
          <label>
            Estado
            <select id="zowCompanyStatus">
              <option value="active">Activo</option>
              <option value="suspended">Suspendido</option>
            </select>
          </label>
          <label>
            Max. usuarios
            <input id="zowMaxUsers" type="number" min="1" value="10" required />
          </label>
          <label>
            Max. areas
            <input id="zowMaxUnits" type="number" min="2" value="10" required />
          </label>
          <label>
            Almacenamiento MB
            <input id="zowStorageMb" type="number" min="100" value="1024" required />
          </label>
          <label>
            Contacto comercial
            <input id="zowContactName" type="text" />
          </label>
          <label>
            Email contacto
            <input id="zowContactEmail" type="email" />
          </label>
          <label>
            Celular contacto
            <input id="zowContactPhone" type="tel" />
          </label>
          <label>
            Usuario encargado
            <input id="zowAdminUsername" type="email" required placeholder="sistema@empresa.com" />
          </label>
          <label>
            Contrasena inicial
            <input id="zowAdminPassword" type="password" autocomplete="new-password" required />
          </label>
          <label class="span-2">
            Nombre del encargado
            <input id="zowAdminName" type="text" value="Encargado de Sistema" required />
          </label>
          <fieldset class="span-2 system-checks">
            <legend>Sistemas contratados</legend>
            ${renderSystemCheckboxes(["correspondencia"])}
          </fieldset>
        </div>
        <div class="modal-actions">
          <button class="primary-button" type="submit">Crear empresa y encargado</button>
        </div>
      </form>
    </section>
  `;
}

async function handleZowCompanySubmit(event) {
  event.preventDefault();
  const payload = {
    name: documentWindowValue("#zowCompanyName").trim(),
    slug: documentWindowValue("#zowCompanySlug").trim(),
    plan: documentWindowValue("#zowCompanyPlan"),
    status: documentWindowValue("#zowCompanyStatus"),
    maxUsers: Number(documentWindowValue("#zowMaxUsers")),
    maxUnits: Number(documentWindowValue("#zowMaxUnits")),
    storageMb: Number(documentWindowValue("#zowStorageMb")),
    contactName: documentWindowValue("#zowContactName").trim(),
    contactEmail: documentWindowValue("#zowContactEmail").trim(),
    contactPhone: documentWindowValue("#zowContactPhone").trim(),
    adminUsername: normalizeUsernameInput("#zowAdminUsername"),
    adminPassword: documentWindowValue("#zowAdminPassword").trim(),
    adminName: documentWindowValue("#zowAdminName").trim(),
    systems: getCheckedValues("[data-system-check]")
  };
  await apiRequest("/companies", { method: "POST", body: payload });
  await loadRemoteConfig();
  renderMetrics();
  renderZowAdmin();
}

async function handleZowCompanyEditSubmit(event) {
  event.preventDefault();
  const companyId = event.currentTarget.dataset.companyId;
  const company = companies.find((item) => item.id === companyId);
  if (!company) return;
  const payload = {
    name: documentWindowValue("#zowEditCompanyName").trim(),
    slug: documentWindowValue("#zowEditCompanySlug").trim(),
    plan: documentWindowValue("#zowEditCompanyPlan"),
    status: documentWindowValue("#zowEditCompanyStatus"),
    maxUsers: Number(documentWindowValue("#zowEditMaxUsers")),
    maxUnits: Number(documentWindowValue("#zowEditMaxUnits")),
    storageMb: Number(documentWindowValue("#zowEditStorageMb")),
    contactName: documentWindowValue("#zowEditContactName").trim(),
    contactEmail: documentWindowValue("#zowEditContactEmail").trim(),
    contactPhone: documentWindowValue("#zowEditContactPhone").trim(),
    adminUserId: company.admin_user_id || "",
    adminUsername: normalizeUsernameInput("#zowEditAdminUsername"),
    adminPassword: documentWindowValue("#zowEditAdminPassword").trim(),
    adminName: documentWindowValue("#zowEditAdminName").trim()
  };
  await apiRequest(`/companies/${companyId}`, { method: "PATCH", body: payload });
  await loadRemoteConfig();
  renderMetrics();
  renderZowAdmin();
}

function companyStatusLabel(status) {
  const labels = {
    active: "Activo",
    suspended: "Suspendido",
    cancelled: "Cancelado"
  };
  return labels[status] || status;
}

function renderSystemCheckboxes(selected = []) {
  return saasSystems
    .map(
      (system) => `
        <label class="check-row">
          <input type="checkbox" data-system-check value="${escapeHtml(system.id)}" ${selected.includes(system.id) ? "checked" : ""} />
          ${escapeHtml(system.name)}
        </label>
      `
    )
    .join("");
}

function getCheckedValues(selector) {
  return [...document.querySelectorAll(selector)]
    .filter((item) => item.checked)
    .map((item) => item.value);
}

function renderAdmin(mode = "overview") {
  const activeUsers = users.filter((user) => user.active).length;
  const protectedUsers = users.filter((user) => user.protected).length;
  const operativeUnits = units.filter((unit) => unit.id !== "unit-admin").length;
  const modeLabels = {
    overview: "Panel de sistema",
    company: "Empresa",
    unit: "Areas",
    user: "Usuarios"
  };

  resultCount.textContent = modeLabels[mode] || modeLabels.overview;

  listEl.innerHTML = `
    <section class="setup-overview">
      <article>
        <span>Unidades operativas</span>
        <strong>${operativeUnits}</strong>
      </article>
      <article>
        <span>Usuarios activos</span>
        <strong>${activeUsers}</strong>
      </article>
      <article>
        <span>Encargados protegidos</span>
        <strong>${protectedUsers}</strong>
      </article>
    </section>

    <div class="admin-tabs" role="tablist" aria-label="Configuracion">
      <button class="${mode === "overview" ? "is-active" : ""}" type="button" data-admin-tab="overview">Resumen</button>
      <button class="${mode === "company" ? "is-active" : ""}" type="button" data-admin-tab="company">Empresa</button>
      <button class="${mode === "unit" ? "is-active" : ""}" type="button" data-admin-tab="unit">Areas</button>
      <button class="${mode === "user" ? "is-active" : ""}" type="button" data-admin-tab="user">Usuarios</button>
    </div>

    ${mode === "overview" ? renderAdminOverview(operativeUnits, activeUsers) : ""}
    ${mode === "company" ? renderCompanyPanel() : ""}
    ${mode === "unit" ? renderUnitsPanel() : ""}
    ${mode === "user" ? renderUsersPanel() : ""}
  `;

  emptyDetail.classList.add("hidden");
  detailEl.classList.add("hidden");

  document.querySelector("#adminUserForm")?.addEventListener("submit", handleAdminUserSubmit);
  document.querySelector("#adminUnitForm")?.addEventListener("submit", handleAdminUnitSubmit);
  document.querySelector("#organizationForm")?.addEventListener("submit", handleOrganizationSubmit);
  document.querySelectorAll("[data-admin-tab]").forEach((button) => {
    button.addEventListener("click", () => renderAdmin(button.dataset.adminTab));
  });
  document.querySelectorAll("[data-toggle-user]").forEach((button) => {
    button.addEventListener("click", async () => {
      const target = users.find((user) => user.id === button.dataset.toggleUser);
      if (!target || target.id === currentUser.id || target.protected) return;

      if (sessionStorage.getItem(TOKEN_KEY)) {
        await apiRequest(`/users/${target.id}/status`, {
          method: "PATCH",
          body: { active: !target.active }
        });
        await loadRemoteConfig();
      } else {
        users = users.map((user) =>
          user.id === target.id && user.id !== currentUser.id && !user.protected ? { ...user, active: !user.active } : user
        );
        persistUsers();
      }

      renderAdmin();
    });
  });
  document.querySelectorAll("[data-edit-user]").forEach((button) => {
    button.addEventListener("click", () => {
      editingUserId = button.dataset.editUser;
      renderAdmin("user");
    });
  });
  document.querySelector("#cancelUserEdit")?.addEventListener("click", () => {
    editingUserId = null;
    renderAdmin("user");
  });
}

function renderAdminOverview(operativeUnits, activeUsers) {
  return `
    <section class="setup-guide admin-start">
      <div>
        <p class="eyebrow">Sistema</p>
        <h3>Configuracion de la empresa</h3>
      </div>
      <ol>
        <li>Define el nombre de la empresa.</li>
        <li>Registra areas secundarias y sub areas.</li>
        <li>Crea usuarios, credenciales y roles por area.</li>
        <li>Entrega la operacion diaria a Recepcion y unidades.</li>
      </ol>
    </section>

    <section class="admin-action-grid">
      <button class="admin-action-card" type="button" data-admin-tab="company">
        <span>Empresa y membrete</span>
        <strong>${escapeHtml(organizationSettings.companyName || "Sin configurar")}</strong>
        <small>Solo el encargado de sistema puede editar estos datos.</small>
      </button>
      <button class="admin-action-card" type="button" data-admin-tab="unit">
        <span>Areas</span>
        <strong>${operativeUnits}</strong>
        <small>Principal, secundarias y sub areas.</small>
      </button>
      <button class="admin-action-card" type="button" data-admin-tab="user">
        <span>Usuarios</span>
        <strong>${activeUsers}</strong>
        <small>Credenciales, roles y areas asignadas.</small>
      </button>
    </section>
  `;
}

function renderCompanyPanel() {
  return `
    <section class="admin-panel organization-panel">
      <div class="admin-panel-head">
        <div>
          <p class="eyebrow">Empresa</p>
          <h3>Datos de la organizacion y membrete</h3>
          <span>Solo Encargado de sistema</span>
        </div>
      </div>
      <form class="admin-form" id="organizationForm">
        <div class="form-grid">
          <label class="span-2">
            Nombre de la empresa
            <input id="organizationName" type="text" value="${escapeHtml(organizationSettings.companyName || "")}" required />
          </label>
          <label>
            NIT / Identificacion tributaria
            <input id="organizationTaxId" type="text" value="${escapeHtml(organizationSettings.taxId || "")}" placeholder="Opcional" />
          </label>
          <label>
            Telefono institucional
            <input id="organizationPhone" type="text" value="${escapeHtml(organizationSettings.phone || "")}" placeholder="Opcional" />
          </label>
          <label class="span-2">
            Direccion
            <input id="organizationAddress" type="text" value="${escapeHtml(organizationSettings.address || "")}" placeholder="Opcional" />
          </label>
          <label class="span-2">
            Logo para hoja de control PNG
            <input id="organizationLogo" type="file" accept="image/png" />
          </label>
        </div>
        <div class="letterhead-preview">
          ${organizationSettings.logoUrl ? `<img src="${escapeHtml(organizationSettings.logoUrl)}" alt="Logo institucional" />` : `<span>Sin logo configurado</span>`}
          <div>
            <strong>${escapeHtml(organizationSettings.companyName || "Empresa sin configurar")}</strong>
            <small>${escapeHtml([organizationSettings.taxId, organizationSettings.phone, organizationSettings.address].filter(Boolean).join(" / ") || "Estos datos apareceran en la hoja de control.")}</small>
          </div>
        </div>
        <button class="primary-button" type="submit">Guardar empresa</button>
      </form>
    </section>
  `;
}

function renderUnitsPanel() {
  return `
    <section class="admin-panel">
      <div class="admin-panel-head">
        <div>
          <p class="eyebrow">Estructura</p>
          <h3>Areas organizacionales</h3>
        </div>
        <span>${units.length} registros</span>
      </div>
      <details class="admin-collapsible" open>
        <summary>Registrar nueva area</summary>
        ${renderUnitForm()}
      </details>
      <div class="admin-list">
        ${units.map(renderUnitRow).join("")}
      </div>
    </section>
  `;
}

function renderUsersPanel() {
  return `
    <section class="admin-panel">
      <div class="admin-panel-head">
        <div>
          <p class="eyebrow">Credenciales</p>
          <h3>Usuarios y permisos</h3>
        </div>
        <span>${users.length} registros</span>
      </div>
      <details class="admin-collapsible" open>
        <summary>${editingUserId ? "Editar usuario" : "Crear usuario"}</summary>
        ${renderUserForm()}
      </details>
      <div class="admin-list">
        ${users.map(renderUserRow).join("")}
      </div>
    </section>
  `;
}

async function markDocumentSeen(documentId) {
  if (!sessionStorage.getItem(TOKEN_KEY) || !["recepcion_secundaria", "funcionario", "supervisor"].includes(currentUser?.role)) return;
  if (!notifications.some((item) => item.id === documentId)) return;

  notifications = notifications.filter((item) => item.id !== documentId);
  try {
    await apiRequest(`/documents/${documentId}/seen`, { method: "PATCH" });
  } catch {
    // La seleccion del documento no debe bloquearse si falla el marcado de notificacion.
  }
}

function renderUserRow(user) {
  const unit = units.find((item) => item.id === user.unitId);
  return `
    <article class="admin-row">
      <div>
        <strong>${escapeHtml(user.name)}</strong>
        <span>${escapeHtml(user.position)} / ${escapeHtml(unit?.name ?? "Sin unidad")}</span>
        <span>CI ${escapeHtml(user.ci || "Sin CI")} / Cel. ${escapeHtml(user.phone || "Sin celular")}</span>
      </div>
      <div class="admin-row-meta">
        <span>${escapeHtml(user.username)}</span>
        <span>${roleLabel(user.role)}</span>
        <span class="${user.active ? "ok-text" : "danger-text"}">${user.active ? "Activo" : "Inactivo"}</span>
      </div>
      <button class="ghost-button" type="button" data-toggle-user="${user.id}" ${user.protected ? "disabled" : ""}>
        ${user.active ? "Desactivar" : "Activar"}
      </button>
      <button class="ghost-button" type="button" data-edit-user="${user.id}">Editar</button>
    </article>
  `;
}

function renderUnitRow(unit) {
  const unitUsers = users.filter((user) => user.unitId === unit.id);
  return `
    <article class="admin-row">
      <div>
        <strong>${escapeHtml(unit.name)}</strong>
        <span>${areaLevelLabel(unit.level)} / Codigo ${escapeHtml(unit.code)}</span>
      </div>
      <div class="admin-row-meta">
        <span>${unitUsers.length} usuario${unitUsers.length === 1 ? "" : "s"}</span>
      </div>
    </article>
  `;
}

function renderUserForm() {
  const editingUser = users.find((user) => user.id === editingUserId);
  return `
    <form class="admin-form" id="adminUserForm">
      <div class="form-grid">
        <label>
          Nombre completo
          <input id="adminUserName" type="text" value="${escapeHtml(editingUser?.name || "")}" required />
        </label>
        <label>
          Usuario
          <input id="adminUsername" type="text" value="${escapeHtml(editingUser?.username || "")}" required />
        </label>
        <label>
          CI
          <input id="adminUserCi" type="text" value="${escapeHtml(editingUser?.ci || "")}" required />
        </label>
        <label>
          Celular
          <input id="adminUserPhone" type="tel" value="${escapeHtml(editingUser?.phone || "")}" required />
        </label>
        <label>
          ${editingUser ? "Nueva contrasena opcional" : "Contrasena temporal"}
          <input id="adminPassword" type="password" autocomplete="new-password" ${editingUser ? "" : "required"} />
        </label>
        <label>
          Cargo
          <input id="adminPosition" type="text" value="${escapeHtml(editingUser?.position || "")}" required />
        </label>
        <label>
          Rol
          <select id="adminRole" ${editingUser?.protected ? "disabled" : ""}>
            <option value="recepcion_principal" ${editingUser?.role === "recepcion_principal" ? "selected" : ""}>Recepcion principal</option>
            <option value="recepcion_secundaria" ${editingUser?.role === "recepcion_secundaria" ? "selected" : ""}>Recepcion secundaria</option>
            <option value="funcionario" ${editingUser?.role === "funcionario" ? "selected" : ""}>Funcionario</option>
            <option value="supervisor" ${editingUser?.role === "supervisor" ? "selected" : ""}>Secretario / Director</option>
            <option value="ventas_admin" ${editingUser?.role === "ventas_admin" ? "selected" : ""}>Administrador ventas</option>
            <option value="cajero" ${editingUser?.role === "cajero" ? "selected" : ""}>Cajero</option>
            <option value="almacen" ${editingUser?.role === "almacen" ? "selected" : ""}>Almacen</option>
            <option value="vendedor" ${editingUser?.role === "vendedor" ? "selected" : ""}>Vendedor</option>
            ${editingUser?.role === "admin" ? `<option value="admin" selected>Encargado de sistema</option>` : ""}
          </select>
        </label>
        <label>
          Unidad
          <select id="adminUnit" ${editingUser?.protected ? "disabled" : ""}>
            ${units
              .map((unit) => `<option value="${unit.id}" ${editingUser?.unitId === unit.id ? "selected" : ""}>${escapeHtml(unit.name)}</option>`)
              .join("")}
          </select>
        </label>
      </div>
      <div class="modal-actions">
        ${editingUser ? `<button class="ghost-button" type="button" id="cancelUserEdit">Cancelar edicion</button>` : ""}
        <button class="primary-button" type="submit">${editingUser ? "Guardar cambios" : "Crear credencial"}</button>
      </div>
    </form>
  `;
}

function renderUnitForm() {
  return `
    <form class="admin-form" id="adminUnitForm">
      <div class="form-grid">
        <label>
          Nombre de unidad
          <input id="adminUnitName" type="text" required />
        </label>
        <label>
          Codigo
          <input id="adminUnitCode" type="text" required placeholder="Ej. DPLA" />
        </label>
        <label>
          Tipo de area
          <select id="adminUnitLevel">
            <option value="secundaria">Area secundaria</option>
            <option value="subarea">Sub area</option>
            <option value="principal">Area principal</option>
          </select>
        </label>
        <label>
          Depende de
          <select id="adminParentUnit">
            <option value="">Sin dependencia</option>
            ${units
              .filter((unit) => unit.id !== "unit-admin")
              .map((unit) => `<option value="${unit.id}">${escapeHtml(unit.name)}</option>`)
              .join("")}
          </select>
        </label>
      </div>
      <button class="primary-button" type="submit">Guardar unidad</button>
    </form>
  `;
}

async function handleAdminUserSubmit(event) {
  event.preventDefault();
  const username = normalizeUsernameInput("#adminUsername");
  if (users.some((user) => user.username.toLowerCase() === username && user.id !== editingUserId)) {
    alert("Ese usuario ya existe.");
    return;
  }
  const editingUser = users.find((user) => user.id === editingUserId);

  const payload = {
    name: documentWindowValue("#adminUserName").trim(),
    username,
    password: documentWindowValue("#adminPassword").trim(),
    role: editingUser?.protected ? editingUser.role : documentWindowValue("#adminRole"),
    unitId: editingUser?.protected ? editingUser.unitId : documentWindowValue("#adminUnit"),
    position: documentWindowValue("#adminPosition").trim(),
    ci: documentWindowValue("#adminUserCi").trim(),
    phone: documentWindowValue("#adminUserPhone").trim()
  };

  if (sessionStorage.getItem(TOKEN_KEY)) {
    if (editingUserId) {
      await apiRequest(`/users/${editingUserId}`, { method: "PATCH", body: payload });
    } else {
      await apiRequest("/users", { method: "POST", body: payload });
    }
    await loadRemoteConfig();
  } else {
    if (editingUserId) {
      users = users.map((user) => (user.id === editingUserId ? { ...user, ...payload } : user));
    } else {
      users = [
        ...users,
        {
          id: crypto.randomUUID(),
          ...payload,
          active: true
        }
      ];
    }
    persistUsers();
  }

  editingUserId = null;
  renderAdmin();
}

async function handleAdminUnitSubmit(event) {
  event.preventDefault();
  const payload = {
    name: documentWindowValue("#adminUnitName").trim(),
    code: documentWindowValue("#adminUnitCode").trim().toUpperCase(),
    level: documentWindowValue("#adminUnitLevel"),
    parentUnitId: documentWindowValue("#adminParentUnit")
  };

  if (sessionStorage.getItem(TOKEN_KEY)) {
    await apiRequest("/units", { method: "POST", body: payload });
    await loadRemoteConfig();
  } else {
    units = [
      ...units,
      {
        id: crypto.randomUUID(),
        ...payload
      }
    ];
    persistUnits();
  }

  renderAdmin("unit");
}

async function handleOrganizationSubmit(event) {
  event.preventDefault();
  const payload = {
    companyName: documentWindowValue("#organizationName").trim(),
    taxId: documentWindowValue("#organizationTaxId").trim(),
    phone: documentWindowValue("#organizationPhone").trim(),
    address: documentWindowValue("#organizationAddress").trim()
  };
  const logoFile = document.querySelector("#organizationLogo")?.files?.[0];

  if (sessionStorage.getItem(TOKEN_KEY)) {
    let response = await apiRequest("/settings", { method: "PATCH", body: payload });
    organizationSettings = response.settings;
    if (logoFile) {
      const formData = new FormData();
      formData.append("logo", logoFile);
      response = await apiRequest("/settings/logo", { method: "POST", body: formData });
      organizationSettings = response.settings;
    }
  } else {
    organizationSettings = { ...organizationSettings, ...payload };
  }

  renderAdmin("company");
  renderSession();
}

function renderDetail() {
  const detailPanel = document.querySelector(".detail-panel");
  if (activeView === "admin" || activeView === "zowAdmin") {
    detailPanel?.classList.add("hidden");
    emptyDetail.classList.add("hidden");
    detailEl.classList.add("hidden");
    return;
  }

  detailPanel?.classList.remove("hidden");

  const item = getSelectedDocument();
  if (!item) {
    emptyDetail.classList.remove("hidden");
    detailEl.classList.add("hidden");
    return;
  }

  emptyDetail.classList.add("hidden");
  detailEl.classList.remove("hidden");
  document.querySelector("#detailType").textContent = `${item.direction} / ${item.type}`;
  document.querySelector("#detailSubject").textContent = item.subject;
  document.querySelector("#detailCode").textContent = item.code;
  document.querySelector("#detailStatus").textContent = item.status;
  document.querySelector("#detailStatus").className = `status-pill ${statusClass(item.status)}`;
  document.querySelector("#detailOwner").textContent = item.owner;
  document.querySelector("#detailArea").textContent = item.area;
  document.querySelector("#detailDueDate").textContent = formatDate(item.dueDate);
  document.querySelector("#detailContact").textContent = `${item.sender} -> ${item.receiver}`;
  document.querySelector("#detailApplicant").textContent = item.applicantName || "Sin solicitante";
  document.querySelector("#detailApplicantContact").textContent = `${item.applicantCi || "Sin CI"} / ${item.applicantPhone || "Sin celular"}`;
  document.querySelector("#detailSheetCount").textContent = item.sheetCount ? `${item.sheetCount} hoja(s)` : "Sin registrar";
  document.querySelector("#detailReceivedAt").textContent = formatDateTime(item.receivedAt || item.createdAt);
  document.querySelector("#detailInternalNumber").textContent = item.internalNumber || "Sin CITE";
  document.querySelector("#detailReference").textContent = item.reference || "Sin referencia";
  document.querySelector("#detailAttachments").textContent = item.attachments || "Sin anexos";
  document.querySelector("#detailDigital").textContent = item.hasDigitalFile ? item.fileRef : "Pendiente de escaneo";
  const canDerive = canDeriveDocument(item);
  document.querySelectorAll("[data-action], [data-special-action], [data-derive-action]").forEach((button) => {
    let visible = true;
    let enabled = true;

    if (button.dataset.action) {
      visible = canChangeStatus(item, button.dataset.action);
      enabled = visible;
    }

    if (button.dataset.specialAction === "control") {
      visible = isReceptionPrincipal() || item.direction === "Entrante";
      enabled = visible;
    }

    if (button.dataset.specialAction === "digital") {
      visible = canAttachDigital(item);
      enabled = visible;
    }

    if (button.dataset.specialAction === "download") {
      visible = item.hasDigitalFile;
      enabled = visible;
    }

    if (button.dataset.specialAction === "physical") {
      visible = canReceivePhysical();
      enabled = visible && !item.physicalReceived;
    }

    if (button.dataset.deriveAction !== undefined) {
      visible = canDerive;
      enabled = canDerive;
    }

    button.classList.toggle("hidden", !visible);
    button.disabled = !enabled;
  });

  document.querySelector("#timeline").innerHTML = [...item.history]
    .reverse()
    .map(
      (entry) => `
        <div class="timeline-item">
          <strong>${entry.status} / ${escapeHtml(entry.owner)}</strong>
          <span>${formatDateTime(entry.date)}</span>
          <span>${escapeHtml(entry.comment)}</span>
        </div>
      `
    )
    .join("");

  if (sessionStorage.getItem(TOKEN_KEY) && movementCache[item.id] === undefined) {
    movementCache[item.id] = null;
    apiRequest(`/documents/${item.id}/movements`)
      .then((response) => {
        movementCache[item.id] = response.movements.map(normalizeApiMovement);
        if (selectedId === item.id) {
          const selected = getSelectedDocument();
          if (selected) selected.history = movementCache[item.id];
          renderDetail();
        }
      })
      .catch(() => {
        movementCache[item.id] = [];
      });
  }
}

function printControlSheet(item) {
  const unit = units.find((unitItem) => unitItem.id === item.currentUnitId);
  const printable = window.open("", "_blank", "width=900,height=720");
  if (!printable) return;
  const companyDetails = [
    organizationSettings.taxId ? `NIT/ID: ${organizationSettings.taxId}` : "",
    organizationSettings.phone ? `Tel.: ${organizationSettings.phone}` : "",
    organizationSettings.address || ""
  ].filter(Boolean);
  const logoMarkup = organizationSettings.logoUrl
    ? `<img class="company-logo" src="${escapeHtml(organizationSettings.logoUrl)}" alt="Logo institucional" />`
    : `<div class="logo-placeholder">Logo</div>`;

  printable.document.write(`
    <!doctype html>
    <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <title>Hoja de control ${escapeHtml(item.code)}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #17262b; padding: 30px; }
          h1 { margin: 0 0 4px; font-size: 22px; }
          h2 { margin: 24px 0 10px; font-size: 16px; text-transform: uppercase; }
          .head { display: grid; grid-template-columns: 96px 1fr auto; align-items: center; gap: 18px; border-bottom: 2px solid #17262b; padding-bottom: 16px; }
          .company-logo { width: 86px; max-height: 86px; object-fit: contain; }
          .logo-placeholder { width: 84px; height: 84px; display: grid; place-items: center; border: 1px dashed #8aa0a6; color: #6b7f85; font-size: 12px; }
          .company-meta { display: grid; gap: 3px; color: #52676d; font-size: 12px; line-height: 1.35; }
          .system-label { margin-top: 6px; color: #17262b; font-weight: 700; }
          .code { border: 2px solid #17262b; padding: 12px 18px; font-size: 20px; font-weight: 800; text-align: center; }
          .code span { display: block; margin-bottom: 4px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #52676d; }
          table { width: 100%; border-collapse: collapse; margin-top: 14px; }
          th, td { border: 1px solid #8aa0a6; padding: 10px; text-align: left; vertical-align: top; }
          th { width: 190px; background: #eef4f5; }
          .control-note { margin-top: 18px; padding: 10px 12px; border-left: 4px solid #17262b; background: #f4f8f8; font-size: 12px; color: #52676d; }
          .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 36px; margin-top: 56px; }
          .signature { border-top: 1px solid #17262b; padding-top: 8px; text-align: center; }
          @media print { button { display: none; } body { padding: 12px; } }
        </style>
      </head>
      <body>
        <button onclick="window.print()">Imprimir</button>
        <section class="head">
          ${logoMarkup}
          <div>
            <h1>${escapeHtml(organizationSettings.companyName || "Empresa sin configurar")}</h1>
            <div class="company-meta">
              ${companyDetails.map((detail) => `<span>${escapeHtml(detail)}</span>`).join("")}
              <span class="system-label">Correspondencia ZOW / Hoja de control documental</span>
            </div>
          </div>
          <div class="code"><span>Codigo de control</span>${escapeHtml(item.code)}</div>
        </section>

        <h2>Datos de recepcion</h2>
        <table>
          <tr><th>Fecha de registro</th><td>${formatDateTime(item.createdAt)}</td></tr>
          <tr><th>Fecha/hora recepcion</th><td>${formatDateTime(item.receivedAt || item.createdAt)}</td></tr>
          <tr><th>Solicitante</th><td>${escapeHtml(item.applicantName || "Sin solicitante")}</td></tr>
          <tr><th>CI</th><td>${escapeHtml(item.applicantCi || "Sin CI")}</td></tr>
          <tr><th>Celular</th><td>${escapeHtml(item.applicantPhone || "Sin celular")}</td></tr>
          <tr><th>Cantidad de hojas</th><td>${escapeHtml(String(item.sheetCount || "Sin registrar"))}</td></tr>
          <tr><th>Tipo</th><td>${escapeHtml(item.direction)} / ${escapeHtml(item.type)}</td></tr>
          <tr><th>Nro. comunicacion / CITE</th><td>${escapeHtml(item.internalNumber || "Sin CITE")}</td></tr>
          <tr><th>Referencia</th><td>${escapeHtml(item.reference || "Sin referencia")}</td></tr>
          <tr><th>Asunto</th><td>${escapeHtml(item.subject)}</td></tr>
          <tr><th>Remitente</th><td>${escapeHtml(item.sender)}</td></tr>
          <tr><th>Destinatario</th><td>${escapeHtml(item.receiver)}</td></tr>
          <tr><th>Area actual</th><td>${escapeHtml(unit?.name || item.area)}</td></tr>
          <tr><th>Estado</th><td>${escapeHtml(item.status)}</td></tr>
          <tr><th>Prioridad</th><td>${escapeHtml(item.priority)}</td></tr>
          <tr><th>Archivo digital</th><td>${escapeHtml(item.hasDigitalFile ? item.fileRef : "Pendiente de escaneo")}</td></tr>
          <tr><th>Anexos</th><td>${escapeHtml(item.attachments || "Sin anexos")}</td></tr>
        </table>

        <div class="control-note">
          Esta hoja acompana la carpeta fisica y permite consultar el estado digital mediante el codigo de control.
        </div>

        <div class="signatures">
          <div class="signature">Recepcion</div>
          <div class="signature">Unidad destinataria</div>
        </div>
      </body>
    </html>
  `);
  printable.document.close();
  printable.focus();
}

function statusClass(status) {
  return status.toLowerCase().replace(/\s+/g, "-");
}

function formatDate(date) {
  return new Intl.DateTimeFormat("es-BO", { day: "2-digit", month: "short", year: "numeric" }).format(
    new Date(`${date}T00:00:00`)
  );
}

function formatDateTime(date) {
  return new Intl.DateTimeFormat("es-BO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(date));
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return entities[char];
  });
}

const buttonIcons = {
  ingresar: "login",
  salir: "logout",
  guardar: "save",
  crear: "plus",
  nueva: "plus",
  nuevo: "plus",
  editar: "edit",
  sistemas: "grid",
  suspender: "pause",
  activar: "check",
  volver: "back",
  cancelar: "close",
  imprimir: "print",
  registrar: "send",
  derivar: "send",
  adjuntar: "clip",
  descargar: "download",
  buscar: "search"
};

const iconPaths = {
  login: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
  pause: '<path d="M8 5v14"/><path d="M16 5v14"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  back: '<path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>',
  close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  print: '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/>',
  send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  clip: '<path d="m21.4 11.6-8.5 8.5a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 1 1-2.8-2.8l8.5-8.5"/>',
  download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>'
};

function enhanceInterface() {
  decorateButtons();
  animatePanels();
}

function decorateButtons() {
  document.querySelectorAll("button").forEach((button) => {
    if (!button.dataset.iconified) {
      const iconName = resolveButtonIcon(button);
      if (iconName && iconPaths[iconName]) {
        button.insertAdjacentHTML("afterbegin", `<span class="button-icon" aria-hidden="true"><svg viewBox="0 0 24 24">${iconPaths[iconName]}</svg></span>`);
      }
      button.dataset.iconified = "true";
    }
    if (!button.dataset.fxBound) {
      button.addEventListener("pointerdown", createButtonRipple);
      button.dataset.fxBound = "true";
    }
  });
}

function resolveButtonIcon(button) {
  if (button.classList.contains("icon-button")) return "";
  const action = `${button.dataset.specialAction || ""} ${button.dataset.action || ""} ${button.dataset.companyStatus || ""}`.toLowerCase();
  if (action.includes("download")) return "download";
  if (action.includes("digital")) return "clip";
  if (action.includes("control")) return "print";
  if (action.includes("archivado") || action.includes("atendido") || action.includes("active")) return "check";
  if (action.includes("suspended")) return "pause";
  const text = button.textContent.trim().toLowerCase();
  const key = Object.keys(buttonIcons).find((item) => text.includes(item));
  return key ? buttonIcons[key] : "";
}

function createButtonRipple(event) {
  const button = event.currentTarget;
  if (button.disabled || button.classList.contains("icon-button")) return;
  const rect = button.getBoundingClientRect();
  const ripple = document.createElement("span");
  ripple.className = "button-ripple";
  ripple.style.left = `${event.clientX - rect.left}px`;
  ripple.style.top = `${event.clientY - rect.top}px`;
  button.appendChild(ripple);
  ripple.addEventListener("animationend", () => ripple.remove(), { once: true });
}

function animatePanels() {
  document.querySelectorAll(".admin-panel, .doc-card, .setup-overview article, .cloud-safe-note").forEach((item, index) => {
    item.style.setProperty("--stagger", `${Math.min(index, 8) * 28}ms`);
    item.classList.add("surface-enter");
  });
}

render();
