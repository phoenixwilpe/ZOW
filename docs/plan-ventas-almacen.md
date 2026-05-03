# Plan de trabajo: Zow Ventas-Almacen

Referencia funcional: plataformas de alimentos y bebidas con gestion comercial, operativa y administrativa, venta en ruta, liquidaciones, inventario, despacho, notificaciones, ticket digital, promociones, impresoras, lista de precios, auditorias, dashboard, soporte, capacitacion, mantenimiento y respaldo.

## Fase 1 - Base operativa real

- Separar completamente el acceso de Ventas-Almacen desde `/ventas-almacen.html` y `/ventas-almacen` en Vercel.
- Activar backend Postgres para productos, categorias, clientes, ventas, caja, movimientos y comprobantes.
- Mantener aislamiento por empresa mediante `company_id` en todas las consultas.
- Permitir roles iniciales: encargado/admin ventas, cajero, vendedor, almacen y supervisor.

## Fase 2 - Gestion comercial

- Punto de venta con carrito, cliente, descuento, efectivo, cambio y ticket imprimible.
- Clientes frecuentes con CI/NIT, celular, email y direccion.
- Lista de precios por producto.
- Promociones y paquetes comerciales por temporada o stock disponible.

## Fase 3 - Gestion operativa

- Inventario con stock minimo, entradas, salidas, ajustes y alertas.
- Rutas de venta y reparto por clientes.
- Despacho de pedidos y control de entregas.
- Liquidacion de ventas por cajero, vendedor o ruta.

## Fase 4 - Gestion administrativa

- Reportes de ventas, caja, inventario critico, valor de almacen y margen estimado.
- Auditoria de movimientos, ventas anuladas, ajustes y cierres de caja.
- Configuracion por tienda: nombre comercial, moneda, NIT, telefono, direccion y nota del ticket.

## Fase 5 - SaaS avanzado

- Planes por empresa desde Panel ZOW.
- Usuarios y permisos por tienda o sucursal.
- Respaldo, soporte, capacitacion y mantenimiento como servicios visibles del plan.
- Luego: notificaciones por correo con Resend y tareas pesadas con Inngest.
