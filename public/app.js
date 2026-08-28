function formatFechaHora(iso) {
  if (!iso) return "nunca";
  return new Date(iso).toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function initSyncWidget() {
  const el = document.getElementById("syncWidget");
  if (!el) return;

  el.innerHTML = `
    <span class="sync-info" id="syncInfo">Consultando estado...</span>
    <button type="button" class="btn btn-secondary btn-sm" id="btnSync">Actualizar datos</button>
  `;
  const info = el.querySelector("#syncInfo");
  const btn = el.querySelector("#btnSync");
  let polling = null;

  async function actualizarEstado() {
    try {
      const res = await fetch("/api/sync/estado");
      const data = await res.json();

      if (data.corriendo) {
        info.textContent = data.progreso ? `Sincronizando — ${data.progreso}` : "Sincronizando...";
        btn.disabled = true;
        if (!polling) polling = setInterval(actualizarEstado, 4000);
      } else {
        info.textContent = data.error
          ? "Error en la última sincronización"
          : `Datos al día: ${formatFechaHora(data.ultimaSincronizacion)}`;
        btn.disabled = false;
        if (polling) {
          clearInterval(polling);
          polling = null;
        }
      }
    } catch {
      info.textContent = "Sin conexión con el servidor";
    }
  }

  btn.addEventListener("click", async () => {
    btn.disabled = true;
    info.textContent = "Iniciando sincronización...";
    try {
      await fetch("/api/sync", { method: "POST" });
    } catch {
      /* el próximo poll de estado reflejará el error */
    }
    actualizarEstado();
  });

  actualizarEstado();
}

document.addEventListener("DOMContentLoaded", initSyncWidget);

function renderEsqueleto(contenedor, numCols) {
  const wrap = document.createElement("div");
  wrap.className = "table-wrap";
  const skel = document.createElement("div");
  skel.className = "skeleton";
  for (let i = 0; i < 6; i++) {
    const row = document.createElement("div");
    row.className = "skeleton-row";
    for (let j = 0; j < numCols; j++) {
      const cell = document.createElement("div");
      cell.className = "skeleton-cell";
      row.appendChild(cell);
    }
    skel.appendChild(row);
  }
  wrap.appendChild(skel);
  contenedor.innerHTML = "";
  contenedor.appendChild(wrap);
}

function renderVacio(contenedor, mensaje) {
  const wrap = document.createElement("div");
  wrap.className = "table-wrap";
  const div = document.createElement("div");
  div.className = "estado-vacio";
  div.textContent = mensaje;
  wrap.appendChild(div);
  contenedor.innerHTML = "";
  contenedor.appendChild(wrap);
}

const FILAS_POR_PAGINA = 50;

function renderTabla(contenedor, columns, rows, cellRenderers) {
  let sortKey = null;
  let sortDir = 1;
  let pagina = 1;

  function dibujar() {
    const filas = sortKey
      ? [...rows].sort((a, b) => {
          const va = String(a[sortKey] ?? "");
          const vb = String(b[sortKey] ?? "");
          return va.localeCompare(vb, "es", { numeric: true, sensitivity: "base" }) * sortDir;
        })
      : rows;

    const totalPaginas = Math.max(1, Math.ceil(filas.length / FILAS_POR_PAGINA));
    if (pagina > totalPaginas) pagina = totalPaginas;
    const inicioPagina = (pagina - 1) * FILAS_POR_PAGINA;
    const filasPagina = filas.slice(inicioPagina, inicioPagina + FILAS_POR_PAGINA);

    const wrap = document.createElement("div");
    wrap.className = "table-wrap";
    const table = document.createElement("table");
    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");

    for (const col of columns) {
      const th = document.createElement("th");
      th.textContent = col.header + " ";
      const caret = document.createElement("span");
      caret.className = "caret";
      if (sortKey === col.key) {
        th.classList.add("sorted");
        caret.textContent = sortDir === 1 ? "▲" : "▼";
      } else {
        caret.textContent = "↕";
      }
      th.appendChild(caret);
      th.addEventListener("click", () => {
        if (sortKey === col.key) sortDir *= -1;
        else {
          sortKey = col.key;
          sortDir = 1;
        }
        pagina = 1;
        dibujar();
      });
      headRow.appendChild(th);
    }
    thead.appendChild(headRow);

    const tbody = document.createElement("tbody");
    for (const row of filasPagina) {
      const tr = document.createElement("tr");
      for (const col of columns) {
        const td = document.createElement("td");
        const render = cellRenderers && cellRenderers[col.key];
        const valor = row[col.key] ?? "";
        if (render) {
          const nodo = render(valor, row);
          if (nodo instanceof Node) td.appendChild(nodo);
          else td.textContent = nodo;
        } else {
          td.textContent = valor;
        }
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }

    table.appendChild(thead);
    table.appendChild(tbody);
    wrap.appendChild(table);

    contenedor.innerHTML = "";
    contenedor.appendChild(wrap);
    contenedor.appendChild(renderPaginacion());
  }

  function renderPaginacion() {
    const totalPaginas = Math.max(1, Math.ceil(rows.length / FILAS_POR_PAGINA));

    const barra = document.createElement("div");
    barra.className = "paginacion";

    const btnAnterior = document.createElement("button");
    btnAnterior.type = "button";
    btnAnterior.className = "btn btn-secondary btn-sm";
    btnAnterior.textContent = "‹ Anterior";
    btnAnterior.disabled = pagina <= 1;
    btnAnterior.addEventListener("click", () => {
      pagina--;
      dibujar();
    });

    const info = document.createElement("span");
    info.className = "paginacion-info";
    info.textContent = `Página ${pagina} de ${totalPaginas}`;

    const btnSiguiente = document.createElement("button");
    btnSiguiente.type = "button";
    btnSiguiente.className = "btn btn-secondary btn-sm";
    btnSiguiente.textContent = "Siguiente ›";
    btnSiguiente.disabled = pagina >= totalPaginas;
    btnSiguiente.addEventListener("click", () => {
      pagina++;
      dibujar();
    });

    barra.appendChild(btnAnterior);
    barra.appendChild(info);
    barra.appendChild(btnSiguiente);
    return barra;
  }

  dibujar();
}

function filtrarFilas(rows, columns, texto) {
  if (!texto.trim()) return rows;
  const q = texto.trim().toLowerCase();
  return rows.filter((row) => columns.some((c) => String(row[c.key] ?? "").toLowerCase().includes(q)));
}

function initModulo(seccion) {
  const form = document.getElementById("formConsulta");
  const btnConsultar = document.getElementById("btnConsultar");
  const camposFecha = document.getElementById("camposFecha");
  const campoPlaca = document.getElementById("campoPlaca");
  const inicioInput = document.getElementById("inicio");
  const finInput = document.getElementById("fin");
  const placaInput = document.getElementById("placa");
  const estadoSelect = document.getElementById("estado");
  const resultadosEl = document.getElementById("resultados");

  const today = new Date().toISOString().slice(0, 10);
  inicioInput.value = today;
  finInput.value = today;

  const segmentBtns = form.querySelectorAll(".segmented button");
  let modo = "fecha";

  function setModo(nuevoModo) {
    modo = nuevoModo;
    const esPlaca = modo === "placa";
    camposFecha.style.display = esPlaca ? "none" : "";
    campoPlaca.style.display = esPlaca ? "" : "none";
    inicioInput.required = !esPlaca;
    finInput.required = !esPlaca;
    placaInput.required = esPlaca;
    for (const btn of segmentBtns) {
      btn.classList.toggle("active", btn.dataset.modo === modo);
    }
  }

  for (const btn of segmentBtns) {
    btn.addEventListener("click", () => setModo(btn.dataset.modo));
  }
  setModo("fecha");

  let datosActuales = null; // { columns, rows }

  function mostrarError(mensaje) {
    resultadosEl.innerHTML = "";
    const div = document.createElement("div");
    div.className = "estado-error";
    div.textContent = mensaje;
    resultadosEl.appendChild(div);
  }

  function renderResultados() {
    resultadosEl.innerHTML = "";

    if (!datosActuales || datosActuales.rows.length === 0) {
      renderVacio(resultadosEl, "No se encontraron registros para esta búsqueda.");
      return;
    }

    const toolbar = document.createElement("div");
    toolbar.className = "toolbar";

    const left = document.createElement("div");
    left.className = "toolbar-left";

    const buscadorWrap = document.createElement("div");
    buscadorWrap.className = "buscador";
    const buscadorInput = document.createElement("input");
    buscadorInput.type = "text";
    buscadorInput.placeholder = "Filtrar resultados...";
    buscadorWrap.appendChild(buscadorInput);

    const badge = document.createElement("span");
    badge.className = "badge";

    left.appendChild(buscadorWrap);
    left.appendChild(badge);

    const exportActions = document.createElement("div");
    exportActions.className = "export-actions";
    const btnExcel = crearBotonExport("Exportar Excel", "excel");
    const btnWord = crearBotonExport("Exportar Word", "word");
    exportActions.appendChild(btnExcel);
    exportActions.appendChild(btnWord);

    toolbar.appendChild(left);
    toolbar.appendChild(exportActions);

    const tablaContenedor = document.createElement("div");
    const descargasEl = document.createElement("div");
    descargasEl.className = "descargas";

    resultadosEl.appendChild(toolbar);
    resultadosEl.appendChild(tablaContenedor);
    resultadosEl.appendChild(descargasEl);

    function actualizarTabla() {
      const filtradas = filtrarFilas(datosActuales.rows, datosActuales.columns, buscadorInput.value);
      badge.textContent = `${filtradas.length} registro${filtradas.length === 1 ? "" : "s"}`;
      renderTabla(tablaContenedor, datosActuales.columns, filtradas);
      return filtradas;
    }

    let filasVisibles = actualizarTabla();
    buscadorInput.addEventListener("input", () => {
      filasVisibles = actualizarTabla();
    });

    function crearBotonExport(label, formato) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn btn-secondary";
      btn.textContent = label;
      btn.addEventListener("click", async () => {
        const original = btn.textContent;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Exportando...';
        try {
          const res = await fetch("/api/exportar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              seccion,
              formato,
              columns: datosActuales.columns,
              rows: filasVisibles,
              modo,
              inicio: inicioInput.value,
              fin: finInput.value,
              placa: placaInput.value,
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Error al exportar");

          for (const f of data.files) {
            const a = document.createElement("a");
            a.className = "chip";
            a.href = `/api/files/${encodeURIComponent(f.filename)}`;
            a.setAttribute("download", "");
            a.textContent = `${f.filename} (${f.registros})`;
            descargasEl.appendChild(a);
          }
        } catch (err) {
          mostrarErrorFlotante(err.message);
        } finally {
          btn.disabled = false;
          btn.textContent = original;
        }
      });
      return btn;
    }
  }

  function mostrarErrorFlotante(mensaje) {
    const div = document.createElement("div");
    div.className = "estado-error";
    div.style.marginTop = "12px";
    div.textContent = mensaje;
    resultadosEl.appendChild(div);
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const numCols = seccion === "ingresos" ? 6 : 8;
    renderEsqueleto(resultadosEl, numCols);
    btnConsultar.disabled = true;
    const originalLabel = btnConsultar.textContent;
    btnConsultar.innerHTML = '<span class="spinner"></span> Consultando...';

    const body = { seccion, modo };
    if (modo === "placa") {
      body.placa = placaInput.value;
    } else {
      body.inicio = inicioInput.value;
      body.fin = finInput.value;
      if (estadoSelect) body.estado = estadoSelect.value;
    }

    try {
      const res = await fetch("/api/consultar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error desconocido");

      datosActuales = data;
      renderResultados();
    } catch (err) {
      mostrarError(err.message);
    } finally {
      btnConsultar.disabled = false;
      btnConsultar.textContent = originalLabel;
    }
  });
}

function cerrarModalFotosEsc(e) {
  if (e.key === "Escape") cerrarModalFotos();
}

function cerrarModalFotos() {
  const existente = document.getElementById("modalFotosOverlay");
  if (existente) existente.remove();
  document.removeEventListener("keydown", cerrarModalFotosEsc);
}

function abrirModalFotos(placa, fotos) {
  cerrarModalFotos();

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "modalFotosOverlay";
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) cerrarModalFotos();
  });

  const modal = document.createElement("div");
  modal.className = "modal-fotos";

  const header = document.createElement("div");
  header.className = "modal-header";
  const titulo = document.createElement("h3");
  titulo.textContent = `Fotos — ${placa}`;
  const btnCerrar = document.createElement("button");
  btnCerrar.type = "button";
  btnCerrar.className = "modal-close";
  btnCerrar.textContent = "✕";
  btnCerrar.addEventListener("click", cerrarModalFotos);
  header.appendChild(titulo);
  header.appendChild(btnCerrar);

  const grid = document.createElement("div");
  grid.className = "foto-grid";
  for (const archivo of fotos) {
    const url = `/img/${encodeURIComponent(archivo)}`;
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener";
    const img = document.createElement("img");
    img.src = url;
    img.loading = "lazy";
    img.alt = `Foto ${placa}`;
    a.appendChild(img);
    grid.appendChild(a);
  }

  modal.appendChild(header);
  modal.appendChild(grid);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  document.addEventListener("keydown", cerrarModalFotosEsc);
}

function celdaFotos(valor, row) {
  const fotos = row.fotos || [];
  if (fotos.length === 0) {
    const span = document.createElement("span");
    span.style.color = "var(--text-muted)";
    span.textContent = "—";
    return span;
  }
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn btn-secondary btn-sm";
  btn.textContent = `Ver fotos (${fotos.length})`;
  btn.addEventListener("click", () => abrirModalFotos(row.placa, fotos));
  return btn;
}

function categoriaPill(valor) {
  const span = document.createElement("span");
  const esTransito = valor === "Tránsito";
  span.className = "categoria-pill " + (esTransito ? "transito" : "policia");
  span.textContent = valor;
  return span;
}

function renderResumen(contenedor, resumen) {
  const grid = document.createElement("div");
  grid.className = "resumen-grid";

  const stats = [
    { valor: resumen.totalExcel, etiqueta: "Placas en Excel", clase: "" },
    { valor: resumen.totalScraping, etiqueta: "Placas en scraping", clase: "" },
    { valor: resumen.transito, etiqueta: "Tránsito", clase: "exito" },
    { valor: resumen.policiaFiscalia, etiqueta: "Policía/Fiscalía", clase: "acento" },
    { valor: resumen.autorizadosSalidaExcel, etiqueta: "Con salida autorizada (Excel)", clase: "" },
  ];

  for (const s of stats) {
    const card = document.createElement("div");
    card.className = "card resumen-stat" + (s.clase ? " " + s.clase : "");
    const valor = document.createElement("div");
    valor.className = "valor";
    valor.textContent = s.valor;
    const etiqueta = document.createElement("div");
    etiqueta.className = "etiqueta";
    etiqueta.textContent = s.etiqueta;
    card.appendChild(valor);
    card.appendChild(etiqueta);
    grid.appendChild(card);
  }

  contenedor.appendChild(grid);
}

function initInventario() {
  const form = document.getElementById("formInventario");
  const btnConsultar = document.getElementById("btnConsultar");
  const inicioInput = document.getElementById("inicio");
  const finInput = document.getElementById("fin");
  const resultadosEl = document.getElementById("resultados");

  // "2023-06-22" replica config.SCRAPING_DESDE: primer día con datos en la BD.
  inicioInput.value = "2023-06-22";
  finInput.value = new Date().toISOString().slice(0, 10);

  let datosActuales = null; // { columns, rows, resumen }

  function mostrarError(mensaje) {
    resultadosEl.innerHTML = "";
    const div = document.createElement("div");
    div.className = "estado-error";
    div.textContent = mensaje;
    resultadosEl.appendChild(div);
  }

  function renderResultados() {
    resultadosEl.innerHTML = "";

    renderResumen(resultadosEl, datosActuales.resumen);

    if (datosActuales.rows.length === 0) {
      renderVacio(resultadosEl, "No se encontraron registros para este rango.");
      return;
    }

    const toolbar = document.createElement("div");
    toolbar.className = "toolbar";

    const left = document.createElement("div");
    left.className = "toolbar-left";

    const filtroCategoria = document.createElement("select");
    filtroCategoria.innerHTML = `
      <option value="">Todas las categorías</option>
      <option value="Tránsito">Tránsito</option>
      <option value="Policía/Fiscalía">Policía/Fiscalía</option>
    `;
    filtroCategoria.style.maxWidth = "200px";

    const buscadorWrap = document.createElement("div");
    buscadorWrap.className = "buscador";
    const buscadorInput = document.createElement("input");
    buscadorInput.type = "text";
    buscadorInput.placeholder = "Filtrar por placa, tipo, ubicación...";
    buscadorWrap.appendChild(buscadorInput);

    const badge = document.createElement("span");
    badge.className = "badge";

    left.appendChild(filtroCategoria);
    left.appendChild(buscadorWrap);
    left.appendChild(badge);

    const exportActions = document.createElement("div");
    exportActions.className = "export-actions";
    const btnExcel = crearBotonExport("Exportar Excel", "excel");
    const btnWord = crearBotonExport("Exportar Word", "word");
    exportActions.appendChild(btnExcel);
    exportActions.appendChild(btnWord);

    toolbar.appendChild(left);
    toolbar.appendChild(exportActions);

    const tablaContenedor = document.createElement("div");
    const descargasEl = document.createElement("div");
    descargasEl.className = "descargas";

    resultadosEl.appendChild(toolbar);
    resultadosEl.appendChild(tablaContenedor);
    resultadosEl.appendChild(descargasEl);

    function actualizarTabla() {
      const porCategoria = filtroCategoria.value
        ? datosActuales.rows.filter((r) => r.categoria === filtroCategoria.value)
        : datosActuales.rows;
      const filtradas = filtrarFilas(porCategoria, datosActuales.columns, buscadorInput.value);
      badge.textContent = `${filtradas.length} registro${filtradas.length === 1 ? "" : "s"}`;
      const columnasVisibles = [{ key: "fotos", header: "Fotos" }, ...datosActuales.columns];
      renderTabla(tablaContenedor, columnasVisibles, filtradas, { categoria: categoriaPill, fotos: celdaFotos });
      return filtradas;
    }

    let filasVisibles = actualizarTabla();
    buscadorInput.addEventListener("input", () => {
      filasVisibles = actualizarTabla();
    });
    filtroCategoria.addEventListener("change", () => {
      filasVisibles = actualizarTabla();
    });

    function crearBotonExport(label, formato) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn btn-secondary";
      btn.textContent = label;
      btn.addEventListener("click", async () => {
        const original = btn.textContent;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Exportando...';
        try {
          const res = await fetch("/api/exportar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              seccion: "inventario",
              formato,
              columns: datosActuales.columns,
              rows: filasVisibles,
              inicio: inicioInput.value,
              fin: finInput.value,
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Error al exportar");

          for (const f of data.files) {
            const a = document.createElement("a");
            a.className = "chip";
            a.href = `/api/files/${encodeURIComponent(f.filename)}`;
            a.setAttribute("download", "");
            a.textContent = `${f.filename} (${f.registros})`;
            descargasEl.appendChild(a);
          }
        } catch (err) {
          mostrarErrorFlotante(err.message);
        } finally {
          btn.disabled = false;
          btn.textContent = original;
        }
      });
      return btn;
    }
  }

  function mostrarErrorFlotante(mensaje) {
    const div = document.createElement("div");
    div.className = "estado-error";
    div.style.marginTop = "12px";
    div.textContent = mensaje;
    resultadosEl.appendChild(div);
  }

  async function cargarInventario() {
    renderEsqueleto(resultadosEl, 8);
    btnConsultar.disabled = true;
    const originalLabel = btnConsultar.textContent;
    btnConsultar.innerHTML = '<span class="spinner"></span> Consultando...';

    try {
      const res = await fetch("/api/inventario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inicio: inicioInput.value, fin: finInput.value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error desconocido");

      datosActuales = data;
      renderResultados();
    } catch (err) {
      mostrarError(err.message);
    } finally {
      btnConsultar.disabled = false;
      btnConsultar.textContent = originalLabel;
    }
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    cargarInventario();
  });

  cargarInventario();
}
