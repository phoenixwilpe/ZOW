const API_BASE_URL = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
  ? "http://localhost:4174/api"
  : "/api";
const TOKEN_KEY = "zowVentasAlmacen.token";
const SESSION_KEY = "zowVentasAlmacen.session";
const SUSPENDED_SALES_KEY = "zowVentasAlmacen.suspendedSales";
const LOCAL_SALE_META_KEY = "zowVentasAlmacen.saleMeta";
const FAVORITE_PRODUCTS_KEY = "zowVentasAlmacen.favoriteProducts";

/**
 * @typedef {{ id:string, code:string, name:string, category:string, stock:number, sale_price:number, cost_price:number }} Product
 * @typedef {{ productId:string, name:string, quantity:number, salePrice:number, discount:number }} CartItem
 * @typedef {{ id:string, openedAt:string, openedBy:string, openingAmount:number, status:"abierta"|"cerrada" }} CashSession
 * @typedef {{ id:string, type:"ingreso"|"egreso", amount:number, reason:string, createdAt:string, user:string }} CashMovement
 * @typedef {{ method:"efectivo"|"tarjeta"|"transferencia"|"qr"|"mixto", received:number }} PaymentDraft
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
let cash = { pendingSales: [], total: 0 };
let summary = {};
let saleCart = [];
let posMobilePanel = "products";
let lastSaleReceipt = null;
let editingUserId = "";
let editingProductId = "";
let editingCustomerId = "";
let productSearch = "";
let ventasMessage = "";
let paymentDraft = { method: "efectivo", received: 0 };
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
let historyFilter = { status: "", method: "", date: "" };
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
const ventasLoginScene = document.querySelector(".advanced-sales-scene");
let ventasLoginSceneFrame = 0;

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
    name: value("#productName"),
    category: value("#productCategory"),
    unit: value("#productUnit"),
    costPrice: Number(value("#productCost")),
    salePrice: Number(value("#productSale")),
    minStock: Number(value("#productMin"))
  };
  if (!editingProductId) productPayload.stock = Number(value("#productStock"));
  await apiRequest(editingProductId ? `/ventas/products/${editingProductId}` : "/ventas/products", {
    method: editingProductId ? "PATCH" : "POST",
    body: productPayload
  });
  editingProductId = "";
  productModal.close();
  await render();
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
    const [settingsResponse, summaryResponse, productsResponse, customersResponse, categoriesResponse, salesResponse, cashResponse, cashHistoryResponse, suppliersResponse, purchasesResponse, receivablesResponse, usersResponse, unitsResponse] = await Promise.all([
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
  renderMain();
}

function renderMain() {
  if (!canAccessView(activeView)) activeView = defaultViewForRole();
  appShell.dataset.activeView = activeView;
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
  document.querySelectorAll("[data-module-view]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!canAccessView(button.dataset.moduleView)) return;
      activeView = button.dataset.moduleView;
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
    finance: [`<strong>Caja</strong><span>Controla ventas pendientes de cierre y procesa cortes.</span>`, `<button class="primary-button" type="button" id="closeCashBtn">Procesar caja</button>`],
    history: [`<strong>Historial del turno</strong><span>Consulta, reimprime o marca operaciones anuladas.</span>`, ""],
    routes: [`<strong>Operacion en ruta</strong><span>Organiza clientes, entrega, despacho y seguimiento de vendedores.</span>`, ""],
    promotions: [`<strong>Politica comercial</strong><span>Prepara listas de precios, paquetes y promociones por temporada.</span>`, ""],
    reports: [`<strong>Auditoria comercial</strong><span>Revisa ventas, caja, inventario critico y valor de almacen.</span>`, ""],
    catalog: [`<strong>Catalogos</strong><span>Administra articulos y categorias.</span>`, `<button class="ghost-button" type="button" id="newCategoryBtn">Nueva categoria</button><button class="primary-button" type="button" id="newProductBtn">Nuevo producto</button>`],
    customers: [`<strong>Clientes</strong><span>Registra compradores frecuentes para ventas y tienda virtual.</span>`, `<button class="primary-button" type="button" id="newCustomerBtn">Nuevo cliente</button>`],
    inventory: [`<strong>Inventario</strong><span>Controla stock actual y regulariza entradas o salidas.</span>`, `<button class="primary-button" type="button" id="newProductInventoryBtn">Nuevo producto</button>`],
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
  mainList().innerHTML = `
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
      <article><span>Cobrar</span><strong>${money(receivables.reduce((sum, sale) => sum + Number(sale.balance_due || 0), 0))}</strong><small>${receivables.length} cuenta${receivables.length === 1 ? "" : "s"}</small></article>
    </section>
    ${renderVentasCommandCenter()}
    ${renderServiceStrip()}
    <section class="admin-panel">
      <div class="admin-panel-head"><div><p class="eyebrow">Ultimas ventas</p><h3>Movimiento comercial</h3></div></div>
      <div class="admin-list">${sales.slice(0, 6).map(renderSaleRow).join("") || empty("Sin ventas registradas")}</div>
    </section>
  `;
}

function renderAlerts() {
  const alerts = products.filter((product) => isProductActive(product) && Number(product.stock || 0) <= Number(product.min_stock || 0));
  const outOfStock = alerts.filter((product) => Number(product.stock || 0) <= 0);
  const reorderValue = alerts.reduce((sum, product) => sum + suggestedReorderQuantity(product) * Number(product.cost_price || 0), 0);
  setCount(`${alerts.length} alerta${alerts.length === 1 ? "" : "s"}`);
  mainList().innerHTML = `
    <section class="inventory-health-grid">
      <article><span>Productos criticos</span><strong class="${alerts.length ? "warn-text" : "ok-text"}">${num(alerts.length)}</strong></article>
      <article><span>Sin stock</span><strong class="${outOfStock.length ? "danger-text" : "ok-text"}">${num(outOfStock.length)}</strong></article>
      <article><span>Compra sugerida</span><strong>${money(reorderValue)}</strong></article>
      <article><span>Accion</span><strong>${alerts.length ? "Reponer" : "Estable"}</strong></article>
    </section>
    <section class="admin-panel">
      <div class="admin-panel-head"><div><p class="eyebrow">Reposicion</p><h3>Lista sugerida de compra</h3></div><button class="ghost-button" type="button" id="exportReorderCsv">Exportar reposicion</button></div>
      <div class="admin-list">${alerts.map(renderReorderRow).join("") || empty("No hay alertas de stock")}</div>
    </section>
    ${selectedKardex ? renderKardexPanel() : ""}
  `;
  document.querySelector("#exportReorderCsv")?.addEventListener("click", exportReorderCsv);
  document.querySelectorAll("[data-stock-history]").forEach((button) => {
    button.addEventListener("click", () => viewStockHistory(button.dataset.stockHistory));
  });
}

function renderSell() {
  setCount(`${saleCart.length} item${saleCart.length === 1 ? "" : "s"}`);
  const sellProducts = filteredProducts().filter(isProductActive);
  const favoriteSellProducts = favoriteProducts
    .map((productId) => products.find((product) => product.id === productId))
    .filter((product) => product && isProductActive(product) && Number(product.stock || 0) > 0)
    .slice(0, 8);
  const totals = cartTotals();
  const categories = productCategories();
  const isCashOpen = cashSession?.status === "abierta";
  const cashState = isCashOpen ? `Caja ${num(cashSession.registerNumber)} abierta / ${money(cashExpectedTotal())}` : "Caja sin abrir";
  const lowStockInCart = saleCart
    .map((item) => products.find((product) => product.id === item.productId))
    .filter((product) => product && Number(product.stock || 0) <= Number(product.min_stock || 0));
  mainList().innerHTML = `
    <section class="pos-shell touch-pos-shell pos-mode-${posMobilePanel}">
      <div class="pos-mobile-switch" aria-label="Vista de venta movil">
        <button class="${posMobilePanel === "products" ? "is-active" : ""}" type="button" data-pos-panel="products">Productos</button>
        <button class="${posMobilePanel === "cart" ? "is-active" : ""}" type="button" data-pos-panel="cart">Carrito <strong>${saleCart.length}</strong></button>
      </div>
      <section class="admin-panel pos-products touch-panel">
        <div class="touch-pos-head">
          <div>
            <p class="eyebrow">Venta rapida</p>
            <h3>Productos</h3>
          </div>
          <div class="touch-shortcuts"><span>${escapeHtml(cashState)}</span><span>F2 Buscar</span><span>F4 Cobrar</span></div>
        </div>
        ${ventasMessage ? `<div class="pos-toast">${escapeHtml(ventasMessage)}</div>` : ""}
        ${lastSaleReceipt ? renderLastSaleReceipt() : ""}
        <div class="pos-quick-status">
          <article><span>Turno</span><strong>${isCashOpen ? `Caja ${num(cashSession.registerNumber)}` : "Sin caja"}</strong></article>
          <article><span>Items</span><strong>${num(saleCart.length)}</strong></article>
          <article><span>Total</span><strong>${money(totals.total)}</strong></article>
        </div>
        ${!isCashOpen ? `
          <div class="pos-cash-warning">
            <div><strong>Abre una caja antes de vender</strong><span>El sistema necesita una caja activa para registrar pagos y cierres.</span></div>
            <button class="primary-button" type="button" id="goOpenCashBtn">Abrir caja</button>
          </div>
        ` : ""}
        <div class="pos-search-row">
          <label class="toolbar-search touch-search">Buscar o escanear<input id="productSearchInput" type="search" value="${escapeHtml(productSearch)}" placeholder="Codigo, barras o nombre del producto" /></label>
          <button class="primary-button touch-action" type="button" id="scanAddBtn">Agregar</button>
          ${productSearch ? `<button class="ghost-button touch-action" type="button" id="clearSearchBtn">Limpiar</button>` : ""}
        </div>
        <div class="pos-section-block">
          <div class="pos-section-title"><strong>Categorias</strong><span>Filtra rapido por familia</span></div>
          <div class="pos-category-rail">
            <button class="${productSearch ? "" : "is-active"}" type="button" data-product-filter="">Todos</button>
            ${categories.slice(0, 10).map((category) => `<button class="${productSearch === category ? "is-active" : ""}" type="button" data-product-filter="${escapeHtml(category)}">${escapeHtml(category)}</button>`).join("")}
          </div>
        </div>
        ${favoriteSellProducts.length ? `
          <div class="pos-section-block pos-products-block">
            <div class="pos-section-title"><strong>Favoritos de mostrador</strong><span>Productos rapidos para pantalla tactil</span></div>
            <div class="product-suggestion-grid touch-product-grid">${favoriteSellProducts.map(renderSellProduct).join("")}</div>
          </div>
        ` : ""}
        <div class="pos-section-block pos-products-block">
          <div class="pos-section-title"><strong>Productos disponibles</strong><span>Toca para agregar al carrito</span></div>
          <div class="product-suggestion-grid touch-product-grid">${sellProducts.slice(0, 24).map(renderSellProduct).join("") || empty("Sin productos con esa busqueda")}</div>
        </div>
      </section>
      <section class="admin-panel pos-cart touch-cart-panel">
        <div class="touch-cart-head">
          <div><p class="eyebrow">Carrito actual</p><h3>${saleCart.length} producto${saleCart.length === 1 ? "" : "s"}</h3></div>
          <strong>${money(totals.total)}</strong>
        </div>
        <form class="admin-form" id="saleForm">
          <div class="pos-customer-row">
            <label class="touch-customer-select">Cliente<select id="saleCustomer"><option value="">Cliente sin registrar</option>${customers.map((c) => `<option value="${c.id}" ${c.id === saleCustomerId ? "selected" : ""}>${escapeHtml(c.name)}</option>`).join("")}</select></label>
            <button class="ghost-button" type="button" id="quickCustomerBtn">Nuevo cliente</button>
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
              <div class="is-total"><span>Total</span><strong>${money(totals.total)}</strong></div>
            </div>
          </div>
          <div class="pos-section-block pos-actions-block">
            <div class="pos-section-title"><strong>Acciones de venta</strong><span>Gestiona la operacion sin salir de caja</span></div>
            <div class="quick-action-row touch-sale-actions">
              <button class="ghost-button" type="button" id="newSaleBtn">Nueva</button>
              <button class="ghost-button" type="button" id="quickCashBtn" ${saleCart.length && isCashOpen ? "" : "disabled"}>Efectivo exacto</button>
              <button class="ghost-button" type="button" id="suspendSaleBtn">Suspender</button>
              <button class="ghost-button" type="button" id="recoverSaleBtn">Recuperar (${suspendedSales.length})</button>
              <button class="ghost-button danger-action" type="button" id="cancelSaleBtn">Cancelar</button>
            </div>
          </div>
          <button class="primary-button touch-charge-button" type="button" id="chargeSaleBtn" ${saleCart.length && isCashOpen ? "" : "disabled"}>${isCashOpen ? `Cobrar ${money(totals.total)}` : "Abre caja para cobrar"}</button>
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
  document.querySelectorAll("[data-product-filter]").forEach((button) => button.addEventListener("click", () => {
    productSearch = button.dataset.productFilter || "";
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
  document.querySelectorAll("[data-pos-panel]").forEach((button) => button.addEventListener("click", () => {
    posMobilePanel = button.dataset.posPanel || "products";
    renderMain();
  }));
  document.querySelectorAll("[data-add-product]").forEach((button) => button.addEventListener("click", () => addToCart(button.dataset.addProduct)));
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

function renderFinance() {
  setCount(`${sales.length} venta${sales.length === 1 ? "" : "s"}`);
  const cashLabel = canSeeAllSales() ? "Pendiente caja" : "Mi caja pendiente";
  const totalLabel = canSeeAllSales() ? "Monto pendiente" : "Mi monto pendiente";
  const expectedCash = cashExpectedTotal();
  const movementsTotal = cashMovementsTotal();
  const lastClosure = cashClosures[0];
  const totalClosureDifference = cashClosures.reduce((sum, closure) => sum + Number(closure.differenceAmount || 0), 0);
  const paymentBreakdown = cashPaymentBreakdown();
  mainList().innerHTML = `
    <section class="setup-overview">
      <article><span>${cashLabel}</span><strong>${cash.pendingSales?.length || 0}</strong></article>
      <article><span>${totalLabel}</span><strong>${money(cash.total || 0)}</strong></article>
      <article><span>Efectivo esperado</span><strong>${money(expectedCash)}</strong></article>
      <article><span>Cajas configuradas</span><strong>${num(storeSettings.cashRegisterCount || 1)}</strong></article>
      <article><span>Ultimo cierre</span><strong>${lastClosure ? escapeHtml(lastClosure.code) : "Sin cierres"}</strong></article>
      <article><span>Diferencia acumulada</span><strong class="${Math.abs(totalClosureDifference) > 0 ? "warn-text" : "ok-text"}">${money(totalClosureDifference)}</strong></article>
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
        <form class="admin-form" id="cashMovementForm">
          <div class="form-grid">
            <label>Tipo<select id="cashMovementType"><option value="ingreso">Ingreso manual</option><option value="egreso">Egreso manual</option></select></label>
            <label>Monto<input id="cashMovementAmount" type="number" min="0.01" step="0.01" required /></label>
            <label class="span-2">Motivo<input id="cashMovementReason" type="text" required placeholder="Cambio, compra menor, retiro, etc." /></label>
          </div>
          <button class="ghost-button" type="submit" ${cashSession?.status === "abierta" ? "" : "disabled"}>Registrar movimiento</button>
        </form>
      </section>
      <section class="admin-panel">
        <div class="admin-panel-head"><div><p class="eyebrow">Cierre</p><h3>Cuadre de caja</h3></div></div>
        <form class="admin-form" id="cashCloseForm">
          <div class="form-grid">
            <label>Efectivo esperado<input type="text" value="${money(expectedCash)}" readonly /></label>
            <label>Efectivo contado<input id="cashCountedAmount" type="number" min="0" step="0.01" value="${expectedCash.toFixed(2)}" /></label>
            <label class="span-2">Observacion si hay diferencia<input id="cashClosureNote" type="text" placeholder="Ej: faltante por vuelto, sobrante, revision pendiente" /></label>
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
      <div class="admin-panel-head"><div><p class="eyebrow">Historial movimientos</p><h3>Turno actual</h3></div></div>
      <div class="admin-list">${cashMovements.slice(0, 8).map(renderCashMovementRow).join("") || empty("Sin movimientos manuales")}</div>
    </section>
    <section class="admin-panel">
      <div class="admin-panel-head">
        <div><p class="eyebrow">Arqueos</p><h3>Historial de cierres de caja</h3></div>
        <span>${cashClosures.length} cierre${cashClosures.length === 1 ? "" : "s"}</span>
      </div>
      <div class="admin-list">${cashClosures.slice(0, 10).map(renderCashClosureRow).join("") || empty("Sin cierres registrados")}</div>
    </section>
  `;
  document.querySelector("#cashOpenForm")?.addEventListener("submit", openCashSession);
  document.querySelector("#cashMovementForm")?.addEventListener("submit", addCashMovement);
  document.querySelector("#cashCloseForm")?.addEventListener("submit", closeCashSession);
  document.querySelectorAll("[data-print-closure]").forEach((button) => {
    button.addEventListener("click", () => printCashClosure(button.dataset.printClosure));
  });
}

function renderHistory() {
  const visibleSales = sales.filter((sale) => {
    const meta = localSaleMeta[sale.id] || {};
    const status = saleStatus(sale);
    if (historyFilter.status && status !== historyFilter.status) return false;
    if (historyFilter.method && (sale.payment_method || meta.method) !== historyFilter.method) return false;
    if (historyFilter.date && !String(sale.created_at || "").startsWith(historyFilter.date)) return false;
    return true;
  });
  setCount(`${visibleSales.length} venta${visibleSales.length === 1 ? "" : "s"}`);
  mainList().innerHTML = `
    <section class="admin-panel">
      <div class="admin-panel-head"><div><p class="eyebrow">Historial</p><h3>Ventas del turno</h3></div></div>
      <div class="history-filters">
        <label>Fecha<input id="historyDate" type="date" value="${escapeHtml(historyFilter.date)}" /></label>
        <label>Metodo<select id="historyMethod"><option value="">Todos</option>${paymentMethods().map((method) => `<option value="${method.id}" ${historyFilter.method === method.id ? "selected" : ""}>${method.label}</option>`).join("")}</select></label>
        <label>Estado<select id="historyStatus"><option value="">Todos</option><option value="pagada" ${historyFilter.status === "pagada" ? "selected" : ""}>Pagada</option><option value="pendiente" ${historyFilter.status === "pendiente" ? "selected" : ""}>Pendiente</option><option value="anulada" ${historyFilter.status === "anulada" ? "selected" : ""}>Anulada</option></select></label>
      </div>
      <div class="admin-list">${visibleSales.map(renderHistorySaleRow).join("") || empty("Sin ventas con esos filtros")}</div>
    </section>
  `;
  document.querySelector("#historyDate")?.addEventListener("change", (event) => { historyFilter.date = event.target.value; renderMain(); });
  document.querySelector("#historyMethod")?.addEventListener("change", (event) => { historyFilter.method = event.target.value; renderMain(); });
  document.querySelector("#historyStatus")?.addEventListener("change", (event) => { historyFilter.status = event.target.value; renderMain(); });
  document.querySelectorAll("[data-detail-sale]").forEach((button) => button.addEventListener("click", () => showSaleDetail(button.dataset.detailSale)));
  document.querySelectorAll("[data-reprint-sale]").forEach((button) => button.addEventListener("click", () => reprintSale(button.dataset.reprintSale)));
  document.querySelectorAll("[data-void-sale]").forEach((button) => button.addEventListener("click", () => voidSale(button.dataset.voidSale)));
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
  const featured = products.slice().sort((a, b) => Number(b.stock || 0) - Number(a.stock || 0)).slice(0, 6);
  const critical = products.filter((product) => Number(product.stock || 0) <= Number(product.min_stock || 0)).slice(0, 4);
  setCount(`${featured.length} articulo${featured.length === 1 ? "" : "s"}`);
  mainList().innerHTML = `
    <section class="promotion-grid">
      <article class="promotion-card is-green"><span>Lista base</span><strong>${products.length} productos activos</strong><p>Precios actuales listos para caja, vendedores y ruta.</p></article>
      <article class="promotion-card is-amber"><span>Paquetes</span><strong>${featured.length} sugeridos</strong><p>Combina productos con mayor disponibilidad para impulsar salida.</p></article>
      <article class="promotion-card is-red"><span>Reposicion</span><strong>${critical.length} criticos</strong><p>Evita promocionar articulos por debajo del minimo.</p></article>
    </section>
    <section class="admin-panel">
      <div class="admin-panel-head"><div><p class="eyebrow">Lista de precios</p><h3>Productos para venta</h3></div></div>
      <div class="price-list">${featured.map(renderPriceRow).join("") || empty("Registra productos para crear listas de precios")}</div>
    </section>
  `;
}

function renderReports() {
  const filteredSales = sales.filter(isSaleInsideReportFilter);
  const confirmedSales = filteredSales.filter((sale) => sale.status !== "anulada");
  const totalIncome = confirmedSales.reduce((sum, sale) => sum + Number(sale.amount_paid || sale.cash_received || sale.total || 0), 0);
  const totalSold = confirmedSales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
  const pendingTotal = receivables.reduce((sum, sale) => sum + Number(sale.balance_due || 0), 0);
  const averageSale = confirmedSales.length ? totalSold / confirmedSales.length : 0;
  const voidedSales = filteredSales.filter((sale) => sale.status === "anulada").length;
  const paymentBreakdown = buildSalesPaymentBreakdown(confirmedSales);
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
    <section class="admin-panel">
      <div class="admin-panel-head"><div><p class="eyebrow">Cobros</p><h3>Ventas por metodo de pago</h3></div></div>
      <div class="payment-breakdown-grid">${paymentBreakdown.map((item) => `<article><span>${escapeHtml(item.label)}</span><strong>${money(item.total)}</strong><small>${num(item.count)} venta${item.count === 1 ? "" : "s"}</small></article>`).join("")}</div>
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
        <div><strong>Respaldo operativo</strong><span>Descarga un archivo JSON con ventas, productos, clientes, compras y configuracion visible.</span></div>
        <button class="ghost-button" type="button" id="exportBackupJson">Exportar respaldo JSON</button>
      </article>
    </section>
    <section class="admin-panel">
      <div class="admin-panel-head"><div><p class="eyebrow">Control</p><h3>Productos que requieren accion</h3></div></div>
      <div class="admin-list">${products.filter((product) => isProductActive(product) && Number(product.stock || 0) <= Number(product.min_stock || 0)).map(renderProductRow).join("") || empty("Sin riesgos de inventario")}</div>
    </section>
  `;
  document.querySelector("#reportDateFrom")?.addEventListener("change", (event) => { reportFilter.from = event.target.value; renderMain(); });
  document.querySelector("#reportDateTo")?.addEventListener("change", (event) => { reportFilter.to = event.target.value; renderMain(); });
  document.querySelector("#clearReportFilter")?.addEventListener("click", () => { reportFilter = { from: "", to: "" }; renderMain(); });
  document.querySelector("#exportSalesCsv")?.addEventListener("click", exportSalesCsv);
  document.querySelector("#exportInventoryCsv")?.addEventListener("click", exportInventoryCsv);
  document.querySelector("#exportCustomersCsv")?.addEventListener("click", exportCustomersCsv);
  document.querySelector("#exportBackupJson")?.addEventListener("click", exportBackupJson);
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
  setCount(`${customers.length} cliente${customers.length === 1 ? "" : "s"}`);
  mainList().innerHTML = `
    <section class="setup-overview">
      <article><span>Clientes</span><strong>${customers.length}</strong></article>
      <article><span>Cuentas por cobrar</span><strong>${receivables.length}</strong></article>
      <article><span>Saldo pendiente</span><strong>${money(totalDebt)}</strong></article>
      <article><span>Mas antigua</span><strong>${oldestDebt ? formatDateTime(oldestDebt.created_at) : "Sin deuda"}</strong></article>
    </section>
    <section class="admin-panel">
      <div class="admin-panel-head"><div><p class="eyebrow">Cuentas por cobrar</p><h3>Ventas al credito</h3></div></div>
      <div class="admin-list">${receivables.map(renderReceivableRow).join("") || empty("Sin saldos pendientes")}</div>
    </section>
    <section class="admin-panel">
      <div class="admin-panel-head"><div><p class="eyebrow">Directorio</p><h3>Clientes registrados</h3></div></div>
      <div class="admin-list">${customers.map((customer) => `
        <article class="admin-row">
          <div>
            <strong>${escapeHtml(customer.name)}</strong>
            <span>CI/NIT ${escapeHtml(customer.ci || "Sin dato")} / Cel. ${escapeHtml(customer.phone || "Sin celular")}</span>
            <span>${escapeHtml(customer.address || "Sin direccion")}</span>
          </div>
          <div class="admin-row-meta">
            <span>${escapeHtml(customer.email || "Sin email")}</span>
            <span class="${customer.status === "bloqueado" ? "danger-text" : customer.status === "observado" ? "warn-text" : "ok-text"}">${escapeHtml(customer.status || "activo")}</span>
            <span>Credito ${money(customer.credit_limit || 0)}</span>
            <button class="ghost-button" type="button" data-edit-customer="${customer.id}">Editar</button>
          </div>
        </article>
      `).join("") || empty("Sin clientes registrados")}</div>
    </section>
  `;
  document.querySelectorAll("[data-pay-receivable]").forEach((button) => {
    button.addEventListener("click", () => payReceivable(button.dataset.payReceivable));
  });
  document.querySelectorAll("[data-edit-customer]").forEach((button) => {
    button.addEventListener("click", () => openCustomerModal(button.dataset.editCustomer));
  });
}

function renderReceivableRow(sale) {
  const paidPercent = Math.min(100, Math.round((Number(sale.amount_paid || 0) / Math.max(Number(sale.total || 1), 1)) * 100));
  return `<article class="admin-row receivable-row">
    <div>
      <strong>${escapeHtml(sale.code)}</strong>
      <span>${escapeHtml(sale.customer_name || "Cliente sin registrar")} / ${formatDateTime(sale.created_at)}</span>
      <span>Pagado ${money(sale.amount_paid)} de ${money(sale.total)}</span>
      <div class="receivable-progress"><i style="width:${paidPercent}%"></i></div>
    </div>
    <div class="admin-row-meta"><span class="warn-text">Debe ${money(sale.balance_due)}</span><button class="primary-button" type="button" data-pay-receivable="${sale.id}">Registrar pago</button></div>
  </article>`;
}

function renderPurchases() {
  const activeProducts = products.filter(isProductActive);
  setCount(`${purchases.length} compra${purchases.length === 1 ? "" : "s"}`);
  mainList().innerHTML = `
    ${ventasMessage ? `<div class="cloud-safe-note"><strong>${escapeHtml(ventasMessage)}</strong><span>La compra afecta solo el inventario de esta empresa.</span></div>` : ""}
    <section class="cashier-grid">
      <section class="admin-panel">
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
      <section class="admin-panel">
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
            <button class="ghost-button" type="button" id="addPurchaseLine" ${activeProducts.length ? "" : "disabled"}>Agregar linea</button>
            <button class="primary-button" type="submit" ${activeProducts.length ? "" : "disabled"}>Registrar compra y sumar stock</button>
          </div>
        </form>
      </section>
    </section>
    <section class="admin-panel">
      <div class="admin-panel-head"><div><p class="eyebrow">Detalle</p><h3>Productos de la compra</h3></div><span>${money(purchaseCart.reduce((sum, item) => sum + item.quantity * item.unitCost, 0))}</span></div>
      <div class="admin-list">${purchaseCart.map(renderPurchaseCartRow).join("") || empty("Agrega productos a la compra")}</div>
    </section>
    <section class="admin-panel">
      <div class="admin-panel-head"><div><p class="eyebrow">Historial</p><h3>Compras recientes</h3></div><span>${money(purchases.reduce((sum, purchase) => sum + Number(purchase.total || 0), 0))}</span></div>
      <div class="admin-list">${purchases.slice(0, 12).map(renderPurchaseRow).join("") || empty("Sin compras registradas")}</div>
    </section>
    <section class="admin-panel">
      <div class="admin-panel-head"><div><p class="eyebrow">Proveedores</p><h3>Directorio</h3></div></div>
      <div class="admin-list">${suppliers.map(renderSupplierRow).join("") || empty("Sin proveedores registrados")}</div>
    </section>
  `;
  document.querySelector("#supplierForm")?.addEventListener("submit", saveSupplier);
  document.querySelector("#purchaseForm")?.addEventListener("submit", savePurchase);
  document.querySelector("#addPurchaseLine")?.addEventListener("click", addPurchaseLine);
  document.querySelectorAll("[data-remove-purchase-line]").forEach((button) => button.addEventListener("click", () => {
    purchaseCart = purchaseCart.filter((item) => item.id !== button.dataset.removePurchaseLine);
    renderMain();
  }));
  document.querySelector("#purchaseProduct")?.addEventListener("change", updatePurchaseCostFromProduct);
  updatePurchaseCostFromProduct();
}

function renderPurchaseCartRow(item) {
  return `<article class="admin-row">
    <div><strong>${escapeHtml(item.name)}</strong><span>${num(item.quantity)} x ${money(item.unitCost)}</span></div>
    <div class="admin-row-meta"><span>Total ${money(item.quantity * item.unitCost)}</span><button class="ghost-button danger-action" type="button" data-remove-purchase-line="${item.id}">Quitar</button></div>
  </article>`;
}

function renderPurchaseRow(purchase) {
  return `<article class="admin-row"><div><strong>${escapeHtml(purchase.code)}</strong><span>${escapeHtml(purchase.supplier_name || "Proveedor sin registrar")} / ${escapeHtml(purchase.invoice_number || "Sin factura")}</span><span>${formatDateTime(purchase.created_at)} / ${escapeHtml(purchase.created_by_name || "Usuario")}</span></div><div class="admin-row-meta"><span>Total ${money(purchase.total)}</span><span class="ok-text">${escapeHtml(purchase.status || "confirmada")}</span></div></article>`;
}

function renderSupplierRow(supplier) {
  return `<article class="admin-row"><div><strong>${escapeHtml(supplier.name)}</strong><span>NIT/CI ${escapeHtml(supplier.tax_id || "Sin dato")} / Cel. ${escapeHtml(supplier.phone || "Sin celular")}</span><span>${escapeHtml(supplier.address || "Sin direccion")}</span></div></article>`;
}

function renderInventory() {
  const inventoryProducts = filteredProducts({ includeInactive: true });
  const activeCount = products.filter(isProductActive).length;
  const outOfStock = products.filter((product) => isProductActive(product) && Number(product.stock || 0) <= 0).length;
  const lowStock = products.filter((product) => isProductActive(product) && Number(product.stock || 0) > 0 && Number(product.stock || 0) <= Number(product.min_stock || 0)).length;
  setCount(`${products.length} producto${products.length === 1 ? "" : "s"}`);
  mainList().innerHTML = `
    <section class="inventory-health-grid">
      <article><span>Activos</span><strong>${num(activeCount)}</strong></article>
      <article><span>Sin stock</span><strong class="${outOfStock ? "danger-text" : "ok-text"}">${num(outOfStock)}</strong></article>
      <article><span>Bajo minimo</span><strong class="${lowStock ? "warn-text" : "ok-text"}">${num(lowStock)}</strong></article>
      <article><span>Favoritos POS</span><strong>${num(favoriteProducts.length)}</strong></article>
    </section>
    <section class="admin-panel">
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
    <section class="admin-panel">
      <div class="admin-panel-head"><div><p class="eyebrow">Empresa</p><h3>Datos para ventas e impresion</h3></div></div>
      <form class="admin-form" id="storeSettingsForm">
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
    <section class="admin-panel">
      <div class="admin-panel-head"><div><p class="eyebrow">Modelos de operacion</p><h3>Adaptable a empresa chica o grande</h3></div></div>
      <div class="operation-model-grid">
        <article><span>Tienda 1 persona</span><strong>Encargado de sistema</strong><small>Puede configurar, vender, cerrar caja, registrar productos y ajustar stock.</small></article>
        <article><span>Tienda 2 personas</span><strong>Operador integral + encargado</strong><small>El operador integral atiende venta, caja e inventario diario sin tocar el panel ZOW.</small></article>
        <article><span>Empresa grande</span><strong>Cajas separadas</strong><small>Cajeros, almacen, vendedor y supervisor trabajan con permisos separados en el mismo punto de atencion.</small></article>
      </div>
    </section>
  `;
  document.querySelector("#storeSettingsForm")?.addEventListener("submit", saveStoreSettings);
}

function renderProductRow(product) {
  return `<article class="admin-row"><div><strong>${escapeHtml(product.name)}</strong><span>${escapeHtml(product.code)} / ${escapeHtml(product.category || "Sin categoria")} / ${escapeHtml(product.unit)}</span><span>Stock ${num(product.stock)} / Minimo ${num(product.min_stock)}</span></div><div class="admin-row-meta"><span>Costo ${money(product.cost_price)}</span><span>Venta ${money(product.sale_price)}</span><span class="${Number(product.stock || 0) <= Number(product.min_stock || 0) ? "danger-text" : "ok-text"}">${Number(product.stock || 0) <= Number(product.min_stock || 0) ? "Bajo minimo" : "Stock OK"}</span></div></article>`;
}

function renderReorderRow(product) {
  const suggested = suggestedReorderQuantity(product);
  return `<article class="admin-row">
    <div>
      <strong>${escapeHtml(product.name)}</strong>
      <span>${escapeHtml(product.code)} / ${escapeHtml(product.category || "Sin categoria")}</span>
      <span>Stock actual ${num(product.stock)} / Minimo ${num(product.min_stock)}</span>
    </div>
    <div class="admin-row-meta">
      <span>Sugerido ${num(suggested)}</span>
      <span>Costo estimado ${money(suggested * Number(product.cost_price || 0))}</span>
      <button class="ghost-button" type="button" data-stock-history="${product.id}">Kardex</button>
    </div>
  </article>`;
}

function renderInventoryProductRow(product) {
  const canMoveStock = ["admin", "ventas_admin", "almacen"].includes(currentUser?.role);
  const active = isProductActive(product);
  return `<article class="admin-row inventory-row">
    <div>
      <strong>${escapeHtml(product.name)}</strong>
      <span>${escapeHtml(product.code)} / ${escapeHtml(product.category || "Sin categoria")} / ${escapeHtml(product.unit)}</span>
      <span>Stock ${num(product.stock)} / Minimo ${num(product.min_stock)}</span>
    </div>
    <div class="admin-row-meta">
      <span>Costo ${money(product.cost_price)}</span>
      <span>Venta ${money(product.sale_price)}</span>
      <span class="${active ? "ok-text" : "danger-text"}">${active ? "Activo" : "Inactivo"}</span>
      <span class="${Number(product.stock || 0) <= Number(product.min_stock || 0) ? "danger-text" : "ok-text"}">${Number(product.stock || 0) <= Number(product.min_stock || 0) ? "Bajo minimo" : "Stock OK"}</span>
      <div class="mini-action-row">
        <button class="ghost-button" type="button" data-stock-history="${product.id}">Kardex</button>
        ${canMoveStock ? `<button class="ghost-button" type="button" data-edit-product="${product.id}">Editar</button><button class="ghost-button" type="button" data-stock-move="${product.id}" data-type="entrada">Entrada</button><button class="ghost-button" type="button" data-stock-move="${product.id}" data-type="salida">Salida</button><button class="ghost-button" type="button" data-stock-move="${product.id}" data-type="ajuste">Ajuste</button><button class="ghost-button" type="button" data-toggle-favorite="${product.id}">${favoriteProducts.includes(product.id) ? "Quitar favorito" : "Favorito POS"}</button><button class="ghost-button ${active ? "danger-action" : ""}" type="button" data-product-status="${product.id}">${active ? "Desactivar" : "Reactivar"}</button>` : ""}
      </div>
    </div>
  </article>`;
}

function renderKardexPanel() {
  const product = products.find((item) => item.id === selectedKardex.productId);
  return `
    <section class="admin-panel">
      <div class="admin-panel-head">
        <div><p class="eyebrow">Kardex</p><h3>${escapeHtml(product?.name || "Producto")}</h3></div>
        <button class="ghost-button" type="button" id="closeKardex">Cerrar</button>
      </div>
      <div class="admin-list">
        ${selectedKardex.movements.map(renderStockMovementRow).join("") || empty("Sin movimientos de inventario")}
      </div>
    </section>
  `;
}

function renderStockMovementRow(movement) {
  const quantity = Number(movement.quantity || 0);
  const sign = quantity < 0 || movement.type === "salida" ? "-" : "+";
  return `<article class="admin-row"><div><strong>${escapeHtml(movement.type)} ${sign}${num(Math.abs(quantity))}</strong><span>${escapeHtml(movement.reference || "Sin referencia")} / ${escapeHtml(movement.note || "Sin nota")}</span><span>${formatDateTime(movement.created_at || movement.createdAt)} / ${escapeHtml(movement.created_by_name || movement.user || "Usuario")}</span></div></article>`;
}

function renderSellProduct(product) {
  const stock = Number(product.stock || 0);
  return `<button class="pos-product-card touch-product-card" type="button" data-add-product="${product.id}" ${stock <= 0 ? "disabled" : ""}>
    <span class="product-code">${escapeHtml(product.code)}</span>
    <strong>${escapeHtml(product.name)}</strong>
    <span class="product-meta"><span>${escapeHtml(product.category || "Sin categoria")}</span><small class="${stock <= Number(product.min_stock || 0) ? "warn-text" : ""}">Stock ${num(stock)}</small></span>
    <b>${money(product.sale_price)}</b>
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

function renderCartItem(item) {
  const lineSubtotal = item.quantity * item.salePrice;
  const lineDiscount = storeSettings.allowDiscounts ? Number(item.discount || 0) : 0;
  return `<article class="cart-line touch-cart-line">
    <div class="cart-item-name"><strong>${escapeHtml(item.name)}</strong><span>${money(item.salePrice)} c/u</span></div>
    <div class="cart-qty touch-qty"><button class="ghost-button" type="button" data-cart-dec="${item.productId}">-</button><strong>${item.quantity}</strong><button class="ghost-button" type="button" data-cart-inc="${item.productId}">+</button></div>
    <label>Descuento<input type="number" min="0" step="0.01" value="${Number(lineDiscount || 0)}" data-cart-discount="${item.productId}" ${storeSettings.allowDiscounts ? "" : "disabled"} /></label>
    <strong>${money(Math.max(lineSubtotal - lineDiscount, 0))}</strong>
    <button class="ghost-button danger-action" type="button" data-remove-cart="${item.productId}">Quitar</button>
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
  const canVoid = status !== "anulada" && !sale.cash_closed;
  return `<article class="admin-row">
    <div><strong>${escapeHtml(sale.code)}</strong><span>${escapeHtml(sale.customer_name || "Cliente sin registrar")} / ${formatDateTime(sale.created_at)}</span><span>Metodo: ${escapeHtml(paymentLabel(sale.payment_method || meta.method || "efectivo"))} / Pagado ${money(sale.amount_paid || sale.cash_received || 0)}</span></div>
    <div class="admin-row-meta"><span>Total ${money(sale.total)}</span>${Number(sale.balance_due || 0) > 0 ? `<span class="warn-text">Debe ${money(sale.balance_due)}</span>` : ""}<span class="${status === "anulada" ? "danger-text" : status === "pagada" ? "ok-text" : "warn-text"}">${status}</span><button class="ghost-button" type="button" data-detail-sale="${sale.id}">Ver detalle</button><button class="ghost-button" type="button" data-reprint-sale="${sale.id}">Reimprimir</button>${canVoid ? `<button class="ghost-button danger-action" type="button" data-void-sale="${sale.id}">Anular</button>` : `<span class="muted-text">${status === "anulada" ? "Stock devuelto" : "Caja cerrada"}</span>`}</div>
  </article>`;
}

function saleStatus(sale) {
  if (sale.status === "anulada") return "anulada";
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
  const term = productSearch.trim().toLowerCase();
  const source = options.includeInactive ? products : products.filter(isProductActive);
  if (!term) return source;
  return source.filter((product) => [product.code, product.name, product.category]
    .some((value) => String(value || "").toLowerCase().includes(term)));
}

function productCategories() {
  return [...new Set(products.map((product) => String(product.category || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
}

function bindProductSearch() {
  const input = document.querySelector("#productSearchInput");
  if (!input) return;
  input.addEventListener("input", () => {
    productSearch = input.value;
    renderMain();
  });
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

function addToCart(productId) {
  const product = products.find((item) => item.id === productId);
  if (!product) return;
  const existing = saleCart.find((item) => item.productId === productId);
  const stock = Number(product.stock || 0);
  const currentQuantity = Number(existing?.quantity || 0);
  if (currentQuantity + 1 > stock) {
    ventasMessage = `Stock insuficiente para ${product.name}. Disponible: ${num(stock)}.`;
    return renderMain();
  }
  ventasMessage = "";
  if (existing) existing.quantity += 1;
  else saleCart.push({ productId, name: product.name, quantity: 1, salePrice: Number(product.sale_price || 0), discount: 0 });
  if (isMobilePos()) posMobilePanel = "cart";
  renderMain();
}

function removeFromCart(productId) {
  saleCart = saleCart.filter((item) => item.productId !== productId);
  renderMain();
}

function updateCartQuantity(productId, delta) {
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
  renderMain();
}

function updateCartDiscount(productId, discount) {
  if (!storeSettings.allowDiscounts) {
    ventasMessage = "Los descuentos estan desactivados para esta tienda.";
    return renderMain();
  }
  saleCart = saleCart.map((item) => item.productId === productId ? { ...item, discount: Math.max(discount, 0) } : item);
  renderMain();
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

function isMobilePos() {
  return window.matchMedia("(max-width: 720px)").matches;
}

function scanAddProduct() {
  const term = productSearch.trim().toLowerCase();
  const product = products.find((item) => [item.code, item.name].some((value) => String(value || "").toLowerCase() === term)) || filteredProducts()[0];
  if (product) addToCart(product.id);
}

function newSale() {
  saleCart = [];
  productSearch = "";
  lastSaleReceipt = null;
  saleCustomerId = "";
  saleGlobalDiscount = 0;
  saleNote = "";
  posMobilePanel = "products";
  renderMain();
}

function cancelCurrentSale() {
  saleCart = [];
  saleCustomerId = "";
  saleGlobalDiscount = 0;
  saleNote = "";
  ventasMessage = "Venta cancelada.";
  posMobilePanel = "products";
  renderMain();
}

function suspendCurrentSale() {
  if (!saleCart.length) return;
  suspendedSales = [{ id: crypto.randomUUID(), items: saleCart, customerId: saleCustomerId, globalDiscount: saleGlobalDiscount, note: saleNote, createdAt: new Date().toISOString() }, ...suspendedSales].slice(0, 10);
  persistJson(SUSPENDED_SALES_KEY, suspendedSales);
  saleCart = [];
  saleCustomerId = "";
  saleGlobalDiscount = 0;
  saleNote = "";
  ventasMessage = "Venta suspendida.";
  renderMain();
}

function recoverSuspendedSale() {
  if (!suspendedSales.length) return;
  const recovered = suspendedSales.shift();
  saleCart = recovered.items || [];
  saleCustomerId = recovered.customerId || "";
  saleGlobalDiscount = Number(recovered.globalDiscount || 0);
  saleNote = recovered.note || "";
  posMobilePanel = "cart";
  persistJson(SUSPENDED_SALES_KEY, suspendedSales);
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
  paymentDraft.received = paymentDraft.method === "efectivo" ? total : total;
  renderPaymentModal();
  paymentModal.showModal();
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
  const change = Math.max(Number(paymentDraft.received || 0) - totals.total, 0);
  const insufficient = !isCredit && Number(paymentDraft.received || 0) < totals.total;
  const balanceDue = isCredit ? Math.max(totals.total - Number(paymentDraft.received || 0), 0) : 0;
  const quickAmounts = buildQuickCashAmounts(totals.total);
  paymentModalContent.innerHTML = `
    <div class="touch-payment-layout">
      <div class="payment-total touch-payment-total"><span>Total a pagar</span><strong>${money(totals.total)}</strong><small>${saleCart.length} item${saleCart.length === 1 ? "" : "s"} en carrito</small></div>
      <div class="payment-method-grid touch-payment-methods">${availablePaymentMethods().map((method) => `<button class="${paymentDraft.method === method.id ? "is-active" : ""}" type="button" data-payment-method="${method.id}"><span>${method.icon}</span><strong>${method.label}</strong></button>`).join("")}</div>
      ${isCredit ? `<div class="cloud-safe-note"><strong>Venta al credito</strong><span>Quedara saldo pendiente de ${money(balanceDue)} en cuentas por cobrar.</span></div>` : `<div class="quick-cash-grid">${quickAmounts.map((amount) => `<button type="button" data-quick-cash="${amount}">${money(amount)}</button>`).join("")}</div>`}
      <div class="form-grid touch-payment-fields">
        <label>${isCredit ? "Anticipo recibido" : "Monto recibido"}<input id="paymentReceived" type="number" min="0" step="0.01" value="${Number(paymentDraft.received || 0).toFixed(2)}" /></label>
        <label>${isCredit ? "Saldo pendiente" : "Vuelto"}<input type="text" value="${money(isCredit ? balanceDue : change)}" readonly /></label>
      </div>
      ${insufficient ? `<p class="form-error">Pago insuficiente. Falta ${money(totals.total - Number(paymentDraft.received || 0))}.</p>` : ""}
      <div class="modal-actions touch-payment-actions"><button class="ghost-button" type="button" id="printDraftBtn">Precomprobante</button><button class="primary-button" type="submit" id="confirmPaymentBtn" ${insufficient ? "disabled" : ""}>Confirmar pago</button></div>
    </div>
  `;
  paymentModalContent.querySelectorAll("[data-payment-method]").forEach((button) => {
    button.addEventListener("click", () => {
      paymentDraft.method = button.dataset.paymentMethod;
      if (paymentDraft.method === "credito") paymentDraft.received = 0;
      renderPaymentModal();
    });
  });
  paymentModalContent.querySelector("#paymentReceived")?.addEventListener("input", (event) => {
    paymentDraft.received = Number(event.target.value || 0);
    renderPaymentModal();
  });
  paymentModalContent.querySelectorAll("[data-quick-cash]").forEach((button) => {
    button.addEventListener("click", () => {
      paymentDraft.received = Number(button.dataset.quickCash || totals.total);
      renderPaymentModal();
    });
  });
  paymentModalContent.querySelector("#printDraftBtn")?.addEventListener("click", printDraftTicket);
  paymentForm.onsubmit = submitSale;
}

function buildQuickCashAmounts(total) {
  const base = Math.ceil(Number(total || 0));
  const rounded5 = Math.ceil(base / 5) * 5;
  const rounded10 = Math.ceil(base / 10) * 10;
  const rounded20 = Math.ceil(base / 20) * 20;
  return [...new Set([total, rounded5, rounded10, rounded20].filter((amount) => amount >= total))].slice(0, 4);
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
  if (paymentDraft.method !== "credito" && Number(paymentDraft.received || 0) < totals.total) return;
  if (paymentDraft.method === "credito" && Number(paymentDraft.received || 0) > totals.total) return;
  const response = await apiRequest("/ventas/sales", {
    method: "POST",
    body: {
      customerId: saleCustomerId,
      discount: totals.discount,
      tax: totals.tax,
      note: saleNote.trim(),
      paymentMethod: paymentDraft.method,
      cashReceived: paymentDraft.method === "credito" ? Number(paymentDraft.received || 0) : Number(paymentDraft.received || totals.total),
      items: saleCart.map((item) => ({ productId: item.productId, quantity: item.quantity, unitPrice: item.salePrice }))
    }
  });
  localSaleMeta[response.sale.id] = { method: paymentDraft.method, status: response.sale.payment_status || "pagada", received: Number(paymentDraft.received || totals.total), createdAt: new Date().toISOString() };
  persistJson(LOCAL_SALE_META_KEY, localSaleMeta);
  lastSaleReceipt = { sale: response.sale, items: response.items };
  saleCart = [];
  productSearch = "";
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
    await apiRequest("/ventas/cash/close", { method: "POST", body: { countedAmount: counted } });
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
  const printable = window.open("", "_blank", "width=440,height=720");
  if (!printable) return;
  const difference = Number(closure.differenceAmount || 0);
  printable.document.write(`<!doctype html><html><head><meta charset="UTF-8"><title>Cierre ${escapeHtml(closure.code)}</title><style>body{font-family:Arial,sans-serif;padding:20px;max-width:340px;color:#111}h1{font-size:18px;text-align:center;margin:0 0 8px}.muted{color:#555;font-size:12px;text-align:center}.row{display:flex;justify-content:space-between;border-bottom:1px dashed #aaa;padding:8px 0}.total{font-weight:800;font-size:17px}.diff{font-weight:800;color:${difference === 0 ? "#15803d" : "#b45309"}}button{margin-bottom:12px}.sign{margin-top:34px;border-top:1px solid #111;text-align:center;padding-top:8px;font-size:12px}</style></head><body><button onclick="window.print()">Imprimir</button><h1>${escapeHtml(storeSettings.storeName || storeSettings.companyName || currentUser.companyName || "Zow Ventas-Almacen")}</h1><p class="muted">Cierre de caja ${escapeHtml(closure.code)}<br>Caja ${num(closure.registerNumber)} / ${formatDateTime(closure.createdAt)}</p><div class="row"><span>Monto apertura</span><strong>${money(closure.openingAmount)}</strong></div><div class="row"><span>Total ventas</span><strong>${money(closure.totalSales)}</strong></div><div class="row"><span>Movimientos</span><strong>${money(closure.movementTotal)}</strong></div><div class="row total"><span>Esperado</span><strong>${money(closure.expectedAmount)}</strong></div><div class="row"><span>Contado</span><strong>${money(closure.countedAmount)}</strong></div><div class="row diff"><span>Diferencia</span><strong>${money(difference)}</strong></div><div class="row"><span>Ventas cerradas</span><strong>${closure.saleCount}</strong></div><div class="sign">Firma cajero / responsable</div></body></html>`);
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
    const methodSales = pendingSales.filter((sale) => (sale.payment_method || "efectivo") === method.id);
    return {
      id: method.id,
      label: method.label,
      total: methodSales.reduce((sum, sale) => sum + Number(sale.amount_paid || sale.cash_received || sale.total || 0), 0),
      count: methodSales.length
    };
  }).filter((item) => item.count || ["efectivo", "tarjeta", "qr"].includes(item.id));
}

function buildSalesPaymentBreakdown(sourceSales) {
  return paymentMethods().map((method) => {
    const methodSales = sourceSales.filter((sale) => (sale.payment_method || "efectivo") === method.id);
    return {
      id: method.id,
      label: method.label,
      total: methodSales.reduce((sum, sale) => sum + Number(sale.amount_paid || sale.cash_received || sale.total || 0), 0),
      count: methodSales.length
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
    document.querySelector("#productName").value = product.name || "";
    document.querySelector("#productCategory").value = product.category || "";
    document.querySelector("#productCost").value = Number(product.cost_price || 0);
    document.querySelector("#productSale").value = Number(product.sale_price || 0);
    document.querySelector("#productMin").value = Number(product.min_stock || 0);
    document.querySelector("#productStock").value = Number(product.stock || 0);
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
  const printable = window.open("", "_blank", "width=420,height=720");
  if (!printable) return;
  const title = storeSettings.storeName || storeSettings.companyName || currentUser.companyName || "Zow Ventas-Almacen";
  printable.document.write(`<!doctype html><html><head><meta charset="UTF-8"><title>Ticket ${escapeHtml(sale.code)}</title><style>
    *{box-sizing:border-box}body{font-family:Arial,sans-serif;margin:0;padding:14px;max-width:330px;color:#111;background:#fff}
    .toolbar{margin-bottom:10px}.toolbar button{width:100%;border:0;border-radius:8px;padding:10px;background:#111;color:#fff;font-weight:800}
    h1{font-size:17px;text-align:center;margin:0 0 5px;text-transform:uppercase}.center{text-align:center}.muted{color:#555;font-size:11px;line-height:1.35}
    .ticket-box{border:1px solid #111;border-radius:8px;padding:9px;margin:10px 0}.row{display:flex;justify-content:space-between;gap:10px;padding:5px 0;border-bottom:1px dashed #aaa}.row:last-child{border-bottom:0}
    table{width:100%;border-collapse:collapse;margin-top:8px}td{padding:6px 0;border-bottom:1px dashed #aaa;font-size:12px;vertical-align:top}td:last-child{text-align:right;font-weight:700}
    .total{font-weight:900;font-size:18px}.barcode{height:34px;margin:10px 24px;background:repeating-linear-gradient(90deg,#111 0 2px,transparent 2px 5px,#111 5px 6px,transparent 6px 10px)}
    .foot{margin-top:10px;text-align:center;font-size:11px;color:#555}.sign{margin-top:18px;border-top:1px solid #111;text-align:center;padding-top:6px;font-size:10px;color:#444}
    @media print{.toolbar{display:none}body{padding:0}}
  </style></head><body><div class="toolbar"><button onclick="window.print()">Imprimir comprobante</button></div>
  <h1>${escapeHtml(title)}</h1>
  <p class="center muted">${escapeHtml(storeSettings.taxId ? `NIT ${storeSettings.taxId}` : "")}<br>${escapeHtml(storeSettings.address || "")}<br>${escapeHtml(storeSettings.phone || "")}</p>
  <div class="ticket-box"><div class="row"><span>Comprobante</span><strong>${escapeHtml(sale.code)}</strong></div><div class="row"><span>Fecha</span><strong>${formatDateTime(sale.created_at)}</strong></div><div class="row"><span>Cajero</span><strong>${escapeHtml(currentUser.name || sale.seller_name || "")}</strong></div><div class="row"><span>Cliente</span><strong>${escapeHtml(sale.customer_name || "S/R")}</strong></div></div>
  <table>${items.map((item) => `<tr><td>${escapeHtml(item.product_name)}<br><span class="muted">${num(item.quantity)} x ${money(item.unit_price)}</span></td><td>${money(item.total)}</td></tr>`).join("")}</table>
  <div class="ticket-box"><div class="row"><span>Subtotal</span><strong>${money(sale.subtotal)}</strong></div><div class="row"><span>Descuento</span><strong>${money(sale.discount)}</strong></div><div class="row"><span>Impuesto</span><strong>${money(sale.tax || 0)}</strong></div><div class="row total"><span>Total</span><strong>${money(sale.total)}</strong></div><div class="row"><span>Metodo</span><strong>${escapeHtml(paymentLabel(sale.payment_method || paymentDraft.method || "efectivo"))}</strong></div><div class="row"><span>Pagado</span><strong>${money(sale.amount_paid || sale.cash_received || 0)}</strong></div><div class="row"><span>Cambio</span><strong>${money(sale.change_amount)}</strong></div>${Number(sale.balance_due || 0) > 0 ? `<div class="row"><span>Saldo</span><strong>${money(sale.balance_due)}</strong></div>` : ""}</div>
  ${sale.note ? `<p class="muted"><strong>Obs.:</strong> ${escapeHtml(sale.note)}</p>` : ""}
  <div class="barcode"></div><p class="foot">${escapeHtml(storeSettings.ticketNote || "Gracias por su compra")}</p><p class="foot">Sistema ZOW SAAS / Wilmar Peinado B.</p></body></html>`);
  printable.document.close();
  printable.focus();
}

function printDraftTicket() {
  const totals = cartTotals();
  const sale = {
    code: "PREVENTA",
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total,
    cash_received: Number(paymentDraft.received || totals.total),
    change_amount: Math.max(Number(paymentDraft.received || 0) - totals.total, 0),
    payment_method: paymentDraft.method,
    amount_paid: paymentDraft.method === "credito" ? Number(paymentDraft.received || 0) : Number(paymentDraft.received || totals.total),
    balance_due: paymentDraft.method === "credito" ? Math.max(totals.total - Number(paymentDraft.received || 0), 0) : 0,
    created_at: new Date().toISOString(),
    note: saleNote.trim()
  };
  const items = saleCart.map((item) => ({ product_name: item.name, quantity: item.quantity, total: item.quantity * item.salePrice - Number(item.discount || 0) }));
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
  saleDetailTitle.textContent = sale.code || "Comprobante";
  saleDetailContent.innerHTML = `
    <section class="sale-detail-summary">
      <article><span>Estado</span><strong class="${status === "anulada" ? "danger-text" : status === "pagada" ? "ok-text" : "warn-text"}">${escapeHtml(status)}</strong></article>
      <article><span>Total</span><strong>${money(sale.total)}</strong></article>
      <article><span>Metodo</span><strong>${escapeHtml(paymentLabel(sale.payment_method || "efectivo"))}</strong></article>
      <article><span>Fecha</span><strong>${formatDateTime(sale.created_at)}</strong></article>
    </section>
    <section class="sale-detail-card">
      <div>
        <span>Cliente</span>
        <strong>${escapeHtml(sale.customer_name || "Cliente sin registrar")}</strong>
      </div>
      <div>
        <span>Cajero</span>
        <strong>${escapeHtml(sale.seller_name || currentUser.name || "Usuario")}</strong>
      </div>
      <div>
        <span>Pago</span>
        <strong>Pagado ${money(sale.amount_paid || sale.cash_received || 0)} / Cambio ${money(sale.change_amount || 0)}</strong>
      </div>
      <div>
        <span>Impuesto</span>
        <strong>${money(sale.tax || 0)}</strong>
      </div>
      ${sale.note ? `<div><span>Observacion</span><strong>${escapeHtml(sale.note)}</strong></div>` : ""}
      ${Number(sale.balance_due || 0) > 0 ? `<div><span>Saldo pendiente</span><strong class="warn-text">${money(sale.balance_due)}</strong></div>` : ""}
    </section>
    <div class="sale-detail-items">
      ${items.map((item) => `
        <article>
          <div><strong>${escapeHtml(item.product_name)}</strong><span>${num(item.quantity)} x ${money(item.unit_price)}</span></div>
          <b>${money(item.total)}</b>
        </article>
      `).join("") || empty("Sin productos registrados")}
    </div>
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
  const response = await apiRequest("/ventas/settings", {
    method: "PATCH",
    body: {
      companyName: value("#storeCompanyName"),
      storeName: value("#storeName"),
      currency: value("#storeCurrency"),
      taxId: value("#storeTaxId"),
      phone: value("#storePhone"),
      address: value("#storeAddress"),
      ticketNote: value("#storeTicketNote"),
      cashRegisterCount: Number(value("#storeCashRegisterCount") || 1),
      taxRate: Number(value("#storeTaxRate") || 0),
      allowCredit: Boolean(document.querySelector("#storeAllowCredit")?.checked),
      allowDiscounts: Boolean(document.querySelector("#storeAllowDiscounts")?.checked),
      requireCustomerForSale: Boolean(document.querySelector("#storeRequireCustomerForSale")?.checked)
    }
  });
  storeSettings = response.settings;
  await render();
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

async function savePurchase(event) {
  event.preventDefault();
  if (!purchaseCart.length) addPurchaseLine();
  if (!purchaseCart.length) return;
  try {
    await apiRequest("/ventas/purchases", {
      method: "POST",
      body: {
        supplierId: value("#purchaseSupplier"),
        invoiceNumber: value("#purchaseInvoice"),
        note: value("#purchaseNote"),
        items: purchaseCart.map((item) => ({ productId: item.productId, quantity: item.quantity, unitCost: item.unitCost }))
      }
    });
    purchaseCart = [];
    ventasMessage = "Compra registrada. El stock fue actualizado y quedo en Kardex.";
    activeView = "purchases";
    await render();
  } catch (error) {
    ventasMessage = error.message || "No se pudo registrar la compra.";
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

function toggleFavoriteProduct(productId) {
  favoriteProducts = favoriteProducts.includes(productId)
    ? favoriteProducts.filter((id) => id !== productId)
    : [productId, ...favoriteProducts].slice(0, 12);
  persistJson(FAVORITE_PRODUCTS_KEY, favoriteProducts);
  ventasMessage = favoriteProducts.includes(productId) ? "Producto marcado como favorito del POS." : "Producto quitado de favoritos.";
  renderMain();
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
function cashRegisterOptions() {
  const count = Math.min(Math.max(Math.floor(Number(storeSettings.cashRegisterCount || 1)), 1), 20);
  return Array.from({ length: count }, (_, index) => index + 1);
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

function exportCustomersCsv() {
  const debtByCustomer = new Map();
  receivables.forEach((sale) => {
    const name = sale.customer_name || "Cliente sin registrar";
    debtByCustomer.set(name, (debtByCustomer.get(name) || 0) + Number(sale.balance_due || 0));
  });
  const rows = customers.map((customer) => ({
    cliente: customer.name,
    ci_nit: customer.ci || "",
    celular: customer.phone || "",
    email: customer.email || "",
    direccion: customer.address || "",
    saldo_pendiente: Number(debtByCustomer.get(customer.name) || 0).toFixed(2)
  }));
  receivables.filter((sale) => !customers.some((customer) => customer.name === sale.customer_name)).forEach((sale) => {
    rows.push({
      cliente: sale.customer_name || "Cliente sin registrar",
      ci_nit: "",
      celular: "",
      email: "",
      direccion: "",
      saldo_pendiente: Number(sale.balance_due || 0).toFixed(2)
    });
  });
  downloadCsv(`clientes-${csvDateStamp()}.csv`, rows);
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
    return {
      codigo: product.code,
      producto: product.name,
      categoria: product.category || "",
      unidad: product.unit || "",
      stock: stock.toFixed(2),
      minimo: Number(product.min_stock || product.minStock || 0).toFixed(2),
      costo: cost.toFixed(2),
      precio: price.toFixed(2),
      margen_unitario: (price - cost).toFixed(2),
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
    createdAt: closure.created_at || closure.createdAt || ""
  };
}
function canAccessView(view) { return accessibleViewsForRole(currentUser?.role).includes(view); }
function defaultViewForRole() { return accessibleViewsForRole(currentUser?.role)[0] || "summary"; }
function accessibleViewsForRole(role) {
  const views = {
    admin: ["sell", "summary", "alerts", "finance", "history", "routes", "promotions", "reports", "catalog", "customers", "inventory", "purchases", "users", "settings"],
    ventas_admin: ["sell", "summary", "alerts", "finance", "history", "routes", "promotions", "reports", "catalog", "customers", "inventory", "purchases", "settings"],
    cajero: ["sell", "finance", "history"],
    vendedor: ["sell", "customers", "history"],
    almacen: ["inventory", "purchases", "alerts", "routes", "reports", "catalog", "summary"],
    supervisor: ["sell", "summary", "alerts", "finance", "history", "routes", "promotions", "reports", "catalog", "customers", "inventory", "purchases"],
    funcionario: ["sell", "routes", "customers", "summary"]
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
