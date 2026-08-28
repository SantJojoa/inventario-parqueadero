import ExcelJS from "exceljs";

// Neutraliza inyección de fórmulas (CSV/Excel injection) en celdas que
// vienen de datos externos: si el valor empieza con =, +, - o @, Excel
// podría interpretarlo como fórmula al abrir el archivo.
function celdaSegura(valor: unknown): unknown {
  if (typeof valor === "string" && /^[=+\-@]/.test(valor)) {
    return `'${valor}`;
  }
  return valor;
}

export async function exportToExcel<T extends Record<string, any>>(
  rows: T[],
  columns: { key: keyof T; header: string }[],
  sheetName: string,
  outPath: string
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);

  sheet.columns = columns.map((c) => ({ header: c.header, key: String(c.key), width: 22 }));
  sheet.getRow(1).font = { bold: true };

  for (const row of rows) {
    const fila: Record<string, unknown> = {};
    for (const c of columns) {
      fila[String(c.key)] = celdaSegura(row[c.key]);
    }
    sheet.addRow(fila);
  }

  await workbook.xlsx.writeFile(outPath);
}
