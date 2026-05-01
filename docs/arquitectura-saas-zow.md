# Arquitectura SaaS ZOW

## Separacion de sistemas

- Panel ZOW: control del dueno del SaaS, empresas, planes y sistemas activos.
- Correspondencia ZOW: recepcion, derivacion, seguimiento y archivo documental.
- Zow Ventas-Almacen: ventas, caja, clientes, productos, stock e inventario.

Cada sistema debe mantener su interfaz, ruta y permisos propios. El login puede compartir autenticacion, pero el usuario solo entra a los sistemas activos de su empresa.

## Multiempresa

- Cada empresa tiene `company_id`.
- Todas las tablas operativas deben filtrar por `company_id`.
- El encargado de sistema de cada empresa configura datos, areas/unidades, usuarios y roles.
- El panel ZOW activa planes y sistemas por empresa.

## Stack objetivo

- Supabase: PostgreSQL, autenticacion, storage y politicas RLS por empresa.
- Vercel: despliegue web de los frontends y funciones serverless cuando corresponda.
- GitHub: repositorio, ramas y control de versiones.
- Resend: correos transaccionales para credenciales, invitaciones y avisos.
- Inngest: tareas pesadas y programadas, como reportes, cierres y recordatorios.

## Migracion recomendada

1. Mantener el prototipo local hasta cerrar flujos y pantallas.
2. Crear proyecto Supabase y migrar tablas con `company_id` obligatorio.
3. Activar RLS por empresa y por rol.
4. Reemplazar SQLite por Supabase en servicios de datos.
5. Separar variables en `.env` y conectar Resend/Inngest.
6. Publicar en Vercel por entornos: desarrollo, prueba y produccion.
