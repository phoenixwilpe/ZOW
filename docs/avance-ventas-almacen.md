# Control de avance - Zow Ventas-Almacen

Este documento sirve para medir cuanto falta para considerar el sistema listo para pruebas comerciales reales. El porcentaje es una guia practica, no una certificacion final.

## Estado general

Avance estimado actual: 99%

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
- Inventario: productos, stock, costos, precios, favoritos POS persistentes por empresa, Kardex y movimientos.
- Compras: proveedores, entradas de mercaderia, orden imprimible y actualizacion de stock.
- Ordenes de compra persistentes: pendiente, recibida y cancelada.
- Alertas de stock minimo, compra sugerida y exportacion de reposicion.
- Lotes y vencimientos: alerta, bloqueo de venta vencida y aviso de productos por vencer.
- Devoluciones de clientes: parcial/total, reposicion de stock y egreso de caja.
- Permisos finos por rol para acciones sensibles de caja, stock, compras, usuarios y configuracion.
- Importacion masiva de productos por plantilla Excel/CSV con actualizacion por codigo desde backend.
- Busqueda y escaneo por codigo de barras: foco POS, Enter automatico, cantidades rapidas y campo barcode por producto.
- Caja amarrada a sesion real: cada venta queda ligada a la caja abierta y el cierre solo toma ventas de esa sesion.
- Venta con datos historicos por item: descuento, subtotal y costo al momento de vender para utilidad real.
- Auditoria comercial visible: ventas, anulaciones, devoluciones, cobros, caja y stock quedan consultables en reportes.
- Reporte de utilidad por producto y periodo usando costo historico, venta neta, descuento y margen.
- Ventas suspendidas en base de datos: se pueden recuperar desde otra sesion/equipo y quedan auditadas.
- Favoritos POS en base de datos: se comparten entre cajas de la empresa, respetan limite operativo y quedan auditados.
- Promociones reales basicas: reglas por producto, vigencia, cantidad minima, descuento automatico en POS y auditoria.
- Plan de pruebas funcionales con casos reales por rol, flujo y evidencia esperada.
- Manual rapido por rol para encargado, cajero, almacen, supervisor y vendedor.
- Kit comercial con demos por rubro, checklist de instalacion, guion de presentacion y planes sugeridos.
- Politicas de seguridad y datos SaaS documentadas, con no-cache aplicado a respuestas API sensibles.
- Modo PWA instalable para caja tactil con manifest, service worker, icono y guia de instalacion.
- Panel de promociones avanzado con crear, editar, duplicar, pausar, activar, eliminar y reglas por categoria.
- Reportes CSV: ventas, inventario, clientes y respaldo operativo JSON.
- Despliegue en Vercel y backend PostgreSQL/Supabase.
- Comprobante de venta mas profesional con encabezado comercial, detalle, datos de pago, codigo visual y pie ZOW.
- Cierre de caja mejorado con desglose por metodo, ingresos, egresos, esperado, contado y comprobante de cierre.
- Permisos mas estrictos: cajero vende y cobra, pero anulaciones y devoluciones quedan para encargado/supervisor.
- Panel de actividad operativa con estado de caja, ultima venta, alertas y auditoria visible.
- Reporte de inventario valorizado con costo en stock, venta potencial, margen estimado y productos de mayor valor.
- Kardex visual por producto con linea de movimientos, entrada/salida, responsable, referencia y saldo por movimiento.
- Asistente de configuracion inicial para encargado con avance por datos de empresa, cajas, usuarios, productos y caja de prueba.
- Validaciones reforzadas en productos y configuracion para evitar codigos duplicados, precios bajo costo, stock negativo e impuestos invalidos.
- Ajustes responsivos para que actividad, cierre detallado, Kardex y configuracion se acomoden mejor en celular/tablet.
- Centro de avisos interno con contador en barra superior para caja abierta, ventas sin cierre, stock critico, vencimientos, cuentas por cobrar y acciones sensibles.
- Observacion de cierre de caja persistente: se guarda en la base de datos, historial y comprobante imprimible.
- Panel de salud del negocio en reportes con puntaje ejecutivo sobre ventas, inventario, vencimientos, caja, deuda y margen.

## Faltante prioritario

1. Combos comerciales avanzados: paquetes con varios productos y precio final fijo.
2. Ajustes finales de experiencia movil.
3. Validacion asistida de importaciones grandes con vista previa de filas observadas.

## Omitido por ahora

- Cierre de caja con desglose imprimible por metodo de pago, devoluciones y creditos cobrados.

## Despues

- Facturacion o integracion fiscal si el cliente lo requiere.
- App movil nativa, si el cliente necesita operacion fuera del navegador.
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
