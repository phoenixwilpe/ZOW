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
let users = [];
let units = [];
let cash = { pendingSales: [], total: 0 };
let summary = {};
let saleCart = [];
let editingUserId = "";
let productSearch = "";
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
    routes: ["Rutas", "Venta en ruta y despacho"],
    promotions: ["Promociones", "Lista de precios y ofertas"],
    reports: ["Reportes", "Auditoria comercial"],
    catalog: ["Catalogos", "Articulos y categorias"],
    customers: ["Clientes", "Base de clientes"],
    inventory: ["Inventario", "Stock y reabastecimiento"],
    settings: ["Configuracion", "Tienda, moneda y datos de impresion"]
  };
  document.querySelector("#viewEyebrow").textContent = titles[activeView][0];
  document.querySelector("#viewTitle").textContent = titles[activeView][1];
  renderWorkflow();
  const renderers = { summary: renderSummary, alerts: renderAlerts, sell: renderSell, finance: renderFinance, routes: renderRoutes, promotions: renderPromotions, reports: renderReports, catalog: renderCatalog, customers: renderCustomers, inventory: renderInventory, settings: renderSettings };
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
    sell: [`<strong>Nueva venta</strong><span>Agrega productos, cliente, descuento y efectivo recibido.</span>`, ""],
    finance: [`<strong>Caja</strong><span>Controla ventas pendientes de cierre y procesa cortes.</span>`, `<button class="primary-button" type="button" id="closeCashBtn">Procesar caja</button>`],
    routes: [`<strong>Operacion en ruta</strong><span>Organiza clientes, entrega, despacho y seguimiento de vendedores.</span>`, ""],
    promotions: [`<strong>Politica comercial</strong><span>Prepara listas de precios, paquetes y promociones por temporada.</span>`, ""],
    reports: [`<strong>Auditoria comercial</strong><span>Revisa ventas, caja, inventario critico y valor de almacen.</span>`, ""],
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
    ${renderVentasCommandCenter()}
    ${renderServiceStrip()}
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
  const sellProducts = filteredProducts();
  mainList().innerHTML = `
    <section class="admin-panel">
      <div class="admin-panel-head"><div><p class="eyebrow">Productos</p><h3>Agregar a venta</h3></div></div>
      <label class="toolbar-search">Buscar producto<input id="productSearchInput" type="search" value="${escapeHtml(productSearch)}" placeholder="Codigo, nombre o categoria" /></label>
      <div class="admin-list">${sellProducts.map(renderSellProduct).join("") || empty("Sin productos con esa busqueda")}</div>
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
  bindProductSearch();
  document.querySelectorAll("[data-add-product]").forEach((button) => button.addEventListener("click", () => addToCart(button.dataset.addProduct)));
  document.querySelectorAll("[data-remove-cart]").forEach((button) => button.addEventListener("click", () => removeFromCart(button.dataset.removeCart)));
  document.querySelectorAll("[data-cart-dec]").forEach((button) => button.addEventListener("click", () => updateCartQuantity(button.dataset.cartDec, -1)));
  document.querySelectorAll("[data-cart-inc]").forEach((button) => button.addEventListener("click", () => updateCartQuantity(button.dataset.cartInc, 1)));
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
      <div class="admin-list">${products.filter((product) => Number(product.stock || 0) <= Number(product.min_stock || 0)).map(renderProductRow).join("") || empty("Sin riesgos de inventario")}</div>
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
  const inventoryProducts = filteredProducts();
  setCount(`${products.length} producto${products.length === 1 ? "" : "s"}`);
  mainList().innerHTML = `
    <section class="admin-panel">
      <div class="admin-panel-head"><div><p class="eyebrow">Control de stock</p><h3>Inventario operativo</h3></div></div>
      <label class="toolbar-search">Buscar producto<input id="productSearchInput" type="search" value="${escapeHtml(productSearch)}" placeholder="Codigo, nombre o categoria" /></label>
      <div class="admin-list">${inventoryProducts.map(renderInventoryProductRow).join("") || empty("Sin productos con esa busqueda")}</div>
    </section>
  `;
  bindProductSearch();
  document.querySelectorAll("[data-stock-move]").forEach((button) => {
    button.addEventListener("click", () => openStockMovement(button.dataset.stockMove, button.dataset.type));
  });
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
    ${currentUser.role === "admin" ? renderVentasUsersPanel() : ""}
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
  document.querySelector("#ventasUserForm")?.addEventListener("submit", saveVentasUser);
  document.querySelector("#cancelVentasUserEdit")?.addEventListener("click", () => {
    editingUserId = "";
    renderMain();
  });
  document.querySelectorAll("[data-edit-user]").forEach((button) => {
    button.addEventListener("click", () => {
      editingUserId = button.dataset.editUser;
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

function renderProductRow(product) {
  return `<article class="admin-row"><div><strong>${escapeHtml(product.name)}</strong><span>${escapeHtml(product.code)} / ${escapeHtml(product.category || "Sin categoria")} / ${escapeHtml(product.unit)}</span><span>Stock ${num(product.stock)} / Minimo ${num(product.min_stock)}</span></div><div class="admin-row-meta"><span>Costo ${money(product.cost_price)}</span><span>Venta ${money(product.sale_price)}</span><span class="${Number(product.stock || 0) <= Number(product.min_stock || 0) ? "danger-text" : "ok-text"}">${Number(product.stock || 0) <= Number(product.min_stock || 0) ? "Bajo minimo" : "Stock OK"}</span></div></article>`;
}

function renderInventoryProductRow(product) {
  const canMoveStock = ["admin", "ventas_admin", "almacen"].includes(currentUser?.role);
  return `<article class="admin-row inventory-row">
    <div>
      <strong>${escapeHtml(product.name)}</strong>
      <span>${escapeHtml(product.code)} / ${escapeHtml(product.category || "Sin categoria")} / ${escapeHtml(product.unit)}</span>
      <span>Stock ${num(product.stock)} / Minimo ${num(product.min_stock)}</span>
    </div>
    <div class="admin-row-meta">
      <span>Costo ${money(product.cost_price)}</span>
      <span>Venta ${money(product.sale_price)}</span>
      <span class="${Number(product.stock || 0) <= Number(product.min_stock || 0) ? "danger-text" : "ok-text"}">${Number(product.stock || 0) <= Number(product.min_stock || 0) ? "Bajo minimo" : "Stock OK"}</span>
      ${canMoveStock ? `<div class="mini-action-row"><button class="ghost-button" type="button" data-stock-move="${product.id}" data-type="entrada">Entrada</button><button class="ghost-button" type="button" data-stock-move="${product.id}" data-type="salida">Salida</button><button class="ghost-button" type="button" data-stock-move="${product.id}" data-type="ajuste">Ajuste</button></div>` : ""}
    </div>
  </article>`;
}

function renderSellProduct(product) {
  return `<article class="admin-row"><div><strong>${escapeHtml(product.name)}</strong><span>${escapeHtml(product.code)} / Stock ${num(product.stock)} / ${money(product.sale_price)}</span></div><button class="primary-button" type="button" data-add-product="${product.id}" ${Number(product.stock || 0) <= 0 ? "disabled" : ""}>+</button></article>`;
}

function renderCartItem(item) {
  return `<article class="admin-row cart-row"><div><strong>${escapeHtml(item.name)}</strong><span>${item.quantity} x ${money(item.salePrice)} = ${money(item.quantity * item.salePrice)}</span></div><div class="cart-actions"><button class="ghost-button" type="button" data-cart-dec="${item.productId}">-</button><strong>${item.quantity}</strong><button class="ghost-button" type="button" data-cart-inc="${item.productId}">+</button><button class="ghost-button" type="button" data-remove-cart="${item.productId}">Quitar</button></div></article>`;
}

function renderSaleRow(sale) {
  return `<article class="admin-row"><div><strong>${escapeHtml(sale.code)}</strong><span>${escapeHtml(sale.customer_name || "Cliente sin registrar")} / ${escapeHtml(sale.seller_name || "Vendedor")}</span><span>${formatDateTime(sale.created_at)}</span></div><div class="admin-row-meta"><span>Total ${money(sale.total)}</span><span>${sale.cash_closed ? "Caja cerrada" : "Pendiente caja"}</span></div></article>`;
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

function filteredProducts() {
  const term = productSearch.trim().toLowerCase();
  if (!term) return products;
  return products.filter((product) => [product.code, product.name, product.category]
    .some((value) => String(value || "").toLowerCase().includes(term)));
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
  if (existing) existing.quantity += 1;
  else saleCart.push({ productId, name: product.name, quantity: 1, salePrice: Number(product.sale_price || 0) });
  renderMain();
}

function removeFromCart(productId) {
  saleCart = saleCart.filter((item) => item.productId !== productId);
  renderMain();
}

function updateCartQuantity(productId, delta) {
  saleCart = saleCart
    .map((item) => item.productId === productId ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item)
    .filter((item) => item.quantity > 0);
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

async function saveVentasUser(event) {
  event.preventDefault();
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
  await apiRequest(editingUserId ? `/users/${editingUserId}` : "/users", {
    method: editingUserId ? "PATCH" : "POST",
    body: payload
  });
  editingUserId = "";
  await render();
}

async function toggleVentasUser(userId) {
  const user = users.find((item) => item.id === userId);
  if (!user || user.protected || user.id === currentUser.id) return;
  await apiRequest(`/users/${user.id}/status`, { method: "PATCH", body: { active: !user.active } });
  await render();
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
function canAccessView(view) { return accessibleViewsForRole(currentUser?.role).includes(view); }
function defaultViewForRole() { return accessibleViewsForRole(currentUser?.role)[0] || "summary"; }
function accessibleViewsForRole(role) {
  const views = {
    admin: ["summary", "alerts", "sell", "finance", "routes", "promotions", "reports", "catalog", "customers", "inventory", "settings"],
    ventas_admin: ["summary", "alerts", "sell", "finance", "routes", "promotions", "reports", "catalog", "customers", "inventory", "settings"],
    cajero: ["summary", "sell", "finance", "routes", "customers", "reports"],
    vendedor: ["summary", "sell", "routes", "promotions", "customers"],
    almacen: ["summary", "alerts", "routes", "reports", "catalog", "inventory"],
    supervisor: ["summary", "alerts", "sell", "finance", "routes", "promotions", "reports", "catalog", "customers", "inventory"],
    funcionario: ["summary", "sell", "routes", "customers"]
  };
  return views[role] || ["summary"];
}
function escapeHtml(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
