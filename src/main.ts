import { runExport, Formato } from "./runExport";
import { Modo, Seccion } from "./query";
import { EstadoIngreso } from "./scrape/ingresos";
import { REQUEST_DELAY_MS } from "./config";
import { sleep } from "./utils";

type SeccionCLI = Seccion | "ambas";

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string, fallback?: string) => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : fallback;
  };

  const today = new Date().toISOString().slice(0, 10);
  return {
    inicio: get("--inicio", today)!,
    fin: get("--fin", today)!,
    seccion: get("--seccion", "ambas") as SeccionCLI,
    formato: get("--formato", "ambos") as Formato,
    modo: get("--modo", "fecha") as Modo,
    estado: get("--estado") as EstadoIngreso | undefined,
    placa: get("--placa"),
  };
}

async function main() {
  const args = parseArgs();
  const secciones: Seccion[] = args.seccion === "ambas" ? ["ingresos", "salidas"] : [args.seccion];

  for (let i = 0; i < secciones.length; i++) {
    if (i > 0) await sleep(REQUEST_DELAY_MS);

    const files = await runExport({
      seccion: secciones[i],
      modo: args.modo,
      inicio: args.inicio,
      fin: args.fin,
      estado: args.estado,
      placa: args.placa,
      formato: args.formato,
    });

    for (const f of files) {
      console.log(`${f.seccion} (${f.formato}): ${f.filename} - ${f.registros} registros`);
    }
  }

  console.log("Listo.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
