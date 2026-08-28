import * as fs from "fs";
import * as path from "path";
import { IMG_DIR } from "./config";
import { normalizarPlaca } from "./utils";

const EXTENSIONES_VALIDAS = new Set([".jpg", ".jpeg", ".png"]);

// Lee la carpeta img/ y agrupa los archivos por placa normalizada. Se lee en
// cada llamada (barato: ~2000 archivos) en vez de cachear, para reflejar
// fotos nuevas sin reiniciar el servidor.
export function indexarFotos(): Map<string, string[]> {
  const indice = new Map<string, string[]>();
  if (!fs.existsSync(IMG_DIR)) return indice;

  for (const archivo of fs.readdirSync(IMG_DIR)) {
    const ext = path.extname(archivo).toLowerCase();
    if (!EXTENSIONES_VALIDAS.has(ext)) continue;

    // Fotos repetidas de una misma placa se nombran "PLACA (2).jpg", "PLACA (3).jpg".
    const base = path.basename(archivo, ext).replace(/\s*\(\d+\)$/, "");
    const placa = normalizarPlaca(base);
    if (!placa) continue;

    const lista = indice.get(placa) ?? [];
    lista.push(archivo);
    indice.set(placa, lista);
  }

  for (const lista of indice.values()) {
    lista.sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
  }

  return indice;
}
