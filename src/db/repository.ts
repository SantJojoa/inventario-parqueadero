import { pool } from "./pool";
import { IngresoApiRecord, SalidaApiRecord, IngresoRow, SalidaRow } from "../types";
import { mapIngresoRow } from "../scrape/ingresos";
import { mapSalidaRow } from "../scrape/salidas";

function normalizarPlaca(valor: string): string {
  return valor.trim().toUpperCase().replace(/[\s-]/g, "");
}

function placaOrNull(valor: string | undefined): string | null {
  return valor ? normalizarPlaca(valor) : null;
}

export async function upsertIngresos(records: IngresoApiRecord[], estadoConsultado: string): Promise<void> {
  if (records.length === 0) return;

  await pool.query(
    `INSERT INTO ingresos (id, estado_consultado, fecha_ingreso, placa, clase, tipo_ingreso, grua, estado, raw)
     SELECT * FROM unnest($1::bigint[], $2::smallint[], $3::date[], $4::text[], $5::text[], $6::text[], $7::text[], $8::text[], $9::jsonb[])
     ON CONFLICT (id, estado_consultado) DO UPDATE SET
       fecha_ingreso = EXCLUDED.fecha_ingreso,
       placa = EXCLUDED.placa,
       clase = EXCLUDED.clase,
       tipo_ingreso = EXCLUDED.tipo_ingreso,
       grua = EXCLUDED.grua,
       estado = EXCLUDED.estado,
       raw = EXCLUDED.raw,
       synced_at = now()`,
    [
      records.map((r) => r.id),
      records.map(() => Number(estadoConsultado)),
      records.map((r) => r.fechaIngreso ?? null),
      records.map((r) => placaOrNull(r.vehiculo?.placa)),
      records.map((r) => r.vehiculo?.tipoVehiculoId?.nombre ?? null),
      records.map((r) => r.tipoIngresoPatio?.nombre ?? null),
      records.map((r) => r.grua?.placa ?? null),
      records.map((r) => r.movimientoPatio?.nombre ?? null),
      records.map((r) => JSON.stringify(r)),
    ]
  );
}

export async function upsertSalidas(records: SalidaApiRecord[]): Promise<void> {
  if (records.length === 0) return;

  await pool.query(
    `INSERT INTO salidas (id, fecha_ingreso, fecha_salida, placa, raw)
     SELECT * FROM unnest($1::bigint[], $2::date[], $3::timestamptz[], $4::text[], $5::jsonb[])
     ON CONFLICT (id) DO UPDATE SET
       fecha_ingreso = EXCLUDED.fecha_ingreso,
       fecha_salida = EXCLUDED.fecha_salida,
       placa = EXCLUDED.placa,
       raw = EXCLUDED.raw,
       synced_at = now()`,
    [
      records.map((r) => r.id),
      records.map((r) => r.fechaIngreso ?? null),
      records.map((r) => r.fechaSalida ?? null),
      records.map((r) => placaOrNull(r.vehiculo?.placa)),
      records.map((r) => JSON.stringify(r)),
    ]
  );
}

export async function getSyncState(clave: string): Promise<string | null> {
  const res = await pool.query<{ ultima_fecha: string }>(
    "SELECT ultima_fecha::text FROM sync_state WHERE clave = $1",
    [clave]
  );
  return res.rows[0]?.ultima_fecha ?? null;
}

export async function setSyncState(clave: string, fecha: string): Promise<void> {
  await pool.query(
    `INSERT INTO sync_state (clave, ultima_fecha, actualizado_en)
     VALUES ($1, $2, now())
     ON CONFLICT (clave) DO UPDATE SET ultima_fecha = EXCLUDED.ultima_fecha, actualizado_en = now()`,
    [clave, fecha]
  );
}

export async function getUltimaSincronizacion(): Promise<string | null> {
  const res = await pool.query<{ actualizado_en: string }>(
    "SELECT MAX(actualizado_en)::text AS actualizado_en FROM sync_state"
  );
  return res.rows[0]?.actualizado_en ?? null;
}

export async function queryIngresos(
  inicio: string,
  fin: string,
  estado?: string
): Promise<IngresoRow[]> {
  const params: unknown[] = [inicio, fin];
  let where = "fecha_ingreso BETWEEN $1 AND $2";
  if (estado) {
    params.push(Number(estado));
    where += ` AND estado_consultado = $${params.length}`;
  }
  const res = await pool.query<{ raw: IngresoApiRecord }>(
    `SELECT raw FROM ingresos WHERE ${where} ORDER BY fecha_ingreso`,
    params
  );
  return res.rows.map((r) => mapIngresoRow(r.raw));
}

export async function queryIngresosPorPlaca(placa: string): Promise<IngresoRow[]> {
  const res = await pool.query<{ raw: IngresoApiRecord }>(
    "SELECT raw FROM ingresos WHERE placa = $1 ORDER BY fecha_ingreso",
    [normalizarPlaca(placa)]
  );
  return res.rows.map((r) => mapIngresoRow(r.raw));
}

export async function querySalidas(inicio: string, fin: string): Promise<SalidaRow[]> {
  const res = await pool.query<{ raw: SalidaApiRecord }>(
    "SELECT raw FROM salidas WHERE fecha_salida::date BETWEEN $1 AND $2 ORDER BY fecha_salida",
    [inicio, fin]
  );
  return res.rows.map((r) => mapSalidaRow(r.raw));
}

export async function querySalidasPorPlaca(placa: string): Promise<SalidaRow[]> {
  const res = await pool.query<{ raw: SalidaApiRecord }>(
    "SELECT raw FROM salidas WHERE placa = $1 ORDER BY fecha_salida",
    [normalizarPlaca(placa)]
  );
  return res.rows.map((r) => mapSalidaRow(r.raw));
}

// Placas vistas en el rango dado, ya sea en Ingresos (cualquiera de los 3
// estados) o en Salidas. Usado por el cruce de inventario.
export async function getPlacasEnRango(inicio: string, fin: string): Promise<Set<string>> {
  const res = await pool.query<{ placa: string }>(
    `SELECT DISTINCT placa FROM (
       SELECT placa FROM ingresos WHERE fecha_ingreso BETWEEN $1 AND $2 AND placa IS NOT NULL
       UNION
       SELECT placa FROM salidas WHERE fecha_salida::date BETWEEN $1 AND $2 AND placa IS NOT NULL
     ) t`,
    [inicio, fin]
  );
  return new Set(res.rows.map((r) => normalizarPlaca(r.placa)));
}

export interface InventarioFilaBD {
  placa: string;
  categoria: string;
  tipoVehiculo: string;
  ubicacion: string;
  estadoSalidaExcel: string;
  enExcel: boolean;
  enMoviliza: boolean;
  observaciones: string;
}

// Reemplaza el contenido de la tabla inventario con la clasificación más
// reciente (Tránsito / Policía-Fiscalía), en una sola transacción para que
// nunca quede a medias si algo falla.
export async function reemplazarInventario(filas: InventarioFilaBD[]): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM inventario");
    const LOTE = 5000;
    for (let i = 0; i < filas.length; i += LOTE) {
      const lote = filas.slice(i, i + LOTE);
      await client.query(
        `INSERT INTO inventario (placa, categoria, tipo_vehiculo, ubicacion, estado_salida_excel, en_excel, en_moviliza, observaciones)
         SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::boolean[], $7::boolean[], $8::text[])`,
        [
          lote.map((f) => f.placa),
          lote.map((f) => f.categoria),
          lote.map((f) => f.tipoVehiculo),
          lote.map((f) => f.ubicacion),
          lote.map((f) => f.estadoSalidaExcel),
          lote.map((f) => f.enExcel),
          lote.map((f) => f.enMoviliza),
          lote.map((f) => f.observaciones),
        ]
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
