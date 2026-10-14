import ExcelJS from "exceljs";
import { INVENTARIO_EXCEL_PATH, INVENTARIO_EXCEL_SHEET } from "../config";
import { normalizarPlaca } from "../utils";

export interface ExcelInventarioRow {
  placa: string;
  tipoVehiculo: string;
  ubicacion: string;
  observaciones: string;
  estadoSalida: string; // "AUTORIZADO" o ""
  numero: number;
}

// La columna SALIDAS del Excel trae "AUTORIZADO" con variantes de tipeo
// (ej. "AUTORIADO"); cualquier texto que empiece por "AUTOR" se normaliza igual.
function normalizarEstadoSalida(valor: unknown): string {
  const texto = String(valor ?? "").trim().toUpperCase();
  return texto.startsWith("AUTOR") ? "AUTORIZADO" : "";
}

// Lee la hoja "General" del Excel de inventario de la empresa y devuelve un
// registro por placa. Cuando una placa aparece repetida (reubicaciones, etc.)
// se prioriza la fila vigente (sin salida autorizada) y, en empate, la de
// mayor número de fila (más reciente).
export async function leerInventarioExcel(
  rutaArchivo: string = INVENTARIO_EXCEL_PATH
): Promise<ExcelInventarioRow[]> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.readFile(rutaArchivo);
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : String(err);
    if (mensaje.startsWith("File not found")) return [];
    throw err;
  }

  const sheet = workbook.getWorksheet(INVENTARIO_EXCEL_SHEET);
  if (!sheet) {
    throw new Error(`No se encontró la hoja "${INVENTARIO_EXCEL_SHEET}" en ${rutaArchivo}`);
  }

  const porPlaca = new Map<string, ExcelInventarioRow>();

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return; // encabezado

    const placa = normalizarPlaca(row.getCell(2).value);
    if (!placa) return;

    const candidato: ExcelInventarioRow = {
      placa,
      tipoVehiculo: String(row.getCell(3).value ?? "").trim(),
      ubicacion: String(row.getCell(5).value ?? "").trim(),
      observaciones: String(row.getCell(6).value ?? "").trim(),
      estadoSalida: normalizarEstadoSalida(row.getCell(7).value),
      numero: Number(row.getCell(1).value) || rowNumber,
    };

    const existente = porPlaca.get(placa);
    if (!existente) {
      porPlaca.set(placa, candidato);
      return;
    }

    const candidatoVigente = !candidato.estadoSalida;
    const existenteVigente = !existente.estadoSalida;

    if (candidatoVigente && !existenteVigente) {
      porPlaca.set(placa, candidato);
    } else if (candidatoVigente === existenteVigente && candidato.numero > existente.numero) {
      porPlaca.set(placa, candidato);
    }
  });

  return [...porPlaca.values()];
}
