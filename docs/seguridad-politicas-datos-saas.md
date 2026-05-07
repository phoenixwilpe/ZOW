# Seguridad y politicas de datos - System ZOW SaaS

Este documento resume las reglas de seguridad que deben mantenerse para Correspondencia ZOW, Zow Ventas-Almacen y futuros sistemas SaaS.

## Principios

- Cada empresa es un inquilino separado.
- Ningun usuario de una empresa debe ver datos de otra empresa.
- Cada usuario debe operar con su propia credencial.
- Los roles limitan funciones, reportes y acciones sensibles.
- Las acciones criticas deben quedar auditadas.
- Los datos sensibles no deben quedar cacheados por navegador o intermediarios.
- Las membresias vencidas suspenden el acceso operativo.

## Aislamiento por empresa

Todas las tablas operativas deben tener `company_id` y cada consulta de usuario empresarial debe filtrar por `req.user.company_id`.

Aplica a:

- Usuarios.
- Areas o unidades.
- Documentos.
- Productos.
- Clientes.
- Proveedores.
- Ventas.
- Compras.
- Caja.
- Promociones.
- Auditoria.
- Archivos.

Regla obligatoria:

Si un endpoint recibe un `id`, primero debe validar que ese registro pertenece al `company_id` del usuario autenticado antes de leer, modificar o borrar.

## Roles principales

### Panel ZOW

- `zow_owner`: administra empresas, planes, acceso a sistemas y seguimiento comercial.
- No debe operar datos internos de una empresa desde los sistemas empresariales.

### Correspondencia ZOW

- `admin`: configura empresa, areas, usuarios y membrete.
- `recepcion_principal`: registra documentacion inicial y deriva.
- `recepcion_secundaria`: recibe y deriva documentacion interna.
- `funcionario`: atiende y consulta solo lo asignado.
- `supervisor`: consulta y controla segun permisos.

### Zow Ventas-Almacen

- `admin`: encargado de sistema de la empresa.
- `ventas_admin`: operador integral.
- `cajero`: ventas, caja e historial permitido.
- `almacen`: inventario, compras, stock y favoritos POS.
- `supervisor`: reportes, auditoria, promociones, anulaciones y devoluciones.
- `vendedor`: ventas y clientes segun permiso.

## Politica de login

El sistema ya aplica:

- Comparacion segura de contrasena con hash bcrypt.
- Hash falso para evitar diferencias claras entre usuario inexistente y password incorrecto.
- Bloqueo temporal por intentos fallidos.
- Usuario no sensible a mayusculas/minusculas.
- JWT con emisor, audiencia y expiracion.
- Validacion de empresa activa y membresia vigente.
- Registro de login correcto e intento fallido en auditoria.

Recomendaciones operativas:

- No entregar una misma cuenta a varias personas.
- Usar contrasenas de al menos 10 caracteres con mayuscula, minuscula, numero y simbolo.
- Desactivar usuarios que ya no trabajen en la empresa.
- Cambiar credenciales iniciales cuando el cliente reciba el sistema.

## Politica de API

Toda API sensible debe:

- Requerir token.
- Verificar rol.
- Verificar acceso al sistema SaaS contratado.
- Filtrar por empresa.
- No devolver `password_hash`.
- No exponer rutas internas de archivos.
- No guardar respuestas sensibles en cache.
- Registrar auditoria cuando cambia datos importantes.

El backend aplica cabeceras de seguridad:

- `X-Content-Type-Options: nosniff`.
- `X-Frame-Options: DENY`.
- `Referrer-Policy: no-referrer`.
- `Permissions-Policy` restringido.
- `Content-Security-Policy` limitada al propio sitio y Supabase.
- `Strict-Transport-Security` cuando se usa HTTPS.
- `Cache-Control: no-store` para rutas `/api`.

## Politica de archivos

Los archivos deben guardarse separados por empresa.

Reglas:

- La ruta de storage debe incluir `company_id`.
- El usuario solo puede descargar archivos de su empresa.
- En Correspondencia, el usuario tambien debe tener permiso sobre el documento.
- Los logos o membretes solo los sube el encargado de sistema.
- Se limita tipo y tamano de archivo.

## Auditoria obligatoria

Debe quedar registro de:

- Login correcto.
- Login fallido.
- Creacion y edicion de usuarios.
- Cambio de estado de empresa.
- Cambio de sistemas activos.
- Registro, derivacion y archivo de documentos.
- Subida de archivos.
- Venta registrada.
- Venta anulada.
- Devolucion.
- Cobro de credito.
- Apertura y cierre de caja.
- Movimiento manual de caja.
- Movimiento manual de stock.
- Creacion o cambio de promocion.
- Favoritos POS.

## Politica de membresia

Cuando una empresa vence:

- Se cambia estado a suspendida.
- El login empresarial queda bloqueado.
- El mensaje debe indicar que contacte a ZOW.
- Los datos no se borran automaticamente.
- El panel ZOW debe poder reactivar o actualizar fechas.

## Datos que no se deben borrar en actualizaciones

Nunca usar despliegues o scripts que eliminen:

- Empresas reales.
- Usuarios reales.
- Productos.
- Ventas.
- Documentos.
- Compras.
- Auditoria.
- Archivos.

Las migraciones deben ser incrementales:

- `CREATE TABLE IF NOT EXISTS`.
- `ALTER TABLE ADD COLUMN IF NOT EXISTS`.
- Indices con `CREATE INDEX IF NOT EXISTS`.
- Nunca `DROP TABLE` en produccion sin respaldo y autorizacion explicita.

## Checklist antes de entregar a una empresa

- Empresa creada con plan y fecha de vencimiento.
- Sistema correcto activado.
- Encargado de sistema puede iniciar sesion.
- Usuarios creados con roles correctos.
- Cajero no ve reportes de utilidad.
- Almacen no ve configuracion sensible.
- Supervisor ve reportes, pero no administra empresa si no corresponde.
- Datos de otra empresa no aparecen.
- API responde 401 sin token.
- API responde 403 con rol insuficiente.
- Auditoria muestra acciones criticas.

## Checklist tecnico antes de desplegar

- `npm run check` pasa correctamente.
- `npm run vercel-build` pasa correctamente.
- `/api/health` responde con PostgreSQL.
- Variables de entorno en Vercel configuradas:
  - `DATABASE_URL`.
  - `SUPABASE_URL`.
  - `SUPABASE_SERVICE_ROLE_KEY`.
  - `SUPABASE_STORAGE_BUCKET`.
  - `JWT_SECRET`.
  - `CORS_ORIGINS` si se usan dominios propios.
- No subir secretos al repositorio.
- No registrar passwords en auditoria ni logs.

## Politicas para vender con confianza

Al cliente se le puede explicar:

- Sus datos quedan separados de otras empresas.
- Cada empleado tiene usuario propio.
- Los permisos evitan que todos vean todo.
- Las acciones importantes quedan registradas.
- Si deja de pagar, el acceso se suspende pero los datos no se eliminan automaticamente.
- El sistema esta pensado para crecer con la empresa.

## Riesgos pendientes a futuro

- Agregar respaldo automatico programado.
- Agregar exportacion completa por empresa desde Panel ZOW.
- Agregar recuperacion de contrasena por correo cuando se active Resend.
- Agregar autenticacion de dos factores para el panel ZOW.
- Agregar monitoreo de errores y alertas de seguridad.
- Agregar politicas RLS completas si se permite acceso directo desde Supabase al frontend.
