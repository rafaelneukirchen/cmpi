import ExcelJS from "exceljs";

export interface StyledColumn {
  header: string;
  width?: number;
}

/**
 * Gera uma planilha .xlsx formatada como relatório:
 * cabeçalho azul, linhas alternadas (branco / azul claro), bordas e filtro automático.
 */
export async function exportStyledExcel(
  fileName: string,
  sheetTitle: string,
  columns: StyledColumn[],
  rows: (string | number)[][],
  reportTitle?: string,
) {
  const wb = new ExcelJS.Workbook();
  wb.created = new Date();
  const ws = wb.addWorksheet(sheetTitle.slice(0, 31), {
    views: [{ state: "frozen", ySplit: reportTitle ? 3 : 1 }],
  });

  ws.columns = columns.map((c) => ({
    header: c.header,
    width: c.width ?? Math.max(12, Math.min(40, c.header.length + 6)),
  }));

  let headerRowIndex = 1;

  if (reportTitle) {
    ws.spliceRows(1, 0, [reportTitle], []);
    headerRowIndex = 3;
    ws.mergeCells(1, 1, 1, columns.length);
    const titleCell = ws.getCell(1, 1);
    titleCell.value = reportTitle;
    titleCell.font = { bold: true, size: 14, color: { argb: "FF1E2D50" } };
    titleCell.alignment = { vertical: "middle", horizontal: "left" };
    ws.getRow(1).height = 24;
  }

  const headerRow = ws.getRow(headerRowIndex);
  headerRow.values = columns.map((c) => c.header);
  headerRow.height = 22;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E2D50" } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: "FFB4C2DA" } },
      left: { style: "thin", color: { argb: "FFB4C2DA" } },
      bottom: { style: "thin", color: { argb: "FFB4C2DA" } },
      right: { style: "thin", color: { argb: "FFB4C2DA" } },
    };
  });

  rows.forEach((r, i) => {
    const row = ws.addRow(r);
    row.height = 18;
    const zebra = i % 2 === 1;
    row.eachCell({ includeEmpty: true }, (cell) => {
      if (zebra) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCE6F5" } };
      } else {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
      }
      cell.font = { size: 10, color: { argb: "FF1F2933" } };
      cell.alignment = { vertical: "middle", horizontal: "left", wrapText: false };
      cell.border = {
        top: { style: "hair", color: { argb: "FFCBD5E1" } },
        left: { style: "hair", color: { argb: "FFCBD5E1" } },
        bottom: { style: "hair", color: { argb: "FFCBD5E1" } },
        right: { style: "hair", color: { argb: "FFCBD5E1" } },
      };
    });
  });

  ws.autoFilter = {
    from: { row: headerRowIndex, column: 1 },
    to: { row: headerRowIndex + rows.length, column: columns.length },
  };

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}
