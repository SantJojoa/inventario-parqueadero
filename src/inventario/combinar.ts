import { leerInventarioExcel } from "./excel";
import { InventarioRow, INVENTARIO_COLUMNS } from "../types";
import { getPlacasEnRango } from "../db/repository";
import { indexarFotos } from "../fotos";

export interface ResumenInventario {
  totalExcel: number;
  totalScraping: number;
  transito: number;
  policiaFiscalia: number;
  autorizadosSalidaExcel: number;
}

export interface InventarioResultado {
  columns: typeof INVENTARIO_COLUMNS;
  rows: InventarioRow[];
  resumen: ResumenInventario;
}

// Combina el Excel de la empresa (hoja General) con las placas vistas en el
// scraping dentro del rango de fechas: si una placa está en ambas fuentes es
// un vehículo de Tránsito; si solo está en el Excel, es de Policía/Fiscalía.
// Placas que solo aparecen en el scraping (aún no cargadas al Excel) también
// se listan como Tránsito, porque el criterio de "otros" es exclusivamente
// "está en el Excel pero no en el scraping".
// Las placas del scraping se leen de la BD (poblada por la sincronización
// incremental), no en vivo, así la consulta es instantánea.
export async function combinarInventario(inicio: string, fin: string): Promise<InventarioResultado> {
  const excelRows = await leerInventarioExcel();
  const excelPorPlaca = new Map(excelRows.map((r) => [r.placa, r]));

  const placasScraping = await getPlacasEnRango(inicio, fin);
  const indiceFotos = indexarFotos();

  const todasLasPlacas = new Set<string>([...excelPorPlaca.keys(), ...placasScraping]);

  const rows: InventarioRow[] = [...todasLasPlacas].map((placa) => {
    const enScraping = placasScraping.has(placa);
    const excel = excelPorPlaca.get(placa);

    return {
      placa,
      categoria: enScraping ? "Tránsito" : "Policía/Fiscalía",
      tipoVehiculo: excel?.tipoVehiculo ?? "",
      ubicacion: excel?.ubicacion ?? "",
      estadoSalidaExcel: excel?.estadoSalida ?? "",
      enExcel: excel ? "Sí" : "No",
      enScraping: enScraping ? "Sí" : "No",
      observaciones: excel?.observaciones ?? "",
      fotos: indiceFotos.get(placa) ?? [],
    };
  });

  rows.sort((a, b) => {
    if (a.categoria !== b.categoria) return a.categoria === "Tránsito" ? -1 : 1;
    return a.placa.localeCompare(b.placa);
  });

  const resumen: ResumenInventario = {
    totalExcel: excelRows.length,
    totalScraping: placasScraping.size,
    transito: rows.filter((r) => r.categoria === "Tránsito").length,
    policiaFiscalia: rows.filter((r) => r.categoria === "Policía/Fiscalía").length,
    autorizadosSalidaExcel: rows.filter((r) => r.estadoSalidaExcel === "AUTORIZADO").length,
  };

  return { columns: INVENTARIO_COLUMNS, rows, resumen };
}
