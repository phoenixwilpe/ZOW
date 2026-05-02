# Backup y restauracion de Correspondencia ZOW

## Objetivo

Evitar perdida de informacion de empresas, usuarios, areas, documentos, movimientos, auditoria y configuracion SaaS.

## Backup recomendado en Supabase

1. Entrar a Supabase.
2. Abrir el proyecto de produccion.
3. Ir a `Project Settings` > `Database`.
4. Confirmar que la base este en plan con backups habilitados antes de vender a clientes reales.
5. Descargar un respaldo manual antes de cambios grandes de version.

## Backup manual con PostgreSQL

Desde una terminal con `pg_dump` disponible:

```powershell
$env:DATABASE_URL="postgresql://postgres.eqohrmszdysompqelvrr:TU_PASSWORD@aws-1-sa-east-1.pooler.supabase.com:6543/postgres"
pg_dump $env:DATABASE_URL --format=custom --file="zow-backup-$(Get-Date -Format yyyyMMdd-HHmm).dump"
```

## Restauracion

Restaurar primero en un proyecto de prueba, nunca directo sobre produccion:

```powershell
pg_restore --clean --if-exists --dbname "postgresql://..." "zow-backup-YYYYMMDD-HHmm.dump"
```

## Frecuencia

- Diario: backup automatico de Supabase.
- Antes de deploy importante: backup manual.
- Mensual: prueba de restauracion en entorno separado.

## Datos que deben protegerse

- `companies`, `users`, `units`
- `documents`, `movements`, `document_recipients`, `document_files`
- `organization_settings`
- `audit_events`, `public_lookup_audit`
- `company_system_access`, `saas_systems`

## Regla operativa

Nunca ejecutar scripts con `DROP TABLE`, `TRUNCATE` o `DELETE` masivo en produccion sin backup manual reciente y prueba previa.
