import * as fs from "fs";
import { exportToExcel } from "./export/excel";
import { exportToWord } from "./export/word";
import { OUT_DIR } from "./config";
import { ejecutarConsulta, ConsultaOptions, Columna, Seccion } from "./query";

export type Formato = "excel" | "word" | "ambos";
export type SeccionExportable = Seccion | "inventario";

export interface GeneratedFile {
  seccion: SeccionExportable;
  formato: "excel" | "word";
  filename: string;
  registros: number;
}

export function sufijoArchivo(options: {
  modo: "fecha" | "placa";
  inicio?: string;
  fin?: string;
  placa?: string;
}): string {
  if (options.modo === "placa") {
    const placaSanitizada = options.placa?.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    return `placa_${placaSanitizada}`;
  }
  return `${options.inicio}_${options.fin}`;
}

const NOMBRE_SECCION: Record<SeccionExportable, string> = {
  ingresos: "Ingresos",
  salidas: "Salidas",
  inventario: "Inventario",
};

const TITULO_SECCION: Record<SeccionExportable, string> = {
  ingresos: "Ingresos a Patios",
  salidas: "Salidas de Patios",
  inventario: "Inventario Combinado (Excel + Scraping)",
};

export async function writeExportFiles(
  seccion: SeccionExportable,
  formato: Formato,
  columns: Columna[],
  rows: Record<string, string>[],
  sufijo: string
): Promise<GeneratedFile[]> {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const generated: GeneratedFile[] = [];
  const nombreSeccion = NOMBRE_SECCION[seccion];
  const titulo = TITULO_SECCION[seccion];

  if (formato === "excel" || formato === "ambos") {
    const filename = `${seccion}_${sufijo}.xlsx`;
    await exportToExcel(rows, columns, nombreSeccion, `${OUT_DIR}/${filename}`);
    generated.push({ seccion, formato: "excel", filename, registros: rows.length });
  }
  if (formato === "word" || formato === "ambos") {
    const filename = `${seccion}_${sufijo}.docx`;
    await exportToWord(rows, columns, titulo, `${OUT_DIR}/${filename}`);
    generated.push({ seccion, formato: "word", filename, registros: rows.length });
  }

  return generated;
}

// Usado por el CLI (main.ts): consulta y exporta en un solo paso.
export async function runExport(
  options: ConsultaOptions & { formato: Formato }
): Promise<GeneratedFile[]> {
  const { columns, rows } = await ejecutarConsulta(options);
  const sufijo = sufijoArchivo(options);
  return writeExportFiles(options.seccion, options.formato, columns, rows, sufijo);
}
