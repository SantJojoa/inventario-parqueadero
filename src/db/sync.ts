import { BrowserContext } from "playwright";
import { getAuthenticatedContext } from "../auth/login";
import { fetchIngresosRaw, EstadoIngreso } from "../scrape/ingresos";
import { fetchSalidasRaw } from "../scrape/salidas";
import { upsertIngresos, upsertSalidas, getSyncState, setSyncState } from "./repository";
import { guardarInventarioEnBD } from "../inventario/combinar";
import { sleep } from "../utils";
import { REQUEST_DELAY_MS, SCRAPING_DESDE } from "../config";

const ESTADOS: EstadoIngreso[] = ["1", "2", "3"];

export interface SyncStatus {
  corriendo: boolean;
  progreso?: string;
  iniciado?: string;
  terminado?: string;
  error?: string;
}

let status: SyncStatus = { corriendo: false };

export function getSyncStatus(): SyncStatus {
  return status;
}

function hoy(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function addMonths(fecha: string, meses: number): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + meses);
  return d.toISOString().slice(0, 10);
}

// Trocea un rango de fechas en tramos de ~1 mes: rangos muy amplios son lentos
// y, si algo falla a mitad de camino, perder solo un tramo (no toda la
// sincronización) porque cada tramo actualiza sync_state al terminar.
function generarChunks(desde: string, hasta: string): { inicio: string; fin: string }[] {
  const chunks: { inicio: string; fin: string }[] = [];
  let inicio = desde;
  while (inicio <= hasta) {
    let fin = addDays(addMonths(inicio, 1), -1);
    if (fin > hasta) fin = hasta;
    chunks.push({ inicio, fin });
    inicio = addDays(fin, 1);
  }
  return chunks;
}

// El sitio devuelve "Error al consultar la información..." si se golpea
// demasiado rápido (WAF/rate-limit); reintenta con backoff antes de rendirse.
async function conReintento<T>(fn: () => Promise<T>, intentos = 3): Promise<T> {
  for (let intento = 1; intento <= intentos; intento++) {
    try {
      return await fn();
    } catch (err) {
      if (intento === intentos) throw err;
      await sleep(REQUEST_DELAY_MS * 2 ** intento);
    }
  }
  throw new Error("inalcanzable");
}

async function sincronizarIngresoEstado(context: BrowserContext, estado: EstadoIngreso): Promise<void> {
  const clave = `ingresos_${estado}`;
  const ultima = await getSyncState(clave);
  const desde = ultima ? addDays(ultima, 1) : SCRAPING_DESDE;
  const hasta = hoy();
  if (desde > hasta) return;

  for (const chunk of generarChunks(desde, hasta)) {
    status.progreso = `Ingresos (estado ${estado}): ${chunk.inicio} a ${chunk.fin}`;
    await sleep(REQUEST_DELAY_MS);
    const records = await conReintento(() => fetchIngresosRaw(context, chunk.inicio, chunk.fin, estado));
    await upsertIngresos(records, estado);
    await setSyncState(clave, chunk.fin);
  }
}

async function sincronizarSalidas(context: BrowserContext): Promise<void> {
  const clave = "salidas";
  const ultima = await getSyncState(clave);
  const desde = ultima ? addDays(ultima, 1) : SCRAPING_DESDE;
  const hasta = hoy();
  if (desde > hasta) return;

  for (const chunk of generarChunks(desde, hasta)) {
    status.progreso = `Salidas: ${chunk.inicio} a ${chunk.fin}`;
    await sleep(REQUEST_DELAY_MS);
    const records = await conReintento(() => fetchSalidasRaw(context, chunk.inicio, chunk.fin));
    await upsertSalidas(records);
    await setSyncState(clave, chunk.fin);
  }
}

// Trae a la BD todo lo nuevo desde la última sincronización guardada (o desde
// SCRAPING_DESDE si nunca se ha sincronizado) para los 3 estados de Ingresos
// y para Salidas. Es seguro llamarla repetidas veces: si ya hay una
// sincronización corriendo, no arranca una segunda en paralelo.
export async function sincronizarIncremental(): Promise<SyncStatus> {
  if (status.corriendo) return status;

  status = { corriendo: true, iniciado: new Date().toISOString() };

  try {
    const { browser, context } = await getAuthenticatedContext();
    try {
      for (const estado of ESTADOS) {
        await sincronizarIngresoEstado(context, estado);
      }
      await sincronizarSalidas(context);
    } finally {
      await browser.close();
    }
  } catch (err) {
    status.error = err instanceof Error ? err.message : String(err);
  }

  // Aunque el scraping falle, se guarda la clasificación con lo que ya hay en
  // la BD (el Excel pudo cambiar).
  try {
    status.progreso = "Guardando clasificación del inventario";
    await guardarInventarioEnBD();
  } catch (err) {
    status.error ??= `No se pudo guardar el inventario: ${err instanceof Error ? err.message : String(err)}`;
  }

  status = { corriendo: false, terminado: new Date().toISOString(), error: status.error };

  return status;
}

if (require.main === module) {
  sincronizarIncremental().then((resultado) => {
    console.log(resultado.error ? `Sincronización con error: ${resultado.error}` : "Sincronización completa.");
    process.exit(resultado.error ? 1 : 0);
  });
}
