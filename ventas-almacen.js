const API_BASE_URL = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
  ? "http://localhost:4174/api"
  : "/api";
const TOKEN_KEY = "zowVentasAlmacen.token";
const SESSION_KEY = "zowVentasAlmacen.session";

let currentUser = loadSession();
let activeView = "summary";
let products = [];
let customers = [];
let categories = [];
let sales = [];
let cash = { pendingSales: [], total: 0 };
let summary = {};
let saleCart = [];
let storeSettings = { companyName: "", storeName: "", currency: "BOB", taxId: "", phone: "", address: "", ticketNote: "" };

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
    renderMain();
  });
});

document.querySelector("#showProductForm").addEventListener("click", openProductModal);
document.querySelector("#closeProductModal").addEventListener("click", () => productModal.close());
document.querySelector("#cancelProductModal").addEventListener("click", () => productModal.close());
document.querySelector("#closeCustomerModal").addEventListener("click", () => customerModal.close());
document.querySelector("#cancelCustomerModal").addEventListener("click", () => customerModal.close());
document.querySelector("#closeCategoryModal").addEventListener("click", () => categoryModal.close());
document.querySelector("#cancelCategoryModal").addEventListener("click", () => categoryModal.close());

productForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await apiRequest("/ventas/products", {
    method: "POST",
    body: {
      code: value("#productCode"),
      name: value("#productName"),
      category: value("#productCategory"),
      unit: value("#productUnit"),
      costPrice: Number(value("#productCost")),
      salePrice: Number(value("#productSale")),
      minStock: Number(value("#productMin")),
      stock: Number(value("#productStock"))
    }
  });
  productModal.close();
  await render();
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
    const [settingsResponse, summaryResponse, productsResponse, customersResponse, categoriesResponse, salesResponse, cashResponse] = await Promise.all([
      apiRequest("/ventas/settings"),
      apiRequest("/ventas/summary"),
      apiRequest("/ventas/products"),
      apiRequest("/ventas/customers"),
      apiRequest("/ventas/categories"),
      apiRequest("/ventas/sales"),
      apiRequest("/ventas/cash")
    ]);
    storeSettings = settingsResponse.settings || storeSettings;
    summary = summaryResponse.summary || {};
    products = productsResponse.products || [];
    customers = customersResponse.customers || [];
    categories = categoriesResponse.categories || [];
    sales = salesResponse.sales || [];
    cash = cashResponse || { pendingSales: [], total: 0 };
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
    catalog: ["Catalogos", "Articulos y categorias"],
    customers: ["Clientes", "Base de clientes"],
    inventory: ["Inventario", "Stock y reabastecimiento"],
    settings: ["Configuracion", "Tienda, moneda y datos de impresion"]
  };
  document.querySelector("#viewEyebrow").textContent = titles[activeView][0];
  document.querySelector("#viewTitle").textContent = titles[activeView][1];
  renderWorkflow();
  const renderers = { summary: renderSummary, alerts: renderAlerts, sell: renderSell, finance: renderFinance, catalog: renderCatalog, customers: renderCustomers, inventory: renderInventory, settings: renderSettings };
  renderers[activeView]();
}

function renderWorkflow() {
  const panel = document.querySelector("#workflowPanel");
  const actions = {
    summary: [`<strong>Resumen operativo</strong><span>Consulta ventas, ingresos, productos y alertas de stock.</span>`, ""],
    alerts: [`<strong>Alertas de stock</strong><span>Repone productos agotados o por debajo del minimo.</span>`, ""],
    sell: [`<strong>Nueva venta</strong><span>Agrega productos, cliente, descuento y efectivo recibido.</span>`, ""],
    finance: [`<strong>Caja</strong><span>Controla ventas pendientes de cierre y procesa cortes.</span>`, `<button class="primary-button" type="button" id="closeCashBtn">Procesar caja</button>`],
    catalog: [`<strong>Catalogos</strong><span>Administra articulos y categorias.</span>`, `<button class="ghost-button" type="button" id="newCategoryBtn">Nueva categoria</button><button class="primary-button" type="button" id="newProductBtn">Nuevo producto</button>`],
    customers: [`<strong>Clientes</strong><span>Registra compradores frecuentes para ventas y tienda virtual.</span>`, `<button class="primary-button" type="button" id="newCustomerBtn">Nuevo cliente</button>`],
    inventory: [`<strong>Inventario</strong><span>Controla stock actual y regulariza entradas o salidas.</span>`, `<button class="primary-button" type="button" id="newProductInventoryBtn">Nuevo producto</button>`],
    settings: [`<strong>Configuracion comercial</strong><span>Define datos de tienda, moneda y textos del comprobante.</span>`, ""]
  };
  panel.innerHTML = `<div>${actions[activeView][0]}</div><div class="admin-actions">${actions[activeView][1]}</div>`;
  document.querySelector("#newProductBtn")?.addEventListener("click", openProductModal);
  document.querySelector("#newProductInventoryBtn")?.addEventListener("click", openProductModal);
  document.querySelector("#newCategoryBtn")?.addEventListener("click", openCategoryModal);
  document.querySelector("#newCustomerBtn")?.addEventListener("click", openCustomerModal);
  document.querySelector("#closeCashBtn")?.addEventListener("click", closeCash);
}

function renderSummary() {
  setCount("Resumen");
  mainList().innerHTML = `
    <section class="setup-overview">
      <article><span>Clientes</span><strong>${customers.length}</strong></article>
      <article><span>Ventas</span><strong>${summary.sales || 0}</strong></article>
      <article><span>Ingresos</span><strong>${money(summary.income || 0)}</strong></article>
    </section>
    <section class="admin-panel">
      <div class="admin-panel-head"><div><p class="eyebrow">Ultimas ventas</p><h3>Movimiento comercial</h3></div></div>
      <div class="admin-list">${sales.slice(0, 6).map(renderSaleRow).join("") || empty("Sin ventas registradas")}</div>
    </section>
  `;
}

function renderAlerts() {
  const alerts = products.filter((product) => Number(product.stock || 0) <= Number(product.min_stock || 0));
  setCount(`${alerts.length} alerta${alerts.length === 1 ? "" : "s"}`);
  mainList().innerHTML = alerts.map(renderProductRow).join("") || empty("No hay alertas de stock");
}

function renderSell() {
  setCount(`${saleCart.length} item${saleCart.length === 1 ? "" : "s"}`);
  const subtotal = saleCart.reduce((sum, item) => sum + item.quantity * item.salePrice, 0);
  mainList().innerHTML = `
    <section class="admin-panel">
      <div class="admin-panel-head"><div><p class="eyebrow">Productos</p><h3>Agregar a venta</h3></div></div>
      <div class="admin-list">${products.map(renderSellProduct).join("") || empty("Registra productos para vender")}</div>
    </section>
    <section class="admin-panel">
      <div class="admin-panel-head"><div><p class="eyebrow">Venta actual</p><h3>Total ${money(subtotal)}</h3></div></div>
      <form class="admin-form" id="saleForm">
        <div class="admin-list">${saleCart.map(renderCartItem).join("") || empty("Agrega productos a la venta")}</div>
        <div class="form-grid">
          <label>Cliente<select id="saleCustomer"><option value="">Cliente sin registrar</option>${customers.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("")}</select></label>
          <label>Descuento<input id="saleDiscount" type="number" min="0" step="0.01" value="0" /></label>
          <label>Efectivo<input id="saleCash" type="number" min="0" step="0.01" value="${subtotal.toFixed(2)}" /></label>
        </div>
        <div class="modal-actions"><button class="primary-button" type="submit">Confirmar venta</button></div>
      </form>
    </section>
  `;
  document.querySelectorAll("[data-add-product]").forEach((button) => button.addEventListener("click", () => addToCart(button.dataset.addProduct)));
  document.querySelectorAll("[data-remove-cart]").forEach((button) => button.addEventListener("click", () => removeFromCart(button.dataset.removeCart)));
  document.querySelector("#saleForm")?.addEventListener("submit", submitSale);
}

function renderFinance() {
  setCount(`${sales.length} venta${sales.length === 1 ? "" : "s"}`);
  mainList().innerHTML = `
    <section class="setup-overview">
      <article><span>Pendiente caja</span><strong>${cash.pendingSales?.length || 0}</strong></article>
      <article><span>Monto pendiente</span><strong>${money(cash.total || 0)}</strong></article>
      <article><span>Ingreso total</span><strong>${money(summary.income || 0)}</strong></article>
    </section>
    <section class="admin-panel"><div class="admin-list">${sales.map(renderSaleRow).join("") || empty("Sin ventas")}</div></section>
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
  setCount(`${products.length} producto${products.length === 1 ? "" : "s"}`);
  mainList().innerHTML = products.map(renderProductRow).join("") || empty("Sin productos");
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
      <div class="admin-panel-head"><div><p class="eyebrow">Roles recomendados</p><h3>Operacion por permisos</h3></div></div>
      <div class="setup-overview">
        <article><span>Administrador ventas</span><strong>Todo</strong></article>
        <article><span>Cajero / vendedor</span><strong>Ventas</strong></article>
        <article><span>Almacen</span><strong>Stock</strong></article>
      </div>
    </section>
  `;
  document.querySelector("#storeSettingsForm")?.addEventListener("submit", saveStoreSettings);
}

function renderProductRow(product) {
  return `<article class="admin-row"><div><strong>${escapeHtml(product.name)}</strong><span>${escapeHtml(product.code)} / ${escapeHtml(product.category || "Sin categoria")} / ${escapeHtml(product.unit)}</span><span>Stock ${num(product.stock)} / Minimo ${num(product.min_stock)}</span></div><div class="admin-row-meta"><span>Costo ${money(product.cost_price)}</span><span>Venta ${money(product.sale_price)}</span><span class="${Number(product.stock || 0) <= Number(product.min_stock || 0) ? "danger-text" : "ok-text"}">${Number(product.stock || 0) <= Number(product.min_stock || 0) ? "Bajo minimo" : "Stock OK"}</span></div></article>`;
}

function renderSellProduct(product) {
  return `<article class="admin-row"><div><strong>${escapeHtml(product.name)}</strong><span>${escapeHtml(product.code)} / Stock ${num(product.stock)} / ${money(product.sale_price)}</span></div><button class="primary-button" type="button" data-add-product="${product.id}" ${Number(product.stock || 0) <= 0 ? "disabled" : ""}>+</button></article>`;
}

function renderCartItem(item) {
  return `<article class="admin-row"><div><strong>${escapeHtml(item.name)}</strong><span>${item.quantity} x ${money(item.salePrice)} = ${money(item.quantity * item.salePrice)}</span></div><button class="ghost-button" type="button" data-remove-cart="${item.productId}">Quitar</button></article>`;
}

function renderSaleRow(sale) {
  return `<article class="admin-row"><div><strong>${escapeHtml(sale.code)}</strong><span>${escapeHtml(sale.customer_name || "Cliente sin registrar")} / ${escapeHtml(sale.seller_name || "Vendedor")}</span><span>${formatDateTime(sale.created_at)}</span></div><div class="admin-row-meta"><span>Total ${money(sale.total)}</span><span>${sale.cash_closed ? "Caja cerrada" : "Pendiente caja"}</span></div></article>`;
}

function addToCart(productId) {
  const product = products.find((item) => item.id === productId);
  if (!product) return;
  const existing = saleCart.find((item) => item.productId === productId);
  if (existing) existing.quantity += 1;
  else saleCart.push({ productId, name: product.name, quantity: 1, salePrice: Number(product.sale_price || 0) });
  renderMain();
}

function removeFromCart(productId) {
  saleCart = saleCart.filter((item) => item.productId !== productId);
  renderMain();
}

async function submitSale(event) {
  event.preventDefault();
  const response = await apiRequest("/ventas/sales", {
    method: "POST",
    body: {
      customerId: value("#saleCustomer"),
      discount: Number(value("#saleDiscount")),
      cashReceived: Number(value("#saleCash")),
      items: saleCart.map((item) => ({ productId: item.productId, quantity: item.quantity, unitPrice: item.salePrice }))
    }
  });
  saleCart = [];
  await render();
  printTicket(response.sale, response.items);
}

async function closeCash() {
  if (!cash.pendingSales?.length) return;
  await apiRequest("/ventas/cash/close", { method: "POST", body: {} });
  await render();
}

function openProductModal() {
  productForm.reset();
  document.querySelector("#productUnit").value = "Unidad";
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

async function assertVentasAccess() {
  if (currentUser?.role === "zow_owner") throw new Error("El panel ZOW administra empresas. Ingresa con un usuario de empresa.");
  const response = await apiRequest("/auth/systems");
  if (!(response.systems || []).some((system) => system.id === "ventas_almacen")) throw new Error("Esta empresa no tiene activo Zow Ventas-Almacen.");
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
function roleLabel(role) { return { admin: "Encargado de sistema", recepcion_principal: "Recepcion principal", recepcion_secundaria: "Recepcion secundaria", funcionario: "Funcionario", supervisor: "Secretario / Director", ventas_admin: "Administrador ventas", cajero: "Cajero", almacen: "Almacen", vendedor: "Vendedor" }[role] || role; }
function canAccessView(view) { return accessibleViewsForRole(currentUser?.role).includes(view); }
function defaultViewForRole() { return accessibleViewsForRole(currentUser?.role)[0] || "summary"; }
function accessibleViewsForRole(role) {
  const views = {
    admin: ["summary", "alerts", "sell", "finance", "catalog", "customers", "inventory", "settings"],
    ventas_admin: ["summary", "alerts", "sell", "finance", "catalog", "customers", "inventory", "settings"],
    cajero: ["summary", "sell", "finance", "customers"],
    vendedor: ["summary", "sell", "customers"],
    almacen: ["summary", "alerts", "catalog", "inventory"],
    supervisor: ["summary", "alerts", "sell", "finance", "catalog", "customers", "inventory"],
    funcionario: ["summary", "sell", "customers"]
  };
  return views[role] || ["summary"];
}
function escapeHtml(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
