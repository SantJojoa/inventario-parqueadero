import { BrowserContext } from "playwright";
import { APP_URL, REQUEST_DELAY_MS, REQUEST_TIMEOUT_MS } from "../config";
import { IngresoApiRecord, IngresoRow } from "../types";
import { sleep, defaultPlacaRange } from "../utils";

export type EstadoIngreso = "1" | "2" | "3"; // 1=Ingreso, 2=Salida, 3=Autorizacion

export const ESTADO_INGRESO_LABELS: Record<EstadoIngreso, string> = {
  "1": "Ingreso",
  "2": "Salida",
  "3": "Autorizacion",
};

export async function fetchIngresosRaw(
  context: BrowserContext,
  fechaInicio: string,
  fechaFin: string,
  estado: EstadoIngreso = "1"
): Promise<IngresoApiRecord[]> {
  const res = await context.request.post(`${APP_URL}/webresources/ControlPatio/HistorialPatios`, {
    data: { estado, fechaInicio, fechaFin },
    timeout: REQUEST_TIMEOUT_MS,
  });

  if (!res.ok()) {
    throw new Error(`HistorialPatios respondió ${res.status()}: ${await res.text()}`);
  }

  return res.json();
}

export function mapIngresoRow(r: IngresoApiRecord): IngresoRow {
  return {
    fechaInicio: r.fechaIngreso ?? "",
    vehiculo: r.vehiculo?.placa ?? "",
    clase: r.vehiculo?.tipoVehiculoId?.nombre ?? "",
    tipoIngreso: r.tipoIngresoPatio?.nombre ?? "",
    grua: r.grua?.placa ?? "",
    estado: r.movimientoPatio?.nombre ?? "",
  };
}

export async function fetchIngresos(
  context: BrowserContext,
  fechaInicio: string,
  fechaFin: string,
  estado: EstadoIngreso = "1"
): Promise<IngresoRow[]> {
  const records = await fetchIngresosRaw(context, fechaInicio, fechaFin, estado);
  return records.map(mapIngresoRow);
}

// La API no soporta filtrar por placa directamente, así que se consultan los
// tres estados sobre un rango amplio de fechas y se filtra el resultado.
export async function fetchIngresosPorPlaca(
  context: BrowserContext,
  placa: string
): Promise<IngresoRow[]> {
  const { fechaInicio, fechaFin } = defaultPlacaRange();
  const placaNormalizada = placa.trim().toUpperCase();
  const estados: EstadoIngreso[] = ["1", "2", "3"];
  const resultados: IngresoRow[] = [];

  for (let i = 0; i < estados.length; i++) {
    if (i > 0) await sleep(REQUEST_DELAY_MS);
    const rows = await fetchIngresos(context, fechaInicio, fechaFin, estados[i]);
    resultados.push(...rows.filter((r) => r.vehiculo.toUpperCase() === placaNormalizada));
  }

  return resultados;
}
