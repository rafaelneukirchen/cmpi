import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

interface ReportSection {
  title: string;
  items: { label: string; value: string }[];
}

export function exportReportPdf(sections: ReportSection[], totalInvestment: number) {
  const doc = new jsPDF();
  
  doc.setFontSize(18);
  doc.setTextColor(30, 45, 80);
  doc.text("CAMPANHA 2026 — Relatório Estratégico", 14, 22);
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}`, 14, 30);

  doc.setFontSize(14);
  doc.setTextColor(30, 45, 80);
  doc.text(`Custo Total da Campanha: R$ ${totalInvestment.toLocaleString("pt-BR")}`, 14, 42);

  let yPos = 52;

  sections.forEach((section) => {
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(12);
    doc.setTextColor(30, 45, 80);
    doc.text(section.title, 14, yPos);
    yPos += 4;

    autoTable(doc, {
      startY: yPos,
      head: [["Item", "Valor"]],
      body: section.items.map(i => [i.label, i.value]),
      theme: "striped",
      headStyles: { fillColor: [30, 45, 80], fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      margin: { left: 14, right: 14 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Campanha 2026 — Página ${i} de ${pageCount}`, 14, 290);
  }

  doc.save("relatorio-campanha-2026.pdf");
}

export function exportTablePdf(title: string, headers: string[], rows: string[][]) {
  const doc = new jsPDF();
  
  doc.setFontSize(16);
  doc.setTextColor(30, 45, 80);
  doc.text(title, 14, 22);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`, 14, 30);

  autoTable(doc, {
    startY: 36,
    head: [headers],
    body: rows,
    theme: "striped",
    headStyles: { fillColor: [30, 45, 80], fontSize: 9 },
    bodyStyles: { fontSize: 8 },
    margin: { left: 14, right: 14 },
  });

  doc.save(`${title.toLowerCase().replace(/\s+/g, "-")}.pdf`);
}

export function exportTableExcel(title: string, headers: string[], rows: string[][]) {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 31));
  XLSX.writeFile(wb, `${title.toLowerCase().replace(/\s+/g, "-")}.xlsx`);
}

export function exportReportExcel(sections: { title: string; items: { label: string; value: string }[] }[], totalInvestment: number) {
  const wb = XLSX.utils.book_new();
  const allRows: string[][] = [
    ["Relatório Estratégico — Campanha 2026"],
    [`Custo Total: R$ ${totalInvestment.toLocaleString("pt-BR")}`],
    [],
  ];
  sections.forEach(section => {
    allRows.push([section.title]);
    allRows.push(["Item", "Valor"]);
    section.items.forEach(i => allRows.push([i.label, i.value]));
    allRows.push([]);
  });
  const ws = XLSX.utils.aoa_to_sheet(allRows);
  XLSX.utils.book_append_sheet(wb, ws, "Relatório");
  XLSX.writeFile(wb, "relatorio-campanha-2026.xlsx");
}
