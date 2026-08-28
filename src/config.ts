import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ quiet: true });

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta variable de entorno ${name} (revisa tu .env)`);
  return value;
}

export const APP_URL = process.env.APP_URL || "https://www.moviliza.com.co/Patios";
export const APP_USERNAME = required("APP_USERNAME");
export const APP_PASSWORD = required("APP_PASSWORD");

export const STORAGE_STATE_PATH = path.resolve(__dirname, "..", "storageState.json");
export const OUT_DIR = path.resolve(__dirname, "..", "out");

export const INVENTARIO_EXCEL_PATH =
  process.env.INVENTARIO_EXCEL_PATH || path.resolve(__dirname, "..", "data", "inventario.xlsx");
export const INVENTARIO_EXCEL_SHEET = "General";

// Carpeta con fotos de vehículos, un archivo por placa (algunas con guion,
// ej. "013-NBJ.jpg") y ocasionalmente varias fotos por placa (" (2)", " (3)").
export const IMG_DIR = process.env.IMG_DIR || path.resolve(__dirname, "..", "img");

// Espaciado entre peticiones a la API para no disparar el rate-limit/WAF del sitio.
export const REQUEST_DELAY_MS = 1500;

// Rangos de fechas amplios (ej. varios meses) hacen que HistorialPatios/SalidasVehiculos
// tarden más que el timeout por defecto de Playwright (30s) en responder.
export const REQUEST_TIMEOUT_MS = 120_000;

export const DB_HOST = process.env.DB_HOST || "localhost";
export const DB_PORT = process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432;
export const DB_NAME = process.env.DB_NAME || "inventario_parqueadero";
export const DB_USER = process.env.DB_USER || "inventario";
export const DB_PASSWORD = process.env.DB_PASSWORD || "inventario";

// Primer día con datos relevantes en Moviliza: punto de partida del backfill
// histórico y tope inferior de la sincronización incremental.
export const SCRAPING_DESDE = "2023-06-22";
