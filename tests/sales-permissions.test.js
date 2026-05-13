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
