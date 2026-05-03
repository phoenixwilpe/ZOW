const API_BASE_URL = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
  ? "http://localhost:4174/api"
  : "/api";
const TOKEN_KEY = "zowVentasAlmacen.token";
const SESSION_KEY = "zowVentasAlmacen.session";
const SUSPENDED_SALES_KEY = "zowVentasAlmacen.suspendedSales";
const LOCAL_SALE_META_KEY = "zowVentasAlmacen.saleMeta";

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
let cash = { pendingSales: [], total: 0 };
let summary = {};
let saleCart = [];
let editingUserId = "";
let editingProductId = "";
let productSearch = "";
let ventasMessage = "";
let paymentDraft = { method: "efectivo", received: 0 };
let suspendedSales = loadJson(SUSPENDED_SALES_KEY, []);
let cashSession = null;
let cashMovements = [];
let selectedKardex = null;
let localSaleMeta = loadJson(LOCAL_SALE_META_KEY, {});
let historyFilter = { status: "", method: "", date: "" };
let storeSettings = { companyName: "", storeName: "", currency: "BOB", taxId: "", phone: "", address: "", ticketNote: "" };

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
const paymentModal = document.querySelector("#paymentModal");
const paymentForm = document.querySelector("#paymentForm");
const paymentModalContent = document.querySelector("#paymentModalContent");
const ventasMenuToggle = document.querySelector("#ventasMenuToggle");

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
document.querySelector("#closePaymentModal").addEventListener("click", () => paymentModal.close());

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
  await apiRequest("/ventas/customers", {
    method: "POST",
    body: {
      name: value("#customerName"),
      phone: value("#customerPhone"),
      ci: value("#customerCi"),
      email: value("#customerEmail"),
      address: value("#customerAddress")
    }
  });
  customerModal.close();
  await render();
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

render();

async function render() {
  if (!currentUser || !sessionStorage.getItem(TOKEN_KEY)) return renderLoggedOut();
  try {
    await assertVentasAccess();
    const [settingsResponse, summaryResponse, productsResponse, customersResponse, categoriesResponse, salesResponse, cashResponse, usersResponse, unitsResponse] = await Promise.all([
      apiRequest("/ventas/settings"),
      apiRequest("/ventas/summary"),
      apiRequest("/ventas/products"),
      apiRequest("/ventas/customers"),
      apiRequest("/ventas/categories"),
      apiRequest("/ventas/sales"),
      apiRequest("/ventas/cash"),
      currentUser?.role === "admin" ? apiRequest("/users") : Promise.resolve({ users: [] }),
      currentUser?.role === "admin" ? apiRequest("/units") : Promise.resolve({ units: [] })
    ]);
    storeSettings = settingsResponse.settings || storeSettings;
    summary = summaryResponse.summary || {};
    products = productsResponse.products || [];
    customers = customersResponse.customers || [];
    categories = categoriesResponse.categories || [];
    sales = salesResponse.sales || [];
    users = (usersResponse.users || []).map(normalizeUser);
    units = (unitsResponse.units || []).map(normalizeUnit);
    cash = cashResponse || { pendingSales: [], total: 0 };
    cashSession = normalizeCashSession(cash.activeSession);
    cashMovements = (cash.movements || []).map(normalizeCashMovement);
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
    users: ["Usuarios", "Credenciales y roles de Ventas-Almacen"],
    settings: ["Configuracion", "Tienda, moneda y datos de impresion"]
  };
  document.querySelector("#viewEyebrow").textContent = titles[activeView][0];
  document.querySelector("#viewTitle").textContent = titles[activeView][1];
  document.querySelector("#ventasMenuLabel").textContent = document.querySelector(`[data-view="${activeView}"]`)?.textContent || titles[activeView][0];
  renderWorkflow();
  const renderers = { summary: renderSummary, alerts: renderAlerts, sell: renderSell, finance: renderFinance, history: renderHistory, routes: renderRoutes, promotions: renderPromotions, reports: renderReports, catalog: renderCatalog, customers: renderCustomers, inventory: renderInventory, users: renderUsers, settings: renderSettings };
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
  mainList().innerHTML = `
    <section class="setup-overview">
      <article><span>Clientes</span><strong>${customers.length}</strong></article>
      <article><span>${scopeText}</span><strong>${summary.sales || 0}</strong></article>
      <article><span>${incomeText}</span><strong>${money(summary.income || 0)}</strong></article>
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
  setCount(`${alerts.length} alerta${alerts.length === 1 ? "" : "s"}`);
  mainList().innerHTML = alerts.map(renderProductRow).join("") || empty("No hay alertas de stock");
}

function renderSell() {
  setCount(`${saleCart.length} item${saleCart.length === 1 ? "" : "s"}`);
  const sellProducts = filteredProducts().filter(isProductActive);
  const totals = cartTotals();
  const categories = productCategories();
  const cashState = cashSession?.status === "abierta" ? `Caja abierta / ${money(cashExpectedTotal())}` : "Caja sin abrir";
  mainList().innerHTML = `
    <section class="pos-shell touch-pos-shell">
      <section class="admin-panel pos-products touch-panel">
        <div class="touch-pos-head">
          <div>
            <p class="eyebrow">Venta rapida</p>
            <h3>Productos</h3>
          </div>
          <div class="touch-shortcuts"><span>${escapeHtml(cashState)}</span><span>F2 Buscar</span><span>F4 Cobrar</span></div>
        </div>
        ${ventasMessage ? `<div class="pos-toast">${escapeHtml(ventasMessage)}</div>` : ""}
        <div class="pos-search-row">
          <label class="toolbar-search touch-search">Buscar o escanear<input id="productSearchInput" type="search" value="${escapeHtml(productSearch)}" placeholder="Codigo, barras o nombre del producto" /></label>
          <button class="primary-button touch-action" type="button" id="scanAddBtn">Agregar</button>
        </div>
        <div class="pos-category-rail">
          <button class="${productSearch ? "" : "is-active"}" type="button" data-product-filter="">Todos</button>
          ${categories.slice(0, 10).map((category) => `<button class="${productSearch === category ? "is-active" : ""}" type="button" data-product-filter="${escapeHtml(category)}">${escapeHtml(category)}</button>`).join("")}
        </div>
        <div class="product-suggestion-grid touch-product-grid">${sellProducts.slice(0, 24).map(renderSellProduct).join("") || empty("Sin productos con esa busqueda")}</div>
      </section>
      <section class="admin-panel pos-cart touch-cart-panel">
        <div class="touch-cart-head">
          <div><p class="eyebrow">Carrito actual</p><h3>${saleCart.length} producto${saleCart.length === 1 ? "" : "s"}</h3></div>
          <strong>${money(totals.total)}</strong>
        </div>
        <form class="admin-form" id="saleForm">
          <label class="touch-customer-select">Cliente<select id="saleCustomer"><option value="">Cliente sin registrar</option>${customers.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("")}</select></label>
          <div class="pos-cart-list touch-cart-list">${saleCart.map(renderCartItem).join("") || empty("Toca un producto para agregarlo")}</div>
          <div class="sale-total-card">
            <div><span>Subtotal</span><strong>${money(totals.subtotal)}</strong></div>
            <div><span>Descuentos</span><strong>${money(totals.discount)}</strong></div>
            <div><span>Impuestos</span><strong>${money(totals.tax)}</strong></div>
            <div class="is-total"><span>Total</span><strong>${money(totals.total)}</strong></div>
          </div>
          <div class="quick-action-row touch-sale-actions">
            <button class="ghost-button" type="button" id="newSaleBtn">Nueva</button>
            <button class="ghost-button" type="button" id="suspendSaleBtn">Suspender</button>
            <button class="ghost-button" type="button" id="recoverSaleBtn">Recuperar (${suspendedSales.length})</button>
            <button class="ghost-button danger-action" type="button" id="cancelSaleBtn">Cancelar</button>
          </div>
          <button class="primary-button touch-charge-button" type="button" id="chargeSaleBtn" ${saleCart.length ? "" : "disabled"}>Cobrar ${money(totals.total)}</button>
        </form>
      </section>
    </section>
  `;
  bindProductSearch();
  document.querySelectorAll("[data-product-filter]").forEach((button) => button.addEventListener("click", () => {
    productSearch = button.dataset.productFilter || "";
    renderMain();
  }));
  document.querySelector("#scanAddBtn")?.addEventListener("click", scanAddProduct);
  document.querySelector("#newSaleBtn")?.addEventListener("click", newSale);
  document.querySelector("#suspendSaleBtn")?.addEventListener("click", suspendCurrentSale);
  document.querySelector("#recoverSaleBtn")?.addEventListener("click", recoverSuspendedSale);
  document.querySelector("#cancelSaleBtn")?.addEventListener("click", () => {
    if (saleCart.length && confirm("Cancelar la venta actual?")) cancelCurrentSale();
  });
  document.querySelector("#chargeSaleBtn")?.addEventListener("click", openPaymentModal);
  document.querySelectorAll("[data-add-product]").forEach((button) => button.addEventListener("click", () => addToCart(button.dataset.addProduct)));
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
  mainList().innerHTML = `
    <section class="setup-overview">
      <article><span>${cashLabel}</span><strong>${cash.pendingSales?.length || 0}</strong></article>
      <article><span>${totalLabel}</span><strong>${money(cash.total || 0)}</strong></article>
      <article><span>Efectivo esperado</span><strong>${money(expectedCash)}</strong></article>
    </section>
    <section class="cashier-grid">
      <section class="admin-panel">
        <div class="admin-panel-head"><div><p class="eyebrow">Apertura</p><h3>${cashSession?.status === "abierta" ? "Caja abierta" : "Abrir caja"}</h3></div></div>
        ${cashSession?.status === "abierta" ? `
          <div class="cash-status-card"><strong>${money(cashSession.openingAmount)}</strong><span>Apertura por ${escapeHtml(cashSession.openedBy)} / ${formatDateTime(cashSession.openedAt)}</span></div>
        ` : `
          <form class="admin-form" id="cashOpenForm"><label>Monto inicial<input id="cashOpeningAmount" type="number" min="0" step="0.01" value="0" /></label><button class="primary-button" type="submit">Abrir caja</button></form>
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
          </div>
          <button class="primary-button" type="submit" ${cashSession?.status === "abierta" ? "" : "disabled"}>Cerrar caja</button>
        </form>
      </section>
    </section>
    <section class="admin-panel">
      <div class="admin-panel-head"><div><p class="eyebrow">Historial movimientos</p><h3>Turno actual</h3></div></div>
      <div class="admin-list">${cashMovements.slice(0, 8).map(renderCashMovementRow).join("") || empty("Sin movimientos manuales")}</div>
    </section>
  `;
  document.querySelector("#cashOpenForm")?.addEventListener("submit", openCashSession);
  document.querySelector("#cashMovementForm")?.addEventListener("submit", addCashMovement);
  document.querySelector("#cashCloseForm")?.addEventListener("submit", closeCashSession);
}

function renderHistory() {
  const visibleSales = sales.filter((sale) => {
    const meta = localSaleMeta[sale.id] || {};
    const status = saleStatus(sale);
    if (historyFilter.status && status !== historyFilter.status) return false;
    if (historyFilter.method && meta.method !== historyFilter.method) return false;
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
  const grossMargin = products.reduce((sum, product) => sum + Math.max(Number(product.sale_price || 0) - Number(product.cost_price || 0), 0) * Number(product.stock || 0), 0);
  const pendingTotal = Number(summary.pending_total || cash.total || 0);
  const averageSale = Number(summary.sales || 0) ? Number(summary.income || 0) / Number(summary.sales || 1) : 0;
  setCount("Auditoria");
  mainList().innerHTML = `
    <section class="report-grid">
      <article><span>Ticket promedio</span><strong>${money(averageSale)}</strong><small>${summary.sales || 0} ventas confirmadas</small></article>
      <article><span>Pendiente de caja</span><strong>${money(pendingTotal)}</strong><small>${summary.pending_sales || cash.pendingSales?.length || 0} ventas por liquidar</small></article>
      <article><span>Margen potencial</span><strong>${money(grossMargin)}</strong><small>Segun costo, precio y stock actual</small></article>
      <article><span>Stock critico</span><strong>${summary.low_stock || 0}</strong><small>Productos bajo minimo</small></article>
    </section>
    <section class="admin-panel">
      <div class="admin-panel-head"><div><p class="eyebrow">Control</p><h3>Productos que requieren accion</h3></div></div>
      <div class="admin-list">${products.filter((product) => isProductActive(product) && Number(product.stock || 0) <= Number(product.min_stock || 0)).map(renderProductRow).join("") || empty("Sin riesgos de inventario")}</div>
    </section>
  `;
}

function renderCatalog() {
  setCount(`${products.length} articulo${products.length === 1 ? "" : "s"}`);
  mainList().innerHTML = `
    <section class="admin-panel"><div class="admin-panel-head"><div><p class="eyebrow">Categorias</p><h3>Agrupacion de articulos</h3></div></div><div class="admin-list">${categories.map((c) => `<article class="admin-row"><strong>${escapeHtml(c.name)}</strong><span>${escapeHtml(c.description || "Sin descripcion")}</span></article>`).join("") || empty("Sin categorias")}</div></section>
    <section class="admin-panel"><div class="admin-panel-head"><div><p class="eyebrow">Articulos</p><h3>Productos registrados</h3></div></div><div class="admin-list">${products.map(renderProductRow).join("") || empty("Sin productos")}</div></section>
  `;
}

function renderCustomers() {
  setCount(`${customers.length} cliente${customers.length === 1 ? "" : "s"}`);
  mainList().innerHTML = customers.map((customer) => `
    <article class="admin-row"><div><strong>${escapeHtml(customer.name)}</strong><span>CI/NIT ${escapeHtml(customer.ci || "Sin dato")} / Cel. ${escapeHtml(customer.phone || "Sin celular")}</span><span>${escapeHtml(customer.address || "Sin direccion")}</span></div><div class="admin-row-meta"><span>${escapeHtml(customer.email || "Sin email")}</span></div></article>
  `).join("") || empty("Sin clientes registrados");
}

function renderInventory() {
  const inventoryProducts = filteredProducts({ includeInactive: true });
  setCount(`${products.length} producto${products.length === 1 ? "" : "s"}`);
  mainList().innerHTML = `
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
          <label>NIT / Identificacion<input id="storeTaxId" type="text" value="${escapeHtml(storeSettings.taxId || "")}" /></label>
          <label>Telefono<input id="storePhone" type="tel" value="${escapeHtml(storeSettings.phone || "")}" /></label>
          <label>Direccion<input id="storeAddress" type="text" value="${escapeHtml(storeSettings.address || "")}" /></label>
          <label class="span-2">Nota en comprobante<input id="storeTicketNote" type="text" value="${escapeHtml(storeSettings.ticketNote || "")}" placeholder="Gracias por su compra" /></label>
        </div>
        <div class="modal-actions"><button class="primary-button" type="submit">Guardar configuracion</button></div>
      </form>
    </section>
    <section class="admin-panel">
      <div class="admin-panel-head"><div><p class="eyebrow">Modelos de operacion</p><h3>Adaptable a empresa chica o grande</h3></div></div>
      <div class="operation-model-grid">
        <article><span>Tienda 1 persona</span><strong>Encargado de sistema</strong><small>Puede configurar, vender, cerrar caja, registrar productos y ajustar stock.</small></article>
        <article><span>Tienda 2 personas</span><strong>Operador integral + encargado</strong><small>El operador integral atiende venta, caja e inventario diario sin tocar el panel ZOW.</small></article>
        <article><span>Empresa grande</span><strong>Roles separados</strong><small>Cajero, almacen, vendedor, supervisor y administrador ventas por area o sucursal.</small></article>
      </div>
    </section>
  `;
  document.querySelector("#storeSettingsForm")?.addEventListener("submit", saveStoreSettings);
}

function renderProductRow(product) {
  return `<article class="admin-row"><div><strong>${escapeHtml(product.name)}</strong><span>${escapeHtml(product.code)} / ${escapeHtml(product.category || "Sin categoria")} / ${escapeHtml(product.unit)}</span><span>Stock ${num(product.stock)} / Minimo ${num(product.min_stock)}</span></div><div class="admin-row-meta"><span>Costo ${money(product.cost_price)}</span><span>Venta ${money(product.sale_price)}</span><span class="${Number(product.stock || 0) <= Number(product.min_stock || 0) ? "danger-text" : "ok-text"}">${Number(product.stock || 0) <= Number(product.min_stock || 0) ? "Bajo minimo" : "Stock OK"}</span></div></article>`;
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
        ${canMoveStock ? `<button class="ghost-button" type="button" data-edit-product="${product.id}">Editar</button><button class="ghost-button" type="button" data-stock-move="${product.id}" data-type="entrada">Entrada</button><button class="ghost-button" type="button" data-stock-move="${product.id}" data-type="salida">Salida</button><button class="ghost-button" type="button" data-stock-move="${product.id}" data-type="ajuste">Ajuste</button><button class="ghost-button ${active ? "danger-action" : ""}" type="button" data-product-status="${product.id}">${active ? "Desactivar" : "Reactivar"}</button>` : ""}
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
  const sign = movement.type === "salida" ? "-" : "+";
  return `<article class="admin-row"><div><strong>${escapeHtml(movement.type)} ${sign}${num(movement.quantity)}</strong><span>${escapeHtml(movement.reference || "Sin referencia")} / ${escapeHtml(movement.note || "Sin nota")}</span><span>${formatDateTime(movement.created_at || movement.createdAt)} / ${escapeHtml(movement.created_by_name || movement.user || "Usuario")}</span></div></article>`;
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

function renderCartItem(item) {
  const lineSubtotal = item.quantity * item.salePrice;
  return `<article class="cart-line touch-cart-line">
    <div class="cart-item-name"><strong>${escapeHtml(item.name)}</strong><span>${money(item.salePrice)} c/u</span></div>
    <div class="cart-qty touch-qty"><button class="ghost-button" type="button" data-cart-dec="${item.productId}">-</button><strong>${item.quantity}</strong><button class="ghost-button" type="button" data-cart-inc="${item.productId}">+</button></div>
    <label>Descuento<input type="number" min="0" step="0.01" value="${Number(item.discount || 0)}" data-cart-discount="${item.productId}" /></label>
    <strong>${money(Math.max(lineSubtotal - Number(item.discount || 0), 0))}</strong>
    <button class="ghost-button danger-action" type="button" data-remove-cart="${item.productId}">Quitar</button>
  </article>`;
}

function renderSaleRow(sale) {
  const status = saleStatus(sale);
  const label = status === "anulada" ? "Anulada" : sale.cash_closed ? "Caja cerrada" : "Pendiente caja";
  return `<article class="admin-row"><div><strong>${escapeHtml(sale.code)}</strong><span>${escapeHtml(sale.customer_name || "Cliente sin registrar")} / ${escapeHtml(sale.seller_name || "Vendedor")}</span><span>${formatDateTime(sale.created_at)}</span></div><div class="admin-row-meta"><span>Total ${money(sale.total)}</span><span class="${status === "anulada" ? "danger-text" : status === "pagada" ? "ok-text" : "warn-text"}">${label}</span></div></article>`;
}

function renderHistorySaleRow(sale) {
  const meta = localSaleMeta[sale.id] || {};
  const status = saleStatus(sale);
  const canVoid = status !== "anulada" && !sale.cash_closed;
  return `<article class="admin-row">
    <div><strong>${escapeHtml(sale.code)}</strong><span>${escapeHtml(sale.customer_name || "Cliente sin registrar")} / ${formatDateTime(sale.created_at)}</span><span>Metodo: ${escapeHtml(paymentLabel(meta.method || "efectivo"))}</span></div>
    <div class="admin-row-meta"><span>Total ${money(sale.total)}</span><span class="${status === "anulada" ? "danger-text" : status === "pagada" ? "ok-text" : "warn-text"}">${status}</span><button class="ghost-button" type="button" data-reprint-sale="${sale.id}">Reimprimir</button>${canVoid ? `<button class="ghost-button danger-action" type="button" data-void-sale="${sale.id}">Anular</button>` : `<span class="muted-text">${status === "anulada" ? "Stock devuelto" : "Caja cerrada"}</span>`}</div>
  </article>`;
}

function saleStatus(sale) {
  if (sale.status === "anulada") return "anulada";
  const meta = localSaleMeta[sale.id] || {};
  return meta.status || (sale.cash_closed ? "pagada" : "pendiente");
}

function renderCashMovementRow(movement) {
  return `<article class="admin-row"><div><strong>${movement.type === "ingreso" ? "Ingreso" : "Egreso"} ${money(movement.amount)}</strong><span>${escapeHtml(movement.reason)}</span><span>${formatDateTime(movement.createdAt)} / ${escapeHtml(movement.user)}</span></div></article>`;
}

function renderVentasCommandCenter() {
  const modules = [
    ["Gestion comercial", "Ventas, clientes, promociones y listas de precios.", "sell"],
    ["Gestion operativa", "Rutas, despacho, stock minimo y reposicion.", "routes"],
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
          <label>Unidad / Sucursal
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
      <span>${escapeHtml(user.unitName || "Sin unidad")} / ${escapeHtml(user.position || "Sin cargo")}</span>
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
  saleCart = saleCart.map((item) => item.productId === productId ? { ...item, discount: Math.max(discount, 0) } : item);
  renderMain();
}

function cartTotals() {
  const subtotal = saleCart.reduce((sum, item) => sum + item.quantity * item.salePrice, 0);
  const discount = saleCart.reduce((sum, item) => sum + Number(item.discount || 0), 0);
  const tax = 0;
  return { subtotal, discount, tax, total: Math.max(subtotal - discount + tax, 0) };
}

function scanAddProduct() {
  const term = productSearch.trim().toLowerCase();
  const product = products.find((item) => [item.code, item.name].some((value) => String(value || "").toLowerCase() === term)) || filteredProducts()[0];
  if (product) addToCart(product.id);
}

function newSale() {
  saleCart = [];
  productSearch = "";
  renderMain();
}

function cancelCurrentSale() {
  saleCart = [];
  ventasMessage = "Venta cancelada.";
  renderMain();
}

function suspendCurrentSale() {
  if (!saleCart.length) return;
  suspendedSales = [{ id: crypto.randomUUID(), items: saleCart, createdAt: new Date().toISOString() }, ...suspendedSales].slice(0, 10);
  persistJson(SUSPENDED_SALES_KEY, suspendedSales);
  saleCart = [];
  ventasMessage = "Venta suspendida.";
  renderMain();
}

function recoverSuspendedSale() {
  if (!suspendedSales.length) return;
  const recovered = suspendedSales.shift();
  saleCart = recovered.items || [];
  persistJson(SUSPENDED_SALES_KEY, suspendedSales);
  ventasMessage = "Venta recuperada.";
  renderMain();
}

function openPaymentModal() {
  if (!saleCart.length) return;
  const total = cartTotals().total;
  paymentDraft.received = paymentDraft.method === "efectivo" ? total : total;
  renderPaymentModal();
  paymentModal.showModal();
}

function renderPaymentModal() {
  const totals = cartTotals();
  const change = Math.max(Number(paymentDraft.received || 0) - totals.total, 0);
  const insufficient = Number(paymentDraft.received || 0) < totals.total;
  const quickAmounts = buildQuickCashAmounts(totals.total);
  paymentModalContent.innerHTML = `
    <div class="touch-payment-layout">
      <div class="payment-total touch-payment-total"><span>Total a pagar</span><strong>${money(totals.total)}</strong><small>${saleCart.length} item${saleCart.length === 1 ? "" : "s"} en carrito</small></div>
      <div class="payment-method-grid touch-payment-methods">${paymentMethods().map((method) => `<button class="${paymentDraft.method === method.id ? "is-active" : ""}" type="button" data-payment-method="${method.id}">${method.label}</button>`).join("")}</div>
      <div class="quick-cash-grid">${quickAmounts.map((amount) => `<button type="button" data-quick-cash="${amount}">${money(amount)}</button>`).join("")}</div>
      <div class="form-grid touch-payment-fields">
        <label>Monto recibido<input id="paymentReceived" type="number" min="0" step="0.01" value="${Number(paymentDraft.received || 0).toFixed(2)}" /></label>
        <label>Vuelto<input type="text" value="${money(change)}" readonly /></label>
      </div>
      ${insufficient ? `<p class="form-error">Pago insuficiente. Falta ${money(totals.total - Number(paymentDraft.received || 0))}.</p>` : ""}
      <div class="modal-actions touch-payment-actions"><button class="ghost-button" type="button" id="printDraftBtn">Precomprobante</button><button class="primary-button" type="submit" id="confirmPaymentBtn" ${insufficient ? "disabled" : ""}>Confirmar pago</button></div>
    </div>
  `;
  paymentModalContent.querySelectorAll("[data-payment-method]").forEach((button) => {
    button.addEventListener("click", () => {
      paymentDraft.method = button.dataset.paymentMethod;
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
  if (Number(paymentDraft.received || 0) < totals.total) return;
  const response = await apiRequest("/ventas/sales", {
    method: "POST",
    body: {
      customerId: value("#saleCustomer"),
      discount: totals.discount,
      cashReceived: Number(paymentDraft.received || totals.total),
      items: saleCart.map((item) => ({ productId: item.productId, quantity: item.quantity, unitPrice: item.salePrice }))
    }
  });
  localSaleMeta[response.sale.id] = { method: paymentDraft.method, status: "pagada", received: Number(paymentDraft.received || totals.total), createdAt: new Date().toISOString() };
  persistJson(LOCAL_SALE_META_KEY, localSaleMeta);
  saleCart = [];
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
    body: { openingAmount: Number(value("#cashOpeningAmount") || 0) }
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

function cashMovementsTotal() {
  return cashMovements.reduce((sum, item) => sum + (item.type === "ingreso" ? Number(item.amount || 0) : -Number(item.amount || 0)), 0);
}

function cashExpectedTotal() {
  const opening = cashSession?.status === "abierta" ? Number(cashSession.openingAmount || 0) : 0;
  return opening + Number(cash.total || 0) + cashMovementsTotal();
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

function openCustomerModal() {
  customerForm.reset();
  customerModal.showModal();
}

function openCategoryModal() {
  categoryForm.reset();
  categoryModal.showModal();
}

function printTicket(sale, items) {
  const printable = window.open("", "_blank", "width=420,height=720");
  if (!printable) return;
  printable.document.write(`<!doctype html><html><head><meta charset="UTF-8"><title>Ticket ${escapeHtml(sale.code)}</title><style>body{font-family:Arial,sans-serif;padding:18px;max-width:320px;color:#111}h1{font-size:18px;text-align:center;margin:0 0 6px}p{line-height:1.4}table{width:100%;border-collapse:collapse}td{padding:5px 0;border-bottom:1px dashed #aaa}.total{font-weight:800;font-size:18px}.center{text-align:center}.muted{color:#555;font-size:12px}button{margin-bottom:12px}</style></head><body><button onclick="window.print()">Imprimir</button><h1>${escapeHtml(storeSettings.storeName || storeSettings.companyName || currentUser.companyName || "Zow Ventas-Almacen")}</h1><p class="center muted">${escapeHtml(storeSettings.taxId ? `NIT ${storeSettings.taxId}` : "")}<br>${escapeHtml(storeSettings.address || "")}<br>${escapeHtml(storeSettings.phone || "")}</p><p>${escapeHtml(sale.code)}<br>${formatDateTime(sale.created_at)}<br>Cajero: ${escapeHtml(currentUser.name || "")}</p><table>${items.map((item) => `<tr><td>${escapeHtml(item.product_name)} x ${item.quantity}</td><td>${money(item.total)}</td></tr>`).join("")}</table><p>Subtotal ${money(sale.subtotal)}<br>Descuento ${money(sale.discount)}</p><p class="total">Total ${money(sale.total)}</p><p>Efectivo ${money(sale.cash_received)}<br>Cambio ${money(sale.change_amount)}</p><p class="center muted">${escapeHtml(storeSettings.ticketNote || "Gracias por su compra")}</p></body></html>`);
  printable.document.close();
  printable.focus();
}

function printDraftTicket() {
  const totals = cartTotals();
  const sale = {
    code: "PREVENTA",
    subtotal: totals.subtotal,
    discount: totals.discount,
    total: totals.total,
    cash_received: Number(paymentDraft.received || totals.total),
    change_amount: Math.max(Number(paymentDraft.received || 0) - totals.total, 0),
    created_at: new Date().toISOString()
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

async function voidSale(saleId) {
  const sale = sales.find((item) => item.id === saleId);
  if (!sale || !confirm(`Anular venta ${sale.code}?`)) return;
  try {
    const response = await apiRequest(`/ventas/sales/${saleId}/void`, { method: "POST", body: {} });
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
      ticketNote: value("#storeTicketNote")
    }
  });
  storeSettings = response.settings;
  await render();
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
    phone: value("#ventasUserPhone").trim()
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
  const quantityValue = window.prompt(`Cantidad para ${type} de ${product.name}`, "1");
  if (quantityValue === null) return;
  const quantity = Number(quantityValue);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    window.alert("Ingresa una cantidad valida.");
    return;
  }
  const reference = window.prompt("Referencia del movimiento", type === "entrada" ? "Compra / reposicion" : "Control de stock") || "";
  const note = window.prompt("Nota interna", "") || "";
  await apiRequest(`/ventas/products/${product.id}/movements`, {
    method: "POST",
    body: { type, quantity, reference, note }
  });
  await render();
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
    { id: "efectivo", label: "Efectivo" },
    { id: "tarjeta", label: "Tarjeta" },
    { id: "transferencia", label: "Transferencia" },
    { id: "qr", label: "QR" },
    { id: "mixto", label: "Pago mixto" }
  ];
}
function paymentLabel(id) { return paymentMethods().find((method) => method.id === id)?.label || "Efectivo"; }
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
function canAccessView(view) { return accessibleViewsForRole(currentUser?.role).includes(view); }
function defaultViewForRole() { return accessibleViewsForRole(currentUser?.role)[0] || "summary"; }
function accessibleViewsForRole(role) {
  const views = {
    admin: ["sell", "summary", "alerts", "finance", "history", "routes", "promotions", "reports", "catalog", "customers", "inventory", "users", "settings"],
    ventas_admin: ["sell", "summary", "alerts", "finance", "history", "routes", "promotions", "reports", "catalog", "customers", "inventory", "settings"],
    cajero: ["sell", "finance", "history", "customers", "summary"],
    vendedor: ["sell", "customers", "summary"],
    almacen: ["inventory", "alerts", "routes", "reports", "catalog", "summary"],
    supervisor: ["sell", "summary", "alerts", "finance", "history", "routes", "promotions", "reports", "catalog", "customers", "inventory"],
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
