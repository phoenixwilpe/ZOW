require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("node:path");

const app = express();
const port = Number(process.env.VENTAS_PORT || 4175);
const rootDir = path.join(__dirname, "..");

app.use(cors());

app.get("/", (req, res) => {
  res.sendFile(path.join(rootDir, "ventas-almacen.html"));
});

app.use(express.static(rootDir, { index: false }));

app.listen(port, () => {
  console.log(`Zow Ventas-Almacen listo en http://localhost:${port}`);
});
