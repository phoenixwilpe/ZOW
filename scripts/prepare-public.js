const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const outDir = path.join(root, "public");

const files = [
  "index.html",
  "correspondencia.html",
  "app.js",
  "styles.css",
  "system-zow.html",
  "system-zow.js",
  "consulta.html",
  "consulta.js",
  "ventas-almacen.html",
  "ventas-almacen.js",
  "robots.txt",
  "sitemap.xml",
  "site.webmanifest",
  "ventas-pwa.webmanifest",
  "ventas-sw.js"
];

const assetFiles = [
  "assets/brand/system-zow-header-logo.svg",
  "assets/brand/system-zow-og.svg",
  "assets/brand/zow-correspondencia-logo.svg",
  "assets/brand/zow-salud-logo.svg",
  "assets/brand/zow-ventas-almacen-logo.svg",
  "assets/brand/zow-ventas-almacen-icon-transparent.png",
  "assets/brand/zow-ventas-almacen-icon.png"
];

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

for (const file of files) {
  fs.copyFileSync(path.join(root, file), path.join(outDir, file));
}

for (const file of assetFiles) {
  const source = path.join(root, file);
  const target = path.join(outDir, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

console.log(`Vercel static output prepared in ${outDir}`);
