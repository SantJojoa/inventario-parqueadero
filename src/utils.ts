export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Placas se escriben con guiones/espacios inconsistentes según la fuente
// (Excel, nombres de archivo de fotos, scraping); esta forma canónica
// (mayúsculas, solo A-Z0-9) es la que se usa para cruzar entre fuentes.
export function normalizarPlaca(valor: unknown): string {
  return String(valor ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

const PLACA_RANGE_YEARS = 2;

// Rango amplio usado cuando el usuario busca solo por placa (sin fechas).
export function defaultPlacaRange(): { fechaInicio: string; fechaFin: string } {
  const fin = new Date();
  const inicio = new Date(fin);
  inicio.setFullYear(inicio.getFullYear() - PLACA_RANGE_YEARS);

  return {
    fechaInicio: inicio.toISOString().slice(0, 10),
    fechaFin: fin.toISOString().slice(0, 10),
  };
}
