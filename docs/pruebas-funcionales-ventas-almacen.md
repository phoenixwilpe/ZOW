# Pruebas funcionales - Zow Ventas-Almacen

Este documento define las pruebas minimas para validar una empresa con un solo punto de atencion antes de vender o entregar el sistema a un cliente real.

## Datos base para pruebas

- Empresa: Tienda Demo ZOW.
- Moneda: BOB.
- Cajas configuradas: 2.
- Roles:
  - Encargado de sistema: configura tienda, usuarios, permisos y reportes.
  - Cajero: vende, cobra, suspende ventas y consulta su turno.
  - Almacen: productos, stock, compras, vencimientos y favoritos POS.
  - Supervisor: reportes, promociones, anulaciones y devoluciones.
- Productos recomendados:
  - Agua mineral 600 ml, stock 96, minimo 24.
  - Refresco cola 2 L, stock 36, minimo 12.
  - Arroz 1 kg, stock 60, minimo 20.
  - Aceite vegetal 900 ml, stock 30, minimo 10.

## Checklist general

- Login diferencia correctamente empresa, usuario y rol.
- Cada rol ve solo los modulos permitidos.
- Las ventas descuentan stock.
- Las anulaciones y devoluciones devuelven stock cuando corresponde.
- Caja abierta es obligatoria para cobrar.
- Los favoritos POS, ventas suspendidas y promociones quedan guardados en la nube.
- Reportes y auditoria muestran acciones criticas.
- El sistema funciona en escritorio, tablet y celular.

## Casos por rol

### 1. Encargado de sistema

**Objetivo:** validar configuracion inicial de la tienda.

Pasos:

1. Iniciar sesion con el usuario encargado de la empresa.
2. Entrar a Configuracion.
3. Cambiar nombre de tienda, moneda, impuesto, nota de ticket y cantidad de cajas.
4. Guardar cambios.
5. Ir a Usuarios y crear un cajero, un almacen y un supervisor.
6. Cerrar sesion e ingresar con cada usuario creado.

Resultado esperado:

- La configuracion se conserva al recargar.
- Los usuarios nuevos pueden ingresar.
- Cada usuario ve solo sus modulos permitidos.
- El cajero tiene una caja asignada o puede operar segun las reglas configuradas.

Evidencia:

- Captura de Configuracion.
- Captura de Usuarios.
- Captura de menu visible por cada rol.

### 2. Inventario y productos

**Objetivo:** validar alta, edicion, stock minimo, Kardex y vencimientos.

Pasos:

1. Iniciar como Almacen o Encargado.
2. Crear un producto con codigo, codigo de barras, costo, precio, stock y minimo.
3. Editar precio y stock minimo.
4. Registrar movimiento manual de entrada.
5. Registrar movimiento manual de salida.
6. Consultar Kardex del producto.
7. Crear un producto con fecha de vencimiento cercana.

Resultado esperado:

- El producto aparece en Inventario y POS.
- El Kardex muestra entradas, salidas y ajustes.
- El stock se actualiza correctamente.
- El producto por vencer muestra alerta.
- Un producto vencido no puede venderse.

Evidencia:

- Captura del producto.
- Captura del Kardex.
- Captura de alerta de vencimiento.

### 3. Compra y reposicion

**Objetivo:** validar proveedores, ordenes de compra y entrada de mercaderia.

Pasos:

1. Crear proveedor.
2. Crear una compra con 2 productos.
3. Guardar como pendiente.
4. Recibir compra.
5. Verificar stock actualizado.
6. Cancelar una compra pendiente distinta.

Resultado esperado:

- La compra pendiente no debe subir stock hasta recibirse.
- La compra recibida aumenta stock y costo.
- La compra cancelada no mueve stock.
- La orden imprimible muestra proveedor, productos y total.

Evidencia:

- Captura de compra pendiente.
- Captura de compra recibida.
- Captura de stock antes y despues.

### 4. POS y venta rapida

**Objetivo:** validar venta tactil diaria.

Pasos:

1. Iniciar como Cajero.
2. Abrir caja con monto inicial.
3. Buscar producto por nombre.
4. Buscar producto por codigo o codigo de barras.
5. Agregar cantidades con formato rapido, por ejemplo `3x AB-001`.
6. Cambiar cantidad desde el carrito.
7. Aplicar descuento por linea si el permiso lo permite.
8. Cobrar en efectivo y verificar vuelto.
9. Reimprimir comprobante.

Resultado esperado:

- No se puede cobrar sin caja abierta.
- El buscador y escaneo agregan productos correctamente.
- El total, descuento, impuesto y vuelto se calculan bien.
- La venta descuenta stock.
- El comprobante muestra datos correctos.

Evidencia:

- Captura de POS con carrito.
- Captura de modal de cobro.
- Captura o PDF del comprobante.

### 5. Pagos mixtos y credito

**Objetivo:** validar metodos de pago.

Pasos:

1. Crear una venta y cobrar con tarjeta.
2. Crear una venta y cobrar con QR.
3. Crear una venta con pago mixto: efectivo + transferencia.
4. Intentar confirmar pago insuficiente.
5. Crear venta a credito si la tienda lo permite.
6. Registrar pago parcial de cuenta por cobrar.

Resultado esperado:

- Pago insuficiente bloquea confirmacion.
- Pago mixto suma correctamente cada metodo.
- Credito genera saldo pendiente.
- El pago parcial reduce saldo.
- Reportes reflejan metodo de pago.

Evidencia:

- Captura de pago mixto.
- Captura de cuentas por cobrar.
- Captura de historial de venta.

### 6. Ventas suspendidas

**Objetivo:** validar continuidad entre sesiones.

Pasos:

1. Agregar productos al carrito.
2. Suspender venta.
3. Recargar la pagina o abrir desde otro equipo.
4. Recuperar venta.
5. Cobrar la venta.

Resultado esperado:

- La venta suspendida queda en base de datos.
- Puede recuperarse sin perder productos, cliente, descuento ni nota.
- Al recuperarla desaparece de pendientes.
- Auditoria registra suspension y recuperacion.

Evidencia:

- Captura de lista de ventas suspendidas.
- Captura de auditoria.

### 7. Promociones

**Objetivo:** validar reglas comerciales automaticas.

Pasos:

1. Entrar como Encargado o Supervisor.
2. Crear promocion por porcentaje para un producto.
3. Configurar cantidad minima.
4. Agregar menos unidades al POS.
5. Agregar la cantidad minima o mas.
6. Crear promocion vencida o futura.
7. Pausar y reactivar promocion.

Resultado esperado:

- La promocion se aplica solo cuando cumple cantidad y fecha.
- El carrito muestra el nombre de la promocion aplicada.
- El descuento se recalcula al cambiar cantidad.
- Promociones pausadas, futuras o vencidas no se aplican.
- Auditoria registra creacion y cambio de estado.

Evidencia:

- Captura de promocion creada.
- Captura de carrito con promocion.
- Captura de auditoria.

### 8. Anulaciones y devoluciones

**Objetivo:** validar control de stock y caja ante errores.

Pasos:

1. Registrar venta confirmada.
2. Verificar stock descontado.
3. Anular venta antes del cierre de caja.
4. Verificar stock restituido.
5. Registrar venta nueva.
6. Hacer devolucion parcial.
7. Hacer devolucion total en otra venta.

Resultado esperado:

- La anulacion devuelve stock completo.
- La devolucion parcial devuelve solo unidades devueltas.
- La devolucion total marca la venta como devuelta.
- El historial muestra estados correctos.
- La caja registra egreso si corresponde.

Evidencia:

- Captura de stock antes y despues.
- Captura de historial.
- Captura de auditoria.

### 9. Reportes y exportaciones

**Objetivo:** validar analisis para el encargado.

Pasos:

1. Entrar a Reportes.
2. Filtrar por fecha.
3. Revisar utilidad por producto.
4. Exportar ventas CSV.
5. Exportar inventario CSV.
6. Exportar clientes CSV.
7. Exportar respaldo JSON.

Resultado esperado:

- El filtro por fecha afecta ventas y utilidad.
- La utilidad usa costo historico del momento de venta.
- Los CSV se descargan con datos legibles.
- El respaldo JSON incluye datos operativos importantes.

Evidencia:

- Archivos descargados.
- Captura del reporte filtrado.

### 10. Seguridad y aislamiento

**Objetivo:** validar que una empresa no vea datos de otra.

Pasos:

1. Crear dos empresas desde Panel ZOW.
2. Activar Ventas-Almacen para ambas.
3. Crear productos y ventas en Empresa A.
4. Ingresar con Empresa B.
5. Revisar inventario, ventas, clientes y reportes.
6. Intentar entrar con usuario incorrecto o inactivo.

Resultado esperado:

- Empresa B no ve productos, ventas ni clientes de Empresa A.
- Usuarios inactivos no pueden ingresar.
- Usuario o password incorrecto no revela informacion sensible.
- Los endpoints protegidos devuelven error sin token.

Evidencia:

- Captura de ambas empresas.
- Captura de datos separados.

## Matriz de permisos

| Funcion | Encargado | Cajero | Almacen | Supervisor | Vendedor |
| --- | --- | --- | --- | --- | --- |
| Configurar tienda | Si | No | No | No | No |
| Crear usuarios | Si | No | No | No | No |
| Vender | Si | Si | No | Si | Si |
| Abrir caja | Si | Si | No | Si | No |
| Ajustar stock | Si | No | Si | No | No |
| Crear compras | Si | No | Si | Si | No |
| Crear promociones | Si | No | No | Si | No |
| Ver utilidad | Si | No | No | Si | No |
| Anular ventas | Si | Si | No | Si | No |

## Estado de prueba

Usa esta tabla al validar una demo o instalacion.

| Caso | Estado | Observaciones |
| --- | --- | --- |
| Configuracion inicial | Pendiente |  |
| Inventario y productos | Pendiente |  |
| Compra y reposicion | Pendiente |  |
| POS y venta rapida | Pendiente |  |
| Pagos mixtos y credito | Pendiente |  |
| Ventas suspendidas | Pendiente |  |
| Promociones | Pendiente |  |
| Anulaciones y devoluciones | Pendiente |  |
| Reportes y exportaciones | Pendiente |  |
| Seguridad y aislamiento | Pendiente |  |

## Criterio de aprobacion

El sistema puede presentarse comercialmente cuando todos los casos esten en estado Aprobado o Aprobado con observacion, sin errores criticos en venta, stock, caja, permisos ni separacion de empresas.
