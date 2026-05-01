# Zow Ventas-Almacen - base funcional

Adaptacion inicial basada en el manual de usuario entregado como referencia. El sistema se separa de Correspondencia ZOW y funciona como SaaS activable por empresa desde el panel ZOW.

## Modulos

- Resumen: productos, clientes, ventas, ingresos, stock total y alertas.
- Alertas: productos con stock cero o menor/igual al minimo configurado.
- Vender: carrito de venta, cliente, descuento, efectivo, cambio y ticket imprimible.
- Finanzas: ventas realizadas y caja pendiente de cierre.
- Caja: procesamiento de ventas pendientes y generacion de corte de caja.
- Catalogos: productos/articulos y categorias.
- Clientes: registro de clientes con CI/NIT, celular, email y direccion.
- Inventario: stock actual, costo, precio de venta y minimo de alerta.
- Configuracion: nombre legal, nombre comercial, moneda, NIT, telefono, direccion y nota del comprobante.
- Administracion: el encargado de sistema de cada empresa crea usuarios desde el panel de empresa y puede asignar roles comerciales.

## Reglas implementadas

- Cada empresa debe tener acceso activo al sistema `ventas_almacen`.
- El panel ZOW puede activar o desactivar sistemas por empresa.
- Las ventas descuentan stock automaticamente.
- Cada venta genera codigo correlativo `V-AAAA-00001`.
- Los cortes de caja generan codigo correlativo `C-AAAA-00001`.
- Los vendedores y cajeros ven su operacion; administrador de sistema y administrador de ventas ven ventas generales.
- El ticket se genera al confirmar la venta y usa los datos configurados de la tienda.
- Roles comerciales: `ventas_admin`, `cajero`, `almacen`, `vendedor`.
- `almacen` gestiona productos, categorias, stock y alertas.
- `cajero` y `vendedor` registran ventas y clientes. `cajero` tambien puede procesar caja.

## Preparacion cloud

- Supabase sera la base de datos, autenticacion y backend gestionado para el sistema online.
- Vercel publicara los frontends separados: panel ZOW, Correspondencia ZOW y Zow Ventas-Almacen.
- GitHub sera el repositorio central del codigo.
- Resend enviara credenciales, invitaciones y alertas operativas.
- Inngest ejecutara tareas pesadas: cierres programados, reportes, notificaciones y sincronizaciones.

## Siguientes mejoras

- Combos/articulos combinados.
- Reabastecimientos con proveedor y comprobante.
- Gastos y balance por rango de fechas.
- Catalogo publico para clientes.
- Impresion 58 mm / 80 mm y opciones para WhatsApp/Bluetooth.
