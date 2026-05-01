# Zow Correspondencia - Sistema real

## Base creada

- Backend Node.js con Express.
- Base de datos SQLite local en `data/zow-correspondencia.sqlite`.
- Autenticacion JWT.
- Contrasenas cifradas con bcrypt.
- Usuario inicial protegido: `sistema`.
- Modulos API para unidades, usuarios, documentos, derivaciones y archivos digitales.
- Adjuntos guardados en `uploads/`.

## Endpoints iniciales

- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/units`
- `POST /api/units`
- `GET /api/users`
- `POST /api/users`
- `GET /api/documents`
- `POST /api/documents`
- `POST /api/documents/:id/derive`
- `POST /api/documents/:id/digital-file`
- `GET /api/documents/:id/movements`

## Reglas de privacidad

- `admin`: administra configuracion y ve todo.
- `ventanilla`: recepciona, registra y deriva; ve todo lo operativo.
- `funcionario`: solo ve documentos cuyo `current_unit_id` es su unidad.
- `supervisor`: en esta base queda restringido por unidad; puede ampliarse a supervision institucional configurable.

## Siguiente trabajo

1. Login del frontend conectado al backend real.
2. Consola de unidades y usuarios conectada al backend real.
3. Documentos conectados al backend para listado, registro, derivacion, cambio de estado y archivo digital.
4. Mostrar descarga/preview de PDF.
5. Completar reportes reales.
6. Preparar PostgreSQL para despliegue SaaS multiempresa.
