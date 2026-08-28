import { BrowserContext } from "playwright";
import { APP_URL, REQUEST_TIMEOUT_MS } from "../config";
import { SalidaApiRecord, SalidaRow } from "../types";
import { defaultPlacaRange } from "../utils";

function formatFecha(iso: string | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export async function fetchSalidasRaw(
  context: BrowserContext,
  fechaInicio: string,
  fechaFin: string,
  placaVehiculo?: string
): Promise<SalidaApiRecord[]> {
  const filtro: Record<string, string> = { fechaInicio, fechaFin };
  if (placaVehiculo) filtro.placaVehiculo = placaVehiculo;

  const res = await context.request.post(`${APP_URL}/webresources/ControlPatio/SalidasVehiculos`, {
    data: filtro,
    timeout: REQUEST_TIMEOUT_MS,
  });

  if (!res.ok()) {
    throw new Error(`SalidasVehiculos respondió ${res.status()}: ${await res.text()}`);
  }

  return res.json();
}

export function mapSalidaRow(r: SalidaApiRecord): SalidaRow {
  return {
    placa: r.vehiculo?.placa ?? "",
    modelo: r.vehiculo?.modelo ? String(r.vehiculo.modelo) : "",
    color: r.vehiculo?.colorId?.nombre ?? "",
    marca: r.vehiculo?.marca ?? "",
    patio: r.patio?.nombre ?? "",
    fechaIngreso: formatFecha(r.fechaIngreso),
    fechaYHoraSalida: r.fechaSalida ?? "",
    autorizadoEntrega: r.usuarioEntregaVehiculo ? "AUTORIZADO" : "SIN AUTORIZAR",
  };
}

export async function fetchSalidas(
  context: BrowserContext,
  fechaInicio: string,
  fechaFin: string,
  placaVehiculo?: string
): Promise<SalidaRow[]> {
  const records = await fetchSalidasRaw(context, fechaInicio, fechaFin, placaVehiculo);
  return records.map(mapSalidaRow);
}

export async function fetchSalidasPorPlaca(
  context: BrowserContext,
  placa: string
): Promise<SalidaRow[]> {
  const { fechaInicio, fechaFin } = defaultPlacaRange();
  return fetchSalidas(context, fechaInicio, fechaFin, placa);
}
