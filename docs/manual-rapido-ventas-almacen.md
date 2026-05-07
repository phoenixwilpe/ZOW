# Manual rapido por rol - Zow Ventas-Almacen

Este manual resume las tareas diarias de cada usuario dentro del sistema. Esta pensado para capacitacion rapida en tiendas pequenas o empresas con un solo punto de atencion.

## Antes de empezar

- Usa siempre tu propio usuario y contrasena.
- No compartas credenciales entre cajeros o responsables.
- Verifica que estes dentro de la empresa correcta.
- Si una opcion no aparece, probablemente tu rol no tiene permiso para usarla.
- Si detectas datos incorrectos, informa al encargado antes de seguir operando.

## Encargado de sistema

El encargado prepara la tienda para operar y controla la configuracion general.

### Tareas principales

- Configurar nombre de empresa, nombre de tienda, moneda, impuesto y nota de comprobante.
- Definir la cantidad de cajas que usara la empresa.
- Crear usuarios para cajeros, almacen, supervisor y operadores integrales.
- Asignar roles y caja preferida cuando corresponda.
- Revisar reportes, auditoria y actividad general.
- Activar o desactivar reglas de credito y descuentos.

### Configurar la tienda

1. Ingresa con el usuario encargado.
2. Abre el modulo Configuracion.
3. Revisa nombre de empresa, tienda, moneda, NIT/CI, telefono y direccion.
4. Define cantidad de cajas.
5. Activa o desactiva credito, descuentos y cliente obligatorio.
6. Guarda los cambios.

Recomendacion: usa nombres claros para la tienda y una nota corta en el ticket, por ejemplo `Gracias por su compra`.

### Crear usuarios

1. Abre Usuarios.
2. Crea el usuario con nombre completo, CI, celular, usuario y contrasena.
3. Asigna rol:
   - Cajero: ventas y caja.
   - Almacen: productos, compras, stock y Kardex.
   - Supervisor: reportes, anulaciones, devoluciones y promociones.
   - Operador integral: administra casi todo el sistema de ventas.
4. Guarda y prueba el ingreso.

Recomendacion: usa correos tipo `cajero1@empresa.com` o `almacen@empresa.com` para mantener orden.

### Revisar el negocio

1. Abre Resumen para ver ventas, stock e inventario.
2. Abre Reportes para revisar utilidad, ventas y auditoria.
3. Exporta CSV si necesitas analizar en Excel.
4. Revisa Alertas para productos bajo minimo o por vencer.

## Cajero

El cajero registra ventas, cobra y controla su caja durante el turno.

### Inicio de turno

1. Ingresa con tu usuario.
2. Abre Finanzas.
3. Selecciona tu caja.
4. Registra el monto inicial.
5. Confirma apertura.

Importante: no se puede cobrar si no hay caja abierta.

### Realizar una venta

1. Entra a Vender.
2. Busca el producto por nombre, codigo o codigo de barras.
3. Toca el producto para agregarlo al carrito.
4. Cambia cantidades con los botones `+` y `-`.
5. Revisa subtotal, descuento, impuesto y total.
6. Presiona Cobrar.
7. Elige metodo de pago.
8. Ingresa monto recibido.
9. Confirma pago.
10. Imprime o genera el comprobante.

Atajos utiles:

- `F2`: enfocar busqueda.
- `F4`: cobrar.
- `Esc`: cancelar venta actual con confirmacion.
- `3x codigo`: agrega 3 unidades de un producto.

### Cobrar en efectivo

1. Elige Efectivo.
2. Ingresa el monto recibido.
3. Verifica el vuelto.
4. Confirma pago.

Si el pago es insuficiente, el sistema no permite confirmar.

### Pago mixto

1. Elige Pago mixto.
2. Ingresa montos por efectivo, tarjeta, transferencia o QR.
3. Verifica que la suma cubra el total.
4. Confirma pago.

### Suspender una venta

Usa Suspender cuando el cliente aun no termina la compra o necesita salir un momento.

1. Agrega productos al carrito.
2. Presiona Suspender.
3. Luego usa Recuperar para continuar.

La venta suspendida queda guardada en la nube y puede recuperarse en otra sesion autorizada.

### Anular una venta

1. Entra a Historial.
2. Busca la venta.
3. Presiona Anular si tienes permiso.
4. Confirma la accion.

El stock vuelve automaticamente si la anulacion corresponde.

## Almacen

Almacen mantiene productos, stock, compras, proveedores y alertas.

### Registrar producto

1. Entra a Inventario.
2. Presiona Nuevo producto.
3. Completa codigo, codigo de barras, nombre, categoria, unidad, costo, precio, stock y minimo.
4. Si aplica, registra lote y vencimiento.
5. Guarda.

Recomendacion: el codigo debe ser corto y facil de leer. El codigo de barras puede venir del producto fisico.

### Editar producto

1. Busca el producto en Inventario o Catalogo.
2. Presiona Editar.
3. Cambia precio, costo, minimo, lote o vencimiento.
4. Guarda.

No cambies codigos sin coordinacion, porque caja y reportes dependen de ellos.

### Movimiento de stock

1. Abre Inventario.
2. Elige el producto.
3. Registra entrada, salida o ajuste.
4. Escribe referencia y nota.
5. Guarda.

El Kardex mostrara el historial del producto.

### Compras

1. Entra a Compras.
2. Crea o selecciona proveedor.
3. Agrega productos a la compra.
4. Guarda como pendiente si aun no llego mercaderia.
5. Marca como recibida cuando llegue.

La compra recibida actualiza stock y costo. La compra pendiente no mueve stock.

### Alertas

Revisa Alertas para:

- Productos bajo minimo.
- Productos sin stock.
- Productos por vencer.
- Compra sugerida.

## Supervisor

El supervisor controla operaciones sensibles y revisa resultados.

### Reportes

1. Abre Reportes.
2. Filtra por fecha.
3. Revisa ventas, utilidad, inventario y auditoria.
4. Exporta CSV si necesitas respaldar o analizar.

La utilidad usa el costo historico guardado al momento de vender.

### Promociones

1. Entra a Promociones.
2. Crea una regla con nombre, producto, tipo de descuento, valor, cantidad minima y fechas.
3. Guarda.
4. Prueba en el POS agregando la cantidad minima.

La promocion se aplica automaticamente si esta activa, dentro de fecha y cumple la cantidad.

### Devoluciones

1. Abre Historial.
2. Busca la venta.
3. Entra al detalle.
4. Registra devolucion parcial o total si corresponde.
5. Verifica stock y estado de venta.

Usa devoluciones cuando el cliente devuelve producto. Usa anulacion cuando la venta fue un error operativo antes de cierre.

### Auditoria

Revisa auditoria para confirmar:

- Inicio de sesion.
- Ventas registradas.
- Anulaciones.
- Devoluciones.
- Movimientos de caja.
- Cambios de stock.
- Promociones.

## Vendedor

El vendedor registra ventas y consulta clientes cuando la empresa lo permite.

### Venta rapida

1. Ingresa a Vender.
2. Busca productos.
3. Agrega al carrito.
4. Selecciona cliente si corresponde.
5. Cobra o deriva segun el permiso configurado.

### Clientes

1. Entra a Clientes.
2. Busca por nombre, CI/NIT o celular.
3. Registra cliente nuevo si tienes permiso.
4. Revisa cuentas pendientes cuando corresponda.

## Reglas importantes para todos

- No vendas productos vencidos.
- No fuerces descuentos sin autorizacion.
- No cierres sesion con venta pendiente sin suspenderla o cancelarla.
- No hagas ajustes de stock sin motivo claro.
- Si el sistema muestra una alerta, leela antes de continuar.
- Al terminar el turno, verifica caja e historial.

## Problemas comunes

### No puedo cobrar

Posibles causas:

- No abriste caja.
- La venta no tiene productos.
- El pago es insuficiente.
- Tu rol no tiene permiso.

### No aparece un producto

Posibles causas:

- Producto inactivo.
- Stock en cero.
- Producto vencido.
- Busqueda escrita con codigo incorrecto.

### No puedo ver reportes

Solo encargado, supervisor u operador integral pueden ver reportes completos.

### El total no coincide

Revisa:

- Cantidades.
- Descuentos por linea.
- Descuento general.
- Impuesto configurado.
- Promocion aplicada.

## Flujo recomendado de un dia normal

1. Encargado o cajero abre caja.
2. Cajero registra ventas.
3. Almacen revisa alertas y stock.
4. Supervisor revisa ventas y auditoria.
5. Al final del turno se revisa caja e historial.
6. Encargado revisa reportes y productos criticos.

## Cierre de capacitacion

Una persona esta lista para operar cuando puede:

- Iniciar sesion sin ayuda.
- Usar solo los modulos de su rol.
- Completar su tarea principal sin errores criticos.
- Explicar que hacer si aparece una alerta.
- Reportar problemas con datos claros: usuario, hora, venta o producto afectado.
