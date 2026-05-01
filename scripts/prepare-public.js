const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const outDir = path.join(root, "public");

const files = [
  "index.html",
  "app.js",
  "styles.css",
  "ventas-almacen.html",
  "ventas-almacen.js"
];

const directories = ["assets"];

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

for (const file of files) {
  fs.copyFileSync(path.join(root, file), path.join(outDir, file));
}

for (const directory of directories) {
  fs.cpSync(path.join(root, directory), path.join(outDir, directory), { recursive: true });
}

console.log(`Vercel static output prepared in ${outDir}`);
