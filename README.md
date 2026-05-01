# Correspondencia ZOW

Demo MVP para gestionar correspondencia documental entrante y saliente en una institucion publica o empresa privada.

## Como abrir la demo

Opcion simple:

1. Abrir `index.html` en el navegador.

Opcion con servidor local:

```powershell
python -m http.server 4173
```

Luego visitar:

```text
http://localhost:4173
```

## Backend real

Ya existe una primera base backend en Node.js con SQLite local, JWT, empresas separadas, usuarios, unidades, documentos, derivaciones y adjuntos digitales.

Instalar dependencias:

```powershell
npm install
```

Ejecutar backend:

```powershell
npm run dev
```

API y pantallas locales:

```text
http://localhost:4174/api
http://localhost:4174
http://localhost:4175
```

Login real:

```http
POST /api/auth/login
```

Credencial interna del dueno SaaS ZOW:

```text
ramliw@zow.com / 2501Ramliw##
```

Desde este panel se registran empresas cliente, plan contratado, limites y el usuario encargado inicial.

Credencial inicial de la empresa demo:

```text
sistema@zow.com / ZowAdmin2026
```

Datos locales generados:

- `data/zow-correspondencia.sqlite`
- `uploads/`

## Funciones disponibles

- Login por usuario y contrasena.
- Modelo SaaS multiempresa con datos separados por empresa.
- Panel ZOW interno para registrar empresas cliente y crear su encargado inicial.
- Control de accesos por sistema SaaS: Correspondencia ZOW y Zow Ventas-Almacen.
- Roles iniciales: dueno SaaS ZOW, administrador de empresa, recepcion principal, recepcion secundaria, funcionario y supervisor.
- Administrador para crear unidades organizacionales y credenciales.
- Configuracion del nombre de la empresa desde el panel Sistema.
- Usuarios con CI y celular.
- Areas con tipo: principal, secundaria o sub area.
- Restriccion de documentos por unidad para usuarios funcionarios.
- Recepcion como puerta de entrada para toda documentacion entrante.
- Recepcion principal registra toda documentacion desde el inicio.
- Recepcion secundaria recibe y deriva documentacion interna dentro de su area, sin registrar ingresos iniciales.
- Derivacion digital desde Recepcion hacia una o varias unidades responsables.
- Derivacion entre unidades cuando un area necesita coordinar con otra.
- Hoja de control imprimible por cada documento registrado.
- Codigo automatico de carpeta con formato `MM-AAAA-0001`.
- Registro de solicitante, CI, celular, referencia, cantidad de hojas y fecha/hora automatica de recepcion.
- Primera pantalla con indicadores del manual.
- Modulos: Nro. Nota, Despachadas, Recibidas, Por recibir, Seguimiento y Reportes.
- Registro de documentos nuevos.
- Numeracion automatica por carpeta/documentacion: `04-2026-0001`.
- Busqueda y filtro por estado.
- Detalle de documento.
- Cambio de estado: En revision, Atendido, Archivado, Recibido y Vencido.
- Derivacion o registro de movimiento interno.
- Control de archivo digital.
- Adjuntar uno o varios archivos digitales PDF o imagen desde el registro o desde acciones del documento.
- Hoja de control imprimible generada al registrar documentos entrantes en recepcion principal.
- Confirmacion de recepcion fisica.
- Historial cronologico.
- Reportes simulados en PDF/Excel.
- Persistencia local en el navegador.

## Zow Ventas-Almacen

Pantalla inicial separada:

```text
http://localhost:4175
```

Funciones iniciales:

- Login con las mismas credenciales de empresa.
- Validacion de acceso activo al sistema `ventas_almacen`.
- Registro de productos.
- Stock inicial.
- Indicadores de productos, stock total, valor de inventario y bajo minimo.
- Base backend preparada para movimientos de entrada, salida y ajuste.

## Enfoque del MVP

Esta version sirve para validar el flujo con posibles clientes antes de construir la version productiva con usuarios, base de datos, adjuntos reales y despliegue SaaS.

## Transicion a sistema real

La demo visual aun funciona con datos locales del navegador. El backend real ya esta preparado como base. La siguiente fase es conectar el frontend a `/api/auth/login`, `/api/units`, `/api/users`, `/api/documents` y dejar de usar `localStorage`.

## Credenciales demo

- Duenio SaaS ZOW: `ramliw@zow.com` / `2501Ramliw##`
- Encargado de sistema: `sistema@zow.com` / `ZowAdmin2026`
- Recepcion: `recepcion@zow.com` / `ventanilla123`
- Recepcion secundaria Legal: `recepcion.legal@zow.com` / `recepcion456`
- Unidad legal: `legal@zow.com` / `legal123`
- Finanzas: `finanzas@zow.com` / `finanzas123`
- Compras: `compras@zow.com` / `compras123`
- Tecnologia: `tecnologia@zow.com` / `tecnologia123`
- Secretario Legal: `secretario@zow.com` / `secretario123`
- Director Tecnologia: `director@zow.com` / `director123`

La credencial `sistema@zow.com` se restaura automaticamente y las credenciales base anteriores se crean en SQLite si no existen. El administrador puede crear nuevas unidades y nuevos usuarios por area.

Flujo recomendado para probar privacidad:

1. Ingresar como `recepcion@zow.com`.
2. Registrar un documento entrante.
3. Imprimir la hoja de control si corresponde.
4. Derivarlo digitalmente a Legal, Finanzas, Compras o Tecnologia. Se puede elegir mas de una unidad.
5. Salir e ingresar con el usuario del area derivada.
6. Confirmar que esa area solo ve documentos derivados a su unidad.
7. Cambiar el estado a `Atendido`, derivar a otra area si corresponde y finalmente `Archivado`.

Nota: en esta demo estatica se conserva la referencia del archivo adjunto. En produccion los documentos digitales deben subirse a un backend o almacenamiento privado con permisos por unidad.

## Despliegue web

El proyecto ya incluye una entrada serverless para Vercel:

- `api/index.js`
- `vercel.json`

Guia completa:

```text
docs/despliegue-web.md
```

La primera publicacion en Vercel puede servir como preview web. Para produccion real con datos persistentes, se debe migrar SQLite y adjuntos locales a Supabase/PostgreSQL y Supabase Storage.

## Puesta en marcha por empresa

El flujo SaaS recomendado es:

1. Ingresar como `ramliw@zow.com`.
2. Registrar la empresa cliente, plan, limites y contacto.
3. Crear el usuario encargado inicial de esa empresa.
4. Entregar esa credencial al cliente.
5. El encargado configura su propia organizacion.

El usuario encargado de cada empresa es la cuenta inicial que se entrega a la empresa para configurar su ambiente.

Orden recomendado:

1. Crear unidades organizacionales.
2. Crear un encargado por cada unidad.
3. Crear usuarios operativos por area.
4. Definir quienes usan rol Recepcion principal, Recepcion secundaria, Funcionario, Supervisor y Administrador.
5. Probar recepcion, derivacion y seguimiento antes de operar con documentos reales.
