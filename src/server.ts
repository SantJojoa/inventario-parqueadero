import express from "express";
import * as path from "path";
import { ejecutarConsulta, Seccion, Modo, Columna } from "./query";
import { writeExportFiles, sufijoArchivo, Formato, SeccionExportable } from "./runExport";
import { EstadoIngreso } from "./scrape/ingresos";
import { OUT_DIR, IMG_DIR } from "./config";
import { combinarInventario } from "./inventario/combinar";
import { migrate } from "./db/migrate";
import { sincronizarIncremental, getSyncStatus } from "./db/sync";
import { getUltimaSincronizacion } from "./db/repository";

const app = express();
app.use(express.json({ limit: "5mb" }));
app.use(express.static(path.join(__dirname, "..", "public")));
app.use("/img", express.static(IMG_DIR));

function seccionValida(value: unknown): value is Seccion {
  return value === "ingresos" || value === "salidas";
}

function seccionExportableValida(value: unknown): value is SeccionExportable {
  return value === "ingresos" || value === "salidas" || value === "inventario";
}

app.post("/api/consultar", async (req, res) => {
  const { seccion, modo, inicio, fin, estado, placa } = req.body as {
    seccion?: Seccion;
    modo?: Modo;
    inicio?: string;
    fin?: string;
    estado?: EstadoIngreso;
    placa?: string;
  };

  if (!seccionValida(seccion)) {
    res.status(400).json({ error: "Sección inválida" });
    return;
  }

  try {
    const resultado = await ejecutarConsulta({
      seccion,
      modo: modo ?? "fecha",
      inicio,
      fin,
      estado,
      placa,
    });
    res.json(resultado);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.post("/api/inventario", async (req, res) => {
  const { inicio, fin } = req.body as { inicio?: string; fin?: string };

  if (!inicio || !fin) {
    res.status(400).json({ error: "Faltan fechas de inicio y fin" });
    return;
  }

  try {
    const resultado = await combinarInventario(inicio, fin);
    res.json(resultado);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.post("/api/exportar", async (req, res) => {
  const { seccion, formato, columns, rows, modo, inicio, fin, placa } = req.body as {
    seccion?: SeccionExportable;
    formato?: Formato;
    columns?: Columna[];
    rows?: Record<string, string>[];
    modo?: Modo;
    inicio?: string;
    fin?: string;
    placa?: string;
  };

  if (!seccionExportableValida(seccion)) {
    res.status(400).json({ error: "Sección inválida" });
    return;
  }
  if (!Array.isArray(rows) || !Array.isArray(columns)) {
    res.status(400).json({ error: "Faltan los datos a exportar" });
    return;
  }

  try {
    const sufijo = sufijoArchivo({ modo: modo ?? "fecha", inicio, fin, placa });
    const files = await writeExportFiles(seccion, formato ?? "ambos", columns, rows, sufijo);
    res.json({ files });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.get("/api/files/:name", (req, res) => {
  const filename = path.basename(req.params.name);
  res.download(path.join(OUT_DIR, filename));
});

app.post("/api/sync", (req, res) => {
  sincronizarIncremental().catch((err) => console.error("Error en sincronización:", err));
  res.json(getSyncStatus());
});

app.get("/api/sync/estado", async (req, res) => {
  const [estado, ultimaSincronizacion] = await Promise.all([getSyncStatus(), getUltimaSincronizacion()]);
  res.json({ ...estado, ultimaSincronizacion });
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

migrate()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Interfaz disponible en http://localhost:${PORT}`);
    });
    sincronizarIncremental().catch((err) => console.error("Error en sincronización inicial:", err));
  })
  .catch((err) => {
    console.error("No se pudo migrar la base de datos:", err);
    process.exit(1);
  });
