import { jsPDF } from "jspdf";

export type AccountancyPackagePdfField = {
  label: string;
  value: string;
};

export type AccountancyPackagePdfInput = {
  companyName?: string;
  taxPeriod?: string;
  accountantEmail?: string;
  message?: string;
  fields: AccountancyPackagePdfField[];
};

export function buildAccountancyPackagePdf(input: AccountancyPackagePdfInput): Buffer {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const companyName = cleanText(input.companyName || "Not provided");
  const taxPeriod = cleanText(input.taxPeriod || "Not provided");
  const generatedAt = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date());

  doc.setProperties({
    title: "UseClevr Pre-bookkeeping Package",
    subject: "Pre-bookkeeping package prepared for accountant review",
    author: "UseClevr",
    creator: "UseClevr",
  });

  let y = 18;
  doc.setTextColor(17, 24, 39);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Pre-bookkeeping package", 18, y);

  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(75, 85, 99);
  doc.text("Prepared for accountant review.", 18, y);

  y += 10;
  y = drawKeyValue(doc, "Company", companyName, y);
  y = drawKeyValue(doc, "Tax period", taxPeriod, y);
  y = drawKeyValue(doc, "Generated", `${generatedAt} UTC`, y);

  const message = cleanText(input.message || "");
  if (message) {
    y += 4;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(17, 24, 39);
    doc.text("Notes", 18, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(55, 65, 81);
    const lines = doc.splitTextToSize(message, 174);
    doc.text(lines, 18, y);
    y += lines.length * 5 + 4;
  }

  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(17, 24, 39);
  doc.text("Package fields", 18, y);
  y += 8;

  for (const field of input.fields) {
    if (y > 270) {
      doc.addPage();
      y = 18;
    }
    y = drawTableRow(doc, cleanText(field.label), cleanText(field.value || "Not provided"), y);
  }

  const output = doc.output("arraybuffer");
  return Buffer.from(output);
}

export function accountancyPackagePdfFilename(companyName?: string) {
  const base = cleanText(companyName || "pre-bookkeeping-package")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return `${base || "pre-bookkeeping-package"}-bookkeeping-package.pdf`;
}

function drawKeyValue(doc: jsPDF, label: string, value: string, y: number) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(17, 24, 39);
  doc.text(`${label}:`, 18, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(55, 65, 81);
  doc.text(value, 48, y);
  return y + 6;
}

function drawTableRow(doc: jsPDF, label: string, value: string, y: number) {
  const rowHeight = Math.max(10, doc.splitTextToSize(value, 112).length * 5 + 5);
  doc.setDrawColor(209, 213, 219);
  doc.setFillColor(249, 250, 251);
  doc.rect(18, y - 5, 52, rowHeight, "FD");
  doc.rect(70, y - 5, 122, rowHeight);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(17, 24, 39);
  doc.text(doc.splitTextToSize(label, 46), 21, y);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(55, 65, 81);
  doc.text(doc.splitTextToSize(value, 112), 73, y);
  return y + rowHeight;
}

function cleanText(value: unknown) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim();
}
