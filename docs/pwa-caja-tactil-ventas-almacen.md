# PWA para caja tactil - Zow Ventas-Almacen

Zow Ventas-Almacen puede instalarse como aplicacion web en tablet, celular o computadora compatible. Esto facilita que el cajero abra el POS como una app, sin buscar la URL cada vez.

## Que incluye

- Manifest propio de Ventas-Almacen.
- Icono del sistema de ventas.
- Service worker para cachear archivos estaticos.
- Boton de instalacion en el login cuando el navegador lo permite.
- Las respuestas `/api` no se cachean para proteger datos sensibles.

## Como instalar en computadora

1. Abrir `https://zow-six.vercel.app/ventas-almacen.html`.
2. Esperar que aparezca la opcion del navegador para instalar.
3. Tambien puede aparecer el boton `Instalar app de caja` en el login.
4. Confirmar instalacion.
5. Abrir la app instalada desde el escritorio o menu de aplicaciones.

## Como instalar en Android

1. Abrir la URL de Ventas-Almacen en Chrome.
2. Tocar el menu del navegador.
3. Elegir `Agregar a pantalla principal` o `Instalar app`.
4. Confirmar.

## Como instalar en iPhone o iPad

1. Abrir la URL de Ventas-Almacen en Safari.
2. Tocar Compartir.
3. Elegir `Agregar a pantalla de inicio`.
4. Confirmar.

## Limitaciones

- El POS necesita internet para vender, cobrar y consultar datos reales.
- La app puede abrir visualmente aunque no haya conexion, pero las operaciones dependen del backend.
- No se debe prometer modo offline completo hasta implementar cola local de ventas y sincronizacion.

## Recomendacion comercial

Para clientes con tablet o punto de caja fijo, instalar la PWA deja la experiencia mas profesional y reduce errores de navegacion. Es ideal para mostrar el sistema como una app propia de la tienda.
