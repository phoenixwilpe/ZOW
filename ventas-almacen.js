const API_BASE_URL = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
  ? "http://localhost:4174/api"
  : "/api";
const TOKEN_KEY = "zowVentasAlmacen.token";
const SESSION_KEY = "zowVentasAlmacen.session";
const SUSPENDED_SALES_KEY = "zowVentasAlmacen.suspendedSales";
const LOCAL_SALE_META_KEY = "zowVentasAlmacen.saleMeta";
const FAVORITE_PRODUCTS_KEY = "zowVentasAlmacen.favoriteProducts";
const POS_FOCUS_KEY = "zowVentasAlmacen.posFocus";

/**
 * @typedef {{ id:string, code:string, barcode?:string, name:string, category:string, stock:number, sale_price:number, cost_price:number }} Product
 * @typedef {{ productId:string, name:string, quantity:number, salePrice:number, discount:number }} CartItem
 * @typedef {{ id:string, openedAt:string, openedBy:string, openingAmount:number, status:"abierta"|"cerrada" }} CashSession
 * @typedef {{ id:string, type:"ingreso"|"egreso", amount:number, reason:string, createdAt:string, user:string }} CashMovement
 * @typedef {{ method:"efectivo"|"tarjeta"|"transferencia"|"qr"|"mixto", received:number, split?:Record<string, number> }} PaymentDraft
 */

let currentUser = loadSession();
let activeView = "sell";
let products = [];
let customers = [];
let categories = [];
let sales = [];
let users = [];
let units = [];
let suppliers = [];
let purchases = [];
let receivables = [];
let promotions = [];
let combos = [];
let auditEvents = [];
let profitReport = { rows: [], totals: {} };
let cash = { pendingSales: [], total: 0 };
let summary = {};
let saleCart = [];
let posMobilePanel = "products";
let lastSaleReceipt = null;
let editingUserId = "";
let editingProductId = "";
let editingCustomerId = "";
let editingPromotionId = "";
let editingComboId = "";
let productSearch = "";
let productCategoryFilter = "";
let productSearchTimer = 0;
let ventasMessage = "";
let posFeedbackMessage = "";
let posFeedbackTargetId = "";
let posFeedbackTimer = 0;
let historySearchTimer = 0;
let paymentDraft = { method: "efectivo", received: 0, split: { efectivo: 0, tarjeta: 0, transferencia: 0, qr: 0 } };
let saleCustomerId = "";
let saleGlobalDiscount = 0;
let saleNote = "";
let suspendedSales = loadJson(SUSPENDED_SALES_KEY, []);
let cashSession = null;
let cashMovements = [];
let cashClosures = [];
let selectedKardex = null;
let localSaleMeta = loadJson(LOCAL_SALE_META_KEY, {});
let favoriteProducts = loadJson(FAVORITE_PRODUCTS_KEY, []);
let posFocusMode = localStorage.getItem(POS_FOCUS_KEY) === "1";
let historyFilter = { status: "", method: "", date: "", q: "" };
let storeSettings = {
  companyName: "",
  storeName: "",
  currency: "BOB",
  taxId: "",
  phone: "",
  address: "",
  ticketNote: "",
  cashRegisterCount: 1,
  taxRate: 0,
  allowCredit: true,
  allowDiscounts: true,
  requireCustomerForSale: false
};
let stockMovementDraft = { productId: "", type: "entrada" };
let receivablePaymentDraft = { saleId: "" };
let reportFilter = { from: "", to: "" };
let voidSaleDraft = { saleId: "" };
let purchaseCart = [];
let notificationsOpen = false;

const starterProducts = [
  { code: "AB-001", name: "Agua mineral 600 ml", category: "Bebidas", unit: "Botella", costPrice: 2.1, salePrice: 4, minStock: 24, stock: 96 },
  { code: "REF-002", name: "Refresco cola 2 L", category: "Bebidas", unit: "Botella", costPrice: 8.5, salePrice: 13, minStock: 12, stock: 36 },
  { code: "ARR-003", name: "Arroz grano largo 1 kg", category: "Abarrotes", unit: "Bolsa", costPrice: 6.2, salePrice: 9, minStock: 20, stock: 60 },
  { code: "AZ-004", name: "Azucar blanca 1 kg", category: "Abarrotes", unit: "Bolsa", costPrice: 5.8, salePrice: 8.5, minStock: 20, stock: 50 },
  { code: "ACE-005", name: "Aceite vegetal 900 ml", category: "Abarrotes", unit: "Botella", costPrice: 11.5, salePrice: 16, minStock: 10, stock: 30 },
  { code: "DET-006", name: "Detergente en polvo 800 g", category: "Limpieza", unit: "Bolsa", costPrice: 10, salePrice: 15, minStock: 8, stock: 24 },
  { code: "PAN-007", name: "Pan molde familiar", category: "Panaderia", unit: "Unidad", costPrice: 7, salePrice: 11, minStock: 8, stock: 20 },
  { code: "CAF-008", name: "Cafe instantaneo 170 g", category: "Abarrotes", unit: "Frasco", costPrice: 18, salePrice: 26, minStock: 6, stock: 18 },
  { code: "LEC-009", name: "Leche entera 1 L", category: "Lacteos", unit: "Caja", costPrice: 5.7, salePrice: 8, minStock: 18, stock: 48 },
  { code: "GAL-010", name: "Galletas surtidas 400 g", category: "Snacks", unit: "Paquete", costPrice: 8, salePrice: 12, minStock: 12, stock: 32 }
];

const loginScreen = document.querySelector("#loginScreen");
const appShell = document.querySelector("#appShell");
const loginForm = document.querySelector("#loginForm");
const loginError = document.querySelector("#loginError");
const productModal = document.querySelector("#productModal");
const productForm = document.querySelector("#productForm");
const customerModal = document.querySelector("#customerModal");
const customerForm = document.querySelector("#customerForm");
const categoryModal = document.querySelector("#categoryModal");
const categoryForm = document.querySelector("#categoryForm");
const stockMovementModal = document.querySelector("#stockMovementModal");
const stockMovementForm = document.querySelector("#stockMovementForm");
const receivablePaymentModal = document.querySelector("#receivablePaymentModal");
const receivablePaymentForm = document.querySelector("#receivablePaymentForm");
const voidSaleModal = document.querySelector("#voidSaleModal");
const voidSaleForm = document.querySelector("#voidSaleForm");
const paymentModal = document.querySelector("#paymentModal");
const paymentForm = document.querySelector("#paymentForm");
const paymentModalContent = document.querySelector("#paymentModalContent");
const saleDetailModal = document.querySelector("#saleDetailModal");
const saleDetailTitle = document.querySelector("#saleDetailTitle");
const saleDetailContent = document.querySelector("#saleDetailContent");
const ventasMenuToggle = document.querySelector("#ventasMenuToggle");
const installVentasAppButton = document.querySelector("#installVentasApp");
const ventasNotificationButton = document.querySelector("#ventasNotificationBtn");
const posFocusToggle = document.querySelector("#posFocusToggle");
const ventasLoginScene = document.querySelector(".advanced-sales-scene");
let ventasLoginSceneFrame = 0;
let ventasInstallPrompt = null;

ventasLoginScene?.addEventListener("pointermove", (event) => {
  if (ventasLoginSceneFrame) return;
  ventasLoginSceneFrame = requestAnimationFrame(() => {
    const rect = ventasLoginScene.getBoundingClientRect();
    const tiltY = ((event.clientX - rect.left) / rect.width - 0.5) * 14;
    const tiltX = ((event.clientY - rect.top) / rect.height - 0.5) * -12;
    ventasLoginScene.style.setProperty("--scene-tilt-x", `${tiltX}deg`);
    ventasLoginScene.style.setProperty("--scene-tilt-y", `${tiltY}deg`);
    ventasLoginSceneFrame = 0;
  });
});

ventasLoginScene?.addEventListener("pointerleave", () => {
  ventasLoginScene.style.removeProperty("--scene-tilt-x");
  ventasLoginScene.style.removeProperty("--scene-tilt-y");
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const session = await apiRequest("/auth/login", {
      method: "POST",
      auth: false,
      body: { username: value("#loginUsername").trim(), password: value("#loginPassword") }
    });
    currentUser = session.user;
    sessionStorage.setItem(TOKEN_KEY, session.token);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(currentUser));
    await assertVentasAccess();
    loginForm.reset();
    loginError.textContent = "";
    await render();
  } catch (error) {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    currentUser = null;
    loginError.textContent = error.message || "No se pudo iniciar sesion.";
  }
});

document.querySelector("#logoutBtn").addEventListener("click", () => {
  currentUser = null;
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  renderLoggedOut();
});

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => {
    if (!canAccessView(button.dataset.view)) return;
    activeView = button.dataset.view;
    closeVentasMenu();
    renderMain();
  });
});

ventasMenuToggle?.addEventListener("click", () => {
  const isOpen = appShell.classList.toggle("ventas-menu-open");
  ventasMenuToggle.setAttribute("aria-expanded", String(isOpen));
});

ventasNotificationButton?.addEventListener("click", () => {
  notificationsOpen = !notificationsOpen;
  ventasNotificationButton.setAttribute("aria-expanded", String(notificationsOpen));
  renderMain();
});

posFocusToggle?.addEventListener("click", () => {
  posFocusMode = !posFocusMode;
  localStorage.setItem(POS_FOCUS_KEY, posFocusMode ? "1" : "0");
  closeVentasMenu();
  renderMain();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/ventas-sw.js").catch(() => {});
  });
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  ventasInstallPrompt = event;
  installVentasAppButton?.classList.remove("hidden");
});

installVentasAppButton?.addEventListener("click", async () => {
  if (!ventasInstallPrompt) return;
  ventasInstallPrompt.prompt();
  await ventasInstallPrompt.userChoice.catch(() => null);
  ventasInstallPrompt = null;
  installVentasAppButton.classList.add("hidden");
});

window.addEventListener("appinstalled", () => {
  ventasInstallPrompt = null;
  installVentasAppButton?.classList.add("hidden");
});

document.querySelector("#showProductForm").addEventListener("click", openProductModal);
document.querySelector("#closeProductModal").addEventListener("click", () => productModal.close());
document.querySelector("#cancelProductModal").addEventListener("click", () => productModal.close());
document.querySelector("#closeCustomerModal").addEventListener("click", () => customerModal.close());
document.querySelector("#cancelCustomerModal").addEventListener("click", () => customerModal.close());
document.querySelector("#closeCategoryModal").addEventListener("click", () => categoryModal.close());
document.querySelector("#cancelCategoryModal").addEventListener("click", () => categoryModal.close());
document.querySelector("#closeStockMovementModal").addEventListener("click", () => stockMovementModal.close());
document.querySelector("#cancelStockMovementModal").addEventListener("click", () => stockMovementModal.close());
document.querySelector("#closeReceivablePaymentModal").addEventListener("click", () => receivablePaymentModal.close());
document.querySelector("#cancelReceivablePaymentModal").addEventListener("click", () => receivablePaymentModal.close());
document.querySelector("#closeVoidSaleModal").addEventListener("click", () => voidSaleModal.close());
document.querySelector("#cancelVoidSaleModal").addEventListener("click", () => voidSaleModal.close());
document.querySelector("#closePaymentModal").addEventListener("click", () => paymentModal.close());
document.querySelector("#closeSaleDetailModal").addEventListener("click", () => saleDetailModal.close());

document.addEventListener("keydown", (event) => {
  if (!currentUser || activeView !== "sell") return;
  if (event.key === "F2") {
    event.preventDefault();
    document.querySelector("#productSearchInput")?.focus();
  }
  if (event.key === "F4") {
    event.preventDefault();
    openPaymentModal();
  }
  if (event.key === "Escape" && saleCart.length && confirm("Cancelar la venta actual?")) {
    cancelCurrentSale();
  }
});

productForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const productPayload = {
    code: value("#productCode"),
    barcode: value("#productBarcode"),
    name: value("#productName"),
    category: value("#productCategory"),
    unit: value("#productUnit"),
    batchNumber: value("#productBatch"),
    expiresAt: value("#productExpiry"),
    costPrice: Number(value("#productCost")),
    salePrice: Number(value("#productSale")),
    minStock: Number(value("#productMin"))
  };
  if (!editingProductId) productPayload.stock = Number(value("#productStock"));
  const validation = validateProductPayload(productPayload, Boolean(editingProductId));
  if (validation) {
    ventasMessage = validation;
    productModal.close();
    return renderMain();
  }
  try {
    await apiRequest(editingProductId ? `/ventas/products/${editingProductId}` : "/ventas/products", {
      method: editingProductId ? "PATCH" : "POST",
      body: productPayload
    });
    ventasMessage = editingProductId ? "Producto actualizado correctamente." : "Producto registrado correctamente.";
    editingProductId = "";
    productModal.close();
    await render();
  } catch (error) {
    ventasMessage = error.message || "No se pudo guardar el producto.";
    productModal.close();
    renderMain();
  }
});

productModal.addEventListener("close", () => {
  editingProductId = "";
});

customerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = {
    name: value("#customerName"),
    phone: value("#customerPhone"),
    ci: value("#customerCi"),
    email: value("#customerEmail"),
    address: value("#customerAddress"),
    status: value("#customerStatus"),
    creditLimit: Number(value("#customerCreditLimit") || 0)
  };
  await apiRequest(editingCustomerId ? `/ventas/customers/${editingCustomerId}` : "/ventas/customers", {
    method: editingCustomerId ? "PATCH" : "POST",
    body: payload
  });
  editingCustomerId = "";
  customerModal.close();
  await render();
});

customerModal.addEventListener("close", () => {
  editingCustomerId = "";
});

categoryForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await apiRequest("/ventas/categories", {
    method: "POST",
    body: { name: value("#categoryName"), description: value("#categoryDescription") }
  });
  categoryModal.close();
  await render();
});

stockMovementForm.addEventListener("submit", saveStockMovement);
document.querySelector("#stockMovementType")?.addEventListener("change", () => updateStockMovementLabels());
receivablePaymentForm.addEventListener("submit", saveReceivablePayment);
voidSaleForm.addEventListener("submit", submitVoidSale);

render();

async function render() {
  if (!currentUser || !sessionStorage.getItem(TOKEN_KEY)) return renderLoggedOut();
  try {
    await assertVentasAccess();
    const canReadPurchases = canAccessView("purchases");
    const [settingsResponse, summaryResponse, productsResponse, customersResponse, categoriesResponse, salesResponse, cashResponse, cashHistoryResponse, suppliersResponse, purchasesResponse, receivablesResponse, promotionsResponse, combosResponse, auditResponse, profitResponse, suspendedResponse, favoritesResponse, usersResponse, unitsResponse] = await Promise.all([
      apiRequest("/ventas/settings"),
      apiRequest("/ventas/summary"),
      apiRequest("/ventas/products"),
      apiRequest("/ventas/customers"),
      apiRequest("/ventas/categories"),
      apiRequest("/ventas/sales"),
      apiRequest("/ventas/cash"),
      canAccessView("finance") ? apiRequest("/ventas/cash/history") : Promise.resolve({ closures: [] }),
      canReadPurchases ? apiRequest("/ventas/suppliers") : Promise.resolve({ suppliers: [] }),
      canReadPurchases ? apiRequest("/ventas/purchases") : Promise.resolve({ purchases: [] }),
      canAccessView("customers") ? apiRequest("/ventas/receivables") : Promise.resolve({ receivables: [] }),
      canAccessView("promotions") || canAccessView("sell") ? apiRequest("/ventas/promotions") : Promise.resolve({ promotions: [] }),
      canAccessView("promotions") || canAccessView("sell") ? apiRequest("/ventas/combos") : Promise.resolve({ combos: [] }),
      canAccessView("reports") ? apiRequest("/ventas/audit") : Promise.resolve({ events: [] }),
      canAccessView("reports") ? apiRequest(`/ventas/reports/profit${profitReportQuery()}`) : Promise.resolve({ rows: [], totals: {} }),
      apiRequest("/ventas/suspended-sales").catch(() => ({ sales: suspendedSales })),
      apiRequest("/ventas/favorites").catch(() => ({ favorites: favoriteProducts })),
      currentUser?.role === "admin" ? apiRequest("/users") : Promise.resolve({ users: [] }),
      currentUser?.role === "admin" ? apiRequest("/units") : Promise.resolve({ units: [] })
    ]);
    storeSettings = settingsResponse.settings || storeSettings;
    summary = summaryResponse.summary || {};
    products = productsResponse.products || [];
    customers = customersResponse.customers || [];
    categories = categoriesResponse.categories || [];
    sales = salesResponse.sales || [];
    suppliers = suppliersResponse.suppliers || [];
    purchases = purchasesResponse.purchases || [];
    receivables = receivablesResponse.receivables || [];
    promotions = (promotionsResponse.promotions || []).map(normalizePromotion);
    combos = (combosResponse.combos || []).map(normalizeCombo);
    auditEvents = auditResponse.events || [];
    profitReport = { rows: profitResponse.rows || [], totals: profitResponse.totals || {} };
    const localSuspended = loadJson(SUSPENDED_SALES_KEY, []).map((sale) => normalizeSuspendedSale({ ...sale, localOnly: true }));
    suspendedSales = [...(suspendedResponse.sales || []).map(normalizeSuspendedSale), ...localSuspended].slice(0, 30);
    favoriteProducts = Array.isArray(favoritesResponse.favorites) ? favoritesResponse.favorites : favoriteProducts;
    users = (usersResponse.users || []).map(normalizeUser);
    units = (unitsResponse.units || []).map(normalizeUnit);
    cash = cashResponse || { pendingSales: [], total: 0 };
    cashSession = normalizeCashSession(cash.activeSession);
    cashMovements = (cash.movements || []).map(normalizeCashMovement);
    cashClosures = (cashHistoryResponse.closures || []).map(normalizeCashClosure);
    renderLoggedIn();
  } catch (error) {
    renderLoggedOut();
    loginError.textContent = error.message || "No tienes acceso a Zow Ventas-Almacen.";
  }
}

function renderLoggedOut() {
  loginScreen.classList.remove("hidden");
  appShell.classList.add("hidden");
}

function renderLoggedIn() {
  loginScreen.classList.add("hidden");
  appShell.classList.remove("hidden");
  if (!canAccessView(activeView)) activeView = defaultViewForRole();
  document.querySelector("#companyLabel").textContent = storeSettings.storeName || storeSettings.companyName || currentUser.companyName || "Empresa";
  document.querySelector("#currentUserBadge").textContent = `${currentUser.name} / ${roleLabel(currentUser.role)}`;
  document.querySelector("#productsMetric").textContent = summary.products || 0;
  document.querySelector("#stockMetric").textContent = Number(summary.stock || 0).toLocaleString("es-BO");
  document.querySelector("#valueMetric").textContent = money(summary.inventory_value || 0);
  document.querySelector("#lowStockMetric").textContent = summary.low_stock || 0;
  updateNotificationButton();
  renderMain();
}

function renderMain() {
  if (!canAccessView(activeView)) activeView = defaultViewForRole();
  appShell.dataset.activeView = activeView;
  appShell.classList.toggle("pos-focus-mode", activeView === "sell" && posFocusMode);
  if (posFocusToggle) {
    posFocusToggle.hidden = activeView !== "sell";
    posFocusToggle.textContent = posFocusMode ? "Salir modo caja" : "Modo caja";
    posFocusToggle.classList.toggle("is-active", activeView === "sell" && posFocusMode);
  }
  document.querySelectorAll("[data-view]").forEach((button) => {
    const allowed = canAccessView(button.dataset.view);
    button.hidden = !allowed;
    button.classList.toggle("is-active", allowed && button.dataset.view === activeView);
  });
  const titles = {
    summary: ["Resumen", "Dashboard del negocio"],
    alerts: ["Alertas", "Productos sin stock o bajo minimo"],
    sell: ["Vender", "Registrar venta y emitir ticket"],
    finance: ["Finanzas", "Ventas y caja"],
    history: ["Historial", "Operaciones del turno"],
    routes: ["Rutas", "Venta en ruta y despacho"],
    promotions: ["Promociones", "Lista de precios y ofertas"],
    reports: ["Reportes", "Auditoria comercial"],
    catalog: ["Catalogos", "Articulos y categorias"],
    customers: ["Clientes", "Base de clientes"],
    inventory: ["Inventario", "Stock y reabastecimiento"],
    purchases: ["Compras", "Proveedores y entradas de mercaderia"],
    users: ["Usuarios", "Credenciales y roles de Ventas-Almacen"],
    settings: ["Configuracion", "Tienda, moneda y datos de impresion"]
  };
  document.querySelector("#viewEyebrow").textContent = titles[activeView][0];
  document.querySelector("#viewTitle").textContent = titles[activeView][1];
  document.querySelector("#ventasMenuLabel").textContent = document.querySelector(`[data-view="${activeView}"]`)?.textContent || titles[activeView][0];
  renderWorkflow();
  const renderers = { summary: renderSummary, alerts: renderAlerts, sell: renderSell, finance: renderFinance, history: renderHistory, routes: renderRoutes, promotions: renderPromotions, reports: renderReports, catalog: renderCatalog, customers: renderCustomers, inventory: renderInventory, purchases: renderPurchases, users: renderUsers, settings: renderSettings };
  renderers[activeView]();
  if (notificationsOpen) {
    mainList().insertAdjacentHTML("afterbegin", renderNotificationCenter());
    bindNotificationCenter();
  }
  document.querySelectorAll("[data-module-view]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!canAccessView(button.dataset.moduleView)) return;
      activeView = button.dataset.moduleView;
      renderMain();
    });
  });
}

function updateNotificationButton() {
  const count = buildOperationalNotifications().length;
  document.querySelector("#ventasNotificationCount").textContent = count;
  ventasNotificationButton?.classList.toggle("has-alerts", count > 0);
  ventasNotificationButton?.setAttribute("aria-label", `${count} avisos operativos`);
}

function buildOperationalNotifications() {
  const notices = [];
  const lowStock = products.filter((product) => isProductActive(product) && Number(product.stock || 0) > 0 && Number(product.stock || 0) <= Number(product.min_stock || 0));
  const outOfStock = products.filter((product) => isProductActive(product) && Number(product.stock || 0) <= 0);
  const expired = products.filter((product) => isProductActive(product) && expiryStatus(product).level === "danger");
  const expiring = products.filter((product) => isProductActive(product) && expiryStatus(product).level === "warning");
  if (cashSession?.status === "abierta") {
    notices.push({ level: "info", title: `Caja ${num(cashSession.registerNumber)} abierta`, detail: `Esperado actual ${money(cashExpectedTotal())}. Cierra caja al terminar turno.`, view: "finance" });
  }
  if ((cash.pendingSales?.length || 0) > 0) {
    notices.push({ level: "warning", title: `${num(cash.pendingSales.length)} venta(s) sin cierre`, detail: `Monto pendiente de cierre ${money(cash.total || 0)}.`, view: "finance" });
  }
  if (outOfStock.length) {
    notices.push({ level: "danger", title: `${num(outOfStock.length)} producto(s) sin stock`, detail: outOfStock.slice(0, 3).map((item) => item.name).join(", "), view: "alerts" });
  }
  if (lowStock.length) {
    notices.push({ level: "warning", title: `${num(lowStock.length)} producto(s) bajo minimo`, detail: lowStock.slice(0, 3).map((item) => item.name).join(", "), view: "alerts" });
  }
  if (expired.length) {
    notices.push({ level: "danger", title: `${num(expired.length)} producto(s) vencido(s)`, detail: expired.slice(0, 3).map((item) => item.name).join(", "), view: "inventory" });
  }
  if (expiring.length) {
    notices.push({ level: "warning", title: `${num(expiring.length)} producto(s) por vencer`, detail: expiring.slice(0, 3).map((item) => item.name).join(", "), view: "inventory" });
  }
  if (receivables.length) {
    const debt = receivables.reduce((sum, sale) => sum + Number(sale.balance_due || 0), 0);
    notices.push({ level: "info", title: `${num(receivables.length)} cuenta(s) por cobrar`, detail: `Saldo pendiente ${money(debt)}.`, view: "customers" });
  }
  const sensitiveEvent = auditEvents.find((event) => ["sale_void", "sale_return", "cash_close", "product_import"].includes(event.action));
  if (sensitiveEvent) {
    notices.push({ level: "info", title: auditActionLabel(sensitiveEvent.action), detail: sensitiveEvent.description || "Accion sensible registrada.", view: "reports" });
  }
  return notices;
}

function renderNotificationCenter() {
  const notices = buildOperationalNotifications();
  return `<section class="admin-panel ventas-notification-panel">
    <div class="admin-panel-head">
      <div><p class="eyebrow">Centro de avisos</p><h3>Alertas internas del sistema</h3></div>
      <button class="ghost-button" type="button" id="closeVentasNotifications">Cerrar</button>
    </div>
    <div class="ventas-notification-grid">
      ${notices.map(renderOperationalNotification).join("") || empty("Sin avisos pendientes para este rol")}
    </div>
  </section>`;
}

function renderOperationalNotification(notice) {
  return `<article class="ventas-notification-card is-${notice.level}">
    <div><strong>${escapeHtml(notice.title)}</strong><span>${escapeHtml(notice.detail || "Revisa el modulo correspondiente.")}</span></div>
    ${canAccessView(notice.view) ? `<button class="ghost-button" type="button" data-notification-view="${notice.view}">Revisar</button>` : ""}
  </article>`;
}

function bindNotificationCenter() {
  document.querySelector("#closeVentasNotifications")?.addEventListener("click", () => {
    notificationsOpen = false;
    ventasNotificationButton?.setAttribute("aria-expanded", "false");
    renderMain();
  });
  document.querySelectorAll("[data-notification-view]").forEach((button) => {
    button.addEventListener("click", () => {
      notificationsOpen = false;
      activeView = button.dataset.notificationView;
      ventasNotificationButton?.setAttribute("aria-expanded", "false");
      renderMain();
    });
  });
}

function renderWorkflow() {
  const panel = document.querySelector("#workflowPanel");
  const actions = {
    summary: [`<strong>Resumen operativo</strong><span>Consulta ventas, ingresos, productos y alertas de stock.</span>`, ""],
    alerts: [`<strong>Alertas de stock</strong><span>Repone productos agotados o por debajo del minimo.</span>`, ""],
    sell: [`<strong>Nueva venta</strong><span>Productos, cliente, descuento y cobro en un solo flujo.</span>`, ""],
    finance: [`<strong>Caja</strong><span>Controla ventas pendientes de cierre y procesa cortes.</span>`, can("closeCash") ? `<button class="primary-button" type="button" id="closeCashBtn">Procesar caja</button>` : ""],
    history: [`<strong>Historial del turno</strong><span>Consulta, reimprime o marca operaciones anuladas.</span>`, ""],
    routes: [`<strong>Operacion en ruta</strong><span>Organiza clientes, entrega, despacho y seguimiento de vendedores.</span>`, ""],
    promotions: [`<strong>Politica comercial</strong><span>Prepara listas de precios, paquetes y promociones por temporada.</span>`, ""],
    reports: [`<strong>Auditoria comercial</strong><span>Revisa ventas, caja, inventario critico y valor de almacen.</span>`, ""],
    catalog: [`<strong>Catalogos</strong><span>Administra articulos y categorias.</span>`, can("manageCatalog") ? `<button class="ghost-button" type="button" id="downloadProductTemplate">Plantilla Excel/CSV</button><label class="ghost-button file-action">Importar Excel/CSV<input id="importProductsFile" type="file" accept=".csv,text/csv,.xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" /></label><button class="ghost-button" type="button" id="newCategoryBtn">Nueva categoria</button><button class="primary-button" type="button" id="newProductBtn">Nuevo producto</button>` : ""],
    customers: [`<strong>Clientes</strong><span>Registra compradores frecuentes para ventas y tienda virtual.</span>`, `<button class="primary-button" type="button" id="newCustomerBtn">Nuevo cliente</button>`],
    inventory: [`<strong>Inventario</strong><span>Controla stock actual y regulariza entradas o salidas.</span>`, can("manageInventory") ? `<button class="ghost-button" type="button" id="downloadProductTemplate">Plantilla Excel/CSV</button><label class="ghost-button file-action">Importar Excel/CSV<input id="importProductsFile" type="file" accept=".csv,text/csv,.xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" /></label><button class="primary-button" type="button" id="newProductInventoryBtn">Nuevo producto</button>` : ""],
    purchases: [`<strong>Compras</strong><span>Registra proveedores y entradas de mercaderia con Kardex automatico.</span>`, ""],
    users: [`<strong>Usuarios operativos</strong><span>Crea cajeros, vendedores, almacen y operador integral para la empresa.</span>`, ""],
    settings: [`<strong>Configuracion comercial</strong><span>Define datos de tienda, moneda y textos del comprobante.</span>`, ""]
  };
  panel.innerHTML = `<div>${actions[activeView][0]}</div><div class="admin-actions">${actions[activeView][1]}</div>`;
  document.querySelector("#showProductForm")?.addEventListener("click", openProductModal);
  document.querySelector("#newProductBtn")?.addEventListener("click", openProductModal);
  document.querySelector("#newProductInventoryBtn")?.addEventListener("click", openProductModal);
  document.querySelector("#newCategoryBtn")?.addEventListener("click", openCategoryModal);
  document.querySelector("#newCustomerBtn")?.addEventListener("click", openCustomerModal);
  document.querySelector("#closeCashBtn")?.addEventListener("click", closeCash);
  document.querySelector("#downloadProductTemplate")?.addEventListener("click", downloadProductImportTemplate);
  document.querySelector("#importProductsFile")?.addEventListener("change", importProductsFile);
}

function renderSummary() {
  setCount("Resumen");
  const scopeText = canSeeAllSales() ? "Ventas" : "Mis ventas";
  const incomeText = canSeeAllSales() ? "Ingresos" : "Mis ingresos";
  const today = new Date().toISOString().slice(0, 10);
  const todaySales = sales.filter((sale) => String(sale.created_at || "").startsWith(today) && sale.status !== "anulada");
  const todayIncome = todaySales.reduce((sum, sale) => sum + Number(sale.amount_paid || sale.cash_received || sale.total || 0), 0);
  const criticalProducts = products.filter((product) => isProductActive(product) && Number(product.stock || 0) <= Number(product.min_stock || 0));
  const latestSale = sales.find((sale) => sale.status !== "anulada");
  const debtTotal = receivables.reduce((sum, sale) => sum + Number(sale.balance_due || 0), 0);
  const cashOpen = cashSession?.status === "abierta";
  const executiveScore = buildExecutiveScore({ todaySales, criticalProducts, debtTotal, cashOpen });
  mainList().innerHTML = `
    <section class="ventas-executive-hero">
      <div>
        <p class="eyebrow">Centro de control</p>
        <h3>${escapeHtml(storeSettings.storeName || storeSettings.companyName || currentUser.companyName || "Zow Ventas-Almacen")}</h3>
        <span>${executiveScore.message}</span>
      </div>
      <strong>${executiveScore.score}/100</strong>
    </section>
    <section class="setup-overview">
      <article><span>Clientes</span><strong>${customers.length}</strong></article>
      <article><span>${scopeText}</span><strong>${summary.sales || 0}</strong></article>
      <article><span>${incomeText}</span><strong>${money(summary.income || 0)}</strong></article>
    </section>
    <section class="owner-dashboard-grid">
      <article><span>Hoy</span><strong>${money(todayIncome)}</strong><small>${todaySales.length} venta${todaySales.length === 1 ? "" : "s"}</small></article>
      <article><span>Caja</span><strong>${cashSession?.status === "abierta" ? `Caja ${num(cashSession.registerNumber)}` : "Sin abrir"}</strong><small>${cashSession?.status === "abierta" ? money(cashExpectedTotal()) : "Sin turno activo"}</small></article>
      <article><span>Ultima venta</span><strong>${latestSale ? money(latestSale.total) : "Sin datos"}</strong><small>${latestSale ? `${escapeHtml(latestSale.code)} / ${formatDateTime(latestSale.created_at)}` : "Aun sin movimiento"}</small></article>
      <article><span>Riesgo stock</span><strong class="${criticalProducts.length ? "warn-text" : "ok-text"}">${num(criticalProducts.length)}</strong><small>Productos para revisar</small></article>
      <article><span>Cobrar</span><strong>${money(debtTotal)}</strong><small>${receivables.length} cuenta${receivables.length === 1 ? "" : "s"}</small></article>
    </section>
    ${renderExecutiveActionPlan({ todaySales, criticalProducts, debtTotal, cashOpen })}
    ${renderVentasCommandCenter()}
    ${renderServiceStrip()}
    ${renderLiveActivityPanel()}
    <section class="admin-panel">
      <div class="admin-panel-head"><div><p class="eyebrow">Ultimas ventas</p><h3>Movimiento comercial</h3></div></div>
      <div class="admin-list">${sales.slice(0, 6).map(renderSaleRow).join("") || empty("Sin ventas registradas")}</div>
    </section>
  `;
}

function buildExecutiveScore({ todaySales, criticalProducts, debtTotal, cashOpen }) {
  let score = 100;
  if (!cashOpen) score -= 18;
  if (!todaySales.length) score -= 10;
  if (criticalProducts.length) score -= Math.min(26, criticalProducts.length * 4);
  if (debtTotal > 0) score -= Math.min(18, Math.ceil(debtTotal / 500) * 3);
  score = Math.max(score, 20);
  const message = score >= 85
    ? "Operacion estable. Puedes seguir vendiendo y revisar reportes al cierre."
    : score >= 65
      ? "Operacion activa con puntos por revisar antes de cerrar el dia."
      : "Hay alertas importantes: prioriza caja, stock o cobranzas.";
  return { score, message };
}

function renderExecutiveActionPlan({ todaySales, criticalProducts, debtTotal, cashOpen }) {
  const actions = [];
  if (!cashOpen) actions.push({ level: "danger", title: "Abrir caja", detail: "Sin caja activa no se pueden confirmar ventas correctamente.", view: "finance" });
  if (criticalProducts.length) actions.push({ level: "warning", title: "Reponer stock", detail: `${criticalProducts.length} producto${criticalProducts.length === 1 ? "" : "s"} bajo minimo o agotado${criticalProducts.length === 1 ? "" : "s"}.`, view: "inventory" });
  if (debtTotal > 0) actions.push({ level: "warning", title: "Revisar cobranzas", detail: `${money(debtTotal)} pendiente en cuentas por cobrar.`, view: "customers" });
  if (!todaySales.length) actions.push({ level: "info", title: "Primera venta", detail: "Todavia no hay ventas registradas hoy.", view: "sell" });
  if (!actions.length) actions.push({ level: "ok", title: "Todo bajo control", detail: "Caja, stock y cobranza se ven estables para operar.", view: "reports" });
  return `<section class="executive-action-plan">
    ${actions.slice(0, 4).map((item) => `
      <article class="is-${item.level}">
        <div><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.detail)}</span></div>
        ${canAccessView(item.view) ? `<button class="ghost-button" type="button" data-module-view="${item.view}">Ir</button>` : ""}
      </article>
    `).join("")}
  </section>`;
}

function renderLiveActivityPanel() {
  const events = auditEvents.slice(0, 6);
  if (!events.length && !cashSession && !sales.length) return "";
  return `<section class="admin-panel live-activity-panel">
    <div class="admin-panel-head"><div><p class="eyebrow">Actividad en vivo</p><h3>Lo ultimo que esta pasando</h3></div><span>${formatDateTime(new Date().toISOString())}</span></div>
    <div class="live-activity-grid">
      <article><span>Estado caja</span><strong>${cashSession?.status === "abierta" ? `Caja ${num(cashSession.registerNumber)}` : "Cerrada"}</strong><small>${cashSession?.status === "abierta" ? `Esperado ${money(cashExpectedTotal())}` : "Sin turno activo"}</small></article>
      <article><span>Ultima venta</span><strong>${sales[0] ? money(sales[0].total) : "Sin ventas"}</strong><small>${sales[0] ? `${escapeHtml(sales[0].code)} / ${escapeHtml(sales[0].seller_name || currentUser.name || "")}` : "Aun sin movimiento"}</small></article>
      <article><span>Alertas</span><strong class="${Number(summary.low_stock || 0) ? "warn-text" : "ok-text"}">${num(summary.low_stock || 0)}</strong><small>Productos bajo minimo</small></article>
    </div>
    <div class="activity-timeline">${events.map(renderActivityTimelineItem).join("") || empty("Sin auditoria reciente visible para este rol")}</div>
  </section>`;
}

function renderActivityTimelineItem(event) {
  return `<article class="activity-timeline-item">
    <span></span>
    <div><strong>${escapeHtml(auditActionLabel(event.action))}</strong><small>${escapeHtml(event.description || "Accion registrada")} / ${formatDateTime(event.created_at)}</small></div>
  </article>`;
}

function renderAlerts() {
  const alerts = products.filter((product) => isProductActive(product) && Number(product.stock || 0) <= Number(product.min_stock || 0));
  const outOfStock = alerts.filter((product) => Number(product.stock || 0) <= 0);
  const reorderValue = alerts.reduce((sum, product) => sum + suggestedReorderQuantity(product) * Number(product.cost_price || 0), 0);
  const highPriority = alerts.filter((product) => reorderPriority(product).level === "alta");
  setCount(`${alerts.length} alerta${alerts.length === 1 ? "" : "s"}`);
  mainList().innerHTML = `
    <section class="inventory-health-grid">
      <article><span>Productos criticos</span><strong class="${alerts.length ? "warn-text" : "ok-text"}">${num(alerts.length)}</strong></article>
      <article><span>Sin stock</span><strong class="${outOfStock.length ? "danger-text" : "ok-text"}">${num(outOfStock.length)}</strong></article>
      <article><span>Compra sugerida</span><strong>${money(reorderValue)}</strong></article>
      <article><span>Prioridad alta</span><strong class="${highPriority.length ? "danger-text" : "ok-text"}">${num(highPriority.length)}</strong></article>
    </section>
    <section class="inventory-insight-grid">
      ${buildInventoryInsights(alerts).map(renderInventoryInsightCard).join("")}
    </section>
    <section class="admin-panel">
      <div class="admin-panel-head">
        <div><p class="eyebrow">Reposicion</p><h3>Lista sugerida de compra</h3></div>
        <div class="admin-head-actions">
          <button class="ghost-button" type="button" id="prepareSuggestedPurchase" ${alerts.length ? "" : "disabled"}>Preparar compra</button>
          <button class="ghost-button" type="button" id="exportReorderCsv">Exportar reposicion</button>
        </div>
      </div>
      <div class="admin-list">${alerts.map(renderReorderRow).join("") || empty("No hay alertas de stock")}</div>
    </section>
    ${selectedKardex ? renderKardexPanel() : ""}
  `;
  document.querySelector("#prepareSuggestedPurchase")?.addEventListener("click", prepareSuggestedPurchase);
  document.querySelector("#exportReorderCsv")?.addEventListener("click", exportReorderCsv);
  document.querySelectorAll("[data-stock-history]").forEach((button) => {
    button.addEventListener("click", () => viewStockHistory(button.dataset.stockHistory));
  });
}

function renderSell() {
  setCount(`${saleCart.length} item${saleCart.length === 1 ? "" : "s"}`);
  const posNotice = posFeedbackMessage || ventasMessage;
  const sellProducts = filteredProducts({ category: productCategoryFilter }).filter(isProductActive);
  const sortedSellProducts = sortProductsForPos(sellProducts);
  const visibleProductLimit = isMobilePos() ? 24 : 36;
  const visibleSellProducts = sortedSellProducts.slice(0, visibleProductLimit);
  const hiddenProductCount = Math.max(sortedSellProducts.length - visibleSellProducts.length, 0);
  const activeCombos = combos.filter((combo) => combo.active && comboAvailableStock(combo) > 0).slice(0, 8);
  const favoriteSellProducts = favoriteProducts
    .map((productId) => products.find((product) => product.id === productId))
    .filter((product) => product && isProductActive(product) && Number(product.stock || 0) > 0)
    .slice(0, 8);
  const totals = cartTotals();
  const profit = cartEstimatedProfit();
  const categories = productCategories();
  const isCashOpen = cashSession?.status === "abierta";
  const cashState = isCashOpen ? `Caja ${num(cashSession.registerNumber)} abierta / ${money(cashExpectedTotal())}` : "Caja sin abrir";
  const lowStockInCart = saleCart
    .map((item) => products.find((product) => product.id === item.productId))
    .filter((product) => product && Number(product.stock || 0) <= Number(product.min_stock || 0));
  mainList().innerHTML = `
    <section class="pos-shell touch-pos-shell pos-mode-${posMobilePanel}">
      <div class="pos-ambient-strip" aria-hidden="true">
        <span></span><span></span><span></span><span></span>
      </div>
      <div class="pos-mobile-switch" aria-label="Vista de venta movil">
        <button class="${posMobilePanel === "products" ? "is-active" : ""}" type="button" data-pos-panel="products"><span class="ui-ico">#</span>Productos</button>
        <button class="${posMobilePanel === "cart" ? "is-active" : ""}" type="button" data-pos-panel="cart"><span class="ui-ico">$</span>Carrito <strong>${saleCart.length}</strong></button>
      </div>
      <div class="mobile-pos-summary">
        <div><span>Carrito</span><strong>${num(saleCart.length)} item${saleCart.length === 1 ? "" : "s"} / ${money(totals.total)}</strong></div>
        <button class="ghost-button" type="button" data-pos-panel="${posMobilePanel === "cart" ? "products" : "cart"}">${posMobilePanel === "cart" ? "Agregar mas" : "Ver carrito"}</button>
        <button class="primary-button" type="button" id="mobileCheckoutBtn" ${saleCart.length && isCashOpen ? "" : "disabled"}>Cobrar</button>
      </div>
      ${posNotice ? `<div class="mobile-pos-toast">${escapeHtml(posNotice)}</div>` : ""}
      <section class="admin-panel pos-products touch-panel">
        <div class="touch-pos-head">
          <div>
            <p class="eyebrow">Venta rapida</p>
            <h3>Productos</h3>
          </div>
          <div class="touch-shortcuts"><span>${escapeHtml(cashState)}</span><span>F2 Buscar</span><span>F4 Cobrar</span></div>
        </div>
        ${posNotice ? `<div class="pos-toast">${escapeHtml(posNotice)}</div>` : ""}
        ${lastSaleReceipt ? renderLastSaleReceipt() : ""}
        ${renderPosShiftPanel(isCashOpen, totals)}
        ${saleCart.length ? renderPosMiniCartPreview(totals, isCashOpen) : ""}
        <div class="pos-search-row">
          <label class="toolbar-search touch-search">Buscar o escanear<input id="productSearchInput" type="search" value="${escapeHtml(productSearch)}" placeholder="Codigo, barras o nombre del producto" enterkeyhint="search" autocomplete="off" /></label>
          <button class="ghost-button touch-action icon-text-button" type="button" id="applyProductSearchBtn"><span class="ui-ico">B</span>Buscar</button>
          <button class="primary-button touch-action icon-text-button" type="button" id="scanAddBtn"><span class="ui-ico">+</span>Agregar</button>
          ${productSearch ? `<button class="ghost-button touch-action icon-text-button" type="button" id="clearSearchBtn"><span class="ui-ico">x</span>Limpiar</button>` : ""}
        </div>
        <div class="scanner-status"><strong>Lector listo</strong><span>F2 enfoca / escanea y Enter agrega</span></div>
        <div class="pos-input-hint">Acepta cantidad rapida: <strong>3x codigo</strong>, <strong>codigo*3</strong> o lector de barras USB.</div>
        <div class="pos-section-block">
          <div class="pos-section-title"><strong>Categorias</strong><span>Filtra rapido por familia</span></div>
          <div class="pos-category-rail">
            <button class="${productCategoryFilter ? "" : "is-active"}" type="button" data-product-filter="">Todos</button>
            ${categories.slice(0, 10).map((category) => `<button class="${productCategoryFilter === category ? "is-active" : ""}" type="button" data-product-filter="${escapeHtml(category)}">${escapeHtml(category)}</button>`).join("")}
          </div>
        </div>
        ${favoriteSellProducts.length ? `
          <div class="pos-section-block pos-products-block">
            <div class="pos-section-title"><strong>Favoritos de mostrador</strong><span>Productos rapidos para pantalla tactil</span></div>
            <div class="product-suggestion-grid touch-product-grid">${favoriteSellProducts.map(renderSellProduct).join("")}</div>
          </div>
        ` : ""}
        ${activeCombos.length ? `
          <div class="pos-section-block pos-products-block">
            <div class="pos-section-title"><strong>Combos rapidos</strong><span>Paquetes con precio final y stock real</span></div>
            <div class="product-suggestion-grid touch-product-grid">${activeCombos.map(renderSellCombo).join("")}</div>
          </div>
        ` : ""}
        <div class="pos-section-block pos-products-block">
          <div class="pos-section-title">
            <strong>Productos disponibles</strong>
            <span>${num(sortedSellProducts.length)} resultado${sortedSellProducts.length === 1 ? "" : "s"}${hiddenProductCount ? ` / mostrando ${num(visibleProductLimit)}` : ""}</span>
          </div>
          <div class="pos-result-hint">
            <strong>${productSearch ? `Busqueda: ${escapeHtml(productSearch)}` : productCategoryFilter ? `Categoria: ${escapeHtml(productCategoryFilter)}` : "Vista general"}</strong>
            <span>Favoritos, coincidencias exactas y productos con stock aparecen primero.</span>
          </div>
          <div class="product-suggestion-grid touch-product-grid">${visibleSellProducts.map(renderSellProduct).join("") || empty("Sin productos con esa busqueda")}</div>
          ${hiddenProductCount ? `<div class="pos-more-results">Hay ${num(hiddenProductCount)} producto${hiddenProductCount === 1 ? "" : "s"} mas. Usa la busqueda por nombre, codigo o categoria para filtrar.</div>` : ""}
        </div>
      </section>
      <section class="admin-panel pos-cart touch-cart-panel">
        <button class="ghost-button mobile-back-products icon-text-button" type="button" data-pos-panel="products"><span class="ui-ico">+</span>Seguir agregando productos</button>
        <div class="touch-cart-head">
          <div><p class="eyebrow">Carrito actual</p><h3>${saleCart.length} producto${saleCart.length === 1 ? "" : "s"}</h3></div>
          <strong>${money(totals.total)}</strong>
        </div>
        <form class="admin-form" id="saleForm">
          <div class="pos-customer-row">
            <label class="touch-customer-select">Cliente<select id="saleCustomer"><option value="">Cliente sin registrar</option>${customers.map((c) => `<option value="${c.id}" ${c.id === saleCustomerId ? "selected" : ""}>${escapeHtml(c.name)}</option>`).join("")}</select></label>
            <button class="ghost-button icon-text-button" type="button" id="quickCustomerBtn"><span class="ui-ico">+</span>Nuevo cliente</button>
          </div>
          <div class="pos-sale-options">
            <label>Descuento general<input id="saleGlobalDiscount" type="number" min="0" step="0.01" value="${Number(saleGlobalDiscount || 0)}" ${storeSettings.allowDiscounts ? "" : "disabled"} /></label>
            <label>Observacion<input id="saleNote" type="text" value="${escapeHtml(saleNote)}" placeholder="Nota interna o detalle para el comprobante" /></label>
          </div>
          ${storeSettings.requireCustomerForSale ? `<div class="cloud-safe-note"><strong>Cliente requerido</strong><span>La configuracion de la tienda exige seleccionar un cliente antes de cobrar.</span></div>` : ""}
          ${!storeSettings.allowDiscounts ? `<div class="cloud-safe-note"><strong>Descuentos desactivados</strong><span>Solo el encargado puede volver a habilitarlos desde configuracion.</span></div>` : ""}
          ${lowStockInCart.length ? `<div class="pos-stock-note"><strong>Atencion stock bajo:</strong> ${lowStockInCart.map((product) => escapeHtml(product.name)).join(", ")}</div>` : ""}
          <div class="pos-cart-list touch-cart-list">${saleCart.map(renderCartItem).join("") || empty("Toca un producto para agregarlo")}</div>
          <div class="pos-section-block pos-total-block">
            <div class="pos-section-title"><strong>Resumen de cobro</strong><span>Totales de la venta actual</span></div>
            <div class="sale-total-card">
              <div><span>Subtotal</span><strong>${money(totals.subtotal)}</strong></div>
              <div><span>Descuentos</span><strong>${money(totals.discount)}</strong></div>
              <div><span>Impuestos</span><strong>${money(totals.tax)}</strong></div>
              ${canSeeProfit() ? `<div><span>Margen estimado</span><strong>${money(profit)}</strong></div>` : ""}
              <div class="is-total"><span>Total</span><strong>${money(totals.total)}</strong></div>
            </div>
          </div>
          <div class="pos-section-block pos-actions-block">
            <div class="pos-section-title"><strong>Acciones de venta</strong><span>Gestiona la operacion sin salir de caja</span></div>
            <div class="quick-action-row touch-sale-actions">
              <button class="ghost-button icon-text-button" type="button" id="newSaleBtn"><span class="ui-ico">+</span>Nueva</button>
              <button class="ghost-button icon-text-button" type="button" id="quickCashBtn" ${saleCart.length && isCashOpen ? "" : "disabled"}><span class="ui-ico">$</span>Efectivo exacto</button>
              <button class="ghost-button icon-text-button" type="button" id="suspendSaleBtn"><span class="ui-ico">||</span>Suspender</button>
              <button class="ghost-button icon-text-button" type="button" id="recoverSaleBtn"><span class="ui-ico">R</span>Recuperar (${suspendedSales.length})</button>
              <button class="ghost-button danger-action icon-text-button" type="button" id="cancelSaleBtn"><span class="ui-ico">x</span>Cancelar</button>
            </div>
          </div>
          <button class="primary-button touch-charge-button icon-text-button" type="button" id="chargeSaleBtn" ${saleCart.length && isCashOpen ? "" : "disabled"}><span class="ui-ico">$</span>${isCashOpen ? `Cobrar ${money(totals.total)}` : "Abre caja para cobrar"}</button>
        </form>
      </section>
    </section>
  `;
  bindProductSearch();
  document.querySelector("#goOpenCashBtn")?.addEventListener("click", () => {
    activeView = "finance";
    renderMain();
  });
  document.querySelector("#quickCustomerBtn")?.addEventListener("click", openCustomerModal);
  document.querySelector("#saleCustomer")?.addEventListener("change", () => {
    saleCustomerId = value("#saleCustomer");
    ventasMessage = "";
  });
  document.querySelector("#saleGlobalDiscount")?.addEventListener("input", (event) => {
    saleGlobalDiscount = Number(event.target.value || 0);
    renderMain();
  });
  document.querySelector("#saleNote")?.addEventListener("input", (event) => {
    saleNote = event.target.value;
  });
  document.querySelector("#clearSearchBtn")?.addEventListener("click", () => {
    productSearch = "";
    renderMain();
  });
  document.querySelector("#applyProductSearchBtn")?.addEventListener("click", () => {
    productSearch = value("#productSearchInput");
    posMobilePanel = "products";
    renderMain();
  });
  document.querySelectorAll("[data-product-filter]").forEach((button) => button.addEventListener("click", () => {
    productCategoryFilter = button.dataset.productFilter || "";
    posMobilePanel = "products";
    renderMain();
  }));
  document.querySelector("#scanAddBtn")?.addEventListener("click", scanAddProduct);
  document.querySelector("#newSaleBtn")?.addEventListener("click", newSale);
  document.querySelector("#quickCashBtn")?.addEventListener("click", quickCheckoutCash);
  document.querySelector("#suspendSaleBtn")?.addEventListener("click", suspendCurrentSale);
  document.querySelector("#recoverSaleBtn")?.addEventListener("click", recoverSuspendedSale);
  document.querySelector("#cancelSaleBtn")?.addEventListener("click", () => {
    if (saleCart.length && confirm("Cancelar la venta actual?")) cancelCurrentSale();
  });
  document.querySelector("#chargeSaleBtn")?.addEventListener("click", openPaymentModal);
  document.querySelector("[data-last-sale-reprint]")?.addEventListener("click", () => {
    if (lastSaleReceipt) printTicket(lastSaleReceipt.sale, lastSaleReceipt.items);
  });
  document.querySelector("[data-mini-checkout]")?.addEventListener("click", openPaymentModal);
  document.querySelectorAll("[data-pos-panel]").forEach((button) => button.addEventListener("click", () => {
    posMobilePanel = button.dataset.posPanel || "products";
    renderMain();
  }));
  document.querySelector("#mobileCheckoutBtn")?.addEventListener("click", openPaymentModal);
  document.querySelectorAll("[data-add-product]").forEach((button) => button.addEventListener("click", () => addToCart(button.dataset.addProduct)));
  document.querySelectorAll("[data-add-combo]").forEach((button) => button.addEventListener("click", () => addComboToCart(button.dataset.addCombo)));
  document.querySelectorAll("[data-toggle-favorite]").forEach((button) => button.addEventListener("click", () => toggleFavoriteProduct(button.dataset.toggleFavorite)));
  document.querySelectorAll("[data-remove-cart]").forEach((button) => button.addEventListener("click", () => removeFromCart(button.dataset.removeCart)));
  document.querySelectorAll("[data-cart-dec]").forEach((button) => button.addEventListener("click", () => updateCartQuantity(button.dataset.cartDec, -1)));
  document.querySelectorAll("[data-cart-inc]").forEach((button) => button.addEventListener("click", () => updateCartQuantity(button.dataset.cartInc, 1)));
  document.querySelectorAll("[data-cart-discount]").forEach((input) => input.addEventListener("change", () => updateCartDiscount(input.dataset.cartDiscount, Number(input.value || 0))));
  document.querySelector("#saleForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    openPaymentModal();
  });
}

function renderPosShiftPanel(isCashOpen, totals) {
  const pendingCount = cash.pendingSales?.length || 0;
  const lastSale = sales.find((sale) => sale.status !== "anulada");
  const openedAt = cashSession?.openedAt ? formatDateTime(cashSession.openedAt) : "";
  const cashier = currentUser?.name || currentUser?.username || "Cajero";
  return `
    <section class="pos-shift-panel ${isCashOpen ? "is-open" : "is-closed"}">
      <div class="pos-shift-grid">
        <article>
          <span>Turno</span>
          <strong>${isCashOpen ? `Caja ${num(cashSession.registerNumber)}` : "Sin caja"}</strong>
          <small>${isCashOpen ? `Apertura ${openedAt}` : "Abre caja antes de cobrar"}</small>
        </article>
        <article>
          <span>Cajero</span>
          <strong>${escapeHtml(cashier)}</strong>
          <small>${escapeHtml(roleLabel(currentUser?.role || ""))}</small>
        </article>
        <article>
          <span>Pendiente caja</span>
          <strong>${money(cash.total || 0)}</strong>
          <small>${num(pendingCount)} venta${pendingCount === 1 ? "" : "s"} sin cierre</small>
        </article>
        <article>
          <span>Venta actual</span>
          <strong>${money(totals.total)}</strong>
          <small>${num(saleCart.length)} item${saleCart.length === 1 ? "" : "s"} en carrito</small>
        </article>
      </div>
      ${lastSale ? `<div class="pos-shift-last"><span>Ultima venta</span><strong>${escapeHtml(lastSale.code)} / ${money(lastSale.total)}</strong><small>${formatDateTime(lastSale.created_at)}</small></div>` : ""}
      ${!isCashOpen ? `
        <div class="pos-cash-warning">
          <div><strong>Abre una caja antes de vender</strong><span>El sistema necesita una caja activa para registrar pagos y cierres.</span></div>
          <button class="primary-button icon-text-button" type="button" id="goOpenCashBtn"><span class="ui-ico">+</span>Abrir caja</button>
        </div>
      ` : ""}
    </section>
  `;
}

function renderFinance() {
  setCount(`${sales.length} venta${sales.length === 1 ? "" : "s"}`);
  const cashLabel = canSeeAllSales() ? "Pendiente caja" : "Mi caja pendiente";
  const totalLabel = canSeeAllSales() ? "Monto pendiente" : "Mi monto pendiente";
  const expectedCash = cashExpectedTotal();
  const movementsTotal = cashMovementsTotal();
  const lastClosure = cashClosures[0];
  const totalClosureDifference = cashClosures.reduce((sum, closure) => sum + Number(closure.differenceAmount || 0), 0);
  const paymentBreakdown = cashPaymentBreakdown();
  const cashHealth = buildCashHealth(expectedCash, movementsTotal, totalClosureDifference);
  const movementForm = can("cashMovements")
    ? `<form class="admin-form" id="cashMovementForm">
        <div class="form-grid">
          <label>Tipo<select id="cashMovementType"><option value="ingreso">Ingreso manual</option><option value="egreso">Egreso manual</option></select></label>
          <label>Monto<input id="cashMovementAmount" type="number" min="0.01" step="0.01" required /></label>
          <label class="span-2">Motivo<input id="cashMovementReason" type="text" required placeholder="Cambio, compra menor, retiro, etc." /></label>
        </div>
        <button class="ghost-button" type="submit" ${cashSession?.status === "abierta" ? "" : "disabled"}>Registrar movimiento</button>
      </form>`
    : `<div class="permission-note">
        <strong>Movimiento manual bloqueado para este rol</strong>
        <span>El cajero puede abrir, cobrar y cerrar su caja. Ingresos o egresos manuales quedan para encargado o administrador de ventas.</span>
      </div>`;
  mainList().innerHTML = `
    ${renderShiftCommandPanel({ expectedCash, movementsTotal, paymentBreakdown })}
    <section class="setup-overview">
      <article><span>${cashLabel}</span><strong>${cash.pendingSales?.length || 0}</strong></article>
      <article><span>${totalLabel}</span><strong>${money(cash.total || 0)}</strong></article>
      <article><span>Efectivo esperado</span><strong>${money(expectedCash)}</strong></article>
      <article><span>Cajas configuradas</span><strong>${num(storeSettings.cashRegisterCount || 1)}</strong></article>
      <article><span>Ultimo cierre</span><strong>${lastClosure ? escapeHtml(lastClosure.code) : "Sin cierres"}</strong></article>
      <article><span>Diferencia acumulada</span><strong class="${Math.abs(totalClosureDifference) > 0 ? "warn-text" : "ok-text"}">${money(totalClosureDifference)}</strong></article>
    </section>
    <section class="cash-health-grid">
      ${cashHealth.map((item) => `<article class="${item.className}"><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.value)}</strong><small>${escapeHtml(item.detail)}</small></article>`).join("")}
    </section>
    <section class="cashier-grid">
      <section class="admin-panel">
        <div class="admin-panel-head"><div><p class="eyebrow">Apertura</p><h3>${cashSession?.status === "abierta" ? "Caja abierta" : "Abrir caja"}</h3></div></div>
        ${cashSession?.status === "abierta" ? `
          <div class="cash-status-card"><strong>Caja ${num(cashSession.registerNumber)} / ${money(cashSession.openingAmount)}</strong><span>Apertura por ${escapeHtml(cashSession.openedBy)} / ${formatDateTime(cashSession.openedAt)}</span></div>
        ` : `
          <form class="admin-form" id="cashOpenForm">
            <div class="form-grid">
              <label>Caja<select id="cashRegisterNumber">${cashRegisterOptions().map((item) => `<option value="${item}" ${preferredCashRegisterNumber() === item ? "selected" : ""}>Caja ${item}</option>`).join("")}</select></label>
              <label>Monto inicial<input id="cashOpeningAmount" type="number" min="0" step="0.01" value="0" /></label>
            </div>
            <button class="primary-button" type="submit">Abrir caja</button>
          </form>
        `}
      </section>
      <section class="admin-panel">
        <div class="admin-panel-head"><div><p class="eyebrow">Movimientos</p><h3>Ingresos y egresos</h3></div><span>${money(movementsTotal)}</span></div>
        ${movementForm}
      </section>
      <section class="admin-panel">
        <div class="admin-panel-head"><div><p class="eyebrow">Cierre</p><h3>Cuadre de caja</h3></div></div>
        <form class="admin-form" id="cashCloseForm">
          <div class="form-grid">
            <label>Efectivo esperado<input type="text" value="${money(expectedCash)}" readonly /></label>
            <label>Efectivo contado<input id="cashCountedAmount" type="number" min="0" step="0.01" value="${expectedCash.toFixed(2)}" /></label>
            <label class="span-2">Observacion si hay diferencia<input id="cashClosureNote" type="text" placeholder="Ej: faltante por vuelto, sobrante, revision pendiente" /></label>
          </div>
          <div class="cash-denomination-grid">
            ${cashDenominations().map((amount) => `<label><span>${money(amount)}</span><input data-cash-denomination="${amount}" type="number" min="0" step="1" placeholder="0" /></label>`).join("")}
          </div>
          <div class="cash-difference-card" id="cashDifferenceCard">
            <span>Diferencia calculada</span>
            <strong>${money(0)}</strong>
            <small>Usa el conteo por billetes o escribe el total contado.</small>
          </div>
          <button class="primary-button" type="submit" ${cashSession?.status === "abierta" ? "" : "disabled"}>Cerrar caja</button>
        </form>
      </section>
    </section>
    <section class="admin-panel">
      <div class="admin-panel-head"><div><p class="eyebrow">Metodos de pago</p><h3>Resumen del turno actual</h3></div></div>
      <div class="payment-breakdown-grid">
        ${paymentBreakdown.map((item) => `<article><span>${escapeHtml(item.label)}</span><strong>${money(item.total)}</strong><small>${num(item.count)} operacion${item.count === 1 ? "" : "es"}</small></article>`).join("")}
      </div>
    </section>
    <section class="admin-panel">
      <div class="admin-panel-head"><div><p class="eyebrow">Cierre detallado</p><h3>Cuadre por metodo y movimientos</h3></div></div>
      <div class="cash-close-breakdown">
        ${renderCashCloseBreakdown(expectedCash, paymentBreakdown, movementsTotal)}
      </div>
    </section>
    <section class="admin-panel">
      <div class="admin-panel-head"><div><p class="eyebrow">Historial movimientos</p><h3>Turno actual</h3></div></div>
      <div class="admin-list">${cashMovements.slice(0, 8).map(renderCashMovementRow).join("") || empty("Sin movimientos manuales")}</div>
    </section>
    <section class="admin-panel">
      <div class="admin-panel-head">
        <div><p class="eyebrow">Arqueos</p><h3>Historial de cierres de caja</h3></div>
        <div class="admin-head-actions">
          <span>${cashClosures.length} cierre${cashClosures.length === 1 ? "" : "s"}</span>
          <button class="ghost-button" type="button" id="exportCashClosuresCsv">Exportar cierres</button>
        </div>
      </div>
      <div class="admin-list">${cashClosures.slice(0, 10).map(renderCashClosureRow).join("") || empty("Sin cierres registrados")}</div>
    </section>
  `;
  document.querySelector("#cashOpenForm")?.addEventListener("submit", openCashSession);
  document.querySelector("#cashMovementForm")?.addEventListener("submit", addCashMovement);
  document.querySelector("#cashCloseForm")?.addEventListener("submit", closeCashSession);
  bindCashCounting(expectedCash);
  document.querySelectorAll("[data-print-closure]").forEach((button) => {
    button.addEventListener("click", () => printCashClosure(button.dataset.printClosure));
  });
  document.querySelector("#exportCashClosuresCsv")?.addEventListener("click", exportCashClosuresCsv);
}

function renderShiftCommandPanel({ expectedCash, movementsTotal, paymentBreakdown }) {
  const pendingSales = cash.pendingSales?.length || 0;
  const isOpen = cashSession?.status === "abierta";
  const confirmedSales = sales.filter((sale) => sale.status !== "anulada");
  const voidedSales = sales.filter((sale) => sale.status === "anulada");
  const paidTotal = paymentBreakdown.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const checklist = [
    { label: "Caja abierta", done: isOpen, detail: isOpen ? `Caja ${num(cashSession.registerNumber)} activa` : "Abre caja antes de cobrar" },
    { label: "Ventas registradas", done: confirmedSales.length > 0, detail: `${num(confirmedSales.length)} operacion${confirmedSales.length === 1 ? "" : "es"} valida${confirmedSales.length === 1 ? "" : "s"}` },
    { label: "Cierre preparado", done: pendingSales > 0, detail: pendingSales ? `${num(pendingSales)} venta${pendingSales === 1 ? "" : "s"} para cuadrar` : "Sin ventas pendientes" },
    { label: "Control de anuladas", done: voidedSales.length === 0, detail: voidedSales.length ? `${num(voidedSales.length)} anulada${voidedSales.length === 1 ? "" : "s"} para revisar` : "Sin anulaciones" }
  ];
  const progress = Math.round((checklist.filter((item) => item.done).length / checklist.length) * 100);
  return `<section class="shift-command-panel">
    <div class="shift-command-main">
      <div>
        <p class="eyebrow">Control del turno</p>
        <h3>${isOpen ? `Caja ${num(cashSession.registerNumber)} en operacion` : "Caja pendiente de apertura"}</h3>
        <span>${isOpen ? `Abierta por ${escapeHtml(cashSession.openedBy || currentUser.name || currentUser.username || "usuario")} / ${formatDateTime(cashSession.openedAt)}` : "El turno necesita apertura para vender con control."}</span>
      </div>
      <strong>${progress}%</strong>
    </div>
    <div class="shift-command-meter"><span style="width:${progress}%"></span></div>
    <div class="shift-command-grid">
      <article><span>Efectivo esperado</span><strong>${money(expectedCash)}</strong><small>Incluye apertura, cobros y movimientos.</small></article>
      <article><span>Pagos cobrados</span><strong>${money(paidTotal)}</strong><small>${paymentBreakdown.map((item) => `${item.label}: ${money(item.total)}`).join(" / ") || "Sin cobros"}</small></article>
      <article><span>Movimientos manuales</span><strong>${money(movementsTotal)}</strong><small>${can("cashMovements") ? "Permitido para tu rol" : "Solo encargado o administrador"}</small></article>
    </div>
    <div class="shift-checklist">
      ${checklist.map((item) => `<article class="${item.done ? "is-done" : "is-pending"}"><b>${item.done ? "OK" : "!"}</b><div><strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(item.detail)}</span></div></article>`).join("")}
    </div>
    <div class="shift-command-actions">
      ${canAccessView("sell") ? `<button class="primary-button" type="button" data-module-view="sell">Ir a vender</button>` : ""}
      ${canAccessView("history") ? `<button class="ghost-button" type="button" data-module-view="history">Ver operaciones</button>` : ""}
      ${canAccessView("reports") ? `<button class="ghost-button" type="button" data-module-view="reports">Auditoria</button>` : ""}
    </div>
  </section>`;
}

function renderHistory() {
  const visibleSales = filteredHistorySales();
  const historyStats = buildHistoryStats(visibleSales);
  setCount(`${visibleSales.length} venta${visibleSales.length === 1 ? "" : "s"}`);
  mainList().innerHTML = `
    <section class="admin-panel sales-history-panel">
      <div class="admin-panel-head">
        <div><p class="eyebrow">Historial</p><h3>Ventas y comprobantes</h3></div>
        <div class="admin-head-actions"><button class="ghost-button" type="button" id="exportHistoryVisibleCsv">Exportar vista</button><button class="ghost-button" type="button" id="clearHistoryFilters">Limpiar filtros</button></div>
      </div>
      <div class="history-kpi-grid">
        <article><span>Ventas visibles</span><strong>${num(historyStats.count)}</strong><small>${num(historyStats.voided)} anulada${historyStats.voided === 1 ? "" : "s"}</small></article>
        <article><span>Total vendido</span><strong>${money(historyStats.total)}</strong><small>Sin anuladas</small></article>
        <article><span>Cobrado</span><strong>${money(historyStats.paid)}</strong><small>${money(historyStats.pending)} pendiente</small></article>
        <article><span>Ticket promedio</span><strong>${money(historyStats.average)}</strong><small>Ventas validas</small></article>
      </div>
      ${renderHistoryControlStrip(visibleSales, historyStats)}
      <div class="history-quick-filters" aria-label="Filtros rapidos de historial">
        <button type="button" data-history-preset="today">Hoy</button>
        <button type="button" data-history-preset="yesterday">Ayer</button>
        <button type="button" data-history-preset="pending">Pendientes</button>
        <button type="button" data-history-preset="credit">Credito</button>
        <button type="button" data-history-preset="voided">Anuladas</button>
      </div>
      <div class="history-filters">
        <label>Buscar<input id="historySearch" type="search" inputmode="search" autocomplete="off" placeholder="Codigo, cliente, cajero..." value="${escapeHtml(historyFilter.q)}" /></label>
        <label>Fecha<input id="historyDate" type="date" value="${escapeHtml(historyFilter.date)}" /></label>
        <label>Metodo<select id="historyMethod"><option value="">Todos</option>${paymentMethods().map((method) => `<option value="${method.id}" ${historyFilter.method === method.id ? "selected" : ""}>${method.label}</option>`).join("")}</select></label>
        <label>Estado<select id="historyStatus"><option value="">Todos</option><option value="pagada" ${historyFilter.status === "pagada" ? "selected" : ""}>Pagada</option><option value="pendiente" ${historyFilter.status === "pendiente" ? "selected" : ""}>Pendiente</option><option value="anulada" ${historyFilter.status === "anulada" ? "selected" : ""}>Anulada</option></select></label>
      </div>
      <div class="sales-history-list">${visibleSales.map(renderHistorySaleRow).join("") || empty("Sin ventas con esos filtros")}</div>
    </section>
  `;
  document.querySelector("#historySearch")?.addEventListener("input", (event) => {
    historyFilter.q = event.target.value;
    window.clearTimeout(historySearchTimer);
    historySearchTimer = window.setTimeout(renderMain, 220);
  });
  document.querySelector("#historyDate")?.addEventListener("change", (event) => { historyFilter.date = event.target.value; renderMain(); });
  document.querySelector("#historyMethod")?.addEventListener("change", (event) => { historyFilter.method = event.target.value; renderMain(); });
  document.querySelector("#historyStatus")?.addEventListener("change", (event) => { historyFilter.status = event.target.value; renderMain(); });
  document.querySelector("#clearHistoryFilters")?.addEventListener("click", () => { historyFilter = { status: "", method: "", date: "", q: "" }; renderMain(); });
  document.querySelector("#exportHistoryVisibleCsv")?.addEventListener("click", exportVisibleHistoryCsv);
  document.querySelectorAll("[data-history-preset]").forEach((button) => button.addEventListener("click", () => {
    applyHistoryPreset(button.dataset.historyPreset);
    renderMain();
  }));
  document.querySelectorAll("[data-detail-sale]").forEach((button) => button.addEventListener("click", () => showSaleDetail(button.dataset.detailSale)));
  document.querySelectorAll("[data-reprint-sale]").forEach((button) => button.addEventListener("click", () => reprintSale(button.dataset.reprintSale)));
  document.querySelectorAll("[data-void-sale]").forEach((button) => button.addEventListener("click", () => voidSale(button.dataset.voidSale)));
}

function renderHistoryControlStrip(visibleSales, historyStats) {
  const annulable = visibleSales.filter((sale) => saleStatus(sale) !== "anulada" && !sale.cash_closed && can("voidSales"));
  const pendingPayments = visibleSales.filter((sale) => Number(sale.balance_due || 0) > 0 && sale.status !== "anulada");
  const closedSales = visibleSales.filter((sale) => sale.cash_closed && sale.status !== "anulada");
  const latest = visibleSales.find((sale) => sale.status !== "anulada");
  const activeFilters = [
    historyFilter.q ? `Busqueda: ${historyFilter.q}` : "",
    historyFilter.date ? `Fecha: ${historyFilter.date}` : "",
    historyFilter.method ? `Metodo: ${paymentLabel(historyFilter.method)}` : "",
    historyFilter.status ? `Estado: ${historyFilter.status}` : ""
  ].filter(Boolean);
  const health = historyStats.pending > 0 || annulable.length > 0 ? "is-warning" : "is-ok";
  return `<section class="history-control-strip ${health}">
    <article>
      <span>Revision rapida</span>
      <strong>${activeFilters.length ? activeFilters.join(" / ") : "Vista general del turno"}</strong>
      <small>${latest ? `Ultima operacion ${escapeHtml(latest.code)} / ${formatDateTime(latest.created_at)}` : "Sin operaciones visibles"}</small>
    </article>
    <article><span>Anulables</span><strong>${num(annulable.length)}</strong><small>Ventas abiertas del turno</small></article>
    <article><span>Cuentas por cobrar</span><strong>${num(pendingPayments.length)}</strong><small>${money(historyStats.pending)} pendiente</small></article>
    <article><span>Caja cerrada</span><strong>${num(closedSales.length)}</strong><small>Solo consulta o reimpresion</small></article>
  </section>`;
}

function filteredHistorySales() {
  return sales.filter(saleMatchesHistoryFilter);
}

function saleMatchesHistoryFilter(sale) {
  const meta = localSaleMeta[sale.id] || {};
  const status = saleStatus(sale);
  const query = String(historyFilter.q || "").trim().toLowerCase();
  if (historyFilter.status && status !== historyFilter.status) return false;
  if (historyFilter.method && (sale.payment_method || meta.method) !== historyFilter.method) return false;
  if (historyFilter.date && !String(sale.created_at || "").startsWith(historyFilter.date)) return false;
  if (query) {
    const haystack = [sale.code, sale.customer_name, sale.seller_name, sale.payment_method, sale.total, sale.balance_due]
      .map((value) => String(value || "").toLowerCase())
      .join(" ");
    if (!haystack.includes(query)) return false;
  }
  return true;
}

function applyHistoryPreset(preset) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = yesterday.toISOString().slice(0, 10);
  if (preset === "today") historyFilter = { status: "", method: "", date: todayDate(), q: "" };
  if (preset === "yesterday") historyFilter = { status: "", method: "", date: yesterdayKey, q: "" };
  if (preset === "pending") historyFilter = { ...historyFilter, status: "pendiente", date: "" };
  if (preset === "credit") historyFilter = { ...historyFilter, method: "credito", status: "", date: "" };
  if (preset === "voided") historyFilter = { ...historyFilter, status: "anulada", date: "" };
}

function buildHistoryStats(rows) {
  const validSales = rows.filter((sale) => saleStatus(sale) !== "anulada");
  const total = validSales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
  const paid = validSales.reduce((sum, sale) => sum + Number(sale.amount_paid || sale.cash_received || 0), 0);
  const pending = validSales.reduce((sum, sale) => sum + Number(sale.balance_due || 0), 0);
  return {
    count: rows.length,
    voided: rows.length - validSales.length,
    total,
    paid,
    pending,
    average: validSales.length ? total / validSales.length : 0
  };
}

function buildCashHealth(expectedCash, movementsTotal, totalClosureDifference) {
  const pendingCount = cash.pendingSales?.length || 0;
  return [
    {
      label: cashSession?.status === "abierta" ? "Turno activo" : "Turno cerrado",
      value: cashSession?.status === "abierta" ? `Caja ${num(cashSession.registerNumber)}` : "Sin caja abierta",
      detail: cashSession?.status === "abierta" ? `Esperado ${money(expectedCash)}` : "Abre caja para iniciar ventas",
      className: cashSession?.status === "abierta" ? "is-ok" : "is-warning"
    },
    {
      label: "Ventas sin cerrar",
      value: num(pendingCount),
      detail: pendingCount ? "Se incluiran al cerrar caja" : "Sin ventas pendientes",
      className: pendingCount ? "is-ok" : "is-muted"
    },
    {
      label: "Movimientos manuales",
      value: money(movementsTotal),
      detail: "Ingresos menos egresos del turno",
      className: Math.abs(movementsTotal) ? "is-warning" : "is-muted"
    },
    {
      label: "Historial de diferencias",
      value: money(totalClosureDifference),
      detail: Math.abs(totalClosureDifference) ? "Revisar cierres anteriores" : "Cierres equilibrados",
      className: Math.abs(totalClosureDifference) ? "is-danger" : "is-ok"
    }
  ];
}

function cashDenominations() {
  return [200, 100, 50, 20, 10, 5, 2, 1, 0.5];
}

function daysSince(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return 0;
  return Math.max(Math.floor((Date.now() - date.getTime()) / 86400000), 0);
}

function daysUntil(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  return Math.ceil((date.getTime() - Date.now()) / 86400000);
}

function expiryStatus(product) {
  if (!product?.expires_at) return { level: "none", label: "", className: "" };
  const days = daysUntil(product.expires_at);
  if (days === null) return { level: "none", label: "", className: "" };
  if (days < 0) return { level: "danger", label: `Vencido hace ${num(Math.abs(days))} dia${Math.abs(days) === 1 ? "" : "s"}`, className: "danger-text" };
  if (days <= 30) return { level: "warning", label: `Vence en ${num(days)} dia${days === 1 ? "" : "s"}`, className: "warn-text" };
  return { level: "ok", label: `Vence ${formatShortDate(product.expires_at)}`, className: "ok-text" };
}

function formatShortDate(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-BO", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function bindCashCounting(expectedCash) {
  const countedInput = document.querySelector("#cashCountedAmount");
  const denominationInputs = [...document.querySelectorAll("[data-cash-denomination]")];
  if (!countedInput) return;
  const updateDifference = () => {
    const counted = Number(countedInput.value || 0);
    const difference = counted - expectedCash;
    const card = document.querySelector("#cashDifferenceCard");
    if (!card) return;
    card.classList.toggle("is-ok", Math.abs(difference) < 0.01);
    card.classList.toggle("is-warning", Math.abs(difference) >= 0.01 && Math.abs(difference) <= 5);
    card.classList.toggle("is-danger", Math.abs(difference) > 5);
    card.querySelector("strong").textContent = money(difference);
    card.querySelector("small").textContent = Math.abs(difference) < 0.01
      ? "Caja cuadrada. Puedes cerrar con seguridad."
      : "Agrega una observacion antes de cerrar.";
  };
  const updateCountedFromDenominations = () => {
    const total = denominationInputs.reduce((sum, input) => sum + Number(input.dataset.cashDenomination || 0) * Number(input.value || 0), 0);
    if (total > 0) countedInput.value = total.toFixed(2);
    updateDifference();
  };
  countedInput.addEventListener("input", updateDifference);
  denominationInputs.forEach((input) => input.addEventListener("input", updateCountedFromDenominations));
  updateDifference();
}

function renderRoutes() {
  const pending = cash.pendingSales || [];
  const routeGroups = buildRouteGroups();
  setCount(`${routeGroups.length} ruta${routeGroups.length === 1 ? "" : "s"}`);
  mainList().innerHTML = `
    <section class="route-grid">
      ${routeGroups.map((route) => `
        <article class="route-card">
          <div class="route-card-head">
            <span>${route.code}</span>
            <strong>${route.name}</strong>
          </div>
          <div class="route-stats">
            <span>${route.customers.length} clientes</span>
            <span>${route.priority}</span>
          </div>
          <div class="route-customer-list">
            ${route.customers.map((customer) => `<span>${escapeHtml(customer.name)}</span>`).join("") || "<span>Sin clientes asignados</span>"}
          </div>
        </article>
      `).join("")}
    </section>
    <section class="admin-panel">
      <div class="admin-panel-head"><div><p class="eyebrow">Despacho</p><h3>Ventas pendientes de liquidacion</h3></div></div>
      <div class="admin-list">${pending.slice(0, 8).map(renderSaleRow).join("") || empty("No hay ventas pendientes para liquidar")}</div>
    </section>
  `;
}

function renderPromotions() {
  const activePromotions = promotions.filter(isPromotionActiveNow);
  const activeCombos = combos.filter((combo) => combo.active);
  const critical = products.filter((product) => Number(product.stock || 0) <= Number(product.min_stock || 0)).slice(0, 4);
  const editingPromotion = promotions.find((promotion) => promotion.id === editingPromotionId);
  const editingCombo = combos.find((combo) => combo.id === editingComboId);
  setCount(`${activePromotions.length + activeCombos.length} activa${activePromotions.length + activeCombos.length === 1 ? "" : "s"}`);
  mainList().innerHTML = `
    <section class="promotion-grid">
      <article class="promotion-card is-green"><span>Promociones activas</span><strong>${activePromotions.length}</strong><p>Se aplican automaticamente en el POS al cumplir cantidad y fecha.</p></article>
      <article class="promotion-card is-amber"><span>Combos activos</span><strong>${activeCombos.length}</strong><p>Paquetes de varios productos con precio final fijo para caja.</p></article>
      <article class="promotion-card is-red"><span>Reposicion</span><strong>${critical.length} criticos</strong><p>Evita promocionar articulos por debajo del minimo.</p></article>
    </section>
    ${can("managePromotions") ? `
      <section class="admin-panel">
        <div class="admin-panel-head"><div><p class="eyebrow">${editingCombo ? "Editar combo" : "Nuevo combo"}</p><h3>Paquete con stock real</h3></div>${editingCombo ? `<button class="ghost-button" type="button" id="cancelComboEdit">Cancelar edicion</button>` : ""}</div>
        <form class="admin-form combo-rule-form" id="comboForm">
          <div class="form-grid">
            <label>Codigo<input id="comboCode" type="text" required placeholder="COMBO-001" value="${escapeHtml(editingCombo?.code || "")}" /></label>
            <label>Nombre<input id="comboName" type="text" required placeholder="Combo familiar" value="${escapeHtml(editingCombo?.name || "")}" /></label>
            <label>Precio final<input id="comboPrice" type="number" min="0.01" step="0.01" required value="${Number(editingCombo?.price || "")}" /></label>
          </div>
          <div class="combo-builder-grid">
            ${[0, 1, 2, 3].map((index) => renderComboBuilderLine(editingCombo, index)).join("")}
          </div>
          <button class="primary-button" type="submit">${editingCombo ? "Guardar combo" : "Crear combo"}</button>
        </form>
      </section>
      <section class="admin-panel">
        <div class="admin-panel-head"><div><p class="eyebrow">${editingPromotion ? "Editar promocion" : "Nueva promocion"}</p><h3>Regla automatica para POS</h3></div>${editingPromotion ? `<button class="ghost-button" type="button" id="cancelPromotionEdit">Cancelar edicion</button>` : ""}</div>
        <form class="admin-form promotion-rule-form" id="promotionForm">
          <label>Nombre<input id="promotionName" type="text" required placeholder="Ej. Descuento refrescos fin de semana" value="${escapeHtml(editingPromotion?.name || "")}" /></label>
          <label>Aplicar a<select id="promotionScope"><option value="product" ${editingPromotion?.scopeType !== "category" ? "selected" : ""}>Producto especifico</option><option value="category" ${editingPromotion?.scopeType === "category" ? "selected" : ""}>Categoria completa</option></select></label>
          <label>Producto<select id="promotionProduct"><option value="">Seleccionar producto</option>${products.filter(isProductActive).map((product) => `<option value="${product.id}" ${editingPromotion?.productId === product.id ? "selected" : ""}>${escapeHtml(product.name)} / ${money(product.sale_price)}</option>`).join("")}</select></label>
          <label>Categoria<select id="promotionCategory"><option value="">Seleccionar categoria</option>${productCategories().map((category) => `<option value="${escapeHtml(category)}" ${editingPromotion?.category === category ? "selected" : ""}>${escapeHtml(category)}</option>`).join("")}</select></label>
          <label>Tipo<select id="promotionType"><option value="percent" ${editingPromotion?.type === "percent" ? "selected" : ""}>Porcentaje</option><option value="fixed" ${editingPromotion?.type === "fixed" ? "selected" : ""}>Monto fijo</option></select></label>
          <label>Valor<input id="promotionValue" type="number" min="0.01" step="0.01" required value="${Number(editingPromotion?.value || "")}" /></label>
          <label>Cantidad minima<input id="promotionMinQuantity" type="number" min="1" step="1" value="${Number(editingPromotion?.minQuantity || 1)}" /></label>
          <label>Desde<input id="promotionStartsAt" type="date" value="${escapeHtml(editingPromotion?.startsAt || todayDate())}" /></label>
          <label>Hasta<input id="promotionEndsAt" type="date" value="${escapeHtml(editingPromotion?.endsAt || "")}" /></label>
          <button class="primary-button" type="submit">${editingPromotion ? "Guardar cambios" : "Crear promocion"}</button>
        </form>
      </section>
    ` : ""}
    <section class="admin-panel">
      <div class="admin-panel-head"><div><p class="eyebrow">Combos registrados</p><h3>Paquetes para caja</h3></div></div>
      <div class="admin-list">${combos.map(renderComboRow).join("") || empty("Crea combos para vender paquetes con precio fijo")}</div>
    </section>
    <section class="admin-panel">
      <div class="admin-panel-head"><div><p class="eyebrow">Promociones registradas</p><h3>Reglas comerciales</h3></div></div>
      <div class="admin-list">${promotions.map(renderPromotionRow).join("") || empty("Crea tu primera promocion para aplicarla en caja")}</div>
    </section>
    <section class="admin-panel">
      <div class="admin-panel-head"><div><p class="eyebrow">Lista base</p><h3>Productos para venta</h3></div></div>
      <div class="price-list">${products.filter(isProductActive).slice(0, 8).map(renderPriceRow).join("") || empty("Registra productos para crear listas de precios")}</div>
    </section>
  `;
  document.querySelector("#comboForm")?.addEventListener("submit", saveCombo);
  document.querySelector("#cancelComboEdit")?.addEventListener("click", () => {
    editingComboId = "";
    renderMain();
  });
  document.querySelector("#promotionForm")?.addEventListener("submit", savePromotion);
  document.querySelector("#cancelPromotionEdit")?.addEventListener("click", () => {
    editingPromotionId = "";
    renderMain();
  });
  document.querySelectorAll("[data-edit-promotion]").forEach((button) => {
    button.addEventListener("click", () => editPromotion(button.dataset.editPromotion));
  });
  document.querySelectorAll("[data-duplicate-promotion]").forEach((button) => {
    button.addEventListener("click", () => duplicatePromotion(button.dataset.duplicatePromotion));
  });
  document.querySelectorAll("[data-toggle-promotion]").forEach((button) => {
    button.addEventListener("click", () => togglePromotion(button.dataset.togglePromotion));
  });
  document.querySelectorAll("[data-delete-promotion]").forEach((button) => {
    button.addEventListener("click", () => deletePromotion(button.dataset.deletePromotion));
  });
  document.querySelectorAll("[data-edit-combo]").forEach((button) => button.addEventListener("click", () => {
    editingComboId = button.dataset.editCombo;
    renderMain();
  }));
  document.querySelectorAll("[data-toggle-combo]").forEach((button) => button.addEventListener("click", () => toggleCombo(button.dataset.toggleCombo)));
  document.querySelectorAll("[data-delete-combo]").forEach((button) => button.addEventListener("click", () => deleteCombo(button.dataset.deleteCombo)));
}

function renderReports() {
  const filteredSales = sales.filter(isSaleInsideReportFilter);
  const confirmedSales = filteredSales.filter((sale) => sale.status !== "anulada");
  const stockRisks = products.filter((product) => isProductActive(product) && Number(product.stock || 0) <= Number(product.min_stock || 0));
  const expiryRisks = products.filter((product) => isProductActive(product) && ["danger", "warning"].includes(expiryStatus(product).level));
  const totalIncome = confirmedSales.reduce((sum, sale) => sum + Number(sale.amount_paid || sale.cash_received || sale.total || 0), 0);
  const totalSold = confirmedSales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
  const pendingTotal = receivables.reduce((sum, sale) => sum + Number(sale.balance_due || 0), 0);
  const averageSale = confirmedSales.length ? totalSold / confirmedSales.length : 0;
  const voidedSales = filteredSales.filter((sale) => sale.status === "anulada").length;
  const paymentBreakdown = buildSalesPaymentBreakdown(confirmedSales);
  const profitRows = profitReport.rows || [];
  const profitTotals = profitReport.totals || {};
  const marginPercent = Number(profitTotals.netSales || 0) ? (Number(profitTotals.profit || 0) / Number(profitTotals.netSales || 0)) * 100 : 0;
  const businessHealth = buildBusinessHealth({ confirmedSales, stockRisks, expiryRisks, pendingTotal, marginPercent, totalClosureDifference: cashClosures.reduce((sum, closure) => sum + Math.abs(Number(closure.differenceAmount || 0)), 0) });
  setCount("Auditoria");
  mainList().innerHTML = `
    <section class="admin-panel report-filter-panel">
      <div class="admin-panel-head"><div><p class="eyebrow">Periodo</p><h3>Filtro de analisis</h3></div></div>
      <div class="history-filters">
        <label>Desde<input id="reportDateFrom" type="date" value="${escapeHtml(reportFilter.from)}" /></label>
        <label>Hasta<input id="reportDateTo" type="date" value="${escapeHtml(reportFilter.to)}" /></label>
        <button class="ghost-button" type="button" id="clearReportFilter">Limpiar filtro</button>
      </div>
    </section>
    <section class="report-grid">
      <article><span>Ventas del periodo</span><strong>${num(confirmedSales.length)}</strong><small>${voidedSales} anulada${voidedSales === 1 ? "" : "s"}</small></article>
      <article><span>Ingreso cobrado</span><strong>${money(totalIncome)}</strong><small>Total vendido ${money(totalSold)}</small></article>
      <article><span>Ticket promedio</span><strong>${money(averageSale)}</strong><small>Ventas confirmadas</small></article>
      <article><span>Cuentas por cobrar</span><strong>${money(pendingTotal)}</strong><small>${receivables.length} saldo${receivables.length === 1 ? "" : "s"} activo${receivables.length === 1 ? "" : "s"}</small></article>
      <article><span>Stock critico</span><strong>${summary.low_stock || 0}</strong><small>Productos bajo minimo</small></article>
      <article><span>Valor inventario</span><strong>${money(summary.inventory_value || 0)}</strong><small>Capital en almacen</small></article>
    </section>
    <section class="admin-panel business-health-panel">
      <div class="admin-panel-head"><div><p class="eyebrow">Salud del negocio</p><h3>Lectura ejecutiva para decidir</h3></div><span>${businessHealth.score}/100</span></div>
      <div class="business-health-meter"><span style="width:${businessHealth.score}%"></span></div>
      <div class="business-health-grid">
        ${businessHealth.items.map((item) => `<article class="${item.className}"><strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(item.detail)}</span></article>`).join("")}
      </div>
    </section>
    ${renderInventoryValuationReport()}
    <section class="admin-panel">
      <div class="admin-panel-head"><div><p class="eyebrow">Cobros</p><h3>Ventas por metodo de pago</h3></div></div>
      <div class="payment-breakdown-grid">${paymentBreakdown.map((item) => `<article><span>${escapeHtml(item.label)}</span><strong>${money(item.total)}</strong><small>${num(item.count)} venta${item.count === 1 ? "" : "s"}</small></article>`).join("")}</div>
    </section>
    <section class="admin-panel">
      <div class="admin-panel-head"><div><p class="eyebrow">Utilidad real</p><h3>Ganancia por producto</h3></div><span>Margen ${marginPercent.toFixed(1)}%</span></div>
      <div class="report-grid compact-report-grid">
        <article><span>Venta neta</span><strong>${money(profitTotals.netSales || 0)}</strong><small>Despues de descuentos</small></article>
        <article><span>Costo historico</span><strong>${money(profitTotals.costTotal || 0)}</strong><small>Costo al vender</small></article>
        <article><span>Utilidad</span><strong>${money(profitTotals.profit || 0)}</strong><small>${num(profitTotals.quantity || 0)} unidades vendidas</small></article>
      </div>
      <div class="admin-list">${profitRows.slice(0, 12).map(renderProfitProductRow).join("") || empty("Sin ventas confirmadas en este periodo")}</div>
    </section>
    <section class="report-actions" aria-label="Exportaciones">
      <article class="report-export-card">
        <div><strong>Ventas del periodo</strong><span>Descarga operaciones con cliente, metodo de pago, estado y saldos para auditoria.</span></div>
        <button class="primary-button" type="button" id="exportSalesCsv">Exportar ventas CSV</button>
      </article>
      <article class="report-export-card">
        <div><strong>Inventario valorizado</strong><span>Descarga stock, costo, precio, margen y productos inactivos para control comercial.</span></div>
        <button class="ghost-button" type="button" id="exportInventoryCsv">Exportar inventario CSV</button>
      </article>
      <article class="report-export-card">
        <div><strong>Clientes y saldos</strong><span>Exporta clientes, cuentas por cobrar y saldos pendientes para seguimiento comercial.</span></div>
        <button class="ghost-button" type="button" id="exportCustomersCsv">Exportar clientes CSV</button>
      </article>
      <article class="report-export-card">
        <div><strong>Utilidad por producto</strong><span>Descarga ventas netas, costo historico, utilidad y margen por articulo.</span></div>
        <button class="ghost-button" type="button" id="exportProfitCsv">Exportar utilidad CSV</button>
      </article>
      <article class="report-export-card">
        <div><strong>Cierres de caja</strong><span>Exporta arqueos, esperado, contado, diferencia, ventas cerradas y observaciones.</span></div>
        <button class="ghost-button" type="button" id="exportClosuresCsv">Exportar cierres CSV</button>
      </article>
      <article class="report-export-card">
        <div><strong>Auditoria comercial</strong><span>Descarga eventos sensibles: ventas, anulaciones, caja, inventario y usuarios responsables.</span></div>
        <button class="ghost-button" type="button" id="exportAuditCsv">Exportar auditoria CSV</button>
      </article>
      <article class="report-export-card">
        <div><strong>Respaldo operativo</strong><span>Descarga un archivo JSON con ventas, productos, clientes, compras y configuracion visible.</span></div>
        <button class="ghost-button" type="button" id="exportBackupJson">Exportar respaldo JSON</button>
      </article>
    </section>
    <section class="admin-panel">
      <div class="admin-panel-head"><div><p class="eyebrow">Control</p><h3>Productos que requieren accion</h3></div></div>
      <div class="report-risk-columns">
        <div>
          <strong>Stock minimo</strong>
          <div class="admin-list">${stockRisks.map(renderProductRow).join("") || empty("Sin riesgos de stock")}</div>
        </div>
        <div>
          <strong>Vencimiento</strong>
          <div class="admin-list">${expiryRisks.map(renderProductRow).join("") || empty("Sin productos vencidos o por vencer")}</div>
        </div>
      </div>
    </section>
    <section class="admin-panel">
      <div class="admin-panel-head"><div><p class="eyebrow">Auditoria visible</p><h3>Ultimas acciones comerciales</h3></div><span>${auditEvents.length} evento${auditEvents.length === 1 ? "" : "s"}</span></div>
      <div class="admin-list compact-audit-list">${auditEvents.slice(0, 20).map(renderAuditEventRow).join("") || empty("Aun no hay eventos comerciales auditados")}</div>
    </section>
  `;
  document.querySelector("#reportDateFrom")?.addEventListener("change", async (event) => { reportFilter.from = event.target.value; await render(); });
  document.querySelector("#reportDateTo")?.addEventListener("change", async (event) => { reportFilter.to = event.target.value; await render(); });
  document.querySelector("#clearReportFilter")?.addEventListener("click", async () => { reportFilter = { from: "", to: "" }; await render(); });
  document.querySelector("#exportSalesCsv")?.addEventListener("click", exportSalesCsv);
  document.querySelector("#exportInventoryCsv")?.addEventListener("click", exportInventoryCsv);
  document.querySelector("#exportCustomersCsv")?.addEventListener("click", exportCustomersCsv);
  document.querySelector("#exportProfitCsv")?.addEventListener("click", exportProfitCsv);
  document.querySelector("#exportClosuresCsv")?.addEventListener("click", exportCashClosuresCsv);
  document.querySelector("#exportAuditCsv")?.addEventListener("click", exportAuditCsv);
  document.querySelector("#exportBackupJson")?.addEventListener("click", exportBackupJson);
}

function buildBusinessHealth({ confirmedSales, stockRisks, expiryRisks, pendingTotal, marginPercent, totalClosureDifference }) {
  const items = [
    {
      label: "Ventas",
      ok: confirmedSales.length > 0,
      detail: confirmedSales.length ? `${confirmedSales.length} venta(s) en el periodo.` : "Aun no hay ventas para analizar."
    },
    {
      label: "Inventario",
      ok: stockRisks.length === 0,
      detail: stockRisks.length ? `${stockRisks.length} producto(s) requieren reposicion.` : "Stock minimo controlado."
    },
    {
      label: "Vencimientos",
      ok: expiryRisks.length === 0,
      detail: expiryRisks.length ? `${expiryRisks.length} producto(s) vencidos o por vencer.` : "Sin riesgo de vencimiento visible."
    },
    {
      label: "Caja",
      ok: totalClosureDifference <= 1,
      detail: totalClosureDifference > 1 ? `Diferencias acumuladas ${money(totalClosureDifference)}.` : "Cierres sin diferencias importantes."
    },
    {
      label: "Cuentas por cobrar",
      ok: pendingTotal <= 0,
      detail: pendingTotal > 0 ? `Saldo pendiente ${money(pendingTotal)}.` : "Sin deuda pendiente registrada."
    },
    {
      label: "Margen",
      ok: marginPercent >= 15 || !confirmedSales.length,
      detail: confirmedSales.length ? `Margen del periodo ${marginPercent.toFixed(1)}%.` : "Se calculara cuando existan ventas."
    }
  ];
  const score = Math.round((items.filter((item) => item.ok).length / items.length) * 100);
  return {
    score,
    items: items.map((item) => ({ ...item, className: item.ok ? "is-ok" : "is-warning" }))
  };
}

function renderProfitProductRow(row) {
  const margin = Number(row.netSales || 0) ? (Number(row.profit || 0) / Number(row.netSales || 0)) * 100 : 0;
  return `<article class="admin-row">
    <div>
      <strong>${escapeHtml(row.productName || "Producto")}</strong>
      <span>${num(row.quantity)} unidad${Number(row.quantity || 0) === 1 ? "" : "es"} / Venta neta ${money(row.netSales)}</span>
      <span>Costo ${money(row.costTotal)} / Descuento ${money(row.discounts)}</span>
    </div>
    <div class="admin-row-meta"><span class="${Number(row.profit || 0) >= 0 ? "ok-text" : "danger-text"}">Utilidad ${money(row.profit)}</span><span>Margen ${margin.toFixed(1)}%</span></div>
  </article>`;
}

function renderInventoryValuationReport() {
  const activeProducts = products.filter(isProductActive);
  const totals = activeProducts.reduce((sum, product) => {
    const stock = Number(product.stock || 0);
    const cost = Number(product.cost_price || 0);
    const price = Number(product.sale_price || 0);
    sum.cost += stock * cost;
    sum.sale += stock * price;
    sum.margin += stock * Math.max(price - cost, 0);
    return sum;
  }, { cost: 0, sale: 0, margin: 0 });
  const topValue = [...activeProducts]
    .sort((a, b) => Number(b.stock || 0) * Number(b.cost_price || 0) - Number(a.stock || 0) * Number(a.cost_price || 0))
    .slice(0, 8);
  return `<section class="admin-panel inventory-valuation-panel">
    <div class="admin-panel-head"><div><p class="eyebrow">Inventario valorizado</p><h3>Capital, venta potencial y margen</h3></div><span>${num(activeProducts.length)} activos</span></div>
    <div class="report-grid compact-report-grid">
      <article><span>Costo en stock</span><strong>${money(totals.cost)}</strong><small>Capital inmovilizado</small></article>
      <article><span>Venta potencial</span><strong>${money(totals.sale)}</strong><small>Si se vende todo el stock</small></article>
      <article><span>Margen estimado</span><strong>${money(totals.margin)}</strong><small>Antes de descuentos</small></article>
    </div>
    <div class="admin-list">${topValue.map((product) => {
      const insight = productInventoryInsight(product);
      return `<article class="admin-row">
        <div><strong>${escapeHtml(product.name)}</strong><span>${escapeHtml(product.code)} / Clase ${escapeHtml(insight.className)} / Stock ${num(product.stock)}</span></div>
        <div class="admin-row-meta"><span>Valor ${money(insight.stockValue)}</span><span>Venta ${money(insight.potentialRevenue)}</span><span>Margen ${num(insight.marginPercent)}%</span></div>
      </article>`;
    }).join("") || empty("Sin productos activos para valorizar")}</div>
  </section>`;
}

function renderPromotionRow(promotion) {
  const product = products.find((item) => item.id === promotion.productId);
  const active = isPromotionActiveNow(promotion);
  const target = promotion.scopeType === "category" ? `Categoria ${promotion.category || "sin categoria"}` : product?.name || promotion.productName || "Producto";
  return `<article class="admin-row">
    <div>
      <strong>${escapeHtml(promotion.name)}</strong>
      <span>${escapeHtml(target)} / ${promotionLabel(promotion)}</span>
      <span>Desde ${escapeHtml(promotion.startsAt || "hoy")} ${promotion.endsAt ? `/ Hasta ${escapeHtml(promotion.endsAt)}` : "/ Sin fecha final"}</span>
    </div>
    <div class="admin-row-meta">
      <span class="${active ? "ok-text" : promotion.active ? "warn-text" : "danger-text"}">${active ? "Activa" : promotion.active ? "Programada/vencida" : "Inactiva"}</span>
      ${can("managePromotions") ? `<button class="ghost-button" type="button" data-edit-promotion="${promotion.id}">Editar</button><button class="ghost-button" type="button" data-duplicate-promotion="${promotion.id}">Duplicar</button><button class="ghost-button" type="button" data-toggle-promotion="${promotion.id}">${promotion.active ? "Pausar" : "Activar"}</button><button class="ghost-button danger-action" type="button" data-delete-promotion="${promotion.id}">Eliminar</button>` : ""}
    </div>
  </article>`;
}

function renderAuditEventRow(event) {
  return `<article class="admin-row">
    <div>
      <strong>${escapeHtml(auditActionLabel(event.action))}</strong>
      <span>${escapeHtml(event.description || "Accion registrada")}</span>
      <span>${escapeHtml(event.actor_name || "Sistema")} / ${event.created_at ? formatDateTime(event.created_at) : ""}</span>
    </div>
    <div class="admin-row-meta"><span>${escapeHtml(event.entity_type || "ventas")}</span></div>
  </article>`;
}

function auditActionLabel(action) {
  return {
    sale_create: "Venta registrada",
    sale_suspend: "Venta suspendida",
    sale_resume: "Venta recuperada",
    favorite_add: "Favorito POS agregado",
    favorite_remove: "Favorito POS quitado",
    promotion_create: "Promocion creada",
    promotion_update: "Promocion actualizada",
    promotion_status: "Estado de promocion",
    promotion_delete: "Promocion eliminada",
    sale_void: "Venta anulada",
    sale_return: "Devolucion",
    credit_payment: "Cobro de credito",
    cash_open: "Caja abierta",
    cash_close: "Caja cerrada",
    cash_movement: "Movimiento de caja",
    product_create: "Producto creado",
    product_update: "Producto actualizado",
    product_status: "Estado de producto",
    product_import: "Importacion de productos",
    stock_movement: "Movimiento de stock"
  }[action] || action || "Evento";
}

function renderCatalog() {
  setCount(`${products.length} articulo${products.length === 1 ? "" : "s"}`);
  mainList().innerHTML = `
    <section class="admin-panel"><div class="admin-panel-head"><div><p class="eyebrow">Categorias</p><h3>Agrupacion de articulos</h3></div></div><div class="admin-list">${categories.map((c) => `<article class="admin-row"><strong>${escapeHtml(c.name)}</strong><span>${escapeHtml(c.description || "Sin descripcion")}</span></article>`).join("") || empty("Sin categorias")}</div></section>
    <section class="admin-panel"><div class="admin-panel-head"><div><p class="eyebrow">Articulos</p><h3>Productos registrados</h3></div></div><div class="admin-list">${products.map(renderProductRow).join("") || empty("Sin productos")}</div></section>
  `;
}

function renderCustomers() {
  const totalDebt = receivables.reduce((sum, sale) => sum + Number(sale.balance_due || 0), 0);
  const oldestDebt = receivables.slice().sort((a, b) => new Date(a.created_at) - new Date(b.created_at))[0];
  const debtAging = buildDebtAging(receivables);
  const riskCustomers = buildCustomerRiskList().slice(0, 6);
  const collectionPlan = buildCollectionPlan();
  const followUpList = buildReceivableFollowUpList().slice(0, 6);
  const customerHealth = buildCustomerPortfolioHealth(riskCustomers);
  setCount(`${customers.length} cliente${customers.length === 1 ? "" : "s"}`);
  mainList().innerHTML = `
    <section class="customer-command-card">
      <div>
        <p class="eyebrow">Cartera comercial</p>
        <h3>Clientes, creditos y cobros bajo control</h3>
        <span>Prioriza clientes con saldo vencido, revisa limite usado y registra pagos sin salir del modulo.</span>
      </div>
      <div class="customer-command-actions">
        <button class="primary-button" type="button" id="quickNewCustomer">Nuevo cliente</button>
        <button class="ghost-button" type="button" id="exportCustomersCommandCsv">Exportar clientes</button>
      </div>
    </section>
    <section class="customer-health-grid">
      <article><span>Clientes activos</span><strong>${num(customerHealth.activeCustomers)}</strong><small>${num(customers.length)} registrados</small></article>
      <article class="${customerHealth.highRisk ? "is-danger" : "is-ok"}"><span>Riesgo alto</span><strong>${num(customerHealth.highRisk)}</strong><small>Requieren cobro o bloqueo</small></article>
      <article class="${totalDebt ? "is-warning" : "is-ok"}"><span>Cartera pendiente</span><strong>${money(totalDebt)}</strong><small>${num(receivables.length)} venta${receivables.length === 1 ? "" : "s"} al credito</small></article>
      <article class="${customerHealth.oldestDays > 30 ? "is-danger" : customerHealth.oldestDays > 15 ? "is-warning" : "is-ok"}"><span>Mayor antiguedad</span><strong>${num(customerHealth.oldestDays)} dias</strong><small>${oldestDebt ? escapeHtml(oldestDebt.customer_name || "Cliente sin registrar") : "Sin deuda"}</small></article>
    </section>
    <section class="setup-overview">
      <article><span>Clientes</span><strong>${customers.length}</strong></article>
      <article><span>Cuentas por cobrar</span><strong>${receivables.length}</strong></article>
      <article><span>Saldo pendiente</span><strong>${money(totalDebt)}</strong></article>
      <article><span>Mas antigua</span><strong>${oldestDebt ? formatDateTime(oldestDebt.created_at) : "Sin deuda"}</strong></article>
    </section>
    <section class="debt-aging-grid">
      ${debtAging.map((bucket) => `<article class="${bucket.className}"><span>${escapeHtml(bucket.label)}</span><strong>${money(bucket.total)}</strong><small>${bucket.count} venta${bucket.count === 1 ? "" : "s"} pendiente${bucket.count === 1 ? "" : "s"}</small></article>`).join("")}
    </section>
    <section class="collection-plan-grid">
      ${collectionPlan.map((item) => `<article class="${item.className}"><span>${escapeHtml(item.label)}</span><strong>${money(item.total)}</strong><small>${item.detail}</small></article>`).join("")}
    </section>
    <section class="customer-workspace-grid">
      <article class="admin-panel">
        <div class="admin-panel-head"><div><p class="eyebrow">Riesgo comercial</p><h3>Clientes que requieren seguimiento</h3></div></div>
        <div class="admin-list">${riskCustomers.map(renderCustomerRiskRow).join("") || empty("Sin clientes con riesgo de credito")}</div>
      </article>
      <article class="admin-panel">
        <div class="admin-panel-head"><div><p class="eyebrow">Plan de cobro</p><h3>Acciones recomendadas</h3></div><button class="ghost-button" type="button" id="exportReceivablesCsv">Exportar cartera CSV</button></div>
        <div class="admin-list">${followUpList.map(renderReceivableFollowUpRow).join("") || empty("Sin acciones de cobro pendientes")}</div>
      </article>
    </section>
    <section class="admin-panel">
      <div class="admin-panel-head"><div><p class="eyebrow">Cuentas por cobrar</p><h3>Ventas al credito</h3></div></div>
      <div class="admin-list">${receivables.map(renderReceivableRow).join("") || empty("Sin saldos pendientes")}</div>
    </section>
    <section class="admin-panel">
      <div class="admin-panel-head"><div><p class="eyebrow">Directorio</p><h3>Clientes registrados</h3></div><button class="ghost-button" type="button" id="exportCustomersFromCustomersCsv">Exportar clientes CSV</button></div>
      <div class="admin-list customer-directory-list">${customers.map(renderCustomerDirectoryRow).join("") || empty("Sin clientes registrados")}</div>
    </section>
  `;
  document.querySelectorAll("[data-pay-receivable]").forEach((button) => {
    button.addEventListener("click", () => payReceivable(button.dataset.payReceivable));
  });
  document.querySelectorAll("[data-pay-customer]").forEach((button) => {
    button.addEventListener("click", () => payOldestReceivableForCustomer(button.dataset.payCustomer));
  });
  document.querySelectorAll("[data-edit-customer]").forEach((button) => {
    button.addEventListener("click", () => openCustomerModal(button.dataset.editCustomer));
  });
  document.querySelector("#quickNewCustomer")?.addEventListener("click", () => openCustomerModal());
  document.querySelector("#exportCustomersCommandCsv")?.addEventListener("click", exportCustomersCsv);
  document.querySelector("#exportReceivablesCsv")?.addEventListener("click", exportReceivablesCsv);
  document.querySelector("#exportCustomersFromCustomersCsv")?.addEventListener("click", exportCustomersCsv);
}

function renderCustomerDirectoryRow(customer) {
  const debt = receivables
    .filter((sale) => (sale.customer_name || "Cliente sin registrar") === customer.name)
    .reduce((sum, sale) => sum + Number(sale.balance_due || 0), 0);
  const creditLimit = Number(customer.credit_limit || 0);
  const usage = creditLimit > 0 ? Math.min(100, Math.round((debt / creditLimit) * 100)) : debt > 0 ? 100 : 0;
  const statusClass = customer.status === "bloqueado" ? "danger-text" : customer.status === "observado" ? "warn-text" : "ok-text";
  const usageClass = usage >= 90 ? "is-danger" : usage >= 65 ? "is-warning" : "is-ok";
  return `<article class="admin-row customer-directory-row">
    <div>
      <strong>${escapeHtml(customer.name)}</strong>
      <span>CI/NIT ${escapeHtml(customer.ci || "Sin dato")} / Cel. ${escapeHtml(customer.phone || "Sin celular")}</span>
      <span>${escapeHtml(customer.address || "Sin direccion")}</span>
      <div class="customer-credit-meter ${usageClass}"><i style="width:${usage}%"></i></div>
    </div>
    <div class="admin-row-meta">
      <span>${escapeHtml(customer.email || "Sin email")}</span>
      <span class="${statusClass}">${escapeHtml(customer.status || "activo")}</span>
      <span>Credito ${money(creditLimit)}</span>
      <span class="${usageClass}">Usado ${usage}%</span>
      <span>Debe ${money(debt)}</span>
      ${debt > 0 ? `<button class="primary-button" type="button" data-pay-customer="${escapeHtml(customer.name)}">Cobrar</button>` : ""}
      <button class="ghost-button" type="button" data-edit-customer="${customer.id}">Editar</button>
    </div>
  </article>`;
}

function renderReceivableRow(sale) {
  const paidPercent = Math.min(100, Math.round((Number(sale.amount_paid || 0) / Math.max(Number(sale.total || 1), 1)) * 100));
  const age = daysSince(sale.created_at);
  const ageClass = age > 30 ? "danger-text" : age > 15 ? "warn-text" : "ok-text";
  return `<article class="admin-row receivable-row">
    <div>
      <strong>${escapeHtml(sale.code)}</strong>
      <span>${escapeHtml(sale.customer_name || "Cliente sin registrar")} / ${formatDateTime(sale.created_at)} / <b class="${ageClass}">${age} dia${age === 1 ? "" : "s"}</b></span>
      <span>Pagado ${money(sale.amount_paid)} de ${money(sale.total)}</span>
      <div class="receivable-progress"><i style="width:${paidPercent}%"></i></div>
    </div>
    <div class="admin-row-meta"><span class="warn-text">Debe ${money(sale.balance_due)}</span><button class="primary-button" type="button" data-pay-receivable="${sale.id}">Registrar pago</button></div>
  </article>`;
}

function renderComboBuilderLine(combo, index) {
  const item = combo?.items?.[index] || {};
  return `<div class="combo-builder-line">
    <label>Producto ${index + 1}<select data-combo-product="${index}">
      <option value="">Seleccionar producto</option>
      ${products.filter(isProductActive).map((product) => `<option value="${product.id}" ${item.productId === product.id ? "selected" : ""}>${escapeHtml(product.name)} / Stock ${num(product.stock)}</option>`).join("")}
    </select></label>
    <label>Cantidad<input data-combo-qty="${index}" type="number" min="0" step="1" value="${Number(item.quantity || 0)}" /></label>
  </div>`;
}

function renderComboRow(combo) {
  const baseTotal = combo.items.reduce((sum, item) => sum + Number(item.salePrice || 0) * Number(item.quantity || 0), 0);
  const saving = Math.max(baseTotal - Number(combo.price || 0), 0);
  const stock = comboAvailableStock(combo);
  return `<article class="admin-row combo-row">
    <div>
      <strong>${escapeHtml(combo.name)}</strong>
      <span>${escapeHtml(combo.code)} / Precio ${money(combo.price)} / Ahorro ${money(saving)}</span>
      <span>${combo.items.map((item) => `${escapeHtml(item.productName)} x ${num(item.quantity)}`).join(" + ")}</span>
    </div>
    <div class="admin-row-meta">
      <span class="${stock > 0 ? "ok-text" : "danger-text"}">Disponibles ${num(stock)}</span>
      <span class="${combo.active ? "ok-text" : "warn-text"}">${combo.active ? "Activo" : "Pausado"}</span>
      ${can("managePromotions") ? `<button class="ghost-button" type="button" data-edit-combo="${combo.id}">Editar</button><button class="ghost-button" type="button" data-toggle-combo="${combo.id}">${combo.active ? "Pausar" : "Activar"}</button><button class="ghost-button danger-action" type="button" data-delete-combo="${combo.id}">Eliminar</button>` : ""}
    </div>
  </article>`;
}

function renderCustomerRiskRow(item) {
  const levelClass = item.level === "alto" ? "danger-text" : item.level === "medio" ? "warn-text" : "ok-text";
  return `<article class="admin-row customer-risk-row">
    <div>
      <strong>${escapeHtml(item.name)}</strong>
      <span>Saldo ${money(item.debt)} / Limite ${money(item.creditLimit)} / ${item.salesCount} venta${item.salesCount === 1 ? "" : "s"} pendiente${item.salesCount === 1 ? "" : "s"}</span>
      <span>Deuda mas antigua: ${item.oldestDays} dia${item.oldestDays === 1 ? "" : "s"}</span>
    </div>
    <div class="admin-row-meta">
      <span class="${levelClass}">Riesgo ${item.level}</span>
      <span>${item.recommendation}</span>
      <button class="ghost-button" type="button" data-pay-customer="${escapeHtml(item.name)}">Cobrar</button>
    </div>
  </article>`;
}

function renderReceivableFollowUpRow(item) {
  return `<article class="admin-row collection-action-row">
    <div>
      <strong>${escapeHtml(item.name)}</strong>
      <span>${item.salesCount} venta${item.salesCount === 1 ? "" : "s"} pendiente${item.salesCount === 1 ? "" : "s"} / saldo ${money(item.debt)}</span>
      <span>${escapeHtml(item.nextStep)}</span>
    </div>
    <div class="admin-row-meta">
      <span class="${item.className}">${escapeHtml(item.priority)}</span>
      <span>${item.oldestDays} dia${item.oldestDays === 1 ? "" : "s"}</span>
    </div>
  </article>`;
}

function renderPurchases() {
  const activeProducts = products.filter(isProductActive);
  const reorderAlerts = products.filter((product) => isProductActive(product) && Number(product.stock || 0) <= Number(product.min_stock || 0));
  const reorderValue = reorderAlerts.reduce((sum, product) => sum + suggestedReorderQuantity(product) * Number(product.cost_price || 0), 0);
  const highPriority = reorderAlerts.filter((product) => reorderPriority(product).level === "alta");
  const purchaseTotal = purchaseCart.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
  const pendingPurchases = purchases.filter((purchase) => (purchase.status || "confirmada") === "pendiente");
  const confirmedPurchases = purchases.filter((purchase) => ["confirmada", "recibida"].includes(purchase.status || "confirmada"));
  setCount(`${purchases.length} compra${purchases.length === 1 ? "" : "s"}`);
  mainList().innerHTML = `
    ${ventasMessage ? `<div class="cloud-safe-note"><strong>${escapeHtml(ventasMessage)}</strong><span>La compra afecta solo el inventario de esta empresa.</span></div>` : ""}
    <section class="purchase-kpi-grid">
      <article><span>Orden actual</span><strong>${money(purchaseTotal)}</strong><small>${num(purchaseCart.length)} linea${purchaseCart.length === 1 ? "" : "s"} cargada${purchaseCart.length === 1 ? "" : "s"}</small></article>
      <article><span>Pendientes</span><strong>${num(pendingPurchases.length)}</strong><small>Ordenes por recibir</small></article>
      <article><span>Recibidas</span><strong>${num(confirmedPurchases.length)}</strong><small>${money(confirmedPurchases.reduce((sum, purchase) => sum + Number(purchase.total || 0), 0))}</small></article>
      <article><span>Reposicion</span><strong>${money(reorderValue)}</strong><small>${num(reorderAlerts.length)} producto${reorderAlerts.length === 1 ? "" : "s"} bajo minimo</small></article>
    </section>
    <section class="purchase-assist-card">
      <div>
        <p class="eyebrow">Asistente de reposicion</p>
        <h3>Compra sugerida por inventario minimo</h3>
        <span>${num(reorderAlerts.length)} producto${reorderAlerts.length === 1 ? "" : "s"} en alerta / ${num(highPriority.length)} prioridad alta / inversion aprox. ${money(reorderValue)}</span>
      </div>
      <button class="primary-button" type="button" id="prepareSuggestedPurchaseFromPurchases" ${reorderAlerts.length ? "" : "disabled"}>Cargar compra sugerida</button>
    </section>
    <section class="purchase-workflow-strip">
      <article class="is-active"><span>1</span><strong>Proveedor</strong><small>Registra o selecciona</small></article>
      <article class="${purchaseCart.length ? "is-active" : ""}"><span>2</span><strong>Detalle</strong><small>Productos y costos</small></article>
      <article class="${purchaseCart.length ? "is-active" : ""}"><span>3</span><strong>Recepcion</strong><small>Suma stock o deja pendiente</small></article>
    </section>
    <section class="cashier-grid purchase-entry-grid">
      <section class="admin-panel purchase-card-panel">
        <div class="admin-panel-head"><div><p class="eyebrow">Proveedor</p><h3>Registrar proveedor</h3></div></div>
        <form class="admin-form" id="supplierForm">
          <div class="form-grid">
            <label>Nombre<input id="supplierName" type="text" required placeholder="Proveedor o distribuidora" /></label>
            <label>Telefono<input id="supplierPhone" type="tel" /></label>
            <label>NIT / CI<input id="supplierTaxId" type="text" /></label>
            <label>Direccion<input id="supplierAddress" type="text" /></label>
          </div>
          <button class="ghost-button" type="submit">Guardar proveedor</button>
        </form>
      </section>
      <section class="admin-panel purchase-card-panel">
        <div class="admin-panel-head"><div><p class="eyebrow">Compra</p><h3>Entrada de mercaderia</h3></div></div>
        <form class="admin-form" id="purchaseForm">
          <div class="form-grid">
            <label>Proveedor<select id="purchaseSupplier"><option value="">Proveedor sin registrar</option>${suppliers.map((supplier) => `<option value="${supplier.id}">${escapeHtml(supplier.name)}</option>`).join("")}</select></label>
            <label>Nro. factura/nota<input id="purchaseInvoice" type="text" placeholder="Opcional" /></label>
            <label class="span-2">Producto<select id="purchaseProduct" required>${activeProducts.map((product) => `<option value="${product.id}">${escapeHtml(product.code)} - ${escapeHtml(product.name)}</option>`).join("")}</select></label>
            <label>Cantidad<input id="purchaseQuantity" type="number" min="0.01" step="0.01" value="1" required /></label>
            <label>Costo unitario<input id="purchaseCost" type="number" min="0" step="0.01" value="0" required /></label>
            <label class="span-2">Nota<input id="purchaseNote" type="text" placeholder="Compra, reposicion, factura, etc." /></label>
          </div>
          <div class="modal-actions">
            <button class="ghost-button" type="button" id="addPurchaseLine" ${activeProducts.length && can("managePurchases") ? "" : "disabled"}>Agregar linea</button>
            <button class="ghost-button" type="button" id="savePendingPurchase" ${activeProducts.length && can("managePurchases") ? "" : "disabled"}>Guardar orden pendiente</button>
            <button class="primary-button" type="submit" ${activeProducts.length && can("managePurchases") ? "" : "disabled"}>Registrar compra y sumar stock</button>
          </div>
        </form>
      </section>
    </section>
    <section class="admin-panel purchase-detail-panel">
      <div class="admin-panel-head">
        <div><p class="eyebrow">Detalle</p><h3>Productos de la compra</h3></div>
        <div class="admin-head-actions">
          <span>${money(purchaseTotal)}</span>
          <button class="ghost-button" type="button" id="printPurchaseOrder" ${purchaseCart.length ? "" : "disabled"}>Imprimir orden</button>
          <button class="ghost-button danger-action" type="button" id="clearPurchaseCart" ${purchaseCart.length && can("managePurchases") ? "" : "disabled"}>Limpiar</button>
        </div>
      </div>
      <div class="admin-list">${purchaseCart.map(renderPurchaseCartRow).join("") || empty("Agrega productos a la compra")}</div>
    </section>
    <section class="admin-panel purchase-history-panel">
      <div class="admin-panel-head"><div><p class="eyebrow">Historial</p><h3>Compras recientes</h3></div><span>${money(purchases.reduce((sum, purchase) => sum + Number(purchase.total || 0), 0))}</span></div>
      <div class="purchase-history-list">${purchases.slice(0, 12).map(renderPurchaseRow).join("") || empty("Sin compras registradas")}</div>
    </section>
    <section class="admin-panel">
      <div class="admin-panel-head"><div><p class="eyebrow">Proveedores</p><h3>Directorio</h3></div></div>
      <div class="admin-list">${suppliers.map(renderSupplierRow).join("") || empty("Sin proveedores registrados")}</div>
    </section>
  `;
  document.querySelector("#supplierForm")?.addEventListener("submit", saveSupplier);
  document.querySelector("#purchaseForm")?.addEventListener("submit", savePurchase);
  document.querySelector("#savePendingPurchase")?.addEventListener("click", () => savePurchase(null, "pendiente"));
  document.querySelector("#prepareSuggestedPurchaseFromPurchases")?.addEventListener("click", prepareSuggestedPurchase);
  document.querySelector("#addPurchaseLine")?.addEventListener("click", addPurchaseLine);
  document.querySelector("#printPurchaseOrder")?.addEventListener("click", printPurchaseOrder);
  document.querySelector("#clearPurchaseCart")?.addEventListener("click", clearPurchaseCart);
  document.querySelectorAll("[data-remove-purchase-line]").forEach((button) => button.addEventListener("click", () => {
    purchaseCart = purchaseCart.filter((item) => item.id !== button.dataset.removePurchaseLine);
    renderMain();
  }));
  document.querySelectorAll("[data-receive-purchase]").forEach((button) => {
    button.addEventListener("click", () => receivePurchaseOrder(button.dataset.receivePurchase));
  });
  document.querySelectorAll("[data-cancel-purchase]").forEach((button) => {
    button.addEventListener("click", () => cancelPurchaseOrder(button.dataset.cancelPurchase));
  });
  document.querySelector("#purchaseProduct")?.addEventListener("change", updatePurchaseCostFromProduct);
  updatePurchaseCostFromProduct();
}

function buildDebtAging(sourceReceivables) {
  const buckets = [
    { label: "0 a 7 dias", min: 0, max: 7, total: 0, count: 0, className: "is-ok" },
    { label: "8 a 15 dias", min: 8, max: 15, total: 0, count: 0, className: "is-muted" },
    { label: "16 a 30 dias", min: 16, max: 30, total: 0, count: 0, className: "is-warning" },
    { label: "Mas de 30 dias", min: 31, max: Infinity, total: 0, count: 0, className: "is-danger" }
  ];
  sourceReceivables.forEach((sale) => {
    const age = daysSince(sale.created_at);
    const bucket = buckets.find((item) => age >= item.min && age <= item.max);
    if (!bucket) return;
    bucket.total += Number(sale.balance_due || 0);
    bucket.count += 1;
  });
  return buckets;
}

function buildCustomerRiskList() {
  const byName = new Map();
  receivables.forEach((sale) => {
    const name = sale.customer_name || "Cliente sin registrar";
    const current = byName.get(name) || { name, debt: 0, salesCount: 0, oldestDays: 0, creditLimit: 0 };
    current.debt += Number(sale.balance_due || 0);
    current.salesCount += 1;
    current.oldestDays = Math.max(current.oldestDays, daysSince(sale.created_at));
    byName.set(name, current);
  });
  return [...byName.values()].map((item) => {
    const customer = customers.find((entry) => entry.name === item.name);
    const creditLimit = Number(customer?.credit_limit || 0);
    const usage = creditLimit > 0 ? item.debt / creditLimit : item.debt > 0 ? 1 : 0;
    const level = item.oldestDays > 30 || usage >= 0.9 || customer?.status === "bloqueado"
      ? "alto"
      : item.oldestDays > 15 || usage >= 0.65 || item.salesCount >= 3
        ? "medio"
        : "bajo";
    const recommendation = level === "alto"
      ? "Cobrar antes de vender mas"
      : level === "medio"
        ? "Hacer seguimiento"
        : "Credito controlado";
    return { ...item, creditLimit, usage, level, recommendation };
  }).sort((a, b) => {
    const order = { alto: 3, medio: 2, bajo: 1 };
    return order[b.level] - order[a.level] || b.debt - a.debt;
  });
}

function buildCustomerPortfolioHealth(riskList = buildCustomerRiskList()) {
  return {
    activeCustomers: customers.filter((customer) => (customer.status || "activo") === "activo").length,
    highRisk: riskList.filter((item) => item.level === "alto").length,
    oldestDays: receivables.reduce((max, sale) => Math.max(max, daysSince(sale.created_at)), 0)
  };
}

function buildCollectionPlan() {
  const urgent = receivables.filter((sale) => daysSince(sale.created_at) > 30);
  const watch = receivables.filter((sale) => {
    const age = daysSince(sale.created_at);
    return age >= 16 && age <= 30;
  });
  const normal = receivables.filter((sale) => daysSince(sale.created_at) < 16);
  const withoutFile = receivables.filter((sale) => !customers.some((customer) => customer.name === sale.customer_name));
  return [
    {
      label: "Cobro urgente",
      total: urgent.reduce((sum, sale) => sum + Number(sale.balance_due || 0), 0),
      detail: `${urgent.length} cuenta${urgent.length === 1 ? "" : "s"} con mas de 30 dias`,
      className: "is-danger"
    },
    {
      label: "Seguimiento semanal",
      total: watch.reduce((sum, sale) => sum + Number(sale.balance_due || 0), 0),
      detail: `${watch.length} cuenta${watch.length === 1 ? "" : "s"} entre 16 y 30 dias`,
      className: "is-warning"
    },
    {
      label: "Credito controlado",
      total: normal.reduce((sum, sale) => sum + Number(sale.balance_due || 0), 0),
      detail: `${normal.length} cuenta${normal.length === 1 ? "" : "s"} dentro del plazo inicial`,
      className: "is-ok"
    },
    {
      label: "Sin ficha completa",
      total: withoutFile.reduce((sum, sale) => sum + Number(sale.balance_due || 0), 0),
      detail: `${withoutFile.length} venta${withoutFile.length === 1 ? "" : "s"} debe${withoutFile.length === 1 ? "" : "n"} asociarse a cliente`,
      className: withoutFile.length ? "is-warning" : "is-ok"
    }
  ];
}

function buildReceivableFollowUpList() {
  return buildCustomerRiskList().map((item) => {
    const priority = item.level === "alto" ? "Prioridad alta" : item.level === "medio" ? "Prioridad media" : "Control";
    const className = item.level === "alto" ? "danger-text" : item.level === "medio" ? "warn-text" : "ok-text";
    const nextStep = item.level === "alto"
      ? "Contactar hoy, registrar pago o bloquear nuevas ventas a credito."
      : item.level === "medio"
        ? "Confirmar fecha de pago antes de autorizar mas credito."
        : "Mantener seguimiento normal y revisar limite disponible.";
    return { ...item, priority, className, nextStep };
  });
}

function renderPurchaseCartRow(item) {
  const product = products.find((entry) => entry.id === item.productId);
  const priority = product ? reorderPriority(product) : null;
  const stockText = product ? `Stock ${num(product.stock)} / Min. ${num(product.min_stock)}` : "Producto cargado";
  return `<article class="purchase-line-row">
    <div><strong>${escapeHtml(item.name)}</strong><span>${num(item.quantity)} x ${money(item.unitCost)} / ${escapeHtml(stockText)}</span></div>
    <div class="purchase-line-total"><span>Total</span><strong>${money(item.quantity * item.unitCost)}</strong></div>
    <div class="purchase-line-actions">${priority ? `<span class="${priority.className}">Prioridad ${priority.label}</span>` : ""}<button class="ghost-button danger-action" type="button" data-remove-purchase-line="${item.id}">Quitar</button></div>
  </article>`;
}

function renderPurchaseRow(purchase) {
  const status = purchase.status || "confirmada";
  const statusClass = status === "pendiente" ? "warn-text" : status === "cancelada" ? "danger-text" : "ok-text";
  return `<article class="purchase-history-row">
    <div><strong>${escapeHtml(purchase.code)}</strong><span>${escapeHtml(purchase.supplier_name || "Proveedor sin registrar")} / ${escapeHtml(purchase.invoice_number || "Sin factura")}</span><small>${formatDateTime(purchase.created_at)} / ${escapeHtml(purchase.created_by_name || "Usuario")}</small></div>
    <div><span>Total</span><strong>${money(purchase.total)}</strong></div>
    <div><span class="${statusClass}">${escapeHtml(purchaseStatusLabel(status))}</span></div>
    ${status === "pendiente" && can("managePurchases") ? `<div class="purchase-history-actions"><button class="primary-button" type="button" data-receive-purchase="${purchase.id}">Recibir</button><button class="ghost-button danger-action" type="button" data-cancel-purchase="${purchase.id}">Cancelar</button></div>` : ""}
  </article>`;
}

function renderSupplierRow(supplier) {
  return `<article class="admin-row"><div><strong>${escapeHtml(supplier.name)}</strong><span>NIT/CI ${escapeHtml(supplier.tax_id || "Sin dato")} / Cel. ${escapeHtml(supplier.phone || "Sin celular")}</span><span>${escapeHtml(supplier.address || "Sin direccion")}</span></div></article>`;
}

function renderInventory() {
  const inventoryProducts = filteredProducts({ includeInactive: true });
  const activeCount = products.filter(isProductActive).length;
  const outOfStock = products.filter((product) => isProductActive(product) && Number(product.stock || 0) <= 0).length;
  const lowStock = products.filter((product) => isProductActive(product) && Number(product.stock || 0) > 0 && Number(product.stock || 0) <= Number(product.min_stock || 0)).length;
  const expiringSoon = products.filter((product) => isProductActive(product) && expiryStatus(product).level === "warning").length;
  const expired = products.filter((product) => isProductActive(product) && expiryStatus(product).level === "danger").length;
  const inventoryValue = products.filter(isProductActive).reduce((sum, product) => sum + Number(product.stock || 0) * Number(product.cost_price || 0), 0);
  const potentialProfit = products.filter(isProductActive).reduce((sum, product) => sum + Number(product.stock || 0) * Math.max(Number(product.sale_price || 0) - Number(product.cost_price || 0), 0), 0);
  const highValueProducts = inventoryProducts.filter((product) => inventoryClass(product) === "A").length;
  const expiringProducts = products
    .filter((product) => isProductActive(product) && ["danger", "warning"].includes(expiryStatus(product).level))
    .sort((a, b) => daysUntil(a.expires_at) - daysUntil(b.expires_at));
  const overstockProducts = products
    .filter((product) => isProductActive(product) && Number(product.min_stock || 0) > 0 && Number(product.stock || 0) >= Number(product.min_stock || 0) * 4)
    .sort((a, b) => Number(b.stock || 0) * Number(b.cost_price || 0) - Number(a.stock || 0) * Number(a.cost_price || 0));
  const marginRiskProducts = products
    .filter((product) => isProductActive(product) && Number(product.sale_price || 0) <= Number(product.cost_price || 0))
    .sort((a, b) => Number(b.stock || 0) * Number(b.cost_price || 0) - Number(a.stock || 0) * Number(a.cost_price || 0));
  const reorderProducts = products
    .filter((product) => isProductActive(product) && Number(product.stock || 0) <= Number(product.min_stock || 0))
    .sort((a, b) => {
      const priorityOrder = { alta: 3, media: 2, baja: 1 };
      return priorityOrder[reorderPriority(b).level] - priorityOrder[reorderPriority(a).level]
        || suggestedReorderQuantity(b) * Number(b.cost_price || 0) - suggestedReorderQuantity(a) * Number(a.cost_price || 0);
    });
  setCount(`${products.length} producto${products.length === 1 ? "" : "s"}`);
  mainList().innerHTML = `
    <section class="inventory-health-grid">
      <article><span>Activos</span><strong>${num(activeCount)}</strong></article>
      <article><span>Sin stock</span><strong class="${outOfStock ? "danger-text" : "ok-text"}">${num(outOfStock)}</strong></article>
      <article><span>Bajo minimo</span><strong class="${lowStock ? "warn-text" : "ok-text"}">${num(lowStock)}</strong></article>
      <article><span>Por vencer</span><strong class="${expired ? "danger-text" : expiringSoon ? "warn-text" : "ok-text"}">${num(expired + expiringSoon)}</strong></article>
    </section>
    <section class="inventory-insight-grid">
      <article><span>Valor inventario</span><strong>${money(inventoryValue)}</strong><small>Costo total en almacen</small></article>
      <article><span>Margen potencial</span><strong>${money(potentialProfit)}</strong><small>Ganancia bruta estimada</small></article>
      <article><span>Productos clase A</span><strong>${num(highValueProducts)}</strong><small>Mayor valor inmovilizado</small></article>
      <article><span>Salud inventario</span><strong class="${outOfStock || lowStock ? "warn-text" : "ok-text"}">${outOfStock ? "Critico" : lowStock ? "Revisar" : "Estable"}</strong><small>Basado en stock minimo</small></article>
    </section>
    ${renderInventoryRiskBoard({ expiringProducts, overstockProducts, marginRiskProducts })}
    <section class="admin-panel inventory-reorder-panel">
      <div class="admin-panel-head">
        <div><p class="eyebrow">Reposicion inteligente</p><h3>Productos que necesitan atencion</h3></div>
        <button class="primary-button" type="button" id="prepareSuggestedPurchaseFromInventory" ${reorderProducts.length && can("managePurchases") ? "" : "disabled"}>Preparar compra</button>
      </div>
      <div class="inventory-reorder-grid">
        ${reorderProducts.slice(0, 6).map(renderInventoryReorderCard).join("") || empty("Sin productos bajo minimo")}
      </div>
    </section>
    <section class="admin-panel inventory-operational-panel">
      <div class="admin-panel-head">
        <div><p class="eyebrow">Control de stock</p><h3>Inventario operativo</h3></div>
        ${["admin", "ventas_admin", "almacen"].includes(currentUser?.role) ? `<button class="ghost-button" type="button" id="loadStarterProducts">Cargar productos de prueba</button>` : ""}
      </div>
      ${ventasMessage ? `<div class="cloud-safe-note"><strong>${escapeHtml(ventasMessage)}</strong><span>La accion se ejecuto sobre los datos de esta empresa.</span></div>` : ""}
      <label class="toolbar-search">Buscar producto<input id="productSearchInput" type="search" value="${escapeHtml(productSearch)}" placeholder="Codigo, nombre o categoria" /></label>
      <div class="admin-list">${inventoryProducts.map(renderInventoryProductRow).join("") || empty("Sin productos con esa busqueda")}</div>
    </section>
    ${selectedKardex ? renderKardexPanel() : ""}
  `;
  bindProductSearch();
  document.querySelector("#prepareSuggestedPurchaseFromInventory")?.addEventListener("click", prepareSuggestedPurchase);
  document.querySelector("#loadStarterProducts")?.addEventListener("click", loadStarterProducts);
  document.querySelectorAll("[data-stock-move]").forEach((button) => {
    button.addEventListener("click", () => openStockMovement(button.dataset.stockMove, button.dataset.type));
  });
  document.querySelectorAll("[data-edit-product]").forEach((button) => {
    button.addEventListener("click", () => openProductModal(button.dataset.editProduct));
  });
  document.querySelectorAll("[data-product-status]").forEach((button) => {
    button.addEventListener("click", () => toggleProductStatus(button.dataset.productStatus));
  });
  document.querySelectorAll("[data-stock-history]").forEach((button) => {
    button.addEventListener("click", () => viewStockHistory(button.dataset.stockHistory));
  });
  document.querySelectorAll("[data-toggle-favorite]").forEach((button) => {
    button.addEventListener("click", () => toggleFavoriteProduct(button.dataset.toggleFavorite));
  });
  document.querySelector("#closeKardex")?.addEventListener("click", () => {
    selectedKardex = null;
    renderMain();
  });
  document.querySelector("#exportKardexCsv")?.addEventListener("click", exportSelectedKardexCsv);
}

function renderInventoryReorderCard(product) {
  const suggested = suggestedReorderQuantity(product);
  const priority = reorderPriority(product);
  const estimated = suggested * Number(product.cost_price || 0);
  const stock = Number(product.stock || 0);
  const min = Number(product.min_stock || 0);
  const pct = min > 0 ? Math.min(Math.max((stock / min) * 100, 0), 100) : stock > 0 ? 100 : 0;
  return `<article class="inventory-reorder-card is-${priority.level}">
    <div class="inventory-reorder-head">
      <span>${escapeHtml(product.code)}</span>
      <strong class="${priority.className}">${escapeHtml(priority.label)}</strong>
    </div>
    <h4>${escapeHtml(product.name)}</h4>
    <div class="stock-meter"><span style="width:${pct}%"></span></div>
    <div class="inventory-reorder-meta">
      <span>Stock ${num(stock)} / Min. ${num(min)}</span>
      <span>Sugerido ${num(suggested)}</span>
      <strong>${money(estimated)}</strong>
    </div>
  </article>`;
}

function renderInventoryRiskBoard({ expiringProducts, overstockProducts, marginRiskProducts }) {
  const totalRisk = expiringProducts.length + overstockProducts.length + marginRiskProducts.length;
  return `<section class="admin-panel inventory-risk-board">
    <div class="admin-panel-head">
      <div><p class="eyebrow">Radar de inventario</p><h3>Riesgos que conviene revisar hoy</h3></div>
      <span>${num(totalRisk)} alerta${totalRisk === 1 ? "" : "s"}</span>
    </div>
    <div class="inventory-risk-grid">
      <article class="inventory-risk-column is-danger">
        <div><strong>Vencimiento</strong><span>Prioriza salida o bloqueo antes de vender.</span></div>
        ${expiringProducts.slice(0, 4).map((product) => renderInventoryRiskItem(product, expiryStatus(product).label, "danger")).join("") || empty("Sin vencimientos proximos")}
      </article>
      <article class="inventory-risk-column is-warning">
        <div><strong>Exceso de stock</strong><span>Capital detenido por encima del minimo.</span></div>
        ${overstockProducts.slice(0, 4).map((product) => renderInventoryRiskItem(product, `Stock ${num(product.stock)} / Min. ${num(product.min_stock)}`, "warning")).join("") || empty("Sin sobrestock relevante")}
      </article>
      <article class="inventory-risk-column is-info">
        <div><strong>Precio y margen</strong><span>Productos vendidos sin ganancia visible.</span></div>
        ${marginRiskProducts.slice(0, 4).map((product) => renderInventoryRiskItem(product, `Costo ${money(product.cost_price)} / Venta ${money(product.sale_price)}`, "info")).join("") || empty("Margenes saludables")}
      </article>
    </div>
  </section>`;
}

function renderInventoryRiskItem(product, detail, type) {
  const stockValue = Number(product.stock || 0) * Number(product.cost_price || 0);
  return `<div class="inventory-risk-item is-${type}">
    <div>
      <strong>${escapeHtml(product.name)}</strong>
      <span>${escapeHtml(product.code)} / ${escapeHtml(product.category || "Sin categoria")}</span>
      <small>${escapeHtml(detail)} / Valor ${money(stockValue)}</small>
    </div>
    <div class="mini-action-row">
      <button class="ghost-button" type="button" data-stock-history="${product.id}">Kardex</button>
      ${can("manageInventory") ? `<button class="ghost-button" type="button" data-edit-product="${product.id}">Editar</button>` : ""}
    </div>
  </div>`;
}

function renderUsers() {
  setCount(`${users.length} usuario${users.length === 1 ? "" : "s"}`);
  mainList().innerHTML = currentUser.role === "admin"
    ? renderVentasUsersPanel()
    : empty("Solo el encargado de sistema puede administrar usuarios");
  bindVentasUsersPanel();
}

function renderSettings() {
  setCount("Tienda");
  mainList().innerHTML = `
    ${renderSetupAssistant()}
    ${renderStoreSettingsOverview()}
    <section class="admin-panel settings-command-panel">
      <div class="admin-panel-head"><div><p class="eyebrow">Empresa</p><h3>Datos para ventas e impresion</h3></div></div>
      <form class="admin-form" id="storeSettingsForm">
        <div class="settings-preset-row">
          <button class="ghost-button" type="button" data-settings-preset="solo">Tienda 1 persona</button>
          <button class="ghost-button" type="button" data-settings-preset="duo">Tienda 2 personas</button>
          <button class="ghost-button" type="button" data-settings-preset="control">Control estricto</button>
        </div>
        <p class="settings-preset-note">Elige un modelo rapido o ajusta manualmente las reglas de venta.</p>
        <div class="form-grid">
          <label>Nombre legal<input id="storeCompanyName" type="text" value="${escapeHtml(storeSettings.companyName || currentUser.companyName || "")}" required /></label>
          <label>Nombre comercial<input id="storeName" type="text" value="${escapeHtml(storeSettings.storeName || "")}" placeholder="Sucursal central" /></label>
          <label>Moneda<input id="storeCurrency" type="text" value="${escapeHtml(storeSettings.currency || "BOB")}" required /></label>
          <label>Cantidad de cajas<input id="storeCashRegisterCount" type="number" min="1" max="20" step="1" value="${Number(storeSettings.cashRegisterCount || 1)}" /></label>
          <label>Impuesto %<input id="storeTaxRate" type="number" min="0" max="100" step="0.01" value="${Number(storeSettings.taxRate || 0)}" /></label>
          <label>NIT / Identificacion<input id="storeTaxId" type="text" value="${escapeHtml(storeSettings.taxId || "")}" /></label>
          <label>Telefono<input id="storePhone" type="tel" value="${escapeHtml(storeSettings.phone || "")}" /></label>
          <label>Direccion<input id="storeAddress" type="text" value="${escapeHtml(storeSettings.address || "")}" /></label>
          <label class="span-2">Nota en comprobante<input id="storeTicketNote" type="text" value="${escapeHtml(storeSettings.ticketNote || "")}" placeholder="Gracias por su compra" /></label>
          <label class="settings-check"><input id="storeAllowCredit" type="checkbox" ${storeSettings.allowCredit ? "checked" : ""} /> Permitir ventas a credito</label>
          <label class="settings-check"><input id="storeAllowDiscounts" type="checkbox" ${storeSettings.allowDiscounts ? "checked" : ""} /> Permitir descuentos en caja</label>
          <label class="settings-check span-2"><input id="storeRequireCustomerForSale" type="checkbox" ${storeSettings.requireCustomerForSale ? "checked" : ""} /> Exigir cliente registrado para confirmar ventas</label>
        </div>
        <div class="modal-actions"><button class="primary-button" type="submit">Guardar configuracion</button></div>
      </form>
    </section>
    ${renderReceiptPreview()}
    ${renderRoleConfigGuide()}
  `;
  document.querySelector("#storeSettingsForm")?.addEventListener("submit", saveStoreSettings);
  document.querySelectorAll("[data-settings-preset]").forEach((button) => {
    button.addEventListener("click", () => applySettingsPreset(button.dataset.settingsPreset));
  });
}

function renderStoreSettingsOverview() {
  const rules = [
    { label: "Cajas", value: `${num(storeSettings.cashRegisterCount || 1)} configurada${Number(storeSettings.cashRegisterCount || 1) === 1 ? "" : "s"}`, detail: "Define cuantos puntos de cobro puede abrir la empresa." },
    { label: "Moneda", value: storeSettings.currency || "BOB", detail: "Aparece en POS, tickets, cierres y reportes." },
    { label: "Credito", value: storeSettings.allowCredit ? "Permitido" : "Bloqueado", detail: storeSettings.allowCredit ? "Puede vender con saldo pendiente." : "Solo pagos completos." },
    { label: "Cliente", value: storeSettings.requireCustomerForSale ? "Obligatorio" : "Opcional", detail: storeSettings.requireCustomerForSale ? "Toda venta exige cliente registrado." : "Permite venta rapida sin cliente." }
  ];
  return `<section class="settings-overview-grid">
    ${rules.map((item) => `<article><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.value)}</strong><small>${escapeHtml(item.detail)}</small></article>`).join("")}
  </section>`;
}

function renderReceiptPreview() {
  const title = storeSettings.storeName || storeSettings.companyName || currentUser.companyName || "Zow Ventas-Almacen";
  const sampleNote = storeSettings.ticketNote || "Gracias por su compra";
  const sampleTotal = 42.5;
  return `<section class="admin-panel receipt-preview-panel">
    <div class="admin-panel-head"><div><p class="eyebrow">Comprobante</p><h3>Vista previa de impresion</h3></div><span>${escapeHtml(storeSettings.currency || "BOB")}</span></div>
    <div class="receipt-preview-shell">
      <article class="receipt-preview-ticket">
        <div class="receipt-preview-brand">
          <strong>${escapeHtml(title)}</strong>
          <span>${escapeHtml(storeSettings.taxId ? `NIT/CI ${storeSettings.taxId}` : "Datos fiscales pendientes")}</span>
          <small>${escapeHtml(storeSettings.address || "Direccion de la tienda")}</small>
        </div>
        <div class="receipt-preview-meta">
          <span>COM-000001</span><span>Caja 1</span><span>${escapeHtml(formatShortDate(new Date().toISOString()))}</span>
        </div>
        <div class="receipt-preview-lines">
          <div><span>Producto ejemplo x2</span><strong>${money(24)}</strong></div>
          <div><span>Servicio / articulo x1</span><strong>${money(18.5)}</strong></div>
        </div>
        <div class="receipt-preview-total"><span>Total</span><strong>${money(sampleTotal)}</strong></div>
        <p>${escapeHtml(sampleNote)}</p>
      </article>
      <div class="receipt-preview-tips">
        <strong>Antes de vender a una empresa</strong>
        <span>Completa nombre comercial, NIT, telefono, direccion y nota. Estos datos aparecen en tickets, precomprobantes y cierres de caja.</span>
      </div>
    </div>
  </section>`;
}

function renderRoleConfigGuide() {
  return `<section class="admin-panel settings-role-guide">
    <div class="admin-panel-head"><div><p class="eyebrow">Modelos de operacion</p><h3>Adaptable a empresa chica o grande</h3></div></div>
    <div class="operation-model-grid">
      <article><span>Tienda 1 persona</span><strong>Encargado integral</strong><small>Puede configurar, vender, cerrar caja, registrar productos y ajustar stock.</small></article>
      <article><span>Tienda 2 personas</span><strong>Operador integral + encargado</strong><small>El operador integral atiende venta, caja e inventario diario sin tocar el panel ZOW.</small></article>
      <article><span>Empresa grande</span><strong>Cajas separadas</strong><small>Cajeros, almacen, vendedor y supervisor trabajan con permisos separados en el mismo punto de atencion.</small></article>
    </div>
  </section>`;
}

function renderSetupAssistant() {
  const checks = [
    { label: "Datos de empresa", done: Boolean((storeSettings.companyName || currentUser.companyName || "").trim() && (storeSettings.currency || "").trim()) },
    { label: "Cajas configuradas", done: Number(storeSettings.cashRegisterCount || 0) >= 1 },
    { label: "Usuarios creados", done: users.length > 1 },
    { label: "Productos cargados", done: products.filter(isProductActive).length > 0 },
    { label: "Clientes opcionales", done: customers.length > 0 || !storeSettings.requireCustomerForSale },
    { label: "Caja de prueba", done: cashSession?.status === "abierta" || cashClosures.length > 0 || sales.length > 0 }
  ];
  const completed = checks.filter((item) => item.done).length;
  const percent = Math.round((completed / checks.length) * 100);
  return `<section class="admin-panel setup-assistant-panel">
    <div class="admin-panel-head"><div><p class="eyebrow">Configuracion inicial</p><h3>Listo para operar al ${percent}%</h3></div><span>${completed}/${checks.length}</span></div>
    <div class="setup-progress"><span style="width:${percent}%"></span></div>
    <div class="setup-check-grid">
      ${checks.map((item) => `<article class="${item.done ? "is-done" : "is-pending"}"><strong>${item.done ? "Listo" : "Pendiente"}</strong><span>${escapeHtml(item.label)}</span></article>`).join("")}
    </div>
    <p class="setup-hint">Recomendacion: completa estos puntos antes de entregar el acceso a cajeros o almacen.</p>
  </section>`;
}

function applySettingsPreset(preset) {
  const cashCount = document.querySelector("#storeCashRegisterCount");
  const allowCredit = document.querySelector("#storeAllowCredit");
  const allowDiscounts = document.querySelector("#storeAllowDiscounts");
  const requireCustomer = document.querySelector("#storeRequireCustomerForSale");
  if (preset === "solo") {
    if (cashCount) cashCount.value = "1";
    if (allowCredit) allowCredit.checked = true;
    if (allowDiscounts) allowDiscounts.checked = true;
    if (requireCustomer) requireCustomer.checked = false;
    ventasMessage = "Preset aplicado: tienda pequena con operacion rapida.";
  }
  if (preset === "duo") {
    if (cashCount) cashCount.value = "1";
    if (allowCredit) allowCredit.checked = true;
    if (allowDiscounts) allowDiscounts.checked = true;
    if (requireCustomer) requireCustomer.checked = false;
    ventasMessage = "Preset aplicado: cajero y almacen separados.";
  }
  if (preset === "control") {
    if (cashCount) cashCount.value = String(Math.max(Number(cashCount.value || 1), 2));
    if (allowCredit) allowCredit.checked = false;
    if (allowDiscounts) allowDiscounts.checked = false;
    if (requireCustomer) requireCustomer.checked = true;
    ventasMessage = "Preset aplicado: control estricto con cliente obligatorio.";
  }
  const note = document.querySelector(".settings-preset-note");
  if (note) note.textContent = ventasMessage;
}

function renderProductRow(product) {
  const insight = productInventoryInsight(product);
  const expiry = expiryStatus(product);
  return `<article class="admin-row"><div><strong>${escapeHtml(product.name)}</strong><span>${escapeHtml(product.code)} / ${escapeHtml(product.category || "Sin categoria")} / ${escapeHtml(product.unit)}</span><span>Stock ${num(product.stock)} / Minimo ${num(product.min_stock)} / Valor ${money(insight.stockValue)}</span></div><div class="admin-row-meta"><span>Costo ${money(product.cost_price)}</span><span>Venta ${money(product.sale_price)}</span><span>Margen ${num(insight.marginPercent)}%</span>${expiry.label ? `<span class="${expiry.className}">${escapeHtml(expiry.label)}</span>` : ""}<span class="${Number(product.stock || 0) <= Number(product.min_stock || 0) ? "danger-text" : "ok-text"}">${Number(product.stock || 0) <= Number(product.min_stock || 0) ? "Bajo minimo" : "Stock OK"}</span></div></article>`;
}

function renderReorderRow(product) {
  const suggested = suggestedReorderQuantity(product);
  const priority = reorderPriority(product);
  return `<article class="admin-row">
    <div>
      <strong>${escapeHtml(product.name)}</strong>
      <span>${escapeHtml(product.code)} / ${escapeHtml(product.category || "Sin categoria")}</span>
      <span>Stock actual ${num(product.stock)} / Minimo ${num(product.min_stock)}</span>
    </div>
    <div class="admin-row-meta">
      <span>Sugerido ${num(suggested)}</span>
      <span>Costo estimado ${money(suggested * Number(product.cost_price || 0))}</span>
      <span class="${priority.className}">Prioridad ${priority.level}</span>
      <button class="ghost-button" type="button" data-stock-history="${product.id}">Kardex</button>
    </div>
  </article>`;
}

function renderInventoryProductRow(product) {
  const canMoveStock = can("adjustStock");
  const canManageProducts = can("manageInventory");
  const active = isProductActive(product);
  const insight = productInventoryInsight(product);
  const expiry = expiryStatus(product);
  return `<article class="admin-row inventory-row">
    <div>
      <strong>${escapeHtml(product.name)}</strong>
      <span>${escapeHtml(product.code)} / ${escapeHtml(product.category || "Sin categoria")} / ${escapeHtml(product.unit)}</span>
      <span>Stock ${num(product.stock)} / Minimo ${num(product.min_stock)} / Clase ${escapeHtml(insight.className)}${product.batch_number ? ` / Lote ${escapeHtml(product.batch_number)}` : ""}</span>
    </div>
    <div class="admin-row-meta">
      <span>Costo ${money(product.cost_price)}</span>
      <span>Venta ${money(product.sale_price)}</span>
      <span>Valor ${money(insight.stockValue)}</span>
      <span>Margen ${num(insight.marginPercent)}%</span>
      ${expiry.label ? `<span class="${expiry.className}">${escapeHtml(expiry.label)}</span>` : ""}
      <span class="${active ? "ok-text" : "danger-text"}">${active ? "Activo" : "Inactivo"}</span>
      <span class="${Number(product.stock || 0) <= Number(product.min_stock || 0) ? "danger-text" : "ok-text"}">${Number(product.stock || 0) <= Number(product.min_stock || 0) ? "Bajo minimo" : "Stock OK"}</span>
      <div class="mini-action-row">
        <button class="ghost-button" type="button" data-stock-history="${product.id}">Kardex</button>
        ${canManageProducts ? `<button class="ghost-button" type="button" data-edit-product="${product.id}">Editar</button>` : ""}
        ${canMoveStock ? `<button class="ghost-button" type="button" data-stock-move="${product.id}" data-type="entrada">Entrada</button><button class="ghost-button" type="button" data-stock-move="${product.id}" data-type="salida">Salida</button><button class="ghost-button" type="button" data-stock-move="${product.id}" data-type="ajuste">Ajuste</button>` : ""}
        ${can("manageFavorites") ? `<button class="ghost-button" type="button" data-toggle-favorite="${product.id}">${favoriteProducts.includes(product.id) ? "Quitar favorito" : "Favorito POS"}</button>` : ""}
        ${canManageProducts ? `<button class="ghost-button ${active ? "danger-action" : ""}" type="button" data-product-status="${product.id}">${active ? "Desactivar" : "Reactivar"}</button>` : ""}
      </div>
    </div>
  </article>`;
}

function renderKardexPanel() {
  const product = products.find((item) => item.id === selectedKardex.productId);
  const movements = buildKardexTimeline(product, selectedKardex.movements || []);
  const stats = buildKardexStats(movements);
  return `
    <section class="admin-panel kardex-panel">
      <div class="admin-panel-head">
        <div><p class="eyebrow">Kardex visual</p><h3>${escapeHtml(product?.name || "Producto")}</h3></div>
        <div class="admin-head-actions">
          <button class="ghost-button" type="button" id="exportKardexCsv">Exportar CSV</button>
          <button class="ghost-button" type="button" id="closeKardex">Cerrar</button>
        </div>
      </div>
      <div class="kardex-summary">
        <article><span>Stock actual</span><strong>${num(product?.stock || 0)}</strong></article>
        <article><span>Valor actual</span><strong>${money(Number(product?.stock || 0) * Number(product?.cost_price || 0))}</strong></article>
        <article><span>Movimientos</span><strong>${num(movements.length)}</strong></article>
        <article><span>Ultimo movimiento</span><strong>${stats.lastDate ? formatShortDate(stats.lastDate) : "Sin datos"}</strong></article>
      </div>
      <div class="kardex-control-grid">
        <article class="is-in"><span>Entradas</span><strong>${num(stats.in)}</strong><small>${num(stats.inCount)} movimiento${stats.inCount === 1 ? "" : "s"}</small></article>
        <article class="is-out"><span>Salidas</span><strong>${num(stats.out)}</strong><small>${num(stats.outCount)} movimiento${stats.outCount === 1 ? "" : "s"}</small></article>
        <article><span>Ajustes</span><strong>${num(stats.adjustments)}</strong><small>Conteos o regularizaciones</small></article>
        <article><span>Saldo calculado</span><strong>${num(stats.currentStock)}</strong><small>Segun movimientos visibles</small></article>
      </div>
      <div class="kardex-timeline">
        ${movements.map(renderKardexTimelineRow).join("") || empty("Sin movimientos de inventario")}
      </div>
    </section>
  `;
}

function buildKardexStats(movements) {
  return movements.reduce((stats, movement) => {
    const quantity = signedMovementQuantity(movement);
    if (quantity > 0) {
      stats.in += quantity;
      stats.inCount += 1;
    }
    if (quantity < 0) {
      stats.out += Math.abs(quantity);
      stats.outCount += 1;
    }
    if (String(movement.type || "").toLowerCase() === "ajuste") stats.adjustments += 1;
    if (stats.currentStock === null && movement.runningStock !== undefined) stats.currentStock = movement.runningStock;
    const date = movement.created_at || movement.createdAt;
    if (date && (!stats.lastDate || new Date(date) > new Date(stats.lastDate))) stats.lastDate = date;
    return stats;
  }, { in: 0, out: 0, inCount: 0, outCount: 0, adjustments: 0, currentStock: null, lastDate: "" });
}

function buildKardexTimeline(product, movements) {
  const chronological = [...movements].sort((a, b) => new Date(a.created_at || a.createdAt) - new Date(b.created_at || b.createdAt));
  const totalMoved = chronological.reduce((sum, movement) => sum + signedMovementQuantity(movement), 0);
  let running = Number(product?.stock || 0) - totalMoved;
  return chronological.map((movement) => {
    running += signedMovementQuantity(movement);
    return { ...movement, runningStock: running };
  }).reverse();
}

function signedMovementQuantity(movement) {
  const quantity = Number(movement.quantity || 0);
  if (quantity < 0) return quantity;
  return movement.type === "salida" ? -quantity : quantity;
}

function renderKardexTimelineRow(movement) {
  const quantity = signedMovementQuantity(movement);
  const isOut = quantity < 0;
  return `<article class="kardex-timeline-row ${isOut ? "is-out" : "is-in"}">
    <div class="kardex-dot"></div>
    <div>
      <strong>${escapeHtml(movement.type)} ${isOut ? "-" : "+"}${num(Math.abs(quantity))}</strong>
      <span>${escapeHtml(movement.reference || "Sin referencia")} / ${escapeHtml(movement.note || "Sin nota")}</span>
      <small>${formatDateTime(movement.created_at || movement.createdAt)} / ${escapeHtml(movement.created_by_name || movement.user || "Usuario")}</small>
    </div>
    <div class="admin-row-meta"><span>Saldo ${num(movement.runningStock)}</span></div>
  </article>`;
}

function exportSelectedKardexCsv() {
  if (!selectedKardex) return;
  const product = products.find((item) => item.id === selectedKardex.productId);
  const movements = buildKardexTimeline(product, selectedKardex.movements || []);
  const rows = movements.map((movement) => {
    const quantity = signedMovementQuantity(movement);
    return {
      fecha: formatDateTime(movement.created_at || movement.createdAt),
      producto: product?.name || "",
      codigo: product?.code || "",
      tipo: movement.type || "",
      cantidad: quantity,
      saldo: movement.runningStock ?? "",
      referencia: movement.reference || "",
      nota: movement.note || "",
      usuario: movement.created_by_name || movement.user || ""
    };
  });
  downloadCsv(`kardex-${slug(product?.code || product?.name || "producto")}-${csvDateStamp()}.csv`, rows);
}

function renderStockMovementRow(movement) {
  const quantity = Number(movement.quantity || 0);
  const sign = quantity < 0 || movement.type === "salida" ? "-" : "+";
  return `<article class="admin-row"><div><strong>${escapeHtml(movement.type)} ${sign}${num(Math.abs(quantity))}</strong><span>${escapeHtml(movement.reference || "Sin referencia")} / ${escapeHtml(movement.note || "Sin nota")}</span><span>${formatDateTime(movement.created_at || movement.createdAt)} / ${escapeHtml(movement.created_by_name || movement.user || "Usuario")}</span></div></article>`;
}

function renderInventoryInsightCard(item) {
  return `<article class="${item.className || ""}"><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.value)}</strong><small>${escapeHtml(item.detail)}</small></article>`;
}

function buildInventoryInsights(alerts = []) {
  const activeProducts = products.filter(isProductActive);
  const inventoryValue = activeProducts.reduce((sum, product) => sum + Number(product.stock || 0) * Number(product.cost_price || 0), 0);
  const reorderValue = alerts.reduce((sum, product) => sum + suggestedReorderQuantity(product) * Number(product.cost_price || 0), 0);
  const negativeMargin = activeProducts.filter((product) => Number(product.sale_price || 0) <= Number(product.cost_price || 0));
  const expiring = activeProducts.filter((product) => ["danger", "warning"].includes(expiryStatus(product).level));
  const inactiveValue = products.filter((product) => !isProductActive(product)).reduce((sum, product) => sum + Number(product.stock || 0) * Number(product.cost_price || 0), 0);
  return [
    { label: "Valor activo", value: money(inventoryValue), detail: "Costo de productos disponibles", className: inventoryValue ? "is-ok" : "is-muted" },
    { label: "Reposicion estimada", value: money(reorderValue), detail: "Compra sugerida para volver a nivel", className: reorderValue ? "is-warning" : "is-ok" },
    { label: "Margen a revisar", value: num(negativeMargin.length), detail: "Productos con precio menor o igual al costo", className: negativeMargin.length ? "is-danger" : "is-ok" },
    { label: "Vencimiento", value: num(expiring.length), detail: "Vencidos o por vencer en 30 dias", className: expiring.length ? "is-warning" : "is-ok" },
    { label: "Valor inactivo", value: money(inactiveValue), detail: "Capital detenido en productos desactivados", className: inactiveValue ? "is-warning" : "is-muted" }
  ];
}

function productInventoryInsight(product) {
  const cost = Number(product.cost_price || 0);
  const price = Number(product.sale_price || 0);
  const stock = Number(product.stock || 0);
  const marginPercent = price > 0 ? ((price - cost) / price) * 100 : 0;
  return {
    stockValue: stock * cost,
    potentialRevenue: stock * price,
    marginPercent: Math.round(marginPercent),
    className: inventoryClass(product)
  };
}

function validateProductPayload(product, isEditing) {
  const code = String(product.code || "").trim();
  const name = String(product.name || "").trim();
  const cost = Number(product.costPrice || 0);
  const price = Number(product.salePrice || 0);
  const minStock = Number(product.minStock || 0);
  const stock = Number(product.stock || 0);
  if (!code) return "El codigo del producto es obligatorio.";
  if (code.length < 2 || code.length > 40) return "El codigo debe tener entre 2 y 40 caracteres.";
  if (!name) return "El nombre del producto es obligatorio.";
  if (!Number.isFinite(cost) || cost < 0) return "El costo no puede ser negativo.";
  if (!Number.isFinite(price) || price <= 0) return "El precio de venta debe ser mayor a cero.";
  if (price < cost) return "El precio de venta esta por debajo del costo. Revisa el margen antes de guardar.";
  if (!Number.isFinite(minStock) || minStock < 0) return "El stock minimo no puede ser negativo.";
  if (!isEditing && (!Number.isFinite(stock) || stock < 0)) return "El stock inicial no puede ser negativo.";
  const duplicate = products.find((item) => String(item.code || "").trim().toUpperCase() === code.toUpperCase() && item.id !== editingProductId);
  if (duplicate) return `Ya existe un producto con el codigo ${code}.`;
  const barcode = String(product.barcode || "").trim();
  if (barcode) {
    const duplicateBarcode = products.find((item) => String(item.barcode || "").trim().toLowerCase() === barcode.toLowerCase() && item.id !== editingProductId);
    if (duplicateBarcode) return "El codigo de barras ya esta asignado a otro producto.";
  }
  return "";
}

function validateStoreSettingsPayload(settings) {
  if (!settings.companyName) return "El nombre legal de la empresa es obligatorio.";
  if (!settings.currency || settings.currency.length < 2) return "La moneda debe tener al menos 2 caracteres. Ej: BOB, USD.";
  if (!Number.isFinite(settings.cashRegisterCount) || settings.cashRegisterCount < 1 || settings.cashRegisterCount > 20) return "La cantidad de cajas debe estar entre 1 y 20.";
  if (!Number.isFinite(settings.taxRate) || settings.taxRate < 0 || settings.taxRate > 100) return "El impuesto debe estar entre 0 y 100%.";
  return "";
}

function inventoryClass(product) {
  const activeProducts = products.filter(isProductActive);
  const values = activeProducts.map((item) => Number(item.stock || 0) * Number(item.cost_price || 0)).sort((a, b) => b - a);
  const value = Number(product.stock || 0) * Number(product.cost_price || 0);
  if (!value) return "C";
  const rank = values.findIndex((item) => item <= value) + 1;
  const ratio = rank / Math.max(values.length, 1);
  if (ratio <= 0.2) return "A";
  if (ratio <= 0.5) return "B";
  return "C";
}

function reorderPriority(product) {
  const stock = Number(product.stock || 0);
  const min = Number(product.min_stock || 0);
  const value = Number(product.cost_price || 0) * suggestedReorderQuantity(product);
  if (stock <= 0 || value >= 500 || inventoryClass(product) === "A") return { level: "alta", className: "danger-text" };
  if (stock <= min || value >= 150) return { level: "media", className: "warn-text" };
  return { level: "baja", className: "ok-text" };
}

function renderSellProduct(product) {
  const stock = Number(product.stock || 0);
  const expiry = expiryStatus(product);
  const blocked = stock <= 0 || expiry.level === "danger";
  const productCode = product.barcode ? `${product.code} / ${product.barcode}` : product.code;
  const recentClass = posFeedbackTargetId === product.id ? " is-recently-added" : "";
  const stockLevel = stock <= 0 ? "danger" : stock <= Number(product.min_stock || 0) || expiry.level === "warning" ? "warning" : "ok";
  const isFavorite = favoriteProducts.includes(product.id);
  const alertLabel = stock <= 0 ? "Agotado" : expiry.level === "danger" ? "Vencido" : expiry.level === "warning" ? "Por vencer" : stock <= Number(product.min_stock || 0) ? "Stock bajo" : "";
  return `<button class="pos-product-card touch-product-card${recentClass}" type="button" data-add-product="${product.id}" ${blocked ? "disabled" : ""}>
    <span class="product-visual" aria-hidden="true"><i></i><i></i><i></i></span>
    <span class="product-badge-row">${isFavorite ? `<small class="product-badge is-favorite">Favorito</small>` : ""}${alertLabel ? `<small class="product-badge is-${stockLevel}">${escapeHtml(alertLabel)}</small>` : ""}</span>
    <span class="product-code">${escapeHtml(productCode)}</span>
    <strong>${escapeHtml(product.name)}</strong>
    <span class="product-meta"><span>${escapeHtml(product.category || "Sin categoria")}</span><small class="stock-chip is-${stockLevel}">Stock ${num(stock)}${expiry.level !== "none" ? ` / ${escapeHtml(expiry.label)}` : ""}</small></span>
    <b>${money(product.sale_price)}</b>
    <span class="product-add-hint">Agregar</span>
  </button>`;
}

function renderSellCombo(combo) {
  const available = comboAvailableStock(combo);
  const baseTotal = combo.items.reduce((sum, item) => sum + Number(item.salePrice || 0) * Number(item.quantity || 0), 0);
  const recentClass = posFeedbackTargetId === combo.id ? " is-recently-added" : "";
  return `<button class="pos-product-card touch-product-card combo-product-card${recentClass}" type="button" data-add-combo="${combo.id}" ${available <= 0 ? "disabled" : ""}>
    <span class="product-visual combo-visual" aria-hidden="true"><i></i><i></i><i></i></span>
    <span class="product-code">${escapeHtml(combo.code)}</span>
    <strong>${escapeHtml(combo.name)}</strong>
    <span class="product-meta"><span>${combo.items.length} productos</span><small>Disponibles ${num(available)}</small></span>
    <small>${combo.items.map((item) => `${escapeHtml(item.productName)} x ${num(item.quantity)}`).join(" + ")}</small>
    <b>${money(combo.price)}</b>
    ${baseTotal > combo.price ? `<small class="ok-text">Ahorro ${money(baseTotal - combo.price)}</small>` : ""}
  </button>`;
}

function renderLastSaleReceipt() {
  const sale = lastSaleReceipt?.sale;
  if (!sale) return "";
  return `<article class="last-sale-receipt">
    <div>
      <span>Ultima venta emitida</span>
      <strong>${escapeHtml(sale.code)}</strong>
      <small>${money(sale.total)} / ${escapeHtml(paymentLabel(sale.payment_method || "efectivo"))}</small>
    </div>
    <button class="ghost-button" type="button" data-last-sale-reprint>Reimprimir</button>
  </article>`;
}

function renderPosMiniCartPreview(totals, isCashOpen) {
  const previewItems = saleCart.slice(-3).reverse();
  const hiddenCount = Math.max(saleCart.length - previewItems.length, 0);
  return `<aside class="pos-mini-cart-preview" aria-label="Resumen rapido del carrito">
    <div class="mini-cart-preview-head">
      <div><span>Carrito activo</span><strong>${money(totals.total)}</strong></div>
      <button class="ghost-button" type="button" data-pos-panel="cart">Ver detalle</button>
    </div>
    <div class="mini-cart-preview-list">
      ${previewItems.map((item) => `<div><span>${num(item.quantity)}x ${escapeHtml(item.name)}</span><strong>${money(Math.max(item.quantity * item.salePrice - Number(item.discount || 0), 0))}</strong></div>`).join("")}
      ${hiddenCount ? `<small>+ ${num(hiddenCount)} producto${hiddenCount === 1 ? "" : "s"} mas en carrito</small>` : ""}
    </div>
    <button class="primary-button icon-text-button" type="button" data-mini-checkout ${isCashOpen ? "" : "disabled"}><span class="ui-ico">$</span>Cobrar ahora</button>
  </aside>`;
}

function renderCartItem(item) {
  const lineSubtotal = item.quantity * item.salePrice;
  const lineDiscount = storeSettings.allowDiscounts ? Number(item.discount || 0) : 0;
  const product = products.find((entry) => entry.id === item.productId);
  const stockAfterSale = Number(product?.stock || 0) - Number(item.quantity || 0);
  const minStock = Number(product?.min_stock || 0);
  const stockClass = stockAfterSale < 0 ? "danger-text" : stockAfterSale <= minStock ? "warn-text" : "ok-text";
  return `<article class="cart-line touch-cart-line">
    <div class="cart-item-name">
      <strong>${escapeHtml(item.name)}</strong>
      <span>${money(item.salePrice)} c/u</span>
      <small class="${stockClass}">Stock despues: ${num(stockAfterSale)}</small>
      ${item.comboName ? `<small class="ok-text">Combo: ${escapeHtml(item.comboName)}</small>` : ""}
      ${item.promotionName ? `<small class="ok-text">${escapeHtml(item.promotionName)}</small>` : ""}
    </div>
    <div class="cart-line-controls">
      <div class="cart-qty touch-qty"><button class="ghost-button" type="button" data-cart-dec="${item.productId}" aria-label="Restar cantidad">-</button><strong>${item.quantity}</strong><button class="ghost-button" type="button" data-cart-inc="${item.productId}" aria-label="Sumar cantidad">+</button></div>
      <label class="cart-discount-field">Descuento<input type="number" min="0" step="0.01" value="${Number(lineDiscount || 0)}" data-cart-discount="${item.productId}" ${storeSettings.allowDiscounts && !item.comboId ? "" : "disabled"} /></label>
    </div>
    <div class="cart-line-footer">
      <strong>${money(Math.max(lineSubtotal - lineDiscount, 0))}</strong>
      <button class="ghost-button danger-action" type="button" data-remove-cart="${item.productId}">Quitar</button>
    </div>
  </article>`;
}

function renderSaleRow(sale) {
  const status = saleStatus(sale);
  const label = status === "anulada" ? "Anulada" : Number(sale.balance_due || 0) > 0 ? "Credito pendiente" : sale.cash_closed ? "Caja cerrada" : "Pendiente caja";
  return `<article class="admin-row"><div><strong>${escapeHtml(sale.code)}</strong><span>${escapeHtml(sale.customer_name || "Cliente sin registrar")} / ${escapeHtml(sale.seller_name || "Vendedor")}</span><span>${formatDateTime(sale.created_at)}</span></div><div class="admin-row-meta"><span>Total ${money(sale.total)}</span><span class="${status === "anulada" ? "danger-text" : status === "pagada" ? "ok-text" : "warn-text"}">${label}</span></div></article>`;
}

function renderHistorySaleRow(sale) {
  const meta = localSaleMeta[sale.id] || {};
  const status = saleStatus(sale);
  const canVoid = status !== "anulada" && !sale.cash_closed && can("voidSales");
  const method = paymentLabel(sale.payment_method || meta.method || "efectivo");
  const statusClass = status === "anulada" ? "danger-text" : status === "pagada" ? "ok-text" : "warn-text";
  const operationMode = sale.cash_closed ? "Caja cerrada" : status === "anulada" ? "Operacion anulada" : canVoid ? "Anulable" : "Consulta";
  return `<article class="sales-history-row ${status === "anulada" ? "is-voided" : ""}">
    <div class="sales-history-main">
      <span class="sales-history-code">${escapeHtml(sale.code)}</span>
      <strong>${escapeHtml(sale.customer_name || "Cliente sin registrar")}</strong>
      <span>${formatDateTime(sale.created_at)} / ${escapeHtml(sale.seller_name || "Cajero")}</span>
      <small>${escapeHtml(operationMode)}</small>
    </div>
    <div class="sales-history-money">
      <span>Total</span>
      <strong>${money(sale.total)}</strong>
      <small>${escapeHtml(method)} / Pagado ${money(sale.amount_paid || sale.cash_received || 0)}</small>
      ${Number(sale.balance_due || 0) > 0 ? `<small class="warn-text">Debe ${money(sale.balance_due)}</small>` : ""}
    </div>
    <div class="sales-history-state">
      <span class="${statusClass}">${escapeHtml(status)}</span>
      <small>${status === "anulada" ? "Stock devuelto" : sale.cash_closed ? "Caja cerrada" : "Editable en turno"}</small>
    </div>
    <div class="sales-history-actions">
      <button class="ghost-button" type="button" data-detail-sale="${sale.id}">Detalle</button>
      <button class="ghost-button" type="button" data-reprint-sale="${sale.id}">Reimprimir</button>
      ${canVoid ? `<button class="ghost-button danger-action" type="button" data-void-sale="${sale.id}">Anular</button>` : ""}
    </div>
  </article>`;
}

function saleStatus(sale) {
  if (sale.status === "anulada") return "anulada";
  if (sale.return_status === "total") return "devuelta";
  if (sale.return_status === "parcial") return "devolucion parcial";
  if (sale.payment_status === "pendiente" || Number(sale.balance_due || 0) > 0) return "pendiente";
  if (sale.payment_status === "pagada") return "pagada";
  const meta = localSaleMeta[sale.id] || {};
  return meta.status || (sale.cash_closed ? "pagada" : "pendiente");
}

function renderCashMovementRow(movement) {
  return `<article class="admin-row"><div><strong>${movement.type === "ingreso" ? "Ingreso" : "Egreso"} ${money(movement.amount)}</strong><span>${escapeHtml(movement.reason)}</span><span>${formatDateTime(movement.createdAt)} / ${escapeHtml(movement.user)}</span></div></article>`;
}

function renderCashClosureRow(closure) {
  const difference = Number(closure.differenceAmount || 0);
  const differenceClass = difference === 0 ? "ok-text" : Math.abs(difference) <= 1 ? "warn-text" : "danger-text";
  return `<article class="admin-row cash-closure-row">
    <div>
      <strong>${escapeHtml(closure.code)}</strong>
      <span>Caja ${num(closure.registerNumber)} / ${formatDateTime(closure.createdAt)} / ${closure.saleCount} venta${closure.saleCount === 1 ? "" : "s"}</span>
      <span>Apertura ${money(closure.openingAmount)} / Ventas ${money(closure.totalSales)} / Movimientos ${money(closure.movementTotal)}</span>
      ${closure.note ? `<span>Observacion: ${escapeHtml(closure.note)}</span>` : ""}
    </div>
    <div class="admin-row-meta">
      <span>Esperado ${money(closure.expectedAmount)}</span>
      <span>Contado ${money(closure.countedAmount)}</span>
      <span class="${differenceClass}">Diferencia ${money(difference)}</span>
      <button class="ghost-button" type="button" data-print-closure="${closure.id}">Imprimir cierre</button>
    </div>
  </article>`;
}

function renderVentasCommandCenter() {
  const modules = [
    ["Gestion comercial", "Ventas, clientes, promociones y listas de precios.", "sell"],
    ["Gestion operativa", "Compras, proveedores, stock minimo y reposicion.", "purchases"],
    ["Gestion administrativa", "Caja, liquidaciones, auditoria y reportes.", "finance"]
  ];
  return `
    <section class="ventas-module-grid">
      ${modules.map(([title, description, view]) => `
        <button class="ventas-module-card" type="button" data-module-view="${view}" ${canAccessView(view) ? "" : "disabled"}>
          <span>${escapeHtml(title)}</span>
          <strong>${escapeHtml(description)}</strong>
        </button>
      `).join("")}
    </section>
  `;
}

function renderServiceStrip() {
  return `
    <section class="service-strip" aria-label="Servicios SaaS">
      <article><span>Respaldo</span><strong>Datos en la nube</strong></article>
      <article><span>Soporte</span><strong>Asistencia operativa</strong></article>
      <article><span>Capacitacion</span><strong>Usuarios y procesos</strong></article>
      <article><span>Mantenimiento</span><strong>Mejoras continuas</strong></article>
    </section>
  `;
}

function buildRouteGroups() {
  const seeds = [
    { code: "R-01", name: "Ruta Centro", priority: "Alta rotacion" },
    { code: "R-02", name: "Ruta Norte", priority: "Clientes frecuentes" },
    { code: "R-03", name: "Ruta Mayorista", priority: "Volumen" }
  ];
  return seeds.map((route, index) => ({
    ...route,
    customers: customers.filter((_, customerIndex) => customerIndex % seeds.length === index).slice(0, 5)
  }));
}

function renderPriceRow(product) {
  const margin = Number(product.sale_price || 0) - Number(product.cost_price || 0);
  return `<article class="price-row"><div><strong>${escapeHtml(product.name)}</strong><span>${escapeHtml(product.code)} / ${escapeHtml(product.category || "Sin categoria")}</span></div><div><span>${money(product.sale_price)}</span><small>Margen ${money(margin)}</small></div></article>`;
}

function filteredProducts(options = {}) {
  const term = String(options.term ?? productSearch).trim().toLowerCase();
  const source = options.includeInactive ? products : products.filter(isProductActive);
  const category = String(options.category || "").trim().toLowerCase();
  return source.filter((product) => {
    const matchesCategory = !category || String(product.category || "").trim().toLowerCase() === category;
    const matchesTerm = !term || [product.code, product.barcode, product.name, product.category]
      .some((value) => String(value || "").toLowerCase().includes(term));
    return matchesCategory && matchesTerm;
  });
}

function sortProductsForPos(productList) {
  const term = normalizeText(productSearch);
  return [...productList].sort((a, b) => productPosRank(b, term) - productPosRank(a, term) || String(a.name || "").localeCompare(String(b.name || ""), "es"));
}

function productPosRank(product, term) {
  const stock = Number(product.stock || 0);
  const minStock = Number(product.min_stock || 0);
  const code = normalizeText(product.code);
  const barcode = normalizeText(product.barcode);
  const name = normalizeText(product.name);
  const category = normalizeText(product.category);
  const expiry = expiryStatus(product);
  let rank = 0;
  if (favoriteProducts.includes(product.id)) rank += 80;
  if (stock > 0) rank += 35;
  if (stock > minStock) rank += 12;
  if (expiry.level === "warning") rank -= 18;
  if (expiry.level === "danger" || stock <= 0) rank -= 90;
  if (term) {
    if (code === term || barcode === term) rank += 120;
    else if (name === term) rank += 95;
    else if (code.startsWith(term) || barcode.startsWith(term)) rank += 65;
    else if (name.startsWith(term)) rank += 45;
    else if (category.includes(term)) rank += 18;
  }
  return rank;
}

function productCategories() {
  return [...new Set(products.map((product) => String(product.category || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
}

function bindProductSearch() {
  const input = document.querySelector("#productSearchInput");
  if (!input) return;
  input.addEventListener("input", () => {
    productSearch = input.value;
    clearTimeout(productSearchTimer);
    const caretPosition = input.selectionStart || productSearch.length;
    const mobile = isMobilePos();
    productSearchTimer = window.setTimeout(() => {
      if (document.activeElement === input && input.value !== productSearch) return;
      posMobilePanel = "products";
      renderMain();
      window.requestAnimationFrame(() => {
        const nextInput = document.querySelector("#productSearchInput");
        if (!nextInput || activeView !== "sell") return;
        if (!mobile) nextInput.focus({ preventScroll: true });
        nextInput.setSelectionRange(caretPosition, caretPosition);
      });
    }, mobile ? 1250 : 760);
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      clearTimeout(productSearchTimer);
      scanAddProduct();
    }
    if (event.key === "Escape") {
      clearTimeout(productSearchTimer);
      productSearch = "";
      renderMain();
    }
  });
  if (activeView === "sell" && !isMobilePos()) {
    window.requestAnimationFrame(() => input.focus({ preventScroll: true }));
  }
}

function renderVentasUsersPanel() {
  const editing = users.find((user) => user.id === editingUserId);
  const operativeUsers = users.filter((user) => ["ventas_admin", "cajero", "almacen", "vendedor", "supervisor"].includes(user.role));
  return `
    <section class="admin-panel">
      <div class="admin-panel-head">
        <div><p class="eyebrow">Usuarios Ventas-Almacen</p><h3>Credenciales operativas</h3></div>
        <span>${operativeUsers.length} usuario${operativeUsers.length === 1 ? "" : "s"}</span>
      </div>
      ${ventasMessage ? `<div class="cloud-safe-note"><strong>${escapeHtml(ventasMessage)}</strong><span>Si algo no se guarda, revisa que la contrasena tenga mayuscula, minuscula, numero y 10 caracteres como minimo.</span></div>` : ""}
      <div class="role-template-grid" aria-label="Plantillas de roles">
        <button type="button" data-role-template="integral"><span>1 o 2 personas</span><strong>Operador integral</strong><small>Venta, caja, inventario, rutas y reportes.</small></button>
        <button type="button" data-role-template="cashier"><span>Mostrador</span><strong>Cajero vendedor</strong><small>Venta, clientes, caja y rutas basicas.</small></button>
        <button type="button" data-role-template="warehouse"><span>Almacen</span><strong>Responsable stock</strong><small>Inventario, entradas, salidas y alertas.</small></button>
      </div>
      ${renderRolePermissionsOverview()}
      <form class="admin-form" id="ventasUserForm">
        <div class="form-grid">
          <label>Nombre completo<input id="ventasUserName" type="text" value="${escapeHtml(editing?.name || "")}" required /></label>
          <label>Usuario<input id="ventasUsername" type="email" value="${escapeHtml(editing?.username || "")}" placeholder="usuario@empresa.com" required /></label>
          <label>Contrasena<input id="ventasUserPassword" type="password" autocomplete="new-password" placeholder="${editing ? "Dejar vacio para mantener" : "Minimo 10 caracteres"}" ${editing ? "" : "required"} /></label>
          <label>CI<input id="ventasUserCi" type="text" value="${escapeHtml(editing?.ci || "")}" /></label>
          <label>Celular<input id="ventasUserPhone" type="tel" value="${escapeHtml(editing?.phone || "")}" /></label>
          <label>Cargo<input id="ventasUserPosition" type="text" value="${escapeHtml(editing?.position || "")}" placeholder="Cajero, almacen, vendedor" /></label>
          <label>Rol
            <select id="ventasUserRole" required>
              <option value="ventas_admin" ${editing?.role === "ventas_admin" ? "selected" : ""}>Operador integral / administrador ventas</option>
              <option value="cajero" ${editing?.role === "cajero" ? "selected" : ""}>Cajero</option>
              <option value="almacen" ${editing?.role === "almacen" ? "selected" : ""}>Almacen</option>
              <option value="vendedor" ${editing?.role === "vendedor" ? "selected" : ""}>Vendedor</option>
              <option value="supervisor" ${editing?.role === "supervisor" ? "selected" : ""}>Supervisor</option>
            </select>
          </label>
          <label>Caja asignada
            <select id="ventasUserCashRegister">
              <option value="0" ${Number(editing?.cashRegisterNumber || 0) === 0 ? "selected" : ""}>Sin caja fija</option>
              ${cashRegisterOptions().map((item) => `<option value="${item}" ${Number(editing?.cashRegisterNumber || 0) === item ? "selected" : ""}>Caja ${item}</option>`).join("")}
            </select>
          </label>
          <label>Unidad / area
            <select id="ventasUserUnit" required>
              ${units.map((unit) => `<option value="${unit.id}" ${editing?.unitId === unit.id || (!editing && unit.id === currentUser.unitId) ? "selected" : ""}>${escapeHtml(unit.name)}</option>`).join("")}
            </select>
          </label>
        </div>
        <div class="modal-actions">
          ${editing ? `<button class="ghost-button" type="button" id="cancelVentasUserEdit">Cancelar edicion</button>` : ""}
          <button class="primary-button" type="submit">${editing ? "Actualizar usuario" : "Crear usuario"}</button>
        </div>
      </form>
      <div class="admin-list">${operativeUsers.map(renderVentasUserRow).join("") || empty("Aun no hay usuarios operativos de ventas")}</div>
    </section>
  `;
}

function bindVentasUsersPanel() {
  document.querySelector("#ventasUserForm")?.addEventListener("submit", saveVentasUser);
  document.querySelector("#cancelVentasUserEdit")?.addEventListener("click", () => {
    editingUserId = "";
    ventasMessage = "";
    renderMain();
  });
  document.querySelectorAll("[data-edit-user]").forEach((button) => {
    button.addEventListener("click", () => {
      editingUserId = button.dataset.editUser;
      ventasMessage = "Editando usuario. Deja la contrasena vacia si no deseas cambiarla.";
      renderMain();
    });
  });
  document.querySelectorAll("[data-toggle-user]").forEach((button) => {
    button.addEventListener("click", () => toggleVentasUser(button.dataset.toggleUser));
  });
  document.querySelectorAll("[data-role-template]").forEach((button) => {
    button.addEventListener("click", () => applyRoleTemplate(button.dataset.roleTemplate));
  });
}

function renderVentasUserRow(user) {
  return `<article class="admin-row">
    <div>
      <strong>${escapeHtml(user.name)}</strong>
      <span>${escapeHtml(user.username)} / ${roleLabel(user.role)}</span>
      <span>${escapeHtml(user.unitName || "Sin unidad")} / ${escapeHtml(user.position || "Sin cargo")} / ${user.cashRegisterNumber ? `Caja ${num(user.cashRegisterNumber)}` : "Sin caja fija"}</span>
    </div>
    <div class="admin-row-meta">
      <span class="${user.active ? "ok-text" : "danger-text"}">${user.active ? "Activo" : "Inactivo"}</span>
      <button class="ghost-button" type="button" data-edit-user="${user.id}">Editar</button>
      <button class="ghost-button" type="button" data-toggle-user="${user.id}">${user.active ? "Desactivar" : "Activar"}</button>
    </div>
  </article>`;
}

function renderRolePermissionsOverview() {
  const roles = rolePermissionMatrix();
  return `<section class="role-permission-grid" aria-label="Permisos por rol">
    ${roles.map((role) => `<article>
      <div><span>${escapeHtml(role.context)}</span><strong>${escapeHtml(role.label)}</strong></div>
      <ul>${role.permissions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </article>`).join("")}
  </section>`;
}

function rolePermissionMatrix() {
  return [
    { label: "Encargado de sistema", context: "Configuracion", permissions: ["Usuarios y roles", "Datos de empresa", "Cajas, permisos y reglas"] },
    { label: "Operador integral", context: "Empresa pequena", permissions: ["Ventas y caja", "Inventario y compras", "Reportes operativos"] },
    { label: "Cajero", context: "Mostrador", permissions: ["Venta POS", "Abrir y cerrar su caja", "Historial y reimpresion"] },
    { label: "Almacen", context: "Stock", permissions: ["Productos e inventario", "Compras y reposicion", "Kardex y alertas"] },
    { label: "Supervisor", context: "Control", permissions: ["Reportes y auditoria", "Anular o devolver ventas", "Revision de caja"] },
    { label: "Vendedor", context: "Atencion", permissions: ["Venta rapida", "Clientes", "Historial propio"] }
  ];
}

function addToCart(productId, quantity = 1, options = {}) {
  const product = products.find((item) => item.id === productId);
  if (!product) return;
  const existing = saleCart.find((item) => item.productId === productId);
  const stock = Number(product.stock || 0);
  const expiry = expiryStatus(product);
  if (expiry.level === "danger") {
    ventasMessage = `${product.name} esta vencido y no puede venderse. Revisa inventario.`;
    return renderMain();
  }
  const currentQuantity = Number(existing?.quantity || 0);
  const requestedQuantity = Math.max(Math.floor(Number(quantity || 1)), 1);
  if (currentQuantity + requestedQuantity > stock) {
    ventasMessage = `Stock insuficiente para ${product.name}. Disponible: ${num(stock)}.`;
    return renderMain();
  }
  if (existing) existing.quantity += requestedQuantity;
  else saleCart.push({ productId, name: product.name, quantity: requestedQuantity, salePrice: Number(product.sale_price || 0), discount: 0 });
  applyPromotionsToCart();
  showPosFeedback(`${requestedQuantity} x ${product.name} agregado al carrito.${expiry.level === "warning" ? ` Atencion: ${expiry.label}.` : ""}`, product.id);
  posMobilePanel = "products";
  if (options.clearSearch || !isMobilePos()) productSearch = "";
  renderMain();
}

function addComboToCart(comboId, options = {}) {
  const combo = combos.find((item) => item.id === comboId);
  if (!combo || !combo.active) return;
  if (combo.items.some((item) => saleCart.some((cartItem) => cartItem.productId === item.productId))) {
    ventasMessage = "Para aplicar el precio del combo, primero quita del carrito los productos que ya forman parte de ese combo.";
    return renderMain();
  }
  const available = comboAvailableStock(combo);
  if (available <= 0) {
    ventasMessage = `Stock insuficiente para el combo ${combo.name}.`;
    return renderMain();
  }
  const baseTotal = combo.items.reduce((sum, item) => sum + Number(item.salePrice || 0) * Number(item.quantity || 0), 0);
  const priceRatio = baseTotal > 0 ? Math.min(Number(combo.price || 0) / baseTotal, 1) : 1;
  combo.items.forEach((component) => {
    const product = products.find((item) => item.id === component.productId);
    if (!product) return;
    saleCart.push({
      productId: product.id,
      name: product.name,
      quantity: Number(component.quantity || 0),
      salePrice: Number(product.sale_price || 0) * priceRatio,
      discount: 0,
      comboId: combo.id,
      comboName: combo.name
    });
  });
  showPosFeedback(`Combo ${combo.name} agregado al carrito.`, combo.id);
  posMobilePanel = "products";
  if (options.clearSearch || !isMobilePos()) productSearch = "";
  renderMain();
}

function showPosFeedback(message, targetId = "") {
  ventasMessage = "";
  posFeedbackMessage = message;
  posFeedbackTargetId = targetId;
  clearTimeout(posFeedbackTimer);
  posFeedbackTimer = window.setTimeout(() => {
    posFeedbackMessage = "";
    posFeedbackTargetId = "";
    if (activeView === "sell") renderMain();
  }, 1800);
}

function removeFromCart(productId) {
  clearPosFeedback();
  saleCart = saleCart.filter((item) => item.productId !== productId);
  renderMain();
}

function updateCartQuantity(productId, delta) {
  clearPosFeedback();
  const product = products.find((item) => item.id === productId);
  const stock = Number(product?.stock || 0);
  saleCart = saleCart
    .map((item) => {
      if (item.productId !== productId) return item;
      const nextQuantity = Math.max(0, item.quantity + delta);
      if (delta > 0 && nextQuantity > stock) {
        ventasMessage = `No hay mas stock disponible para ${item.name}.`;
        return item;
      }
      ventasMessage = "";
      return { ...item, quantity: nextQuantity };
    })
    .filter((item) => item.quantity > 0);
  applyPromotionsToCart();
  renderMain();
}

function clearPosFeedback() {
  clearTimeout(posFeedbackTimer);
  posFeedbackMessage = "";
  posFeedbackTargetId = "";
}

function updateCartDiscount(productId, discount) {
  clearPosFeedback();
  if (!storeSettings.allowDiscounts) {
    ventasMessage = "Los descuentos estan desactivados para esta tienda.";
    return renderMain();
  }
  saleCart = saleCart.map((item) => item.productId === productId ? { ...item, discount: Math.max(discount, 0) } : item);
  renderMain();
}

function applyPromotionsToCart() {
  if (!storeSettings.allowDiscounts) return;
  saleCart = saleCart.map((item) => {
    if (item.comboId) return item;
    const promotion = bestPromotionForCartItem(item);
    if (!promotion) return { ...item, discount: Number(item.discount || 0), promotionId: "" };
    const lineSubtotal = Number(item.quantity || 0) * Number(item.salePrice || 0);
    const rawDiscount = promotion.type === "percent" ? lineSubtotal * Number(promotion.value || 0) / 100 : Number(promotion.value || 0) * Number(item.quantity || 0);
    return {
      ...item,
      discount: Math.min(Math.max(rawDiscount, 0), lineSubtotal),
      promotionId: promotion.id,
      promotionName: promotion.name
    };
  });
}

function bestPromotionForCartItem(item) {
  const product = products.find((entry) => entry.id === item.productId);
  return promotions
    .filter((promotion) => promotionMatchesCartItem(promotion, item, product) && isPromotionActiveNow(promotion) && Number(item.quantity || 0) >= Number(promotion.minQuantity || 1))
    .sort((a, b) => promotionDiscountAmount(b, item) - promotionDiscountAmount(a, item))[0];
}

function promotionMatchesCartItem(promotion, item, product) {
  if (promotion.scopeType === "category") return normalizeText(promotion.category) === normalizeText(product?.category);
  return promotion.productId === item.productId;
}

function promotionDiscountAmount(promotion, item) {
  const subtotal = Number(item.quantity || 0) * Number(item.salePrice || 0);
  return promotion.type === "percent" ? subtotal * Number(promotion.value || 0) / 100 : Number(promotion.value || 0) * Number(item.quantity || 0);
}

function cartTotals() {
  const subtotal = saleCart.reduce((sum, item) => sum + item.quantity * item.salePrice, 0);
  const lineDiscount = storeSettings.allowDiscounts ? saleCart.reduce((sum, item) => sum + Number(item.discount || 0), 0) : 0;
  const globalDiscount = storeSettings.allowDiscounts ? Number(saleGlobalDiscount || 0) : 0;
  const discount = Math.min(lineDiscount + globalDiscount, subtotal);
  const taxableBase = Math.max(subtotal - discount, 0);
  const tax = taxableBase * Number(storeSettings.taxRate || 0) / 100;
  return { subtotal, discount, tax, total: Math.max(taxableBase + tax, 0) };
}

function cartEstimatedProfit() {
  const grossProfit = saleCart.reduce((sum, item) => {
    const product = products.find((entry) => entry.id === item.productId);
    const unitCost = Number(product?.cost_price || 0);
    return sum + Math.max(Number(item.salePrice || 0) - unitCost, 0) * Number(item.quantity || 0) - Number(item.discount || 0);
  }, 0);
  return Math.max(grossProfit - Number(saleGlobalDiscount || 0), 0);
}

function isMobilePos() {
  return window.matchMedia("(max-width: 760px)").matches;
}

function scanAddProduct() {
  const parsed = parseProductSearch(productSearch);
  const term = parsed.term.toLowerCase();
  const product = products.find((item) => [item.code, item.barcode, item.name].some((value) => String(value || "").toLowerCase() === term)) || filteredProducts({ term: parsed.term })[0];
  if (product) addToCart(product.id, parsed.quantity, { clearSearch: true });
  else {
    ventasMessage = "No encontre un producto con ese codigo, barras o nombre.";
    renderMain();
  }
}

function parseProductSearch(rawValue) {
  let term = String(rawValue || "").trim();
  let quantity = 1;
  const prefixMatch = term.match(/^(\d+(?:[.,]\d+)?)\s*x\s+(.+)$/i);
  const suffixMatch = term.match(/^(.+?)\s*(?:x|\*)\s*(\d+(?:[.,]\d+)?)$/i);
  if (prefixMatch) {
    quantity = Number(prefixMatch[1].replace(",", "."));
    term = prefixMatch[2].trim();
  } else if (suffixMatch) {
    term = suffixMatch[1].trim();
    quantity = Number(suffixMatch[2].replace(",", "."));
  }
  return { term, quantity: Math.max(Math.floor(quantity || 1), 1) };
}

function newSale() {
  saleCart = [];
  productSearch = "";
  productCategoryFilter = "";
  lastSaleReceipt = null;
  saleCustomerId = "";
  saleGlobalDiscount = 0;
  saleNote = "";
  posMobilePanel = "products";
  renderMain();
}

function cancelCurrentSale() {
  saleCart = [];
  productSearch = "";
  productCategoryFilter = "";
  saleCustomerId = "";
  saleGlobalDiscount = 0;
  saleNote = "";
  ventasMessage = "Venta cancelada.";
  posMobilePanel = "products";
  renderMain();
}

async function suspendCurrentSale() {
  if (!saleCart.length) return;
  const payload = { items: saleCart, customerId: saleCustomerId, globalDiscount: saleGlobalDiscount, note: saleNote };
  try {
    await apiRequest("/ventas/suspended-sales", { method: "POST", body: payload });
    persistJson(SUSPENDED_SALES_KEY, []);
    saleCart = [];
    productSearch = "";
    productCategoryFilter = "";
    saleCustomerId = "";
    saleGlobalDiscount = 0;
    saleNote = "";
    ventasMessage = "Venta suspendida y guardada en la nube.";
    await render();
  } catch (error) {
    suspendedSales = [{ id: crypto.randomUUID(), ...payload, createdAt: new Date().toISOString() }, ...suspendedSales].slice(0, 10);
    persistJson(SUSPENDED_SALES_KEY, suspendedSales);
    saleCart = [];
    productSearch = "";
    productCategoryFilter = "";
    saleCustomerId = "";
    saleGlobalDiscount = 0;
    saleNote = "";
    ventasMessage = error.message || "Venta suspendida localmente. Revisa conexion para guardarla en la nube.";
    renderMain();
  }
}

async function recoverSuspendedSale() {
  if (!suspendedSales.length) return;
  const recovered = suspendedSales.shift();
  saleCart = recovered.items || [];
  saleCustomerId = recovered.customerId || "";
  saleGlobalDiscount = Number(recovered.globalDiscount || 0);
  saleNote = recovered.note || "";
  posMobilePanel = "cart";
  if (recovered.id && !recovered.localOnly) {
    try {
      await apiRequest(`/ventas/suspended-sales/${recovered.id}`, { method: "DELETE" });
    } catch {
      suspendedSales = [recovered, ...suspendedSales];
      ventasMessage = "No se pudo retirar la venta suspendida de la nube. Intenta nuevamente.";
      return renderMain();
    }
  } else {
    persistJson(SUSPENDED_SALES_KEY, suspendedSales);
  }
  ventasMessage = "Venta recuperada.";
  renderMain();
}

function openPaymentModal() {
  if (!saleCart.length) return;
  if (storeSettings.requireCustomerForSale && !saleCustomerId) {
    ventasMessage = "Selecciona o registra un cliente antes de cobrar.";
    return renderMain();
  }
  if (!storeSettings.allowCredit && paymentDraft.method === "credito") paymentDraft.method = "efectivo";
  const total = cartTotals().total;
  paymentDraft.received = paymentDraft.method === "credito" ? 0 : total;
  if (paymentDraft.method === "mixto") initializeMixedPayment(total);
  renderPaymentModal();
  paymentModal.showModal();
  window.requestAnimationFrame(() => focusPaymentReceived(!isMobilePos()));
}

function quickCheckoutCash() {
  if (!saleCart.length) return;
  paymentDraft.method = "efectivo";
  paymentDraft.received = cartTotals().total;
  openPaymentModal();
}

function renderPaymentModal() {
  const totals = cartTotals();
  const isCredit = paymentDraft.method === "credito";
  const isMixed = paymentDraft.method === "mixto";
  const paidTotal = paymentDraftTotal();
  const change = Math.max((isMixed ? Number(paymentDraft.split?.efectivo || 0) : Number(paymentDraft.received || 0)) - totals.total, 0);
  const insufficient = !isCredit && paidTotal < totals.total;
  const balanceDue = isCredit ? Math.max(totals.total - Number(paymentDraft.received || 0), 0) : 0;
  const quickOptions = buildQuickCashOptions(totals.total);
  const selectedMethod = availablePaymentMethods().find((method) => method.id === paymentDraft.method)?.label || "Pago";
  const cashChange = paymentChangeAmount(totals.total);
  const changeWarning = !isCredit && !insufficient && cashChange > Math.max(totals.total * 2, 200);
  paymentModalContent.innerHTML = `
    <div class="touch-payment-layout">
      <div class="payment-total touch-payment-total"><span>Total a pagar</span><strong>${money(totals.total)}</strong><small>${saleCart.length} item${saleCart.length === 1 ? "" : "s"} en carrito</small></div>
      <div class="payment-method-grid touch-payment-methods">${availablePaymentMethods().map((method) => `<button class="${paymentDraft.method === method.id ? "is-active" : ""}" type="button" data-payment-method="${method.id}"><span>${method.icon}</span><strong>${method.label}</strong></button>`).join("")}</div>
      <div class="payment-flow-summary" id="paymentFlowSummary">
        <article><span>Metodo</span><strong>${escapeHtml(selectedMethod)}</strong></article>
        <article><span>${isCredit ? "Anticipo" : "Recibido"}</span><strong id="paymentPaidLabel">${money(paidTotal)}</strong></article>
        <article class="${insufficient ? "is-warning" : "is-ok"}"><span>${insufficient ? "Falta" : isCredit ? "Saldo" : "Vuelto"}</span><strong id="paymentBalanceLabel">${money(insufficient ? totals.total - paidTotal : isCredit ? balanceDue : change)}</strong></article>
      </div>
      ${isCredit ? `<div class="cloud-safe-note"><strong>Venta al credito</strong><span>Quedara saldo pendiente de ${money(balanceDue)} en cuentas por cobrar.</span></div>` : isMixed ? renderMixedPaymentFields(totals.total) : `<div class="payment-helper-row"><span>Pagos rapidos</span><button type="button" id="clearPaymentBtn">Limpiar monto</button></div><div class="quick-cash-grid">${quickOptions.map((option) => `<button type="button" data-quick-cash="${option.amount}"><span>${escapeHtml(option.label)}</span><strong>${money(option.amount)}</strong></button>`).join("")}</div>`}
      ${isMixed ? "" : `<div class="form-grid touch-payment-fields">
        <label>${isCredit ? "Anticipo recibido" : "Monto recibido"}<input id="paymentReceived" type="text" inputmode="decimal" enterkeyhint="done" value="${Number(paymentDraft.received || 0).toFixed(2)}" /></label>
        <label>${isCredit ? "Saldo pendiente" : "Vuelto"}<input id="paymentResultValue" type="text" value="${money(isCredit ? balanceDue : change)}" readonly /></label>
      </div>${renderPaymentKeypad(totals.total, isCredit)}`}
      <div class="payment-safety-card ${insufficient ? "is-warning" : changeWarning ? "is-caution" : "is-ok"}" id="paymentSafetyCard">
        <strong>${insufficient ? "Pago incompleto" : changeWarning ? "Revisar vuelto" : isCredit ? "Credito listo" : "Cobro listo"}</strong>
        <span id="paymentSafetyText">${paymentSafetyText(totals.total, insufficient, isCredit)}</span>
      </div>
      <p class="form-error" id="paymentErrorText" ${insufficient ? "" : "hidden"}>${insufficient ? `Pago insuficiente. Falta ${money(totals.total - paidTotal)}.` : ""}</p>
      <div class="modal-actions touch-payment-actions"><button class="ghost-button" type="button" id="printDraftBtn">Precomprobante</button><button class="primary-button" type="submit" id="confirmPaymentBtn" ${insufficient ? "disabled" : ""}>Confirmar pago</button></div>
    </div>
  `;
  paymentModalContent.querySelectorAll("[data-payment-method]").forEach((button) => {
    button.addEventListener("click", () => {
      paymentDraft.method = button.dataset.paymentMethod;
      if (paymentDraft.method === "credito") paymentDraft.received = 0;
      if (paymentDraft.method === "mixto") initializeMixedPayment(totals.total);
      if (!["credito", "mixto"].includes(paymentDraft.method)) paymentDraft.received = totals.total;
      renderPaymentModal();
      window.requestAnimationFrame(() => focusPaymentReceived(!isMobilePos()));
    });
  });
  paymentModalContent.querySelector("#paymentReceived")?.addEventListener("input", (event) => {
    const normalizedValue = String(event.target.value || "").replace(",", ".").replace(/[^\d.]/g, "");
    const dotIndex = normalizedValue.indexOf(".");
    const cleanedValue = dotIndex >= 0
      ? `${normalizedValue.slice(0, dotIndex + 1)}${normalizedValue.slice(dotIndex + 1).replace(/\./g, "")}`
      : normalizedValue;
    event.target.value = cleanedValue;
    paymentDraft.received = Number(cleanedValue || 0);
    updatePaymentLiveSummary(totals.total);
  });
  paymentModalContent.querySelectorAll("[data-quick-cash]").forEach((button) => {
    button.addEventListener("click", () => {
      paymentDraft.received = Number(button.dataset.quickCash || totals.total);
      const receivedInput = paymentModalContent.querySelector("#paymentReceived");
      if (receivedInput) receivedInput.value = Number(paymentDraft.received || 0).toFixed(2);
      updatePaymentLiveSummary(totals.total);
    });
  });
  paymentModalContent.querySelectorAll("[data-payment-key]").forEach((button) => {
    button.addEventListener("click", () => applyPaymentKey(button.dataset.paymentKey, totals.total));
  });
  paymentModalContent.querySelector("#clearPaymentBtn")?.addEventListener("click", () => {
    paymentDraft.received = 0;
    const receivedInput = paymentModalContent.querySelector("#paymentReceived");
    if (receivedInput) receivedInput.value = "";
    updatePaymentLiveSummary(totals.total);
    focusPaymentReceived(false);
  });
  paymentModalContent.querySelectorAll("[data-payment-split]").forEach((input) => {
    input.addEventListener("input", () => {
      paymentDraft.split = { ...(paymentDraft.split || {}), [input.dataset.paymentSplit]: Number(input.value || 0) };
      updatePaymentLiveSummary(totals.total);
    });
  });
  paymentModalContent.querySelector("#printDraftBtn")?.addEventListener("click", printDraftTicket);
  paymentForm.onsubmit = submitSale;
}

function renderPaymentKeypad(total, isCredit = false) {
  const keys = ["7", "8", "9", "4", "5", "6", "1", "2", "3", ".", "0", "del"];
  return `<div class="payment-keypad" aria-label="Teclado de cobro">
    ${keys.map((key) => `<button type="button" data-payment-key="${key}">${key === "del" ? "Borrar" : key}</button>`).join("")}
    <button class="is-wide" type="button" data-payment-key="clear">Limpiar</button>
    <button class="is-wide is-strong" type="button" data-payment-key="${isCredit ? "half" : "exact"}">${isCredit ? "50%" : "Exacto"}</button>
    <button class="is-wide is-strong" type="button" data-payment-key="confirm">Listo</button>
  </div>`;
}

function buildQuickCashOptions(total) {
  const base = Math.ceil(Number(total || 0));
  const rounded5 = Math.ceil(base / 5) * 5;
  const rounded10 = Math.ceil(base / 10) * 10;
  const rounded20 = Math.ceil(base / 20) * 20;
  const rounded50 = Math.ceil(base / 50) * 50;
  const rounded100 = Math.ceil(base / 100) * 100;
  const options = [
    { label: "Exacto", amount: Number(total || 0) },
    { label: "Redondeo 5", amount: rounded5 },
    { label: "Redondeo 10", amount: rounded10 },
    { label: "Redondeo 20", amount: rounded20 },
    { label: "Billete 50", amount: rounded50 },
    { label: "Billete 100", amount: rounded100 }
  ];
  const seen = new Set();
  return options.filter((option) => {
    const key = option.amount.toFixed(2);
    if (option.amount < total || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 4);
}

function paymentChangeAmount(total) {
  if (paymentDraft.method === "credito") return 0;
  if (paymentDraft.method === "mixto") {
    const split = paymentDraft.split || {};
    const nonCashPaid = Number(split.tarjeta || 0) + Number(split.transferencia || 0) + Number(split.qr || 0);
    return Math.max(Number(split.efectivo || 0) - Math.max(Number(total || 0) - nonCashPaid, 0), 0);
  }
  return Math.max(Number(paymentDraft.received || 0) - Number(total || 0), 0);
}

function paymentSafetyText(total, insufficient, isCredit) {
  const paid = paymentDraftTotal();
  if (insufficient) return `Falta ${money(Number(total || 0) - paid)} para confirmar.`;
  if (isCredit) return `Saldo pendiente: ${money(Math.max(Number(total || 0) - Number(paymentDraft.received || 0), 0))}.`;
  const change = paymentChangeAmount(total);
  if (change > Math.max(Number(total || 0) * 2, 200)) return `El vuelto es alto: ${money(change)}. Confirma el monto recibido antes de guardar.`;
  return change > 0 ? `Devuelve ${money(change)} al cliente.` : "Pago exacto. Puedes confirmar.";
}

function applyPaymentKey(key, total) {
  const input = paymentModalContent.querySelector("#paymentReceived");
  if (!input) return;
  const normalized = String(key || "");
  const setPaymentInput = (value) => {
    const nextValue = String(value ?? "").replace(",", ".");
    const parsed = Number(nextValue);
    input.value = nextValue;
    paymentDraft.received = Number.isFinite(parsed) ? parsed : 0;
    updatePaymentLiveSummary(total);
  };
  if (normalized === "confirm") {
    const confirmButton = paymentModalContent.querySelector("#confirmPaymentBtn");
    if (confirmButton && !confirmButton.disabled) confirmButton.click();
    return;
  }
  if (normalized === "exact") {
    setPaymentInput(Number(total || 0).toFixed(2));
  } else if (normalized === "half") {
    setPaymentInput((Number(total || 0) / 2).toFixed(2));
  } else if (normalized === "clear") {
    setPaymentInput("");
  } else if (normalized === "del") {
    const current = input.value || "";
    setPaymentInput(current.slice(0, -1));
  } else if (/^\d$/.test(normalized) || normalized === ".") {
    const current = String(input.value || "");
    const shouldReplace = document.activeElement === input && input.selectionStart === 0 && input.selectionEnd === current.length;
    const base = shouldReplace || current === "0.00" || current === "0" ? "" : current;
    const next = normalized === "."
      ? (base.includes(".") ? base : `${base || "0"}.`)
      : `${base}${normalized}`;
    setPaymentInput(next);
  }
}

function focusPaymentReceived(selectText = false) {
  const input = paymentModalContent.querySelector("#paymentReceived");
  if (!input) return;
  input.focus({ preventScroll: true });
  if (selectText) input.select();
}

function initializeMixedPayment(total) {
  const current = paymentDraft.split || {};
  const hasValues = Object.values(current).some((amount) => Number(amount || 0) > 0);
  paymentDraft.split = hasValues ? current : { efectivo: Number(total || 0), tarjeta: 0, transferencia: 0, qr: 0 };
}

function paymentDraftTotal() {
  if (paymentDraft.method === "credito") return Number(paymentDraft.received || 0);
  if (paymentDraft.method !== "mixto") return Number(paymentDraft.received || 0);
  return Object.values(paymentDraft.split || {}).reduce((sum, amount) => sum + Number(amount || 0), 0);
}

function renderMixedPaymentFields(total) {
  const split = paymentDraft.split || {};
  const paid = paymentDraftTotal();
  const change = Math.max(Number(split.efectivo || 0) - Math.max(Number(total || 0) - Number(split.tarjeta || 0) - Number(split.transferencia || 0) - Number(split.qr || 0), 0), 0);
  return `
    <div class="mixed-payment-card">
      <div><span>Pago dividido</span><strong id="mixedPaymentTotal">${money(paid)} / ${money(total)}</strong><small id="mixedPaymentStatus">${paid >= total ? `Vuelto ${money(change)}` : `Falta ${money(total - paid)}`}</small></div>
      <div class="form-grid touch-payment-fields">
        <label>Efectivo<input data-payment-split="efectivo" type="number" inputmode="decimal" enterkeyhint="done" min="0" step="0.01" value="${Number(split.efectivo || 0).toFixed(2)}" /></label>
        <label>Tarjeta<input data-payment-split="tarjeta" type="number" inputmode="decimal" enterkeyhint="done" min="0" step="0.01" value="${Number(split.tarjeta || 0).toFixed(2)}" /></label>
        <label>Transferencia<input data-payment-split="transferencia" type="number" inputmode="decimal" enterkeyhint="done" min="0" step="0.01" value="${Number(split.transferencia || 0).toFixed(2)}" /></label>
        <label>QR<input data-payment-split="qr" type="number" inputmode="decimal" enterkeyhint="done" min="0" step="0.01" value="${Number(split.qr || 0).toFixed(2)}" /></label>
      </div>
    </div>
  `;
}

function updatePaymentLiveSummary(total) {
  const isCredit = paymentDraft.method === "credito";
  const isMixed = paymentDraft.method === "mixto";
  const paid = paymentDraftTotal();
  const insufficient = !isCredit && paid < total;
  const resultInput = paymentModalContent.querySelector("#paymentResultValue");
  if (resultInput) {
    const balance = isCredit ? Math.max(total - Number(paymentDraft.received || 0), 0) : 0;
    const change = Math.max(Number(paymentDraft.received || 0) - total, 0);
    resultInput.value = money(isCredit ? balance : change);
  }
  const paidLabel = paymentModalContent.querySelector("#paymentPaidLabel");
  const balanceLabel = paymentModalContent.querySelector("#paymentBalanceLabel");
  const balanceCard = balanceLabel?.closest("article");
  if (paidLabel) paidLabel.textContent = money(paid);
  if (balanceLabel) {
    const balance = isCredit ? Math.max(total - Number(paymentDraft.received || 0), 0) : 0;
    const change = isMixed
      ? Math.max(Number(paymentDraft.split?.efectivo || 0) - Math.max(Number(total || 0) - Number(paymentDraft.split?.tarjeta || 0) - Number(paymentDraft.split?.transferencia || 0) - Number(paymentDraft.split?.qr || 0), 0), 0)
      : Math.max(Number(paymentDraft.received || 0) - total, 0);
    balanceLabel.textContent = money(insufficient ? total - paid : isCredit ? balance : change);
  }
  if (balanceCard) {
    balanceCard.classList.toggle("is-warning", insufficient);
    balanceCard.classList.toggle("is-ok", !insufficient);
  }
  const safetyCard = paymentModalContent.querySelector("#paymentSafetyCard");
  const safetyText = paymentModalContent.querySelector("#paymentSafetyText");
  const changeWarning = !isCredit && !insufficient && paymentChangeAmount(total) > Math.max(Number(total || 0) * 2, 200);
  if (safetyCard) {
    safetyCard.classList.toggle("is-warning", insufficient);
    safetyCard.classList.toggle("is-caution", changeWarning);
    safetyCard.classList.toggle("is-ok", !insufficient && !changeWarning);
    const title = safetyCard.querySelector("strong");
    if (title) title.textContent = insufficient ? "Pago incompleto" : changeWarning ? "Revisar vuelto" : isCredit ? "Credito listo" : "Cobro listo";
  }
  if (safetyText) safetyText.textContent = paymentSafetyText(total, insufficient, isCredit);
  if (isMixed) {
    const split = paymentDraft.split || {};
    const change = Math.max(Number(split.efectivo || 0) - Math.max(Number(total || 0) - Number(split.tarjeta || 0) - Number(split.transferencia || 0) - Number(split.qr || 0), 0), 0);
    const totalLabel = paymentModalContent.querySelector("#mixedPaymentTotal");
    const statusLabel = paymentModalContent.querySelector("#mixedPaymentStatus");
    if (totalLabel) totalLabel.textContent = `${money(paid)} / ${money(total)}`;
    if (statusLabel) statusLabel.textContent = paid >= total ? `Vuelto ${money(change)}` : `Falta ${money(total - paid)}`;
  }
  const errorText = paymentModalContent.querySelector("#paymentErrorText");
  if (errorText) {
    errorText.hidden = !insufficient;
    errorText.textContent = insufficient ? `Pago insuficiente. Falta ${money(total - paid)}.` : "";
  }
  const confirmButton = paymentModalContent.querySelector("#confirmPaymentBtn");
  if (confirmButton) confirmButton.disabled = insufficient;
}

async function submitSale(event) {
  event.preventDefault();
  if (!cashSession || cashSession.status !== "abierta") {
    ventasMessage = "Abre caja antes de confirmar ventas.";
    paymentModal.close();
    activeView = "finance";
    renderMain();
    return;
  }
  const totals = cartTotals();
  const paidTotal = paymentDraftTotal();
  if (paymentDraft.method !== "credito" && paidTotal < totals.total) return;
  if (paymentDraft.method === "credito" && Number(paymentDraft.received || 0) > totals.total) return;
  const response = await apiRequest("/ventas/sales", {
    method: "POST",
    body: {
      customerId: saleCustomerId,
      discount: totals.discount,
      tax: totals.tax,
      note: saleNote.trim(),
      paymentMethod: paymentDraft.method,
      paymentDetail: paymentDraft.method === "mixto" ? paymentDraft.split : {},
      cashReceived: paymentDraft.method === "credito" ? Number(paymentDraft.received || 0) : paymentDraft.method === "mixto" ? paidTotal : Number(paymentDraft.received || totals.total),
      items: saleCart.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.salePrice,
        discount: storeSettings.allowDiscounts ? Number(item.discount || 0) : 0
      }))
    }
  });
  localSaleMeta[response.sale.id] = { method: paymentDraft.method, status: response.sale.payment_status || "pagada", received: paidTotal, split: paymentDraft.split, createdAt: new Date().toISOString() };
  persistJson(LOCAL_SALE_META_KEY, localSaleMeta);
  lastSaleReceipt = { sale: response.sale, items: response.items };
  saleCart = [];
  productSearch = "";
  productCategoryFilter = "";
  saleCustomerId = "";
  saleGlobalDiscount = 0;
  saleNote = "";
  posMobilePanel = "products";
  ventasMessage = `Venta ${response.sale.code} registrada correctamente.`;
  paymentModal.close();
  await render();
  printTicket(response.sale, response.items);
}

async function closeCash() {
  if (!cash.pendingSales?.length) return;
  await apiRequest("/ventas/cash/close", { method: "POST", body: {} });
  await render();
}

function openCashSession(event) {
  event.preventDefault();
  apiRequest("/ventas/cash/open", {
    method: "POST",
    body: { registerNumber: Number(value("#cashRegisterNumber") || 1), openingAmount: Number(value("#cashOpeningAmount") || 0) }
  }).then(async () => {
    ventasMessage = "Caja abierta correctamente.";
    await render();
  }).catch((error) => {
    ventasMessage = error.message || "No se pudo abrir la caja.";
    renderMain();
  });
}

function addCashMovement(event) {
  event.preventDefault();
  const movement = {
    type: value("#cashMovementType"),
    amount: Number(value("#cashMovementAmount") || 0),
    reason: value("#cashMovementReason").trim()
  };
  if (!movement.amount || !movement.reason) return;
  apiRequest("/ventas/cash/movements", { method: "POST", body: movement }).then(async () => {
    ventasMessage = "Movimiento registrado.";
    await render();
  }).catch((error) => {
    ventasMessage = error.message || "No se pudo registrar el movimiento.";
    renderMain();
  });
}

async function closeCashSession(event) {
  event.preventDefault();
  const counted = Number(value("#cashCountedAmount") || 0);
  const expected = cashExpectedTotal();
  const note = value("#cashClosureNote").trim();
  if (Math.abs(counted - expected) > 0.009 && !note) {
    ventasMessage = "Cuando la caja no cuadra, la observacion es obligatoria antes de cerrar.";
    return renderMain();
  }
  if (!confirm(`Cerrar caja? Diferencia: ${money(counted - expected)}`)) return;
  try {
    await apiRequest("/ventas/cash/close", { method: "POST", body: { countedAmount: counted, note } });
    ventasMessage = "Caja cerrada correctamente.";
    await render();
  } catch (error) {
    ventasMessage = error.message || "No se pudo cerrar la caja.";
    renderMain();
  }
}

function printCashClosure(closureId) {
  const closure = cashClosures.find((item) => item.id === closureId);
  if (!closure) return;
  const printable = window.open("", "_blank", "width=760,height=820");
  if (!printable) return;
  const difference = Number(closure.differenceAmount || 0);
  const title = storeSettings.storeName || storeSettings.companyName || currentUser.companyName || "Zow Ventas-Almacen";
  const businessLines = [
    storeSettings.taxId ? `NIT/CI: ${storeSettings.taxId}` : "",
    storeSettings.address || "",
    storeSettings.phone ? `Tel: ${storeSettings.phone}` : ""
  ].filter(Boolean);
  const differenceClass = difference === 0 ? "ok" : Math.abs(difference) <= 1 ? "warn" : "danger";
  const manualIncome = Math.max(Number(closure.movementTotal || 0), 0);
  const manualExpense = Math.max(-Number(closure.movementTotal || 0), 0);
  printable.document.write(`<!doctype html><html><head><meta charset="UTF-8"><title>Cierre ${escapeHtml(closure.code)}</title><style>
    *{box-sizing:border-box}body{font-family:Arial,sans-serif;margin:0;padding:28px;color:#111;background:#fff}
    .toolbar{margin-bottom:16px}.toolbar button{border:0;border-radius:10px;padding:11px 18px;background:#0f172a;color:#fff;font-weight:900}
    .head{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:20px;align-items:start;border-bottom:3px solid #111;padding-bottom:16px;margin-bottom:18px}
    h1{font-size:24px;margin:0;text-transform:uppercase;letter-spacing:.04em}.muted{color:#555;font-size:12px;line-height:1.45}.badge{display:inline-block;border:1px solid #111;border-radius:999px;padding:7px 12px;font-weight:900;font-size:12px;text-transform:uppercase}
    .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:16px 0}.card{border:1px solid #ddd;border-radius:12px;padding:12px;min-height:82px}.card span{display:block;color:#555;font-size:11px;text-transform:uppercase;font-weight:800}.card strong{display:block;margin-top:8px;font-size:18px}.card.ok strong{color:#15803d}.card.warn strong{color:#b45309}.card.danger strong{color:#b91c1c}
    .box{border:1px solid #111;border-radius:14px;padding:14px;margin:14px 0}.row{display:flex;justify-content:space-between;gap:14px;padding:8px 0;border-bottom:1px dashed #aaa}.row:last-child{border-bottom:0}.row span{color:#555}.row strong{text-align:right}.total{font-size:18px;font-weight:900;border-top:2px solid #111;margin-top:4px;padding-top:10px}.diff.ok strong{color:#15803d}.diff.warn strong{color:#b45309}.diff.danger strong{color:#b91c1c}
    .note{border:1px dashed #777;border-radius:12px;padding:12px;margin-top:14px;background:#fafafa;font-size:13px}.signatures{display:grid;grid-template-columns:1fr 1fr;gap:34px;margin-top:54px}.sign{border-top:1px solid #111;text-align:center;padding-top:9px;font-size:12px;color:#444}
    .foot{margin-top:22px;text-align:center;color:#555;font-size:12px}.status{margin-top:8px;font-size:13px;font-weight:900}
    @media print{.toolbar{display:none}body{padding:0}.card,.box{break-inside:avoid}}
  </style></head><body><div class="toolbar"><button onclick="window.print()">Imprimir cierre de caja</button></div>
  <section class="head">
    <div><h1>${escapeHtml(title)}</h1><p class="muted">${businessLines.map(escapeHtml).join("<br>") || "Datos de la tienda no configurados"}</p></div>
    <div><span class="badge">${escapeHtml(closure.code)}</span><p class="muted"><strong>Caja:</strong> ${num(closure.registerNumber)}<br><strong>Fecha:</strong> ${formatDateTime(closure.createdAt)}</p></div>
  </section>
  <section class="grid">
    <article class="card"><span>Apertura</span><strong>${money(closure.openingAmount)}</strong></article>
    <article class="card"><span>Ventas</span><strong>${money(closure.totalSales)}</strong></article>
    <article class="card"><span>Movimientos</span><strong>${money(closure.movementTotal)}</strong></article>
    <article class="card ${differenceClass}"><span>Diferencia</span><strong>${money(difference)}</strong></article>
  </section>
  <section class="box">
    <div class="row"><span>Monto inicial declarado</span><strong>${money(closure.openingAmount)}</strong></div>
    <div class="row"><span>Total ventas cerradas</span><strong>${money(closure.totalSales)}</strong></div>
    <div class="row"><span>Ingresos manuales</span><strong>${money(manualIncome)}</strong></div>
    <div class="row"><span>Egresos manuales</span><strong>${money(manualExpense)}</strong></div>
    <div class="row total"><span>Efectivo esperado</span><strong>${money(closure.expectedAmount)}</strong></div>
    <div class="row"><span>Efectivo contado</span><strong>${money(closure.countedAmount)}</strong></div>
    <div class="row diff ${differenceClass}"><span>Diferencia final</span><strong>${money(difference)}</strong></div>
    <div class="row"><span>Ventas incluidas</span><strong>${num(closure.saleCount)}</strong></div>
  </section>
  <section class="box">
    <div class="row"><span>Estado de arqueo</span><strong>${difference === 0 ? "Cuadrado" : Math.abs(difference) <= 1 ? "Diferencia menor" : "Requiere revision"}</strong></div>
    <div class="row"><span>Generado por</span><strong>${escapeHtml(currentUser.name || currentUser.username || "Usuario")}</strong></div>
    <div class="row"><span>Moneda</span><strong>${escapeHtml(storeSettings.currency || "BOB")}</strong></div>
  </section>
  ${closure.note ? `<div class="note"><strong>Observacion:</strong><br>${escapeHtml(closure.note)}</div>` : `<div class="note"><strong>Observacion:</strong><br>Sin observaciones registradas.</div>`}
  <div class="signatures"><div class="sign">Firma cajero</div><div class="sign">Firma responsable</div></div>
  <p class="foot">Reporte generado por ZOW SAAS. Revisar diferencias antes de entregar turno.</p></body></html>`);
  printable.document.close();
  printable.focus();
}

function cashMovementsTotal() {
  return cashMovements.reduce((sum, item) => sum + (item.type === "ingreso" ? Number(item.amount || 0) : -Number(item.amount || 0)), 0);
}

function cashExpectedTotal() {
  const opening = cashSession?.status === "abierta" ? Number(cashSession.openingAmount || 0) : 0;
  return opening + Number(cash.total || 0) + cashMovementsTotal();
}

function cashPaymentBreakdown() {
  const pendingSales = cash.pendingSales || [];
  return paymentMethods().map((method) => {
    const total = pendingSales.reduce((sum, sale) => sum + salePaymentAmountForMethod(sale, method.id), 0);
    const count = pendingSales.filter((sale) => salePaymentHasMethod(sale, method.id)).length;
    return {
      id: method.id,
      label: method.label,
      total,
      count
    };
  }).filter((item) => item.count || ["efectivo", "tarjeta", "qr"].includes(item.id));
}

function renderCashCloseBreakdown(expectedCash, paymentBreakdown, movementsTotal) {
  const opening = cashSession?.status === "abierta" ? Number(cashSession.openingAmount || 0) : 0;
  const manualIncome = cashMovements.filter((item) => item.type === "ingreso").reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const manualExpense = cashMovements.filter((item) => item.type === "egreso").reduce((sum, item) => sum + Number(item.amount || 0), 0);
  return `
    <article><span>Apertura</span><strong>${money(opening)}</strong><small>Monto inicial declarado</small></article>
    ${paymentBreakdown.map((item) => `<article><span>${escapeHtml(item.label)}</span><strong>${money(item.total)}</strong><small>${num(item.count)} operacion${item.count === 1 ? "" : "es"}</small></article>`).join("")}
    <article><span>Ingresos manuales</span><strong>${money(manualIncome)}</strong><small>Cambios o entradas</small></article>
    <article><span>Egresos manuales</span><strong>${money(manualExpense)}</strong><small>Retiros y gastos menores</small></article>
    <article><span>Total esperado</span><strong>${money(expectedCash)}</strong><small>Incluye movimientos: ${money(movementsTotal)}</small></article>
  `;
}

function buildSalesPaymentBreakdown(sourceSales) {
  return paymentMethods().map((method) => {
    const total = sourceSales.reduce((sum, sale) => sum + salePaymentAmountForMethod(sale, method.id), 0);
    const count = sourceSales.filter((sale) => salePaymentHasMethod(sale, method.id)).length;
    return {
      id: method.id,
      label: method.label,
      total,
      count
    };
  }).filter((item) => item.count || ["efectivo", "tarjeta", "qr"].includes(item.id));
}

function openProductModal(productId = "") {
  const product = productId ? products.find((item) => item.id === productId) : null;
  editingProductId = product?.id || "";
  productForm.reset();
  document.querySelector("#productModalTitle").textContent = product ? "Editar producto" : "Nuevo producto";
  document.querySelector("#productSubmitBtn").textContent = product ? "Guardar cambios" : "Guardar producto";
  document.querySelector("#productStockLabel").textContent = product ? "Stock actual" : "Stock inicial";
  document.querySelector("#productStock").disabled = Boolean(product);
  document.querySelector("#productUnit").value = product?.unit || "Unidad";
  if (product) {
    document.querySelector("#productCode").value = product.code || "";
    document.querySelector("#productBarcode").value = product.barcode || "";
    document.querySelector("#productName").value = product.name || "";
    document.querySelector("#productCategory").value = product.category || "";
    document.querySelector("#productCost").value = Number(product.cost_price || 0);
    document.querySelector("#productSale").value = Number(product.sale_price || 0);
    document.querySelector("#productMin").value = Number(product.min_stock || 0);
    document.querySelector("#productStock").value = Number(product.stock || 0);
    document.querySelector("#productBatch").value = product.batch_number || "";
    document.querySelector("#productExpiry").value = product.expires_at || "";
  }
  productModal.showModal();
}

function openCustomerModal(customerId = "") {
  const customer = customerId ? customers.find((item) => item.id === customerId) : null;
  editingCustomerId = customer?.id || "";
  customerForm.reset();
  document.querySelector("#customerModalTitle").textContent = customer ? "Editar cliente" : "Nuevo cliente";
  document.querySelector("#customerSubmitBtn").textContent = customer ? "Guardar cambios" : "Guardar cliente";
  document.querySelector("#customerStatus").value = customer?.status || "activo";
  document.querySelector("#customerCreditLimit").value = Number(customer?.credit_limit || 0);
  if (customer) {
    document.querySelector("#customerName").value = customer.name || "";
    document.querySelector("#customerPhone").value = customer.phone || "";
    document.querySelector("#customerCi").value = customer.ci || "";
    document.querySelector("#customerEmail").value = customer.email || "";
    document.querySelector("#customerAddress").value = customer.address || "";
  }
  customerModal.showModal();
}

function openCategoryModal() {
  categoryForm.reset();
  categoryModal.showModal();
}

function printTicket(sale, items) {
  const printable = window.open("", "_blank", "width=460,height=760");
  if (!printable) return;
  const title = storeSettings.storeName || storeSettings.companyName || currentUser.companyName || "Zow Ventas-Almacen";
  const businessLines = [
    storeSettings.taxId ? `NIT/CI: ${storeSettings.taxId}` : "",
    storeSettings.address || "",
    storeSettings.phone ? `Tel: ${storeSettings.phone}` : ""
  ].filter(Boolean);
  const cashierName = sale.seller_name || currentUser.name || currentUser.username || "Cajero";
  const registerNumber = sale.register_number || sale.cash_register_number || cashSession?.registerNumber || "";
  const itemCount = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const paidAmount = Number(sale.amount_paid ?? sale.cash_received ?? 0);
  const changeAmount = Number(sale.change_amount || 0);
  const isCreditSale = Number(sale.balance_due || 0) > 0;
  printable.document.write(`<!doctype html><html><head><meta charset="UTF-8"><title>Ticket ${escapeHtml(sale.code)}</title><style>
    *{box-sizing:border-box}body{font-family:Arial,sans-serif;margin:0;padding:14px;max-width:390px;color:#111;background:#fff}
    .toolbar{margin-bottom:12px}.toolbar button{width:100%;border:0;border-radius:10px;padding:11px;background:#0f172a;color:#fff;font-weight:900}
    .brand{padding:14px 10px 12px;text-align:center;border-bottom:2px solid #111}.brand b{display:block;font-size:19px;text-transform:uppercase;letter-spacing:.06em}.brand span{display:block;margin-top:4px;font-size:10px;color:#555;text-transform:uppercase;letter-spacing:.12em}
    .business{margin:8px 0 12px;text-align:center;color:#555;font-size:11px;line-height:1.35}.stamp{display:inline-block;margin-top:7px;border:1px solid #111;border-radius:999px;padding:5px 10px;color:#111;font-size:10px;font-weight:900;text-transform:uppercase}
    .ticket-box{border:1px solid #111;border-radius:12px;padding:9px;margin:10px 0}.row{display:flex;justify-content:space-between;gap:10px;padding:5px 0;border-bottom:1px dashed #aaa}.row:last-child{border-bottom:0}.row span{color:#555}.row strong{text-align:right}
    .meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0}.meta-grid div{border:1px solid #ddd;border-radius:10px;padding:8px}.meta-grid span{display:block;color:#555;font-size:10px}.meta-grid strong{display:block;margin-top:3px;font-size:12px}
    table{width:100%;border-collapse:collapse;margin-top:8px}th{font-size:10px;text-align:left;border-bottom:2px solid #111;padding:6px 0;text-transform:uppercase}th:last-child,td:last-child{text-align:right}td{padding:8px 0;border-bottom:1px dashed #bbb;font-size:12px;vertical-align:top}td:last-child{font-weight:800}.muted{color:#555;font-size:10px;line-height:1.35}
    .total{margin-top:4px;padding-top:8px;border-top:2px solid #111;font-weight:900;font-size:18px}.payment{background:#f7f7f7}.barcode{height:36px;margin:10px 20px;background:repeating-linear-gradient(90deg,#111 0 2px,transparent 2px 5px,#111 5px 6px,transparent 6px 10px)}
    .verify{display:grid;grid-template-columns:58px 1fr;gap:10px;align-items:center;margin:12px 0}.qr{width:58px;height:58px;background:linear-gradient(90deg,#111 50%,transparent 0),linear-gradient(#111 50%,transparent 0);background-size:14px 14px;border:7px solid #fff;box-shadow:0 0 0 1px #111}.foot{margin-top:10px;text-align:center;font-size:11px;color:#555}.thanks{color:#111;font-weight:900}
    .signature{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:34px}.signature div{border-top:1px solid #111;text-align:center;padding-top:7px;color:#555;font-size:10px}
    .copy-note{margin:8px 0;border:1px dashed #999;border-radius:10px;padding:8px;text-align:center;color:#333;font-size:10px;font-weight:800;text-transform:uppercase}
    @media print{.toolbar{display:none}body{padding:0}.ticket-box,.meta-grid div{break-inside:avoid}}
  </style></head><body><div class="toolbar"><button onclick="window.print()">Imprimir comprobante</button></div>
  <div class="brand"><b>${escapeHtml(title)}</b><span>Comprobante de venta</span><em class="stamp">${escapeHtml(sale.status === "anulada" ? "Anulado" : sale.code === "PREVENTA" ? "Preventa" : "Pagado")}</em></div>
  <p class="business">${businessLines.map(escapeHtml).join("<br>") || "Datos de la tienda no configurados"}</p>
  <div class="meta-grid"><div><span>Comprobante</span><strong>${escapeHtml(sale.code)}</strong></div><div><span>Fecha y hora</span><strong>${formatDateTime(sale.created_at)}</strong></div><div><span>Caja</span><strong>${registerNumber ? `Caja ${num(registerNumber)}` : "Sin caja"}</strong></div><div><span>Cajero</span><strong>${escapeHtml(cashierName)}</strong></div><div><span>Cliente</span><strong>${escapeHtml(sale.customer_name || "Cliente sin registrar")}</strong></div><div><span>Items</span><strong>${num(itemCount)}</strong></div></div>
  <table><thead><tr><th>Detalle</th><th>Total</th></tr></thead><tbody>${items.map((item) => `<tr><td>${escapeHtml(item.product_name)}<br><span class="muted">${num(item.quantity)} x ${money(item.unit_price)}${Number(item.discount || 0) ? ` / Desc. ${money(item.discount)}` : ""}</span></td><td>${money(item.total)}</td></tr>`).join("")}</tbody></table>
  <div class="ticket-box"><div class="row"><span>Subtotal</span><strong>${money(sale.subtotal)}</strong></div><div class="row"><span>Descuento</span><strong>${money(sale.discount)}</strong></div><div class="row"><span>Impuesto</span><strong>${money(sale.tax || 0)}</strong></div><div class="row total"><span>Total</span><strong>${money(sale.total)}</strong></div><div class="row payment"><span>Metodo</span><strong>${escapeHtml(paymentLabel(sale.payment_method || paymentDraft.method || "efectivo"))}</strong></div><div class="row"><span>Pagado</span><strong>${money(paidAmount)}</strong></div><div class="row"><span>Cambio</span><strong>${money(changeAmount)}</strong></div>${Number(sale.balance_due || 0) > 0 ? `<div class="row"><span>Saldo</span><strong>${money(sale.balance_due)}</strong></div>` : ""}</div>
  ${renderTicketPaymentDetail(sale)}
  ${sale.note ? `<p class="muted"><strong>Obs.:</strong> ${escapeHtml(sale.note)}</p>` : ""}
  ${isCreditSale ? `<div class="copy-note">Venta con saldo pendiente. Conservar copia firmada.</div><div class="signature"><div>Firma cliente</div><div>Firma cajero</div></div>` : ""}
  <div class="verify"><div class="qr"></div><div><div class="barcode"></div><p class="muted">Codigo de control: ${escapeHtml(sale.code)}<br>Moneda: ${escapeHtml(storeSettings.currency || "BOB")}</p></div></div><p class="foot thanks">${escapeHtml(storeSettings.ticketNote || "Gracias por su compra")}</p><p class="foot">Sistema de venta y almacen ZOW SAAS</p></body></html>`);
  printable.document.close();
  printable.focus();
}

function printDraftTicket() {
  const totals = cartTotals();
  const paidTotal = paymentDraftTotal();
  const sale = {
    code: "PREVENTA",
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total,
    cash_received: paymentDraft.method === "mixto" ? paidTotal : Number(paymentDraft.received || totals.total),
    change_amount: paymentDraft.method === "mixto" ? Math.max(Number(paymentDraft.split?.efectivo || 0) - totals.total, 0) : Math.max(Number(paymentDraft.received || 0) - totals.total, 0),
    payment_method: paymentDraft.method,
    payment_detail: paymentDraft.method === "mixto" ? JSON.stringify(paymentDraft.split || {}) : "",
    amount_paid: paymentDraft.method === "credito" ? Number(paymentDraft.received || 0) : paymentDraft.method === "mixto" ? paidTotal : Number(paymentDraft.received || totals.total),
    balance_due: paymentDraft.method === "credito" ? Math.max(totals.total - Number(paymentDraft.received || 0), 0) : 0,
    created_at: new Date().toISOString(),
    note: saleNote.trim()
  };
  const items = saleCart.map((item) => ({ product_name: item.name, quantity: item.quantity, unit_price: item.salePrice, total: item.quantity * item.salePrice - Number(item.discount || 0) }));
  printTicket(sale, items);
}

async function reprintSale(saleId) {
  try {
    const response = await apiRequest(`/ventas/sales/${saleId}`);
    printTicket(response.sale, response.items);
  } catch (error) {
    ventasMessage = error.message || "No se pudo recuperar el comprobante.";
    renderMain();
  }
}

async function showSaleDetail(saleId) {
  try {
    const response = await apiRequest(`/ventas/sales/${saleId}`);
    renderSaleDetail(response.sale, response.items || []);
    saleDetailModal.showModal();
  } catch (error) {
    ventasMessage = error.message || "No se pudo recuperar el detalle de la venta.";
    renderMain();
  }
}

function renderSaleDetail(sale, items) {
  const status = saleStatus(sale);
  const canReturn = !["anulada", "devuelta"].includes(status) && can("returnSales");
  const itemTotal = items.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const quantityTotal = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const paidAmount = Number(sale.amount_paid || sale.cash_received || 0);
  const balanceDue = Number(sale.balance_due || 0);
  const statusClass = status === "anulada" ? "danger-text" : status === "pagada" ? "ok-text" : "warn-text";
  saleDetailTitle.textContent = sale.code || "Comprobante";
  saleDetailContent.innerHTML = `
    <section class="sale-detail-summary">
      <article><span>Estado</span><strong class="${statusClass}">${escapeHtml(status)}</strong></article>
      <article><span>Total</span><strong>${money(sale.total)}</strong></article>
      <article><span>Metodo</span><strong>${escapeHtml(paymentLabel(sale.payment_method || "efectivo"))}</strong></article>
      <article><span>Fecha</span><strong>${formatDateTime(sale.created_at)}</strong></article>
    </section>
    ${status === "anulada" ? `<div class="voided-sale-banner"><strong>Venta anulada</strong><span>Esta operacion queda en auditoria y su stock fue reintegrado.</span></div>` : ""}
    <section class="sale-detail-audit-strip">
      ${renderSaleDetailAuditItem("Comprobante", sale.code || "S/C", "Codigo unico de la operacion")}
      ${renderSaleDetailAuditItem("Caja", sale.register_number || sale.cash_register_number ? `Caja ${num(sale.register_number || sale.cash_register_number)}` : "Sin caja", sale.cash_closed ? "Cierre aplicado" : "Pendiente de cierre")}
      ${renderSaleDetailAuditItem("Cajero", sale.seller_name || currentUser.name || "Usuario", "Responsable registrado")}
      ${renderSaleDetailAuditItem("Cliente", sale.customer_name || "Cliente sin registrar", balanceDue > 0 ? `Debe ${money(balanceDue)}` : "Sin saldo pendiente")}
    </section>
    <section class="sale-detail-card">
      <div>
        <span>Subtotal</span>
        <strong>${money(sale.subtotal || itemTotal)}</strong>
      </div>
      <div>
        <span>Descuento</span>
        <strong>${money(sale.discount || 0)}</strong>
      </div>
      <div>
        <span>Impuesto</span>
        <strong>${money(sale.tax || 0)}</strong>
      </div>
      <div>
        <span>Pagado</span>
        <strong>${money(paidAmount)}</strong>
      </div>
      <div>
        <span>Productos</span>
        <strong>${num(quantityTotal)} unidades / ${items.length} linea${items.length === 1 ? "" : "s"}</strong>
      </div>
      <div>
        <span>Cambio</span>
        <strong>${money(sale.change_amount || 0)}</strong>
      </div>
      ${sale.note ? `<div><span>Observacion</span><strong>${escapeHtml(sale.note)}</strong></div>` : ""}
      ${balanceDue > 0 ? `<div><span>Saldo pendiente</span><strong class="warn-text">${money(balanceDue)}</strong></div>` : ""}
    </section>
    ${renderSaleDetailPaymentBreakdown(sale)}
    <div class="sale-detail-items">
      ${items.map((item) => `
        <article>
          <div>
            <strong>${escapeHtml(item.product_name)}</strong>
            <span>${num(item.quantity)} x ${money(item.unit_price)}${Number(item.discount || 0) > 0 ? ` / Desc. ${money(item.discount)}` : ""}</span>
            <small>${item.product_code ? `Codigo ${escapeHtml(item.product_code)}` : "Linea de venta"}</small>
          </div>
          <b>${money(item.total)}</b>
        </article>
      `).join("") || empty("Sin productos registrados")}
    </div>
    ${canReturn ? renderSaleReturnPanel(items) : ""}
    <div class="modal-actions">
      <button class="ghost-button" type="button" id="detailPrintSale">Reimprimir</button>
      ${status !== "anulada" && !sale.cash_closed ? `<button class="ghost-button danger-action" type="button" id="detailVoidSale">Anular venta</button>` : ""}
    </div>
  `;
  saleDetailContent.querySelector("#detailPrintSale")?.addEventListener("click", () => printTicket(sale, items));
  saleDetailContent.querySelector("#detailVoidSale")?.addEventListener("click", async () => {
    saleDetailModal.close();
    await voidSale(sale.id);
  });
  saleDetailContent.querySelector("#saleReturnForm")?.addEventListener("submit", (event) => submitSaleReturn(event, sale, items));
  saleDetailContent.querySelectorAll("[data-return-qty]").forEach((input) => {
    input.addEventListener("input", () => updateReturnEstimate(items));
  });
  updateReturnEstimate(items);
}

function renderSaleDetailAuditItem(label, value, detail) {
  return `<article><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value || ""))}</strong><small>${escapeHtml(detail || "")}</small></article>`;
}

function renderSaleDetailPaymentBreakdown(sale) {
  const detail = parsePaymentDetail(sale.payment_detail || sale.paymentDetail);
  const entries = Object.entries(detail).filter(([, amount]) => Number(amount || 0) > 0);
  if (!entries.length) return "";
  return `<section class="sale-detail-payment-card">
    <div><span>Pago mixto</span><strong>Detalle por metodo</strong></div>
    ${entries.map(([method, amount]) => `<article><span>${escapeHtml(paymentLabel(method))}</span><strong>${money(amount)}</strong></article>`).join("")}
  </section>`;
}

function renderSaleReturnPanel(items) {
  if (!items.length) return "";
  return `<section class="sale-detail-card sale-return-panel">
    <div>
      <span>Devolucion</span>
      <strong>Parcial o total</strong>
    </div>
    <form id="saleReturnForm" class="admin-form span-2">
      <div class="return-item-list">
        ${items.map((item) => `<label class="return-item-row">
          <span>${escapeHtml(item.product_name)} <small>Vendidos: ${num(item.quantity)}</small></span>
          <input data-return-qty="${item.product_id}" type="number" min="0" max="${Number(item.quantity || 0)}" step="1" value="0" />
        </label>`).join("")}
      </div>
      <div class="form-grid">
        <label>Monto a devolver<input id="returnRefundAmount" type="number" min="0" step="0.01" value="0" /></label>
        <label>Motivo<input id="returnReason" type="text" required placeholder="Producto danado, cambio, error, etc." /></label>
      </div>
      <div class="cloud-safe-note"><strong id="returnEstimate">Total seleccionado: 0.00</strong><span>Si devuelves dinero, el cajero debe tener caja abierta.</span></div>
      <div class="modal-actions"><button class="primary-button" type="submit">Registrar devolucion</button></div>
    </form>
  </section>`;
}

function updateReturnEstimate(items) {
  const total = items.reduce((sum, item) => {
    const quantity = Number(saleDetailContent.querySelector(`[data-return-qty="${CSS.escape(item.product_id)}"]`)?.value || 0);
    return sum + quantity * Number(item.unit_price || 0);
  }, 0);
  const label = saleDetailContent.querySelector("#returnEstimate");
  const refund = saleDetailContent.querySelector("#returnRefundAmount");
  if (label) label.textContent = `Total seleccionado: ${money(total)}`;
  if (refund && Number(refund.value || 0) === 0) refund.value = total.toFixed(2);
}

async function submitSaleReturn(event, sale, items) {
  event.preventDefault();
  const returnItems = items
    .map((item) => ({
      productId: item.product_id,
      quantity: Number(saleDetailContent.querySelector(`[data-return-qty="${CSS.escape(item.product_id)}"]`)?.value || 0)
    }))
    .filter((item) => item.quantity > 0);
  if (!returnItems.length) return window.alert("Selecciona al menos un producto para devolver.");
  const reason = value("#returnReason").trim();
  if (!reason) return window.alert("El motivo de devolucion es obligatorio.");
  try {
    const response = await apiRequest(`/ventas/sales/${sale.id}/returns`, {
      method: "POST",
      body: {
        reason,
        refundAmount: Number(value("#returnRefundAmount") || 0),
        items: returnItems
      }
    });
    saleDetailModal.close();
    ventasMessage = `Devolucion ${response.return.code} registrada. Stock actualizado${Number(response.return.refund_amount || 0) > 0 ? " y egreso de caja guardado" : ""}.`;
    await render();
  } catch (error) {
    ventasMessage = error.message || "No se pudo registrar la devolucion.";
    renderMain();
  }
}

function renderTicketPaymentDetail(sale) {
  const detail = parsePaymentDetail(sale.payment_detail || sale.paymentDetail);
  const rows = Object.entries(detail).filter(([, amount]) => Number(amount || 0) > 0);
  if (!rows.length) return "";
  return `<div class="ticket-box">${rows.map(([method, amount]) => `<div class="row"><span>${escapeHtml(paymentLabel(method))}</span><strong>${money(amount)}</strong></div>`).join("")}</div>`;
}

function parsePaymentDetail(value) {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function salePaymentAmountForMethod(sale, method) {
  const detail = parsePaymentDetail(sale.payment_detail || sale.paymentDetail);
  if (Object.keys(detail).length) return Number(detail[method] || 0);
  const saleMethod = sale.payment_method || "efectivo";
  if (saleMethod === method) return Number(sale.amount_paid || sale.cash_received || sale.total || 0);
  return 0;
}

function salePaymentHasMethod(sale, method) {
  const detail = parsePaymentDetail(sale.payment_detail || sale.paymentDetail);
  if (Object.keys(detail).length) return Number(detail[method] || 0) > 0;
  return (sale.payment_method || "efectivo") === method;
}

async function voidSale(saleId) {
  const sale = sales.find((item) => item.id === saleId);
  if (!sale) return;
  voidSaleDraft = { saleId };
  voidSaleForm.reset();
  document.querySelector("#voidSaleTitle").textContent = `Anular ${sale.code}`;
  voidSaleModal.showModal();
}

async function submitVoidSale(event) {
  event.preventDefault();
  const sale = sales.find((item) => item.id === voidSaleDraft.saleId);
  if (!sale) return;
  const reason = value("#voidSaleReason").trim();
  if (!reason) return window.alert("El motivo de anulacion es obligatorio.");
  try {
    const response = await apiRequest(`/ventas/sales/${sale.id}/void`, { method: "POST", body: { reason } });
    voidSaleModal.close();
    localSaleMeta[sale.id] = { ...(localSaleMeta[sale.id] || {}), status: "anulada", voidedAt: new Date().toISOString() };
    persistJson(LOCAL_SALE_META_KEY, localSaleMeta);
    ventasMessage = `Venta ${response.sale.code} anulada. El stock fue devuelto al inventario.`;
    await render();
  } catch (error) {
    ventasMessage = error.message || "No se pudo anular la venta.";
    renderMain();
  }
}

async function saveStoreSettings(event) {
  event.preventDefault();
  const payload = {
    companyName: value("#storeCompanyName").trim(),
    storeName: value("#storeName").trim(),
    currency: value("#storeCurrency").trim().toUpperCase(),
    taxId: value("#storeTaxId").trim(),
    phone: value("#storePhone").trim(),
    address: value("#storeAddress").trim(),
    ticketNote: value("#storeTicketNote").trim(),
    cashRegisterCount: Number(value("#storeCashRegisterCount") || 1),
    taxRate: Number(value("#storeTaxRate") || 0),
    allowCredit: Boolean(document.querySelector("#storeAllowCredit")?.checked),
    allowDiscounts: Boolean(document.querySelector("#storeAllowDiscounts")?.checked),
    requireCustomerForSale: Boolean(document.querySelector("#storeRequireCustomerForSale")?.checked)
  };
  const validation = validateStoreSettingsPayload(payload);
  if (validation) {
    ventasMessage = validation;
    return renderMain();
  }
  try {
    const response = await apiRequest("/ventas/settings", { method: "PATCH", body: payload });
    storeSettings = response.settings;
    ventasMessage = "Configuracion de tienda actualizada.";
    await render();
  } catch (error) {
    ventasMessage = error.message || "No se pudo guardar la configuracion.";
    renderMain();
  }
}

async function saveSupplier(event) {
  event.preventDefault();
  try {
    await apiRequest("/ventas/suppliers", {
      method: "POST",
      body: {
        name: value("#supplierName"),
        phone: value("#supplierPhone"),
        taxId: value("#supplierTaxId"),
        address: value("#supplierAddress")
      }
    });
    ventasMessage = "Proveedor registrado correctamente.";
    activeView = "purchases";
    await render();
  } catch (error) {
    ventasMessage = error.message || "No se pudo registrar el proveedor.";
    renderMain();
  }
}

async function savePurchase(event, status = "confirmada") {
  event?.preventDefault();
  if (!purchaseCart.length) addPurchaseLine();
  if (!purchaseCart.length) return;
  try {
    await apiRequest("/ventas/purchases", {
      method: "POST",
      body: {
        supplierId: value("#purchaseSupplier"),
        invoiceNumber: value("#purchaseInvoice"),
        note: value("#purchaseNote"),
        status,
        items: purchaseCart.map((item) => ({ productId: item.productId, quantity: item.quantity, unitCost: item.unitCost }))
      }
    });
    purchaseCart = [];
    ventasMessage = status === "pendiente"
      ? "Orden de compra guardada como pendiente. El stock se actualizara al recibirla."
      : "Compra registrada. El stock fue actualizado y quedo en Kardex.";
    activeView = "purchases";
    await render();
  } catch (error) {
    ventasMessage = error.message || "No se pudo registrar la compra.";
    renderMain();
  }
}

async function receivePurchaseOrder(purchaseId) {
  const purchase = purchases.find((item) => item.id === purchaseId);
  if (!purchase || !confirm(`Recibir la orden ${purchase.code}? Esto sumara los productos al stock.`)) return;
  try {
    await apiRequest(`/ventas/purchases/${purchaseId}/receive`, { method: "PATCH" });
    ventasMessage = `Orden ${purchase.code} recibida. Stock actualizado y movimiento registrado en Kardex.`;
    activeView = "purchases";
    await render();
  } catch (error) {
    ventasMessage = error.message || "No se pudo recibir la orden.";
    renderMain();
  }
}

async function cancelPurchaseOrder(purchaseId) {
  const purchase = purchases.find((item) => item.id === purchaseId);
  if (!purchase || !confirm(`Cancelar la orden pendiente ${purchase.code}?`)) return;
  try {
    await apiRequest(`/ventas/purchases/${purchaseId}/cancel`, { method: "PATCH" });
    ventasMessage = `Orden ${purchase.code} cancelada. No afecto inventario.`;
    activeView = "purchases";
    await render();
  } catch (error) {
    ventasMessage = error.message || "No se pudo cancelar la orden.";
    renderMain();
  }
}

function addPurchaseLine() {
  const product = products.find((item) => item.id === value("#purchaseProduct"));
  if (!product) return;
  const quantity = Number(value("#purchaseQuantity") || 0);
  const unitCost = Number(value("#purchaseCost") || product.cost_price || 0);
  if (!quantity || quantity <= 0) return window.alert("Ingresa una cantidad valida para la compra.");
  const existing = purchaseCart.find((item) => item.productId === product.id && Number(item.unitCost) === unitCost);
  if (existing) existing.quantity += quantity;
  else purchaseCart.push({ id: crypto.randomUUID(), productId: product.id, name: product.name, quantity, unitCost });
  renderMain();
}

function prepareSuggestedPurchase() {
  const suggestions = products
    .filter((product) => isProductActive(product) && Number(product.stock || 0) <= Number(product.min_stock || 0))
    .map((product) => ({
      product,
      quantity: suggestedReorderQuantity(product),
      unitCost: Number(product.cost_price || 0)
    }))
    .filter((item) => item.quantity > 0);

  if (!suggestions.length) {
    ventasMessage = "No hay productos por reponer en este momento.";
    activeView = "purchases";
    renderMain();
    return;
  }

  suggestions.forEach(({ product, quantity, unitCost }) => {
    const existing = purchaseCart.find((item) => item.productId === product.id && Number(item.unitCost) === unitCost);
    if (existing) existing.quantity = Math.max(Number(existing.quantity || 0), quantity);
    else purchaseCart.push({ id: crypto.randomUUID(), productId: product.id, name: product.name, quantity, unitCost });
  });

  selectedKardex = null;
  ventasMessage = `Compra sugerida preparada con ${suggestions.length} producto${suggestions.length === 1 ? "" : "s"} en alerta. Revisa cantidades antes de registrar.`;
  activeView = "purchases";
  renderMain();
}

function clearPurchaseCart() {
  if (!purchaseCart.length) return;
  if (!confirm("Limpiar todos los productos cargados en esta compra?")) return;
  purchaseCart = [];
  ventasMessage = "Detalle de compra limpiado.";
  activeView = "purchases";
  renderMain();
}

function printPurchaseOrder() {
  if (!purchaseCart.length) return;
  const supplierId = value("#purchaseSupplier");
  const supplier = suppliers.find((item) => item.id === supplierId);
  const invoice = value("#purchaseInvoice") || "Sin factura/nota";
  const note = value("#purchaseNote") || "Reposicion de inventario";
  const code = `OC-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${String(Date.now()).slice(-4)}`;
  const title = storeSettings.storeName || storeSettings.companyName || currentUser.companyName || "Zow Ventas-Almacen";
  const total = purchaseCart.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
  const printable = window.open("", "_blank", "width=860,height=760");
  if (!printable) return;
  printable.document.write(`<!doctype html><html><head><meta charset="UTF-8"><title>Orden ${escapeHtml(code)}</title><style>
    *{box-sizing:border-box}body{font-family:Arial,sans-serif;margin:0;padding:28px;color:#111;background:#fff}
    .toolbar{margin-bottom:16px}.toolbar button{border:0;border-radius:8px;padding:10px 16px;background:#0f172a;color:#fff;font-weight:800}
    .head{display:flex;justify-content:space-between;gap:24px;border-bottom:3px solid #0f172a;padding-bottom:16px;margin-bottom:16px}
    h1{font-size:24px;margin:0;text-transform:uppercase}.muted{color:#555;font-size:12px;line-height:1.45}.badge{display:inline-block;border:1px solid #0f172a;border-radius:999px;padding:6px 10px;font-weight:800;font-size:12px}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:14px 0}.box{border:1px solid #d1d5db;border-radius:10px;padding:12px}
    .box strong,.box span{display:block}.box span{margin-top:4px;color:#555;font-size:12px}
    table{width:100%;border-collapse:collapse;margin-top:14px}th{background:#f1f5f9;text-align:left;font-size:12px;text-transform:uppercase;color:#334155}th,td{border:1px solid #d1d5db;padding:9px;font-size:13px;vertical-align:top}td:last-child,th:last-child{text-align:right}
    .total{display:flex;justify-content:flex-end;margin-top:14px}.total div{min-width:260px;border:2px solid #0f172a;border-radius:10px;padding:12px;display:flex;justify-content:space-between;font-size:18px;font-weight:900}
    .signs{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:54px}.sign{border-top:1px solid #111;text-align:center;padding-top:8px;font-size:12px;color:#333}
    .foot{margin-top:18px;text-align:center;color:#555;font-size:11px}@media print{.toolbar{display:none}body{padding:12px}.head{break-inside:avoid}.signs{break-inside:avoid}}
  </style></head><body>
  <div class="toolbar"><button onclick="window.print()">Imprimir orden de compra</button></div>
  <section class="head">
    <div><h1>${escapeHtml(title)}</h1><p class="muted">${escapeHtml(storeSettings.taxId ? `NIT ${storeSettings.taxId}` : "")}<br>${escapeHtml(storeSettings.address || "")}<br>${escapeHtml(storeSettings.phone || "")}</p></div>
    <div><span class="badge">${escapeHtml(code)}</span><p class="muted"><strong>Fecha:</strong> ${formatDateTime(new Date().toISOString())}<br><strong>Solicita:</strong> ${escapeHtml(currentUser.name || currentUser.username || "Usuario")}<br><strong>Estado:</strong> Pendiente de recepcion</p></div>
  </section>
  <section class="grid">
    <div class="box"><strong>Proveedor</strong><span>${escapeHtml(supplier?.name || "Proveedor sin registrar")}</span><span>${escapeHtml(supplier?.tax_id ? `NIT/CI ${supplier.tax_id}` : "Sin NIT/CI")}</span><span>${escapeHtml(supplier?.phone ? `Cel. ${supplier.phone}` : "Sin celular")}</span></div>
    <div class="box"><strong>Referencia</strong><span>${escapeHtml(invoice)}</span><span>${escapeHtml(note)}</span><span>Moneda: ${escapeHtml(storeSettings.currency || "BOB")}</span></div>
  </section>
  <table><thead><tr><th>Codigo</th><th>Producto</th><th>Stock actual</th><th>Cantidad</th><th>Costo unit.</th><th>Total</th></tr></thead><tbody>
    ${purchaseCart.map((item) => {
      const product = products.find((entry) => entry.id === item.productId);
      return `<tr><td>${escapeHtml(product?.code || "")}</td><td>${escapeHtml(item.name)}</td><td>${num(product?.stock || 0)} / Min. ${num(product?.min_stock || 0)}</td><td>${num(item.quantity)}</td><td>${money(item.unitCost)}</td><td>${money(item.quantity * item.unitCost)}</td></tr>`;
    }).join("")}
  </tbody></table>
  <div class="total"><div><span>Total estimado</span><strong>${money(total)}</strong></div></div>
  <section class="signs"><div class="sign">Solicitado por</div><div class="sign">Autorizado por</div><div class="sign">Recibido almacen</div></section>
  <p class="foot">Orden generada por Sistema ZOW SAAS.</p>
  </body></html>`);
  printable.document.close();
  printable.focus();
}

function updatePurchaseCostFromProduct() {
  const input = document.querySelector("#purchaseCost");
  const product = products.find((item) => item.id === document.querySelector("#purchaseProduct")?.value);
  if (input && product && Number(input.value || 0) === 0) input.value = Number(product.cost_price || 0);
}

async function saveVentasUser(event) {
  event.preventDefault();
  ventasMessage = "";
  const payload = {
    name: value("#ventasUserName").trim(),
    username: value("#ventasUsername").trim().toLowerCase(),
    password: value("#ventasUserPassword"),
    role: value("#ventasUserRole"),
    unitId: value("#ventasUserUnit"),
    position: value("#ventasUserPosition").trim(),
    ci: value("#ventasUserCi").trim(),
    phone: value("#ventasUserPhone").trim(),
    cashRegisterNumber: Number(value("#ventasUserCashRegister") || 0)
  };
  if (editingUserId && !payload.password) delete payload.password;
  try {
    await apiRequest(editingUserId ? `/users/${editingUserId}` : "/users", {
      method: editingUserId ? "PATCH" : "POST",
      body: payload
    });
    ventasMessage = editingUserId ? "Usuario actualizado correctamente." : "Usuario creado correctamente.";
    editingUserId = "";
    activeView = "users";
    await render();
  } catch (error) {
    ventasMessage = error.message || "No se pudo guardar el usuario.";
    renderMain();
  }
}

async function toggleVentasUser(userId) {
  const user = users.find((item) => item.id === userId);
  if (!user || user.protected || user.id === currentUser.id) return;
  try {
    await apiRequest(`/users/${user.id}/status`, { method: "PATCH", body: { active: !user.active } });
    ventasMessage = `Usuario ${user.active ? "desactivado" : "activado"} correctamente.`;
    activeView = "users";
    await render();
  } catch (error) {
    ventasMessage = error.message || "No se pudo cambiar el estado del usuario.";
    renderMain();
  }
}

function applyRoleTemplate(template) {
  const templates = {
    integral: { role: "ventas_admin", position: "Operador integral" },
    cashier: { role: "cajero", position: "Cajero vendedor" },
    warehouse: { role: "almacen", position: "Responsable de almacen" }
  };
  const selected = templates[template];
  if (!selected) return;
  document.querySelector("#ventasUserRole").value = selected.role;
  document.querySelector("#ventasUserPosition").value = selected.position;
}

async function openStockMovement(productId, type) {
  const product = products.find((item) => item.id === productId);
  if (!product) return;
  stockMovementDraft = { productId, type };
  stockMovementForm.reset();
  document.querySelector("#stockMovementTitle").textContent = type === "entrada" ? "Entrada de stock" : type === "salida" ? "Salida de stock" : "Ajuste exacto de stock";
  document.querySelector("#stockMovementProduct").innerHTML = `<strong>${escapeHtml(product.name)}</strong><span>Stock actual ${num(product.stock)} / Minimo ${num(product.min_stock)}</span>`;
  document.querySelector("#stockMovementType").value = type;
  document.querySelector("#stockMovementQuantity").value = type === "ajuste" ? Number(product.stock || 0) : 1;
  document.querySelector("#stockMovementReference").value = type === "entrada" ? "Reposicion" : type === "salida" ? "Merma / salida interna" : "Conteo fisico";
  updateStockMovementLabels();
  stockMovementModal.showModal();
}

function updateStockMovementLabels() {
  const type = value("#stockMovementType");
  const label = document.querySelector("#stockMovementQuantityLabel");
  const input = document.querySelector("#stockMovementQuantity");
  if (!label || !input) return;
  label.textContent = type === "ajuste" ? "Stock final contado" : "Cantidad";
  input.min = type === "ajuste" ? "0" : "0.01";
}

async function saveStockMovement(event) {
  event.preventDefault();
  const product = products.find((item) => item.id === stockMovementDraft.productId);
  if (!product) return;
  const type = value("#stockMovementType");
  const quantity = Number(value("#stockMovementQuantity"));
  const reference = value("#stockMovementReference").trim();
  const note = value("#stockMovementNote").trim();
  if (!reference || !note) {
    window.alert("La referencia y observacion son obligatorias para auditar el Kardex.");
    return;
  }
  if (!Number.isFinite(quantity) || quantity < 0 || (type !== "ajuste" && quantity <= 0)) {
    window.alert("Ingresa una cantidad valida.");
    return;
  }
  if (type === "salida" && quantity > Number(product.stock || 0)) {
    window.alert("La salida no puede superar el stock disponible.");
    return;
  }
  try {
    await apiRequest(`/ventas/products/${product.id}/movements`, {
      method: "POST",
      body: { type, quantity, reference, note }
    });
    stockMovementModal.close();
    ventasMessage = "Movimiento guardado y Kardex actualizado.";
    activeView = "inventory";
    selectedKardex = null;
    await render();
  } catch (error) {
    window.alert(error.message || "No se pudo guardar el movimiento.");
  }
}

async function toggleFavoriteProduct(productId) {
  if (!can("manageFavorites")) return;
  const wasFavorite = favoriteProducts.includes(productId);
  try {
    const response = await apiRequest(`/ventas/favorites/${productId}`, { method: "POST" });
    favoriteProducts = Array.isArray(response.favorites) ? response.favorites : favoriteProducts;
    persistJson(FAVORITE_PRODUCTS_KEY, []);
    ventasMessage = wasFavorite ? "Producto quitado de favoritos del POS." : "Producto marcado como favorito del POS.";
    renderMain();
  } catch (error) {
    ventasMessage = error.message || "No se pudo actualizar favoritos POS.";
    renderMain();
  }
}

async function viewStockHistory(productId) {
  try {
    const response = await apiRequest(`/ventas/products/${productId}/movements`);
    selectedKardex = { productId, movements: response.movements || [] };
    renderMain();
  } catch (error) {
    ventasMessage = error.message || "No se pudo cargar el kardex.";
    renderMain();
  }
}

async function savePromotion(event) {
  event.preventDefault();
  const payload = {
    name: value("#promotionName"),
    scopeType: value("#promotionScope"),
    productId: value("#promotionProduct"),
    category: value("#promotionCategory"),
    type: value("#promotionType"),
    value: Number(value("#promotionValue")),
    minQuantity: Number(value("#promotionMinQuantity") || 1),
    startsAt: value("#promotionStartsAt"),
    endsAt: value("#promotionEndsAt")
  };
  try {
    await apiRequest(editingPromotionId ? `/ventas/promotions/${editingPromotionId}` : "/ventas/promotions", {
      method: editingPromotionId ? "PATCH" : "POST",
      body: payload
    });
    ventasMessage = editingPromotionId ? "Promocion actualizada." : "Promocion creada y lista para aplicarse en caja.";
    editingPromotionId = "";
    await render();
  } catch (error) {
    ventasMessage = error.message || "No se pudo guardar la promocion.";
    renderMain();
  }
}

async function saveCombo(event) {
  event.preventDefault();
  const items = [0, 1, 2, 3].map((index) => ({
    productId: document.querySelector(`[data-combo-product="${index}"]`)?.value || "",
    quantity: Number(document.querySelector(`[data-combo-qty="${index}"]`)?.value || 0)
  })).filter((item) => item.productId && item.quantity > 0);
  const payload = {
    code: value("#comboCode"),
    name: value("#comboName"),
    price: Number(value("#comboPrice")),
    items
  };
  try {
    await apiRequest(editingComboId ? `/ventas/combos/${editingComboId}` : "/ventas/combos", {
      method: editingComboId ? "PATCH" : "POST",
      body: payload
    });
    ventasMessage = editingComboId ? "Combo actualizado." : "Combo creado y disponible en caja.";
    editingComboId = "";
    await render();
  } catch (error) {
    ventasMessage = error.message || "No se pudo guardar el combo.";
    renderMain();
  }
}

function editPromotion(id) {
  editingPromotionId = id;
  renderMain();
}

async function duplicatePromotion(id) {
  const promotion = promotions.find((item) => item.id === id);
  if (!promotion) return;
  try {
    await apiRequest("/ventas/promotions", {
      method: "POST",
      body: {
        name: `${promotion.name} copia`,
        scopeType: promotion.scopeType,
        productId: promotion.productId,
        category: promotion.category,
        type: promotion.type,
        value: promotion.value,
        minQuantity: promotion.minQuantity,
        startsAt: todayDate(),
        endsAt: promotion.endsAt
      }
    });
    ventasMessage = "Promocion duplicada. Puedes editarla para ajustar fechas o descuento.";
    await render();
  } catch (error) {
    ventasMessage = error.message || "No se pudo duplicar la promocion.";
    renderMain();
  }
}

async function togglePromotion(id) {
  const promotion = promotions.find((item) => item.id === id);
  if (!promotion) return;
  try {
    await apiRequest(`/ventas/promotions/${id}`, { method: "PATCH", body: { active: !promotion.active } });
    ventasMessage = promotion.active ? "Promocion pausada." : "Promocion activada.";
    await render();
  } catch (error) {
    ventasMessage = error.message || "No se pudo actualizar la promocion.";
    renderMain();
  }
}

async function deletePromotion(id) {
  if (!confirm("Eliminar esta promocion?")) return;
  try {
    await apiRequest(`/ventas/promotions/${id}`, { method: "DELETE" });
    ventasMessage = "Promocion eliminada.";
    await render();
  } catch (error) {
    ventasMessage = error.message || "No se pudo eliminar la promocion.";
    renderMain();
  }
}

async function toggleCombo(id) {
  const combo = combos.find((item) => item.id === id);
  if (!combo) return;
  try {
    await apiRequest(`/ventas/combos/${id}`, { method: "PATCH", body: { active: !combo.active } });
    ventasMessage = combo.active ? "Combo pausado." : "Combo activado.";
    await render();
  } catch (error) {
    ventasMessage = error.message || "No se pudo actualizar el combo.";
    renderMain();
  }
}

async function deleteCombo(id) {
  if (!confirm("Eliminar este combo?")) return;
  try {
    await apiRequest(`/ventas/combos/${id}`, { method: "DELETE" });
    ventasMessage = "Combo eliminado.";
    await render();
  } catch (error) {
    ventasMessage = error.message || "No se pudo eliminar el combo.";
    renderMain();
  }
}

async function payReceivable(saleId) {
  const sale = receivables.find((item) => item.id === saleId);
  if (!sale) return;
  receivablePaymentDraft = { saleId };
  receivablePaymentForm.reset();
  document.querySelector("#receivablePaymentTitle").textContent = `Pago ${sale.code}`;
  document.querySelector("#receivablePaymentInfo").innerHTML = `
    <div><span>Cliente</span><strong>${escapeHtml(sale.customer_name || "Cliente sin registrar")}</strong></div>
    <div><span>Total venta</span><strong>${money(sale.total)}</strong></div>
    <div><span>Pagado</span><strong>${money(sale.amount_paid)}</strong></div>
    <div><span>Saldo</span><strong class="warn-text">${money(sale.balance_due)}</strong></div>
  `;
  document.querySelector("#receivablePaymentAmount").value = Number(sale.balance_due || 0).toFixed(2);
  receivablePaymentModal.showModal();
}

function payOldestReceivableForCustomer(customerName) {
  const sale = receivables
    .filter((item) => (item.customer_name || "Cliente sin registrar") === customerName)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))[0];
  if (!sale) return;
  payReceivable(sale.id);
}

async function saveReceivablePayment(event) {
  event.preventDefault();
  const sale = receivables.find((item) => item.id === receivablePaymentDraft.saleId);
  if (!sale) return;
  const amount = Number(value("#receivablePaymentAmount") || 0);
  const method = value("#receivablePaymentMethod") || "efectivo";
  if (!Number.isFinite(amount) || amount <= 0 || amount > Number(sale.balance_due || 0)) {
    window.alert("Ingresa un monto valido. No puede superar el saldo pendiente.");
    return;
  }
  try {
    await apiRequest(`/ventas/sales/${sale.id}/pay`, { method: "POST", body: { amount, paymentMethod: method } });
    receivablePaymentModal.close();
    ventasMessage = "Pago registrado. La cuenta por cobrar fue actualizada.";
    activeView = "customers";
    await render();
  } catch (error) {
    window.alert(error.message || "No se pudo registrar el pago.");
  }
}

async function toggleProductStatus(productId) {
  const product = products.find((item) => item.id === productId);
  if (!product) return;
  const active = isProductActive(product);
  if (!confirm(`${active ? "Desactivar" : "Reactivar"} ${product.name}?`)) return;
  try {
    await apiRequest(`/ventas/products/${product.id}/status`, { method: "PATCH", body: { active: !active } });
    ventasMessage = active ? "Producto desactivado. Ya no aparecera en caja." : "Producto reactivado para venta.";
    await render();
  } catch (error) {
    ventasMessage = error.message || "No se pudo cambiar el estado del producto.";
    renderMain();
  }
}

async function loadStarterProducts() {
  ventasMessage = "";
  let created = 0;
  let skipped = 0;
  try {
    for (const product of starterProducts) {
      try {
        await apiRequest("/ventas/products", { method: "POST", body: product });
        created += 1;
      } catch (error) {
        if (String(error.message || "").toLowerCase().includes("codigo")) skipped += 1;
        else throw error;
      }
    }
    ventasMessage = created
      ? `Inventario de prueba cargado: ${created} producto${created === 1 ? "" : "s"}.`
      : `Los productos de prueba ya estaban registrados.`;
    if (skipped && created) ventasMessage += ` ${skipped} ya existian.`;
  } catch (error) {
    ventasMessage = error.message || "No se pudo cargar el inventario de prueba.";
  }
  activeView = "inventory";
  await render();
}

function downloadProductImportTemplate() {
  downloadCsv(`plantilla-productos-zow-${csvDateStamp()}.csv`, [{
    codigo: "SKU-001",
    codigo_barras: "7791234567890",
    nombre: "Producto ejemplo",
    categoria: "Abarrotes",
    unidad: "Unidad",
    costo: "10.50",
    precio: "15.00",
    stock_minimo: "5",
    stock_inicial: "20",
    lote: "L-001",
    vencimiento: "2026-12-31"
  }]);
}

async function importProductsFile(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  if (!can("manageInventory")) return window.alert("Tu rol no puede importar productos.");
  try {
    if (file.size > 8 * 1024 * 1024) return window.alert("El archivo no debe superar 8 MB.");
    const previewForm = new FormData();
    previewForm.append("file", file);
    const preview = await apiRequest("/ventas/products/import/preview", { method: "POST", body: previewForm });
    const previewText = productImportPreviewText(file.name, preview);
    if (!preview.valid) return window.alert(`${previewText}\n\nNo hay filas validas para importar.`);
    if (!confirm(previewText)) return;
    const formData = new FormData();
    formData.append("file", file);
    const result = await apiRequest("/ventas/products/import", { method: "POST", body: formData });
    ventasMessage = `Importacion completada: ${result.created || 0} nuevo${result.created === 1 ? "" : "s"}, ${result.updated || 0} actualizado${result.updated === 1 ? "" : "s"}`;
    if (result.skipped?.length) ventasMessage += ` y ${result.skipped.length} omitido${result.skipped.length === 1 ? "" : "s"}.`;
    else ventasMessage += ".";
    activeView = "inventory";
    await render();
  } catch (error) {
    ventasMessage = error.message || "No se pudo importar el archivo.";
    renderMain();
  }
}

function productImportPreviewText(fileName, preview) {
  const sampleIssues = (preview.items || [])
    .filter((item) => item.issues?.length)
    .slice(0, 6)
    .map((item) => `Fila ${item.row} (${item.code || item.name || "sin codigo"}): ${item.issues.join(", ")}`)
    .join("\n");
  return [
    `Vista previa de importacion: "${fileName}"`,
    "",
    `Filas leidas: ${preview.total || 0}`,
    `Listas para importar: ${preview.valid || 0}`,
    `Productos nuevos: ${preview.created || 0}`,
    `Productos a actualizar: ${preview.updated || 0}`,
    `Filas omitidas: ${preview.skipped || 0}`,
    `Observaciones: ${preview.warnings || 0}`,
    sampleIssues ? `\nPrimeras observaciones:\n${sampleIssues}` : "",
    "\nContinuar con la importacion?"
  ].filter(Boolean).join("\n");
}

async function assertVentasAccess() {
  if (currentUser?.role === "zow_owner") throw new Error("El panel ZOW administra empresas. Ingresa con un usuario de empresa.");
  await apiRequest("/ventas/settings");
}

async function apiRequest(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = sessionStorage.getItem(TOKEN_KEY);
  if (options.auth !== false && token) headers.Authorization = `Bearer ${token}`;
  let body = options.body;
  if (body && !(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(body);
  }
  const response = await fetch(`${API_BASE_URL}${path}`, { method: options.method || "GET", headers, body });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Error de servidor");
  return data;
}

function mainList() { return document.querySelector("#mainList"); }
function setCount(text) { document.querySelector("#resultCount").textContent = text; }
function value(selector) { return document.querySelector(selector).value; }
function loadSession() { try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch { return null; } }
function empty(text) { return `<div class="empty-state"><strong>${escapeHtml(text)}</strong></div>`; }
function money(value) { return `${Number(value || 0).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${storeSettings.currency || "BOB"}`; }
function num(value) { return Number(value || 0).toLocaleString("es-BO"); }
function formatDateTime(date) { return new Intl.DateTimeFormat("es-BO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(date)); }
function roleLabel(role) { return { admin: "Encargado de sistema", recepcion_principal: "Recepcion principal", recepcion_secundaria: "Recepcion secundaria", funcionario: "Funcionario", supervisor: "Supervisor", ventas_admin: "Operador integral", cajero: "Cajero", almacen: "Almacen", vendedor: "Vendedor" }[role] || role; }
function paymentMethods() {
  return [
    { id: "efectivo", label: "Efectivo", icon: "$" },
    { id: "tarjeta", label: "Tarjeta", icon: "CARD" },
    { id: "transferencia", label: "Transferencia", icon: "TRF" },
    { id: "qr", label: "QR", icon: "QR" },
    { id: "mixto", label: "Pago mixto", icon: "MIX" },
    { id: "credito", label: "Credito", icon: "CR" }
  ];
}
function availablePaymentMethods() {
  return paymentMethods().filter((method) => storeSettings.allowCredit || method.id !== "credito");
}
function paymentLabel(id) { return paymentMethods().find((method) => method.id === id)?.label || "Efectivo"; }
function normalizeText(value) { return String(value || "").trim().toLowerCase(); }
function purchaseStatusLabel(status) {
  return { pendiente: "Pendiente", confirmada: "Recibida", recibida: "Recibida", cancelada: "Cancelada" }[status] || status;
}
function cashRegisterOptions() {
  const count = Math.min(Math.max(Math.floor(Number(storeSettings.cashRegisterCount || 1)), 1), 20);
  return Array.from({ length: count }, (_, index) => index + 1);
}
function todayDate() { return new Date().toISOString().slice(0, 10); }
function isPromotionActiveNow(promotion) {
  if (!promotion.active) return false;
  const today = todayDate();
  return (!promotion.startsAt || promotion.startsAt <= today) && (!promotion.endsAt || promotion.endsAt >= today);
}
function promotionLabel(promotion) {
  const value = promotion.type === "percent" ? `${Number(promotion.value || 0)}%` : money(promotion.value);
  return `${value} desde ${num(promotion.minQuantity || 1)} unidad${Number(promotion.minQuantity || 1) === 1 ? "" : "es"}`;
}
function preferredCashRegisterNumber() {
  const preferred = Number(currentUser?.cashRegisterNumber || 0);
  return cashRegisterOptions().includes(preferred) ? preferred : 1;
}
function exportSalesCsv() {
  const rows = sales.filter(isSaleInsideReportFilter).map((sale) => ({
    codigo: sale.code,
    fecha: formatDateTime(sale.created_at),
    cliente: sale.customer_name || "Cliente sin registrar",
    vendedor: sale.seller_name || "",
    metodo_pago: paymentLabel(sale.payment_method || localSaleMeta[sale.id]?.method || "efectivo"),
    subtotal: Number(sale.subtotal || 0).toFixed(2),
    descuento: Number(sale.discount || 0).toFixed(2),
    impuesto: Number(sale.tax || 0).toFixed(2),
    total: Number(sale.total || 0).toFixed(2),
    pagado: Number(sale.amount_paid || sale.cash_received || 0).toFixed(2),
    saldo: Number(sale.balance_due || 0).toFixed(2),
    estado: saleStatus(sale)
  }));
  downloadCsv(`ventas-${csvDateStamp()}.csv`, rows);
}

function exportVisibleHistoryCsv() {
  const rows = filteredHistorySales().map((sale) => ({
    codigo: sale.code,
    fecha: formatDateTime(sale.created_at),
    cliente: sale.customer_name || "Cliente sin registrar",
    cajero: sale.seller_name || "",
    metodo_pago: paymentLabel(sale.payment_method || localSaleMeta[sale.id]?.method || "efectivo"),
    estado: saleStatus(sale),
    subtotal: Number(sale.subtotal || 0).toFixed(2),
    descuento: Number(sale.discount || 0).toFixed(2),
    impuesto: Number(sale.tax || 0).toFixed(2),
    total: Number(sale.total || 0).toFixed(2),
    pagado: Number(sale.amount_paid || sale.cash_received || 0).toFixed(2),
    saldo: Number(sale.balance_due || 0).toFixed(2),
    caja_cerrada: sale.cash_closed ? "si" : "no"
  }));
  downloadCsv(`historial-ventas-${csvDateStamp()}.csv`, rows);
}

function exportCustomersCsv() {
  const debtByCustomer = new Map();
  const oldestDebtByCustomer = new Map();
  const riskByCustomer = new Map(buildCustomerRiskList().map((item) => [item.name, item]));
  receivables.forEach((sale) => {
    const name = sale.customer_name || "Cliente sin registrar";
    debtByCustomer.set(name, (debtByCustomer.get(name) || 0) + Number(sale.balance_due || 0));
    oldestDebtByCustomer.set(name, Math.max(oldestDebtByCustomer.get(name) || 0, daysSince(sale.created_at)));
  });
  const rows = customers.map((customer) => {
    const risk = riskByCustomer.get(customer.name);
    return {
      cliente: customer.name,
      ci_nit: customer.ci || "",
      celular: customer.phone || "",
      email: customer.email || "",
      direccion: customer.address || "",
      estado: customer.status || "activo",
      limite_credito: Number(customer.credit_limit || 0).toFixed(2),
      saldo_pendiente: Number(debtByCustomer.get(customer.name) || 0).toFixed(2),
      deuda_mas_antigua_dias: Number(oldestDebtByCustomer.get(customer.name) || 0),
      riesgo: risk?.level || "sin deuda",
      recomendacion: risk?.recommendation || "Sin accion"
    };
  });
  receivables.filter((sale) => !customers.some((customer) => customer.name === sale.customer_name)).forEach((sale) => {
    rows.push({
      cliente: sale.customer_name || "Cliente sin registrar",
      ci_nit: "",
      celular: "",
      email: "",
      direccion: "",
      estado: "sin ficha",
      limite_credito: "0.00",
      saldo_pendiente: Number(sale.balance_due || 0).toFixed(2),
      deuda_mas_antigua_dias: daysSince(sale.created_at),
      riesgo: daysSince(sale.created_at) > 30 ? "alto" : "medio",
      recomendacion: "Crear ficha de cliente"
    });
  });
  downloadCsv(`clientes-${csvDateStamp()}.csv`, rows);
}

function exportReceivablesCsv() {
  const riskByCustomer = new Map(buildCustomerRiskList().map((item) => [item.name, item]));
  const rows = receivables.map((sale) => {
    const customerName = sale.customer_name || "Cliente sin registrar";
    const age = daysSince(sale.created_at);
    const risk = riskByCustomer.get(customerName);
    return {
      codigo_venta: sale.code,
      fecha: formatDateTime(sale.created_at),
      cliente: customerName,
      total_venta: Number(sale.total || 0).toFixed(2),
      pagado: Number(sale.amount_paid || 0).toFixed(2),
      saldo_pendiente: Number(sale.balance_due || 0).toFixed(2),
      antiguedad_dias: age,
      riesgo_cliente: risk?.level || (age > 30 ? "alto" : age > 15 ? "medio" : "bajo"),
      recomendacion: risk?.recommendation || (age > 30 ? "Cobrar antes de vender mas" : "Hacer seguimiento")
    };
  });
  downloadCsv(`cartera-cobranza-${csvDateStamp()}.csv`, rows);
}

function exportProfitCsv() {
  const rows = (profitReport.rows || []).map((row) => {
    const margin = Number(row.netSales || 0) ? (Number(row.profit || 0) / Number(row.netSales || 0)) * 100 : 0;
    return {
      producto: row.productName || "",
      cantidad: Number(row.quantity || 0).toFixed(2),
      venta_bruta: Number(row.grossSales || 0).toFixed(2),
      descuentos: Number(row.discounts || 0).toFixed(2),
      venta_neta: Number(row.netSales || 0).toFixed(2),
      costo_historico: Number(row.costTotal || 0).toFixed(2),
      utilidad: Number(row.profit || 0).toFixed(2),
      margen_porcentaje: margin.toFixed(2)
    };
  });
  downloadCsv(`utilidad-productos-${csvDateStamp()}.csv`, rows);
}

function exportCashClosuresCsv() {
  const rows = cashClosures.map((closure) => ({
    codigo: closure.code,
    fecha: formatDateTime(closure.createdAt),
    caja: closure.registerNumber,
    apertura: Number(closure.openingAmount || 0).toFixed(2),
    ventas: Number(closure.totalSales || 0).toFixed(2),
    movimientos: Number(closure.movementTotal || 0).toFixed(2),
    esperado: Number(closure.expectedAmount || 0).toFixed(2),
    contado: Number(closure.countedAmount || 0).toFixed(2),
    diferencia: Number(closure.differenceAmount || 0).toFixed(2),
    ventas_cerradas: Number(closure.saleCount || 0),
    observacion: closure.note || ""
  }));
  downloadCsv(`cierres-caja-${csvDateStamp()}.csv`, rows);
}

function exportAuditCsv() {
  const rows = auditEvents.map((event) => ({
    fecha: formatDateTime(event.created_at),
    usuario: event.actor_name || "Sistema",
    accion: auditActionLabel(event.action),
    entidad: event.entity_type || "",
    referencia: event.entity_id || "",
    descripcion: event.description || "",
    ip: event.ip_address || ""
  }));
  downloadCsv(`auditoria-comercial-${csvDateStamp()}.csv`, rows);
}

function profitReportQuery() {
  const params = new URLSearchParams();
  if (reportFilter.from) params.set("from", reportFilter.from);
  if (reportFilter.to) params.set("to", reportFilter.to);
  const query = params.toString();
  return query ? `?${query}` : "";
}

function exportReorderCsv() {
  const rows = products
    .filter((product) => isProductActive(product) && Number(product.stock || 0) <= Number(product.min_stock || 0))
    .map((product) => {
      const suggested = suggestedReorderQuantity(product);
      return {
        codigo: product.code,
        producto: product.name,
        categoria: product.category || "",
        lote: product.batch_number || "",
        vencimiento: product.expires_at || "",
        alerta_vencimiento: expiryStatus(product).label || "",
        stock_actual: Number(product.stock || 0).toFixed(2),
        stock_minimo: Number(product.min_stock || 0).toFixed(2),
        cantidad_sugerida: suggested.toFixed(2),
        costo_unitario: Number(product.cost_price || 0).toFixed(2),
        costo_estimado: (suggested * Number(product.cost_price || 0)).toFixed(2)
      };
    });
  downloadCsv(`reposicion-${csvDateStamp()}.csv`, rows);
}

function exportBackupJson() {
  const backup = {
    generatedAt: new Date().toISOString(),
    company: storeSettings.companyName || currentUser.companyName || "",
    storeSettings,
    products,
    customers,
    sales,
    receivables,
    purchases,
    suppliers,
    cashClosures
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `respaldo-zow-ventas-${csvDateStamp()}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
function exportInventoryCsv() {
  const rows = products.map((product) => {
    const cost = Number(product.cost_price || product.costPrice || 0);
    const price = Number(product.sale_price || product.salePrice || 0);
    const stock = Number(product.stock || 0);
    const insight = productInventoryInsight(product);
    const priority = reorderPriority(product);
    return {
      codigo: product.code,
      codigo_barras: product.barcode || "",
      producto: product.name,
      categoria: product.category || "",
      unidad: product.unit || "",
      lote: product.batch_number || "",
      vencimiento: product.expires_at || "",
      alerta_vencimiento: expiryStatus(product).label || "",
      stock: stock.toFixed(2),
      minimo: Number(product.min_stock || product.minStock || 0).toFixed(2),
      costo: cost.toFixed(2),
      precio: price.toFixed(2),
      margen_unitario: (price - cost).toFixed(2),
      margen_porcentaje: insight.marginPercent,
      clasificacion_valor: insight.className,
      prioridad_reposicion: priority.level,
      valor_stock: (stock * cost).toFixed(2),
      activo: isProductActive(product) ? "si" : "no"
    };
  });
  downloadCsv(`inventario-${csvDateStamp()}.csv`, rows);
}
function downloadCsv(filename, rows) {
  if (!rows.length) {
    window.alert("No hay datos para exportar.");
    return;
  }
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))
  ].join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
function csvDateStamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
function slug(value) {
  return String(value || "archivo")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "archivo";
}
function isSaleInsideReportFilter(sale) {
  const saleDate = String(sale.created_at || "").slice(0, 10);
  if (reportFilter.from && saleDate < reportFilter.from) return false;
  if (reportFilter.to && saleDate > reportFilter.to) return false;
  return true;
}
function suggestedReorderQuantity(product) {
  const stock = Number(product.stock || 0);
  const min = Number(product.min_stock || 0);
  if (stock > min) return 0;
  return Math.max(min * 2 - stock, min || 1);
}
function loadJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function persistJson(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function normalizeUser(user) {
  return {
    id: user.id,
    name: user.name || "",
    username: user.username || "",
    role: user.role || "",
    unitId: user.unitId || user.unit_id || "",
    unitName: user.unitName || user.unit_name || "",
    position: user.position || "",
    ci: user.ci || "",
    phone: user.phone || "",
    cashRegisterNumber: Number(user.cashRegisterNumber ?? user.cash_register_number ?? 0),
    active: user.active ?? user.is_active ?? true,
    protected: user.protected ?? user.is_protected ?? false
  };
}
function normalizeUnit(unit) {
  return {
    id: unit.id,
    name: unit.name || "",
    code: unit.code || "",
    level: unit.level || "",
    active: unit.active ?? unit.is_active ?? true
  };
}
function normalizeCashSession(session) {
  if (!session) return null;
  return {
    id: session.id,
    openingAmount: Number(session.opening_amount ?? session.openingAmount ?? 0),
    registerNumber: Number(session.register_number ?? session.registerNumber ?? 1),
    openedBy: session.opened_by_name || session.openedBy || currentUser?.name || "",
    openedAt: session.opened_at || session.openedAt || "",
    status: session.status || ""
  };
}
function normalizeCashMovement(movement) {
  return {
    id: movement.id,
    type: movement.type,
    amount: Number(movement.amount || 0),
    reason: movement.reason || "",
    createdAt: movement.created_at || movement.createdAt || "",
    user: movement.created_by_name || movement.user || ""
  };
}
function normalizeCashClosure(closure) {
  return {
    id: closure.id,
    code: closure.code || "",
    registerNumber: Number(closure.register_number ?? closure.registerNumber ?? 1),
    openingAmount: Number(closure.opening_amount ?? closure.openingAmount ?? 0),
    totalSales: Number(closure.total_sales ?? closure.totalSales ?? 0),
    movementTotal: Number(closure.movement_total ?? closure.movementTotal ?? 0),
    expectedAmount: Number(closure.expected_amount ?? closure.expectedAmount ?? 0),
    countedAmount: Number(closure.counted_amount ?? closure.countedAmount ?? 0),
    differenceAmount: Number(closure.difference_amount ?? closure.differenceAmount ?? 0),
    saleCount: Number(closure.sale_count ?? closure.saleCount ?? 0),
    createdAt: closure.created_at || closure.createdAt || "",
    note: closure.note || ""
  };
}
function normalizeSuspendedSale(sale) {
  if (sale.payload && typeof sale.payload === "object") {
    return {
      id: sale.id,
      items: sale.payload.items || [],
      customerId: sale.payload.customerId || "",
      globalDiscount: Number(sale.payload.globalDiscount || 0),
      note: sale.payload.note || "",
      createdAt: sale.created_at || sale.createdAt || ""
    };
  }
  return {
    ...sale,
    localOnly: !sale.id,
    createdAt: sale.createdAt || sale.created_at || ""
  };
}
function normalizePromotion(promotion) {
  return {
    id: promotion.id,
    name: promotion.name || "Promocion",
    scopeType: promotion.scopeType || promotion.scope_type || (promotion.category || promotion.category_name ? "category" : "product"),
    productId: promotion.productId || promotion.product_id || "",
    productName: promotion.productName || promotion.product_name || "",
    category: promotion.category || promotion.category_name || "",
    type: promotion.type || "percent",
    value: Number(promotion.value || 0),
    minQuantity: Number(promotion.minQuantity || promotion.min_quantity || 1),
    startsAt: String(promotion.startsAt || promotion.starts_at || "").slice(0, 10),
    endsAt: String(promotion.endsAt || promotion.ends_at || "").slice(0, 10),
    active: promotion.active !== false && promotion.is_active !== false && promotion.is_active !== 0
  };
}

function normalizeCombo(combo) {
  return {
    id: combo.id,
    code: combo.code || "",
    name: combo.name || "Combo",
    price: Number(combo.price || 0),
    active: combo.active !== false && combo.is_active !== false && combo.is_active !== 0,
    items: (combo.items || []).map((item) => ({
      productId: item.productId || item.product_id || "",
      productName: item.productName || item.product_name || "",
      quantity: Number(item.quantity || 0),
      salePrice: Number(item.salePrice || item.sale_price || 0),
      stock: Number(item.stock || 0)
    })).filter((item) => item.productId && item.quantity > 0)
  };
}

function comboAvailableStock(combo) {
  if (!combo?.items?.length) return 0;
  return Math.min(...combo.items.map((item) => {
    const product = products.find((entry) => entry.id === item.productId);
    const stock = Number(product?.stock ?? item.stock ?? 0);
    return Math.floor(stock / Math.max(Number(item.quantity || 1), 1));
  }));
}
function canAccessView(view) { return accessibleViewsForRole(currentUser?.role).includes(view); }
function defaultViewForRole() { return accessibleViewsForRole(currentUser?.role)[0] || "summary"; }
function canSeeProfit() { return ["admin", "ventas_admin", "supervisor"].includes(currentUser?.role); }
function can(permission) {
  const role = currentUser?.role || "";
  const permissions = {
    manageSettings: ["admin", "ventas_admin"],
    manageUsers: ["admin"],
    manageCatalog: ["admin", "ventas_admin", "almacen"],
    manageInventory: ["admin", "ventas_admin", "almacen"],
    adjustStock: ["admin", "ventas_admin", "almacen"],
    manageFavorites: ["admin", "ventas_admin", "almacen"],
    managePromotions: ["admin", "ventas_admin", "supervisor"],
    managePurchases: ["admin", "ventas_admin", "almacen"],
    closeCash: ["admin", "ventas_admin", "cajero"],
    cashMovements: ["admin", "ventas_admin"],
    voidSales: ["admin", "ventas_admin", "supervisor"],
    returnSales: ["admin", "ventas_admin", "supervisor"],
    manageCustomers: ["admin", "ventas_admin", "cajero", "vendedor"],
    seeProfit: ["admin", "ventas_admin", "supervisor"]
  };
  return (permissions[permission] || []).includes(role);
}
function accessibleViewsForRole(role) {
  const views = {
    admin: ["sell", "summary", "alerts", "finance", "history", "routes", "promotions", "reports", "catalog", "customers", "inventory", "purchases", "users", "settings"],
    ventas_admin: ["sell", "summary", "alerts", "finance", "history", "routes", "promotions", "reports", "catalog", "customers", "inventory", "purchases", "settings"],
    cajero: ["sell", "finance", "history"],
    vendedor: ["sell", "customers", "history"],
    almacen: ["inventory", "purchases", "alerts", "catalog", "summary"],
    supervisor: ["sell", "summary", "alerts", "finance", "history", "routes", "promotions", "reports", "catalog", "customers", "inventory", "purchases"],
    funcionario: ["sell", "customers", "summary"]
  };
  return views[role] || ["summary"];
}
function canSeeAllSales() { return ["admin", "ventas_admin", "supervisor"].includes(currentUser?.role); }
function isProductActive(product) {
  return product?.active ?? product?.is_active ?? true;
}
function closeVentasMenu() {
  appShell.classList.remove("ventas-menu-open");
  ventasMenuToggle?.setAttribute("aria-expanded", "false");
}
function escapeHtml(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
