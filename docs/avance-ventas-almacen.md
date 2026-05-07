# Control de avance - Zow Ventas-Almacen

Este documento sirve para medir cuanto falta para considerar el sistema listo para pruebas comerciales reales. El porcentaje es una guia practica, no una certificacion final.

## Estado general

Avance estimado actual: 72%

## Completado

- Multiempresa SaaS con datos separados por empresa.
- Acceso al sistema desde el Panel ZOW.
- Encargado de sistema creado desde el panel principal.
- Login propio para Ventas-Almacen.
- Roles principales: encargado, operador integral, cajero, almacen, vendedor y supervisor.
- Configuracion de tienda: nombre, moneda, impuesto, comprobante, cajas y reglas de credito/descuentos.
- Registro y edicion de usuarios de la empresa.
- POS tactil: busqueda, carrito, cantidades, descuentos, cobro y comprobante.
- Caja: apertura, cierre, conteo, movimientos manuales y comprobante de cierre.
- Historial de ventas, anulacion con devolucion de stock y reimpresion.
- Clientes, cuentas por cobrar y analisis de riesgo.
- Inventario: productos, stock, costos, precios, favoritos POS, Kardex y movimientos.
- Compras: proveedores, entradas de mercaderia, orden imprimible y actualizacion de stock.
- Ordenes de compra persistentes: pendiente, recibida y cancelada.
- Alertas de stock minimo, compra sugerida y exportacion de reposicion.
- Lotes y vencimientos: alerta, bloqueo de venta vencida y aviso de productos por vencer.
- Reportes CSV: ventas, inventario, clientes y respaldo operativo JSON.
- Despliegue en Vercel y backend PostgreSQL/Supabase.

## Faltante prioritario

1. Devoluciones de clientes: registrar devolucion parcial o total y afectar caja/stock.
2. Permisos finos por rol: definir acciones exactas por pantalla y bloquear botones no autorizados.
3. Importacion masiva de productos desde CSV/Excel.
4. Busqueda por codigo de barras real con foco automatico para lector USB.
5. Auditoria visible: quien cambio precio, stock, usuario, caja o configuracion.
6. Reporte de utilidad por producto y por periodo con costo historico.
7. Dashboard de ventas del dia para encargado.
8. Respaldo/restauracion guiada por empresa.
9. Pruebas funcionales documentadas con casos reales.
10. Ajustes finales de experiencia movil y manuales cortos por rol.

## Despues

- Facturacion o integracion fiscal si el cliente lo requiere.
- App movil o modo PWA instalable.
- Sucursales y traspasos, cuando decidamos ampliar a mas de un punto.
- Notificaciones por correo o WhatsApp, cuando se active esa etapa.
- Modulo de compras avanzado con aprobaciones.

## Criterio para decir "listo para vender"

- El cajero puede vender, cobrar, imprimir y cerrar caja sin ayuda tecnica.
- El encargado puede crear usuarios, configurar tienda y revisar reportes.
- Almacen puede registrar productos, compras, stock y vencimientos.
- Los datos quedan guardados por empresa sin mezclarse.
- Las acciones criticas tienen auditoria.
- Existe una guia corta de uso para cajero, almacen y encargado.
