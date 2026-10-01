import { jsPDF } from "jspdf";
import { BOH_SHARE, CashOut, formatHours, formatMoney, pdfFileName } from "./cashout";

const COPPER: [number, number, number] = [166, 104, 62];
const INK: [number, number, number] = [28, 25, 23];
const MUTED: [number, number, number] = [120, 113, 108];

export function saveCashOutPdf(r: CashOut) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const left = 20;
  const right = 190;
  let y = 26;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...INK);
  doc.text("The Ace", left, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...MUTED);
  doc.text("Cash-Out Report", right, y, { align: "right" });

  y += 7;
  doc.text(r.dateTime, left, y);
  y += 5;
  doc.setDrawColor(...COPPER);
  doc.setLineWidth(0.6);
  doc.line(left, y, right, y);

  const row = (label: string, value: string, opts: { bold?: boolean; size?: number } = {}) => {
    y += opts.size ? opts.size * 0.6 : 8;
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    doc.setFontSize(opts.size ?? 11);
    doc.setTextColor(...INK);
    doc.text(label, left, y);
    doc.text(value, right, y, { align: "right" });
  };

  y += 4;
  row("Total tips", formatMoney(r.totalTips), { bold: true, size: 15 });
  row("Cash", formatMoney(r.cash));
  row("Card", formatMoney(r.card));
  row(`BOH (kitchen, ${Math.round(BOH_SHARE * 100)}%)`, formatMoney(r.bohTips));
  row("FOH pool", formatMoney(r.fohTips));
  row("FOH rate", `${formatMoney(r.fohRate)} / hr  ·  ${formatHours(r.totalHours)}`);

  y += 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text("STAFF", left, y);
  doc.text("HOURS", 140, y, { align: "right" });
  doc.text("PAYOUT", right, y, { align: "right" });
  y += 2;
  doc.setDrawColor(220, 214, 208);
  doc.setLineWidth(0.3);
  doc.line(left, y, right, y);

  doc.setFontSize(11);
  for (const s of r.staffTips) {
    y += 8;
    if (y > 275) {
      doc.addPage();
      y = 24;
    }
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...INK);
    doc.text(s.name, left, y);
    doc.setTextColor(...MUTED);
    doc.text(formatHours(s.hours), 140, y, { align: "right" });
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...INK);
    doc.text(formatMoney(s.amount), right, y, { align: "right" });
  }

  doc.save(pdfFileName());
}
