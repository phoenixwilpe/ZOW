# Despliegue web - Panel ZOW y Correspondencia ZOW

## Objetivo

Publicar una primera version web para probar el Panel ZOW y Correspondencia ZOW desde internet.

## Estado actual

- Frontend estatico: `index.html`, `app.js`, `styles.css`, `assets/`.
- Backend Node/Express: `backend/server.js`.
- Entrada serverless para Vercel: `api/index.js`.
- Configuracion Vercel: `vercel.json`.
- Runtime recomendado: Node.js `24.x`.
- PostgreSQL/Supabase preparado: `supabase/schema.sql` y `supabase/seed.sql`.

Nota tecnica: el esquema PostgreSQL ya esta listo. El backend local sigue teniendo compatibilidad SQLite para desarrollo; la conexion completa del API a PostgreSQL se debe terminar antes de usar datos reales de clientes. No operar documentacion real hasta completar esa conexion y Supabase Storage.

## Rutas en Vercel

- `/` abre Correspondencia ZOW / Panel ZOW segun el usuario autenticado.
- `/panel` abre el mismo frontend para uso del dueno SaaS.
- `/correspondencia` abre el mismo frontend para empresas cliente.
- `/api/*` se envia al backend Express.

## Variables de entorno en Vercel

Configurar en Project Settings > Environment Variables:

```text
JWT_SECRET=valor-largo-seguro
SYSTEM_PASSWORD=ZowAdmin2026
ZOW_OWNER_PASSWORD=2501Ramliw##
DATABASE_PROVIDER=postgres
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
SUPABASE_URL=https://[PROJECT-REF].supabase.co
SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
SUPABASE_STORAGE_BUCKET=documentos
```

Solo para preview temporal sin PostgreSQL:

```text
DATABASE_PROVIDER=sqlite
SQLITE_DIR=/tmp/zow-data
UPLOADS_DIR=/tmp/zow-uploads
```

Importante: `/tmp` no es persistente. Para quitar esa limitacion usa `DATABASE_PROVIDER=postgres` con Supabase.

## Preparar Supabase/PostgreSQL

1. Entra a Supabase.
2. Abre tu proyecto.
3. Ve a `SQL Editor`.
4. Crea una nueva query.
5. Pega y ejecuta el contenido de:

```text
supabase/schema.sql
```

6. Crea otra query.
7. Pega y ejecuta el contenido de:

```text
supabase/seed.sql
```

8. Ve a `Storage`.
9. Crea un bucket llamado:

```text
documentos
```

10. Mantener el bucket privado. Los adjuntos se deben servir con URLs firmadas desde el backend.

## Primer despliegue rapido en Vercel

1. Crear repositorio en GitHub.
2. Subir este proyecto al repositorio.
3. En Vercel, crear un nuevo proyecto importando ese repositorio.
4. Framework Preset: `Other`.
5. Build Command: dejar vacio o `npm run check`.
6. Output Directory: dejar vacio.
7. Instalar con `npm install`.
8. Agregar variables de entorno.
9. Deploy.

## Paso productivo real

1. Usar PostgreSQL/Supabase como base unica.
2. Guardar adjuntos en Supabase Storage.
3. Activar RLS final por `company_id` cuando se migre a auth nativa Supabase.
4. Conectar Resend para envio de credenciales.
5. Conectar Inngest para tareas programadas y reportes.

## Subir a GitHub

Si ya tienes repo creado:

```powershell
git status
git add .
git commit -m "Prepare cloud deploy with Supabase PostgreSQL"
git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
git branch -M main
git push -u origin main
```

Si el remoto ya existe, omite `git remote add origin ...` y usa:

```powershell
git push -u origin main
```

## Publicar en Vercel

1. Entra a Vercel.
2. `Add New Project`.
3. Importa el repo de GitHub.
4. Framework Preset: `Other`.
5. Build Command: `npm run check`.
6. Output Directory: dejar vacio.
7. Agrega las variables de entorno de Supabase.
8. Deploy.

Despues del deploy:

```text
https://tu-proyecto.vercel.app
https://tu-proyecto.vercel.app/panel
https://tu-proyecto.vercel.app/correspondencia
```

## Comandos locales utiles

```powershell
npm install
npm run check
npm run dev
```

URLs locales:

```text
http://localhost:4174
http://localhost:4174/api
```
