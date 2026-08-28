import { EstadoIngreso } from "./scrape/ingresos";
import { INGRESO_COLUMNS, SALIDA_COLUMNS } from "./types";
import { queryIngresos, queryIngresosPorPlaca, querySalidas, querySalidasPorPlaca } from "./db/repository";

export type Seccion = "ingresos" | "salidas";
export type Modo = "fecha" | "placa";

export interface ConsultaOptions {
  seccion: Seccion;
  modo: Modo;
  inicio?: string;
  fin?: string;
  estado?: EstadoIngreso;
  placa?: string;
}

export interface Columna {
  key: string;
  header: string;
}

export interface ConsultaResultado {
  columns: Columna[];
  rows: Record<string, string>[];
}

export async function ejecutarConsulta(options: ConsultaOptions): Promise<ConsultaResultado> {
  const { seccion, modo, estado } = options;

  if (modo === "fecha" && (!options.inicio || !options.fin)) {
    throw new Error("Faltan fechas de inicio y fin");
  }
  if (modo === "placa" && !options.placa?.trim()) {
    throw new Error("Falta la placa a buscar");
  }

  if (seccion === "ingresos") {
    const rows =
      modo === "placa"
        ? await queryIngresosPorPlaca(options.placa!)
        : await queryIngresos(options.inicio!, options.fin!, estado);
    return { columns: INGRESO_COLUMNS as Columna[], rows: rows as unknown as Record<string, string>[] };
  }

  const rows =
    modo === "placa"
      ? await querySalidasPorPlaca(options.placa!)
      : await querySalidas(options.inicio!, options.fin!);
  return { columns: SALIDA_COLUMNS as Columna[], rows: rows as unknown as Record<string, string>[] };
}
