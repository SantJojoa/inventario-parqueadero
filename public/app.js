const $ = (id) => document.getElementById(id);

const DESDE_DEFECTO = "2021-01-01";
const TAMANOS = [25, 50, 100, 250];

const estado = {
  datos: null, // { columns, rows, resumen }
  categoria: "",
  tipo: "",
  salida: "",
  fuente: "",
  texto: "",
  orden: { key: null, dir: 1 },
  pagina: 1,
  porPagina: 50,
};

// ---------- utilidades ----------

function el(tag, props = {}, ...hijos) {
  const nodo = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") nodo.className = v;
    else if (k.startsWith("on")) nodo.addEventListener(k.slice(2), v);
    else if (v === true) nodo.setAttribute(k, "");
    else if (v !== false && v != null) nodo.setAttribute(k, v);
  }
  for (const h of hijos.flat()) if (h != null) nodo.append(h);
  return nodo;
}

const num = (n) => Number(n).toLocaleString("es-CO");
const hoy = () => new Date().toISOString().slice(0, 10);

function fechaHora(iso) {
  if (!iso) return "nunca";
  return new Date(iso).toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function fechaCorta(iso) {
  return new Date(iso + "T00:00:00").toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
}

// Devuelve el texto con las coincidencias de la búsqueda resaltadas.
function resaltar(texto, consulta) {
  if (!consulta || !texto) return texto;
  const i = texto.toLowerCase().indexOf(consulta.toLowerCase());
  if (i < 0) return texto;
  return [texto.slice(0, i), el("mark", {}, texto.slice(i, i + consulta.length)), texto.slice(i + consulta.length)];
}

function vacio() {
  return el("span", { class: "vacio" }, "—");
}

// ---------- sincronización ----------

function iniciarSync() {
  const cont = $("syncWidget");
  const info = el("span", { class: "estado" }, "Consultando…");
  const boton = el("button", { type: "button", class: "btn claro chico" }, "Actualizar datos");
  cont.append(info, boton);
  let timer = null;

  async function revisar() {
    try {
      const d = await (await fetch("/api/sync/estado")).json();
      if (d.corriendo) {
        info.className = "estado trabajando";
        info.textContent = d.progreso ? `Actualizando… ${d.progreso}` : "Actualizando…";
        boton.disabled = true;
        if (!timer) timer = setInterval(revisar, 4000);
        return;
      }
      if (timer) {
        clearInterval(timer);
        timer = null;
        cargar(); // terminó: refresca el cruce con los datos nuevos
      }
      boton.disabled = false;
      if (d.error) {
        info.className = "estado error";
        info.textContent = "La última actualización falló";
        info.title = d.error;
      } else {
        info.className = "estado";
        info.title = "";
        info.textContent = `Datos de Moviliza al ${fechaHora(d.ultimaSincronizacion)}`;
      }
    } catch {
      info.className = "estado error";
      info.textContent = "Sin conexión con el servidor";
    }
  }

  boton.addEventListener("click", async () => {
    boton.disabled = true;
    info.className = "estado trabajando";
    info.textContent = "Iniciando…";
    try {
      await fetch("/api/sync", { method: "POST" });
    } catch {}
    revisar();
  });

  revisar();
}

// ---------- filtrado y orden ----------

const VALOR_ORDEN = {
  placa: (r) => r.placa,
  categoria: (r) => r.categoria,
  tipoVehiculo: (r) => r.tipoVehiculo,
  ubicacion: (r) => r.ubicacion,
  salida: (r) => (r.enExcel !== "Sí" ? "" : r.estadoSalidaExcel === "AUTORIZADO" ? "Autorizada" : "Sin autorizar"),
  fuente: (r) => `${r.enExcel}${r.enScraping}`,
};

function filasFiltradas() {
  const { rows } = estado.datos;
  const q = estado.texto.trim().toLowerCase();
  const filtradas = rows.filter((r) => {
    if (estado.categoria && r.categoria !== estado.categoria) return false;
    if (estado.tipo && (r.tipoVehiculo || "(sin tipo)") !== estado.tipo) return false;
    if (estado.salida === "AUTORIZADO" && r.estadoSalidaExcel !== "AUTORIZADO") return false;
    if (estado.salida === "PENDIENTE" && !(r.enExcel === "Sí" && r.estadoSalidaExcel !== "AUTORIZADO")) return false;
    const ex = r.enExcel === "Sí";
    const mo = r.enScraping === "Sí";
    if (estado.fuente === "ambas" && !(ex && mo)) return false;
    if (estado.fuente === "excel" && !(ex && !mo)) return false;
    if (estado.fuente === "moviliza" && !(mo && !ex)) return false;
    if (q && !(r._texto ??= `${r.placa} ${r.tipoVehiculo} ${r.ubicacion} ${r.observaciones}`.toLowerCase()).includes(q)) return false;
    return true;
  });

  const { key, dir } = estado.orden;
  if (key) {
    const f = VALOR_ORDEN[key];
    filtradas.sort((a, b) => String(f(a)).localeCompare(String(f(b)), "es", { numeric: true, sensitivity: "base" }) * dir);
  }
  return filtradas;
}

function hayFiltros() {
  return !!(estado.categoria || estado.tipo || estado.salida || estado.fuente || estado.texto.trim());
}

// ---------- dibujo ----------

function dibujarResumen() {
  const r = estado.datos.resumen;
  const items = [
    { n: r.transito + r.policiaFiscalia, t: "Vehículos en total" },
    { n: r.transito, t: "Tránsito (en Excel y Moviliza, o solo Moviliza)", c: "transito" },
    { n: r.policiaFiscalia, t: "Policía / Fiscalía (solo en el Excel)", c: "policia" },
    { n: r.autorizadosSalidaExcel, t: "Con salida autorizada en el Excel" },
  ];
  $("resumen").replaceChildren(
    ...items.map((i) => el("div", { class: `dato ${i.c || ""}` }, el("b", {}, num(i.n)), el("span", {}, i.t)))
  );
}

function dibujarTabs() {
  const r = estado.datos.resumen;
  const tabs = [
    { v: "", t: "Todos", n: r.transito + r.policiaFiscalia },
    { v: "Tránsito", t: "Tránsito", n: r.transito },
    { v: "Policía/Fiscalía", t: "Policía / Fiscalía", n: r.policiaFiscalia },
  ];
  $("tabsCategoria").replaceChildren(
    ...tabs.map((t) =>
      el(
        "button",
        {
          type: "button",
          class: "tab",
          role: "tab",
          "aria-selected": String(estado.categoria === t.v),
          onclick: () => {
            estado.categoria = t.v;
            estado.pagina = 1;
            dibujarTabs();
            dibujar();
          },
        },
        t.t,
        el("small", {}, num(t.n))
      )
    )
  );
}

function llenarTipos() {
  const conteo = new Map();
  for (const r of estado.datos.rows) {
    const t = r.tipoVehiculo || "(sin tipo)";
    conteo.set(t, (conteo.get(t) || 0) + 1);
  }
  const tipos = [...conteo.keys()].sort((a, b) => a.localeCompare(b, "es"));
  const sel = $("filtroTipo");
  sel.replaceChildren(el("option", { value: "" }, "Todos"), ...tipos.map((t) => el("option", { value: t }, `${t} (${num(conteo.get(t))})`)));
  sel.value = tipos.includes(estado.tipo) ? estado.tipo : "";
  estado.tipo = sel.value;
}

const COLUMNAS = [
  { key: "placa", titulo: "Placa", orden: true },
  { key: "categoria", titulo: "Categoría", orden: true },
  { key: "tipoVehiculo", titulo: "Tipo", orden: true },
  { key: "ubicacion", titulo: "Ubicación", orden: true },
  { key: "salida", titulo: "Salida", orden: true },
  { key: "fuente", titulo: "Registrado en", orden: true },
  { key: "observaciones", titulo: "Observaciones" },
  { key: "fotos", titulo: "Fotos" },
];

function celda(col, r, q) {
  switch (col.key) {
    case "placa":
      return el("span", { class: "placa" }, resaltar(r.placa, q));
    case "categoria": {
      const t = r.categoria === "Tránsito";
      return el("span", { class: `etiqueta ${t ? "transito" : "policia"}` }, t ? "Tránsito" : "Policía / Fiscalía");
    }
    case "tipoVehiculo":
      return r.tipoVehiculo ? resaltar(r.tipoVehiculo, q) : vacio();
    case "ubicacion":
      return r.ubicacion ? resaltar(r.ubicacion, q) : vacio();
    case "salida":
      if (r.enExcel !== "Sí") return vacio();
      return r.estadoSalidaExcel === "AUTORIZADO"
        ? el("span", { class: "etiqueta ok" }, "Autorizada")
        : el("span", { class: "vacio" }, "Sin autorizar");
    case "fuente":
      return el(
        "span",
        { class: "fuentes" },
        el("i", { class: r.enExcel === "Sí" ? "" : "off" }, "Excel"),
        " · ",
        el("i", { class: r.enScraping === "Sí" ? "" : "off" }, "Moviliza")
      );
    case "observaciones": {
      if (!r.observaciones) return vacio();
      const d = el("div", { class: "obs", title: "Clic para ver completo" }, resaltar(r.observaciones, q));
      d.addEventListener("click", () => d.classList.toggle("abierta"));
      return d;
    }
    case "fotos":
      return r.fotos.length
        ? el(
            "button",
            { type: "button", class: "foto-btn", title: `Ver ${r.fotos.length} foto${r.fotos.length === 1 ? "" : "s"}`, onclick: () => abrirFotos(r) },
            el("img", { src: urlFoto(r.fotos[0]), loading: "lazy", decoding: "async", alt: `Foto de ${r.placa}` }),
            r.fotos.length > 1 ? el("span", {}, `+${r.fotos.length - 1}`) : null
          )
        : vacio();
  }
}

function dibujar() {
  const filas = filasFiltradas();
  const total = estado.datos.rows.length;
  const q = estado.texto.trim();
  const paginas = Math.max(1, Math.ceil(filas.length / estado.porPagina));
  if (estado.pagina > paginas) estado.pagina = paginas;
  const desde = (estado.pagina - 1) * estado.porPagina;
  const visibles = filas.slice(desde, desde + estado.porPagina);

  $("conteo").textContent = hayFiltros()
    ? `${num(filas.length)} de ${num(total)} vehículos`
    : `${num(total)} vehículos`;
  $("limpiar").hidden = !hayFiltros();
  $("btnExcel").disabled = $("btnWord").disabled = filas.length === 0;
  estado.filasVisibles = filas;

  const cont = $("tabla");
  if (filas.length === 0) {
    cont.replaceChildren(el("div", { class: "mensaje" }, "Ningún vehículo coincide con estos filtros."));
    return;
  }

  const thead = el(
    "tr",
    {},
    el("th", { class: "sin-orden" }, "#"),
    COLUMNAS.map((c) => {
      if (!c.orden) return el("th", { class: "sin-orden" }, c.titulo);
      const activo = estado.orden.key === c.key;
      const th = el("th", activo ? { "aria-sort": estado.orden.dir === 1 ? "ascending" : "descending" } : {});
      th.append(
        el(
          "button",
          {
            type: "button",
            onclick: () => {
              if (activo && estado.orden.dir === -1) estado.orden = { key: null, dir: 1 };
              else estado.orden = { key: c.key, dir: activo ? -1 : 1 };
              estado.pagina = 1;
              dibujar();
            },
          },
          c.titulo
        )
      );
      return th;
    })
  );

  const tbody = el(
    "tbody",
    {},
    visibles.map((r, i) =>
      el(
        "tr",
        {},
        el("td", { class: "num" }, num(desde + i + 1)),
        COLUMNAS.map((c) => el("td", {}, celda(c, r, q)))
      )
    )
  );

  cont.replaceChildren(
    el("div", { class: "tabla-scroll" }, el("table", {}, el("thead", {}, thead), tbody)),
    dibujarPie(filas.length, paginas, desde, visibles.length)
  );
}

function listaPaginas(actual, total) {
  const set = new Set([1, total, actual - 1, actual, actual + 1].filter((p) => p >= 1 && p <= total));
  const orden = [...set].sort((a, b) => a - b);
  const salida = [];
  orden.forEach((p, i) => {
    if (i > 0 && p - orden[i - 1] > 1) salida.push("…");
    salida.push(p);
  });
  return salida;
}

function dibujarPie(totalFilas, paginas, desde, cuantas) {
  const ir = (p) => () => {
    estado.pagina = p;
    dibujar();
    $("tabla").querySelector(".tabla-scroll")?.scrollTo(0, 0);
  };

  const selector = el("select", {
    "aria-label": "Filas por página",
    onchange: (e) => {
      estado.porPagina = Number(e.target.value);
      estado.pagina = 1;
      dibujar();
    },
  }, TAMANOS.map((t) => el("option", { value: t, selected: t === estado.porPagina }, `${t} por página`)));

  return el(
    "div",
    { class: "pie" },
    el("span", {}, `Mostrando ${num(desde + 1)}–${num(desde + cuantas)} de ${num(totalFilas)}`),
    el(
      "nav",
      { class: "paginas", "aria-label": "Paginación" },
      el("button", { type: "button", disabled: estado.pagina <= 1, onclick: ir(estado.pagina - 1), "aria-label": "Página anterior" }, "‹"),
      listaPaginas(estado.pagina, paginas).map((p) =>
        p === "…"
          ? el("span", {}, "…")
          : el("button", { type: "button", onclick: ir(p), "aria-current": p === estado.pagina ? "page" : null }, num(p))
      ),
      el("button", { type: "button", disabled: estado.pagina >= paginas, onclick: ir(estado.pagina + 1), "aria-label": "Página siguiente" }, "›")
    ),
    selector
  );
}

// ---------- fotos ----------

const visor = { fotos: [], i: 0, placa: "" };

function cerrarFotos() {
  $("modalFotos")?.remove();
  document.removeEventListener("keydown", teclasFotos);
  document.body.style.overflow = "";
}
function teclasFotos(e) {
  if (e.key === "Escape") cerrarFotos();
  else if (e.key === "ArrowRight") moverFoto(1);
  else if (e.key === "ArrowLeft") moverFoto(-1);
}
const urlFoto = (f) => `/img/${encodeURIComponent(f)}`;

function moverFoto(d) {
  const n = visor.fotos.length;
  mostrarFoto((visor.i + d + n) % n);
}

function mostrarFoto(i) {
  visor.i = i;
  const img = $("visorImg");
  img.classList.add("cargando-foto");
  img.onload = () => img.classList.remove("cargando-foto");
  img.src = urlFoto(visor.fotos[i]);
  img.alt = `Foto ${i + 1} de ${visor.placa}`;
  $("visorCuenta").textContent = `${i + 1} / ${visor.fotos.length}`;
  $("visorAbrir").href = img.src;
  document.querySelectorAll(".miniatura").forEach((m, j) => {
    m.setAttribute("aria-current", String(j === i));
    if (j === i) m.scrollIntoView({ block: "nearest", inline: "center" });
  });
}

function abrirFotos(r, inicio = 0) {
  cerrarFotos();
  visor.fotos = r.fotos;
  visor.placa = r.placa;
  const varias = r.fotos.length > 1;

  const modal = el(
    "div",
    { class: "modal", id: "modalFotos", onclick: (e) => e.target === modal && cerrarFotos() },
    el(
      "div",
      { class: "visor", role: "dialog", "aria-label": `Fotos de ${r.placa}` },
      el(
        "div",
        { class: "modal-cab" },
        el("h2", {}, el("span", { class: "placa" }, r.placa), el("span", { id: "visorCuenta", class: "vacio" })),
        el(
          "div",
          { class: "visor-acciones" },
          el("a", { id: "visorAbrir", class: "btn claro chico", target: "_blank", rel: "noopener" }, "Abrir original"),
          el("button", { type: "button", class: "btn claro chico", onclick: cerrarFotos }, "Cerrar (Esc)")
        )
      ),
      el(
        "div",
        { class: "visor-escena" },
        varias && el("button", { type: "button", class: "flecha izq", "aria-label": "Foto anterior", onclick: () => moverFoto(-1) }, "‹"),
        el("img", { id: "visorImg", class: "visor-img" }),
        varias && el("button", { type: "button", class: "flecha der", "aria-label": "Foto siguiente", onclick: () => moverFoto(1) }, "›")
      ),
      varias &&
        el(
          "div",
          { class: "miniaturas" },
          r.fotos.map((f, j) =>
            el("button", { type: "button", class: "miniatura", "aria-label": `Ver foto ${j + 1}`, onclick: () => mostrarFoto(j) }, el("img", { src: urlFoto(f), loading: "lazy", alt: "" }))
          )
        )
    )
  );
  document.body.append(modal);
  document.body.style.overflow = "hidden";
  document.addEventListener("keydown", teclasFotos);
  mostrarFoto(inicio);
}

// ---------- carga y exportación ----------

async function cargar() {
  const cont = $("tabla");
  if (!estado.datos) cont.replaceChildren(el("div", { class: "cargando" }, Array.from({ length: 8 }, () => el("div"))));
  $("periodoTxt").textContent = `${fechaCorta($("inicio").value)} → ${fechaCorta($("fin").value)}`;

  try {
    const res = await fetch("/api/inventario", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inicio: $("inicio").value, fin: $("fin").value }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error desconocido");
    estado.datos = data;
    dibujarResumen();
    dibujarTabs();
    llenarTipos();
    dibujar();
  } catch (err) {
    cont.replaceChildren(el("div", { class: "mensaje error" }, `No se pudo cargar el inventario: ${err.message}`));
  }
}

async function exportar(formato, boton) {
  const original = boton.textContent;
  boton.disabled = true;
  boton.textContent = "Generando…";
  try {
    const res = await fetch("/api/exportar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        seccion: "inventario",
        formato,
        columns: estado.datos.columns,
        rows: estado.filasVisibles,
        inicio: $("inicio").value,
        fin: $("fin").value,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al exportar");
    for (const f of data.files) {
      const a = el("a", { href: `/api/files/${encodeURIComponent(f.filename)}`, download: f.filename });
      document.body.append(a);
      a.click();
      a.remove();
    }
  } catch (err) {
    alert(`No se pudo exportar: ${err.message}`);
  } finally {
    boton.textContent = original;
    boton.disabled = estado.filasVisibles.length === 0;
  }
}

// ---------- arranque ----------

function iniciar() {
  $("inicio").value = DESDE_DEFECTO;
  $("fin").value = hoy();

  $("buscar").addEventListener("input", (e) => {
    clearTimeout(iniciar.t);
    iniciar.t = setTimeout(() => {
      estado.texto = e.target.value;
      estado.pagina = 1;
      if (estado.datos) dibujar();
    }, 150);
  });
  for (const [id, campo] of [["filtroTipo", "tipo"], ["filtroSalida", "salida"], ["filtroFuente", "fuente"]]) {
    $(id).addEventListener("change", (e) => {
      estado[campo] = e.target.value;
      estado.pagina = 1;
      dibujar();
    });
  }
  $("limpiar").addEventListener("click", () => {
    Object.assign(estado, { categoria: "", tipo: "", salida: "", fuente: "", texto: "", pagina: 1 });
    $("buscar").value = "";
    $("filtroTipo").value = $("filtroSalida").value = $("filtroFuente").value = "";
    dibujarTabs();
    dibujar();
  });
  for (const id of ["inicio", "fin"]) $(id).addEventListener("change", () => $("inicio").value && $("fin").value && cargar());

  $("btnExcel").addEventListener("click", (e) => exportar("excel", e.currentTarget));
  $("btnWord").addEventListener("click", (e) => exportar("word", e.currentTarget));

  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) {
      e.preventDefault();
      $("buscar").focus();
    }
  });

  iniciarSync();
  cargar();
}

document.addEventListener("DOMContentLoaded", iniciar);
