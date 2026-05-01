# Zow Correspondencia - Plan MVP

## Objetivo

Crear un SaaS para registrar, derivar, responder, archivar y consultar documentacion entrante y saliente en instituciones publicas o empresas privadas.

## Alcance de la primera demo

- Primera pantalla con ultimo correlativo, total despachadas, total recibidas y pendientes de archivo digital.
- Solicitud de numero de nota para comunicaciones despachadas.
- Registro de comunicaciones entrantes y salientes.
- Numeracion automatica por gestion.
- Bandejas de despachadas, recibidas y notas por recibir.
- Busqueda por codigo de seguimiento, CITE, referencia, asunto, contacto, responsable, area o tipo.
- Filtro por estado.
- Detalle del documento con responsable, area, fecha limite y origen/destino.
- Cambio rapido de estado.
- Registro de archivo digital pendiente/subido.
- Adjuntar archivo digital en PDF o imagen.
- Confirmacion de recepcion fisica.
- Registro de derivaciones con instruccion, plazo, responsable, comentario y fecha/hora automatica.
- Historial cronologico.
- Reportes simulados de despachadas, recibidas y derivadas por area.
- Login por credenciales.
- Modulo administrador para registrar unidades y usuarios.
- Restriccion de acceso por unidad y rol.
- Recepcion/Ventanilla como primer punto obligatorio para documentacion entrante.
- Derivacion controlada desde Recepcion hacia la unidad responsable.
- Las unidades solo visualizan documentos asignados o derivados a ellas.
- Datos guardados en el navegador para demo comercial.

## Reglas de organizacion y permisos

- Recepcion registra toda documentacion entrante y queda como responsable inicial.
- Una unidad no ve documentos entrantes hasta que Recepcion o Administracion los derive.
- Las areas operativas solo ven documentos cuyo responsable actual (`current_unit_id`) es su unidad.
- Recepcion puede registrar, revisar y derivar documentacion.
- Administracion puede configurar unidades, usuarios y credenciales.
- Debe existir una credencial maestra de encargado de sistema para crear todas las areas y usuarios iniciales.
- El modulo Administrador debe funcionar como consola de puesta en marcha para cada empresa cliente.
- Supervisor puede consultar seguimiento y reportes, sin registrar nuevos documentos.
- Un documento archivado ya no debe modificarse desde una unidad operativa.

## Flujo base tomado del manual

1. Inicio de sesion y acceso por usuario institucional.
2. Primera pantalla con menu lateral y tarjetas de seguimiento.
3. Solicitar numero de nota.
4. Completar despacho de comunicacion interna o externa.
5. Registrar archivo digital escaneado.
6. Registrar comunicacion recibida.
7. Mantener la comunicacion recibida en Recepcion hasta su derivacion.
8. Cargar archivo digital de comunicacion recibida.
9. Derivar comunicacion recibida a la unidad responsable.
10. Consultar seguimiento por codigo.
11. Revisar notas por recibir.
12. Generar reportes por area en PDF o Excel.

## Mejoras propuestas sobre el sistema base

- Vista unificada del expediente con historial y estado documental.
- Alertas visuales cuando falta archivo digital o recepcion fisica.
- Busqueda global en vez de busquedas separadas por pantalla.
- Campos mas claros para CITE, referencia, emisor, receptor, anexos, copias y vias.
- Preparado para roles, auditoria, adjuntos reales y trazabilidad completa.

## Roles previstos para version con backend

- Administrador.
- Recepcion o ventanilla.
- Jefe de area.
- Funcionario responsable.
- Archivo central.
- Auditor o consulta.

## Modulos siguientes

1. Autenticacion y permisos.
2. Gestion de usuarios, unidades, roles y credenciales.
3. Base de datos PostgreSQL.
4. Adjuntos PDF reales.
5. Notificaciones por vencimiento.
6. Reportes PDF y Excel.
7. Codigos QR para consulta de estado.
8. Firma o visto bueno interno.
9. Instalacion multiempresa para SaaS.

## Propuesta de tecnologia para version productiva

- Frontend: Next.js o React.
- Backend: Laravel o NestJS.
- Base de datos: PostgreSQL.
- Archivos: almacenamiento S3 compatible o servidor privado.
- Despliegue inicial: VPS con Docker.
