import { Document, Packer, Table, TableRow, TableCell, Paragraph, WidthType } from "docx";
import * as fs from "fs";

export async function exportToWord<T extends Record<string, any>>(
  rows: T[],
  columns: { key: keyof T; header: string }[],
  title: string,
  outPath: string
): Promise<void> {
  const headerRow = new TableRow({
    children: columns.map(
      (c) =>
        new TableCell({
          width: { size: 100 / columns.length, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ text: c.header })],
        })
    ),
  });

  const dataRows = rows.map(
    (row) =>
      new TableRow({
        children: columns.map(
          (c) =>
            new TableCell({
              children: [new Paragraph({ text: String(row[c.key] ?? "") })],
            })
        ),
      })
  );

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ text: title, heading: "Heading1" }),
          new Table({ rows: [headerRow, ...dataRows], width: { size: 100, type: WidthType.PERCENTAGE } }),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outPath, buffer);
}
