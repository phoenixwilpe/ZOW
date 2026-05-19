const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "zow-sales-permissions-"));
process.env.DATABASE_PROVIDER = "sqlite";
process.env.SQLITE_DIR = tempDir;
process.env.SQLITE_PATH = path.join(tempDir, "test.sqlite");
process.env.JWT_SECRET = "test-permissions-secret";
process.env.SEED_VENTAS_ADMIN_PASSWORD = "TestVentasAdmin2026#";
process.env.SEED_CAJERO_PASSWORD = "TestCajero2026#";
process.env.SEED_ALMACEN_PASSWORD = "TestAlmacen2026#";
process.env.SEED_VENDEDOR_PASSWORD = "TestVendedor2026#";
process.env.SEED_DIRECTOR_PASSWORD = "TestSupervisor2026#";
process.env.SYSTEM_PASSWORD = "TestSistema2026#";
process.env.ZOW_OWNER_PASSWORD = "TestOwner2026#";

const app = require("../backend/server");
const { db } = require("../backend/db");

let server;
let baseUrl;

test.before(async () => {
  server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  db.close();
  fs.rmSync(tempDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 80 });
});

test("matriz de permisos de ventas se entrega desde el backend", async () => {
  const token = await login("ventas.admin@zow.com", "TestVentasAdmin2026#");
  const response = await request("/ventas/permissions", { token });
  assert.equal(response.status, 200);
  assert.equal(response.body.role, "ventas_admin");
  assert.ok(response.body.views.includes("sell"));
  assert.ok(response.body.roles.some((role) => role.key === "cajero" && role.views.includes("finance")));
  const supervisorRole = response.body.roles.find((role) => role.key === "supervisor");
  assert.ok(supervisorRole);
  assert.equal(supervisorRole.views.includes("sell"), false);
  assert.ok(supervisorRole.views.includes("reports"));
});

test("cajero no puede operar funciones administrativas de ventas", async () => {
  const token = await login("cajero@zow.com", "TestCajero2026#");
  await expectStatus("/ventas/audit", { token }, 403);
  await expectStatus("/ventas/products", {
    method: "POST",
    token,
    body: { code: "TEST-CAJA", name: "Producto bloqueado", category: "Test", salePrice: 10, costPrice: 5, stock: 1 }
  }, 403);
  await expectStatus("/ventas/cash/movements", {
    method: "POST",
    token,
    body: { type: "ingreso", amount: 10, reason: "Intento sin permiso" }
  }, 403);
});

test("almacen no puede vender ni mover caja, pero si consultar compras", async () => {
  const token = await login("almacen@zow.com", "TestAlmacen2026#");
  await expectStatus("/ventas/sales", {
    method: "POST",
    token,
    body: { items: [{ productId: "no-real", quantity: 1 }], paymentMethod: "efectivo" }
  }, 403);
  await expectStatus("/ventas/cash/open", {
    method: "POST",
    token,
    body: { openingAmount: 100 }
  }, 403);
  await expectStatus("/ventas/purchases", { token }, 200);
});

test("vendedor no puede gestionar inventario ni promociones", async () => {
  const token = await login("vendedor@zow.com", "TestVendedor2026#");
  const permissionsResponse = await request("/ventas/permissions", { token });
  assert.equal(permissionsResponse.status, 200);
  assert.equal(permissionsResponse.body.views.includes("sell"), false);
  assert.ok(permissionsResponse.body.views.includes("customers"));
  await expectStatus("/ventas/products", {
    method: "POST",
    token,
    body: { code: "TEST-VEND", name: "Producto bloqueado", category: "Test", salePrice: 10, costPrice: 5, stock: 1 }
  }, 403);
  await expectStatus("/ventas/promotions", {
    method: "POST",
    token,
    body: { name: "Promo bloqueada", scopeType: "global", discountType: "percent", discountValue: 5 }
  }, 403);
  await expectStatus("/ventas/sales", {
    method: "POST",
    token,
    body: { items: [{ productId: "no-real", quantity: 1 }], paymentMethod: "efectivo" }
  }, 403);
  await expectStatus("/ventas/sales/no-real/pay", {
    method: "POST",
    token,
    body: { amount: 10, paymentMethod: "efectivo" }
  }, 403);
});

test("supervisor revisa caja pero no abre ni cierra turnos", async () => {
  const token = await login("director@zow.com", "TestSupervisor2026#");
  const permissionsResponse = await request("/ventas/permissions", { token });
  assert.equal(permissionsResponse.status, 200);
  assert.equal(permissionsResponse.body.views.includes("finance"), true);
  assert.equal(permissionsResponse.body.views.includes("sell"), false);
  await expectStatus("/ventas/cash/open", {
    method: "POST",
    token,
    body: { registerNumber: 1, openingAmount: 100 }
  }, 403);
  await expectStatus("/ventas/cash/close", {
    method: "POST",
    token,
    body: { countedAmount: 100, note: "Intento sin permiso" }
  }, 403);
});

test("supervisor consulta compras pero no registra ni recibe mercaderia", async () => {
  const token = await login("director@zow.com", "TestSupervisor2026#");
  await expectStatus("/ventas/purchases", { token }, 200);
  await expectStatus("/ventas/suppliers", {
    method: "POST",
    token,
    body: { name: "Proveedor bloqueado" }
  }, 403);
  await expectStatus("/ventas/purchases", {
    method: "POST",
    token,
    body: { supplierName: "Proveedor bloqueado", items: [{ productId: "no-real", quantity: 1, unitCost: 1 }] }
  }, 403);
  await expectStatus("/ventas/purchases/no-real/receive", { method: "PATCH", token }, 403);
});

test("venta real descuenta stock y anulacion lo devuelve", async () => {
  const token = await login("ventas.admin@zow.com", "TestVentasAdmin2026#");
  const productCode = `FLOW-${Date.now()}`;
  const productResponse = await request("/ventas/products", {
    method: "POST",
    token,
    body: {
      code: productCode,
      name: "Producto flujo venta",
      category: "Pruebas",
      unit: "Unidad",
      costPrice: 7,
      salePrice: 12,
      minStock: 2,
      stock: 8
    }
  });
  assert.equal(productResponse.status, 201, JSON.stringify(productResponse.body));
  const product = productResponse.body.product;

  const openCashResponse = await request("/ventas/cash/open", {
    method: "POST",
    token,
    body: { registerNumber: 1, openingAmount: 100 }
  });
  assert.equal(openCashResponse.status, 201, JSON.stringify(openCashResponse.body));

  const saleResponse = await request("/ventas/sales", {
    method: "POST",
    token,
    body: {
      customerName: "Cliente prueba",
      items: [{ productId: product.id, quantity: 2, unitPrice: 12, discount: 0 }],
      paymentMethod: "efectivo",
      cashReceived: 30,
      discount: 0,
      note: "Prueba automatizada de flujo POS"
    }
  });
  assert.equal(saleResponse.status, 201, JSON.stringify(saleResponse.body));
  assert.equal(Number(saleResponse.body.sale.total), 24);
  assert.equal(Number(saleResponse.body.sale.change_amount), 6);

  let updatedProduct = await getProductByCode(productCode, token);
  assert.equal(Number(updatedProduct.stock), 6);

  const voidResponse = await request(`/ventas/sales/${saleResponse.body.sale.id}/void`, {
    method: "POST",
    token,
    body: { reason: "Prueba automatizada de anulacion" }
  });
  assert.equal(voidResponse.status, 200, JSON.stringify(voidResponse.body));
  assert.equal(voidResponse.body.sale.status, "anulada");

  updatedProduct = await getProductByCode(productCode, token);
  assert.equal(Number(updatedProduct.stock), 8);
});

test("venta a credito registra deuda y pagos parcial y total", async () => {
  const token = await login("ventas.admin@zow.com", "TestVentasAdmin2026#");
  const suffix = Date.now();
  const productResponse = await request("/ventas/products", {
    method: "POST",
    token,
    body: {
      code: `CRED-${suffix}`,
      name: "Producto credito prueba",
      category: "Pruebas",
      unit: "Unidad",
      costPrice: 15,
      salePrice: 25,
      minStock: 1,
      stock: 5
    }
  });
  assert.equal(productResponse.status, 201, JSON.stringify(productResponse.body));

  const customerResponse = await request("/ventas/customers", {
    method: "POST",
    token,
    body: {
      name: "Cliente credito prueba",
      phone: "70000000",
      ci: `CI-${suffix}`,
      creditLimit: 200
    }
  });
  assert.equal(customerResponse.status, 201, JSON.stringify(customerResponse.body));

  const saleResponse = await request("/ventas/sales", {
    method: "POST",
    token,
    body: {
      customerId: customerResponse.body.customer.id,
      items: [{ productId: productResponse.body.product.id, quantity: 2, unitPrice: 25, discount: 0 }],
      paymentMethod: "credito",
      cashReceived: 10,
      discount: 0,
      note: "Prueba automatizada de credito"
    }
  });
  assert.equal(saleResponse.status, 201, JSON.stringify(saleResponse.body));
  assert.equal(Number(saleResponse.body.sale.total), 50);
  assert.equal(Number(saleResponse.body.sale.amount_paid), 10);
  assert.equal(Number(saleResponse.body.sale.balance_due), 40);
  assert.equal(saleResponse.body.sale.payment_status, "pendiente");

  let receivable = await getReceivable(saleResponse.body.sale.id, token);
  assert.equal(Number(receivable.balance_due), 40);

  const partialPay = await request(`/ventas/sales/${saleResponse.body.sale.id}/pay`, {
    method: "POST",
    token,
    body: { amount: 15, paymentMethod: "efectivo" }
  });
  assert.equal(partialPay.status, 200, JSON.stringify(partialPay.body));
  assert.equal(Number(partialPay.body.sale.amount_paid), 25);
  assert.equal(Number(partialPay.body.sale.balance_due), 25);
  assert.equal(partialPay.body.sale.payment_status, "pendiente");

  receivable = await getReceivable(saleResponse.body.sale.id, token);
  assert.equal(Number(receivable.balance_due), 25);

  const finalPay = await request(`/ventas/sales/${saleResponse.body.sale.id}/pay`, {
    method: "POST",
    token,
    body: { amount: 25, paymentMethod: "qr" }
  });
  assert.equal(finalPay.status, 200, JSON.stringify(finalPay.body));
  assert.equal(Number(finalPay.body.sale.balance_due), 0);
  assert.equal(finalPay.body.sale.payment_status, "pagada");

  const receivablesResponse = await request("/ventas/receivables", { token });
  assert.equal(receivablesResponse.status, 200, JSON.stringify(receivablesResponse.body));
  assert.equal(receivablesResponse.body.receivables.some((sale) => sale.id === saleResponse.body.sale.id), false);
});

test("orden de compra pendiente al recibirse aumenta stock y Kardex", async () => {
  const token = await login("ventas.admin@zow.com", "TestVentasAdmin2026#");
  const suffix = Date.now();
  const productResponse = await request("/ventas/products", {
    method: "POST",
    token,
    body: {
      code: `COMP-${suffix}`,
      name: "Producto compra prueba",
      category: "Pruebas",
      unit: "Unidad",
      costPrice: 9,
      salePrice: 14,
      minStock: 3,
      stock: 4
    }
  });
  assert.equal(productResponse.status, 201, JSON.stringify(productResponse.body));

  const supplierResponse = await request("/ventas/suppliers", {
    method: "POST",
    token,
    body: {
      name: "Proveedor prueba",
      phone: "71111111",
      taxId: `NIT-${suffix}`,
      address: "Direccion prueba"
    }
  });
  assert.equal(supplierResponse.status, 201, JSON.stringify(supplierResponse.body));

  const purchaseResponse = await request("/ventas/purchases", {
    method: "POST",
    token,
    body: {
      supplierId: supplierResponse.body.supplier.id,
      invoiceNumber: `FAC-${suffix}`,
      note: "Orden pendiente de prueba",
      status: "pendiente",
      items: [{ productId: productResponse.body.product.id, quantity: 6, unitCost: 10 }]
    }
  });
  assert.equal(purchaseResponse.status, 201, JSON.stringify(purchaseResponse.body));
  assert.equal(purchaseResponse.body.purchase.status, "pendiente");
  assert.equal(Number(purchaseResponse.body.purchase.total), 60);

  let updatedProduct = await getProductByCode(`COMP-${suffix}`, token);
  assert.equal(Number(updatedProduct.stock), 4);

  const receiveResponse = await request(`/ventas/purchases/${purchaseResponse.body.purchase.id}/receive`, {
    method: "PATCH",
    token
  });
  assert.equal(receiveResponse.status, 200, JSON.stringify(receiveResponse.body));
  assert.equal(receiveResponse.body.purchase.status, "recibida");

  updatedProduct = await getProductByCode(`COMP-${suffix}`, token);
  assert.equal(Number(updatedProduct.stock), 10);
  assert.equal(Number(updatedProduct.cost_price), 10);

  const movementsResponse = await request(`/ventas/products/${productResponse.body.product.id}/movements`, { token });
  assert.equal(movementsResponse.status, 200, JSON.stringify(movementsResponse.body));
  assert.ok(movementsResponse.body.movements.some((movement) => movement.reference === purchaseResponse.body.purchase.code && Number(movement.quantity) === 6));
});

test("cierre de caja calcula esperado, diferencia y marca ventas cerradas", async () => {
  const token = await login("ventas.admin@zow.com", "TestVentasAdmin2026#");
  await request("/ventas/cash/close", { method: "POST", token, body: { countedAmount: 1000, note: "Cierre previo de prueba" } });

  const suffix = Date.now();
  const productResponse = await request("/ventas/products", {
    method: "POST",
    token,
    body: {
      code: `CASH-${suffix}`,
      name: "Producto cierre caja",
      category: "Pruebas",
      unit: "Unidad",
      costPrice: 5,
      salePrice: 20,
      minStock: 1,
      stock: 3
    }
  });
  assert.equal(productResponse.status, 201, JSON.stringify(productResponse.body));

  const openCashResponse = await request("/ventas/cash/open", {
    method: "POST",
    token,
    body: { registerNumber: 1, openingAmount: 50 }
  });
  assert.equal(openCashResponse.status, 201, JSON.stringify(openCashResponse.body));

  const saleResponse = await request("/ventas/sales", {
    method: "POST",
    token,
    body: {
      customerName: "Cliente caja",
      items: [{ productId: productResponse.body.product.id, quantity: 1, unitPrice: 20, discount: 0 }],
      paymentMethod: "efectivo",
      cashReceived: 20,
      discount: 0,
      note: "Prueba automatizada de cierre"
    }
  });
  assert.equal(saleResponse.status, 201, JSON.stringify(saleResponse.body));
  assert.equal(Number(saleResponse.body.sale.cash_closed), 0);

  const closeResponse = await request("/ventas/cash/close", {
    method: "POST",
    token,
    body: { countedAmount: 75, note: "Sobrante controlado de prueba" }
  });
  assert.equal(closeResponse.status, 201, JSON.stringify(closeResponse.body));
  assert.equal(Number(closeResponse.body.closure.opening_amount), 50);
  assert.equal(Number(closeResponse.body.closure.total_sales), 20);
  assert.equal(Number(closeResponse.body.closure.expected_amount), 70);
  assert.equal(Number(closeResponse.body.closure.counted_amount), 75);
  assert.equal(Number(closeResponse.body.closure.difference_amount), 5);
  assert.equal(Number(closeResponse.body.closure.sale_count), 1);

  const saleDetailResponse = await request(`/ventas/sales/${saleResponse.body.sale.id}`, { token });
  assert.equal(saleDetailResponse.status, 200, JSON.stringify(saleDetailResponse.body));
  assert.equal(Number(saleDetailResponse.body.sale.cash_closed), 1);

  const cashResponse = await request("/ventas/cash", { token });
  assert.equal(cashResponse.status, 200, JSON.stringify(cashResponse.body));
  assert.equal(cashResponse.body.activeSession || null, null);
});

async function login(username, password) {
  const response = await request("/auth/login", {
    method: "POST",
    body: { username, password }
  });
  assert.equal(response.status, 200, `login failed for ${username}: ${JSON.stringify(response.body)}`);
  assert.ok(response.body.token, `missing token for ${username}`);
  return response.body.token;
}

async function expectStatus(pathname, options, expectedStatus) {
  const response = await request(pathname, options);
  assert.equal(response.status, expectedStatus, `${pathname} expected ${expectedStatus}, got ${response.status}: ${JSON.stringify(response.body)}`);
}

async function getProductByCode(code, token) {
  const response = await request("/ventas/products", { token });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  const product = response.body.products.find((item) => item.code === code);
  assert.ok(product, `No se encontro producto ${code}`);
  return product;
}

async function getReceivable(saleId, token) {
  const response = await request("/ventas/receivables", { token });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  const receivable = response.body.receivables.find((sale) => sale.id === saleId);
  assert.ok(receivable, `No se encontro cuenta por cobrar ${saleId}`);
  return receivable;
}

async function request(pathname, options = {}) {
  const headers = { "Content-Type": "application/json" };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const text = await response.text();
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  return { status: response.status, body };
}
