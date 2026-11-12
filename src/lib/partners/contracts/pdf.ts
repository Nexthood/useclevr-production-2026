import { jsPDF } from "jspdf";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { ContractError, type ContractSnapshot, type Template } from "./domain";
let font: string | undefined;
function legalFont() {
  if (!font) {
    const original = path.join(
      process.cwd(),
      "src/assets/fonts/partner-contracts/NotoSans-Regular.ttf",
    );
    const packaged = path.join(
      process.cwd(),
      "assets/fonts/partner-contracts/NotoSans-Regular.ttf",
    );
    font = readFileSync(existsSync(original) ? original : packaged).toString("base64");
  }
  return font;
}
export function agreementText(t: Template, s: ContractSnapshot, id: string) {
  const party = [
    "## Party Schedule",
    `Partner: ${s.identity.legalName}`,
    `Legal form: ${s.identity.entityType}`,
    `Registration: ${s.identity.registrationId || "Individual; no company registration declared"}`,
    `Address: ${s.identity.address}`,
    `Country: ${s.identity.country}`,
    `Authorized partner signer: ${s.identity.signerName}; ${s.identity.signerTitle}`,
    `Partner notice email: ${s.partnerEmail}`,
    `Company: ${s.company.legalName}`,
    `Company registration: ${s.company.registrationId}; ${s.company.registrationJurisdiction}`,
    `Company address: ${s.company.address}; ${s.company.country}`,
    `Company notice email: ${s.company.noticeEmail}`,
  ].join("\n");
  const commercial = [
    "## Versioned Commercial Schedule",
    `Terms version: ${s.scheduleHash}`,
    `Financial program policy: ${s.financialConfigId}; checksum ${s.financialConfigHash}`,
    `Schedule effective limit: ${s.effectiveUntil || "As expressly specified in the term and renewal provision"}`,
    ...Object.entries(s.terms).map(
      ([key, value]) =>
        `${key.replace(/([A-Z])/g, " $1").replace(/^./, (x) => x.toUpperCase())}: ${value}`,
    ),
  ].join("\n\n");
  const values: Record<string, string> = {
    AGREEMENT_TITLE: t.title,
    TEMPLATE_VERSION: t.version,
    CONTRACT_REFERENCE: id,
    PARTNER_LEGAL_NAME: s.identity.legalName,
    PARTNER_SIGNER_NAME: s.identity.signerName,
    PARTNER_SIGNER_TITLE: s.identity.signerTitle,
    COMPANY_SIGNER_NAME: s.companySigner.name,
    COMPANY_SIGNER_TITLE: s.companySigner.title,
    COMPANY_SIGNER_REFERENCE: s.companySigner.reference,
    PARTY_SCHEDULE: party,
    COMMERCIAL_SCHEDULE: commercial,
  };
  const text = t.body.replace(/\{\{([A-Z_]+)\}\}/g, (_, key: string) => {
    if (!values[key]) throw new ContractError("unresolved_agreement_field");
    return values[key];
  });
  if (/\{\{|\}\}|\[(?:TBD|INSERT|TO BE)/i.test(text))
    throw new ContractError("unresolved_agreement_field");
  return text;
}
export function generateAgreementPdf(
  t: Template,
  s: ContractSnapshot,
  id: string,
  nonBinding: boolean,
) {
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  doc.addFileToVFS("PartnerNotoSans.ttf", legalFont());
  doc.addFont("PartnerNotoSans.ttf", "PartnerNotoSans", "normal");
  doc.setFont("PartnerNotoSans", "normal");
  const text = agreementText(t, s, id);
  const metadata = doc.getFont().metadata as unknown as {
    characterToGlyph?: (code: number) => number;
  };
  if (typeof metadata.characterToGlyph !== "function")
    throw new ContractError("document_font_unavailable");
  for (const char of text) {
    const cp = char.codePointAt(0)!;
    if (cp >= 32 && !metadata.characterToGlyph(cp))
      throw new ContractError("legal_text_requires_supported_font_or_reviewed_transliteration");
  }
  let y = nonBinding ? 28 : 20;
  doc.setFontSize(9);
  doc.setTextColor(20, 25, 35);
  const lines = doc.splitTextToSize(text.replace(/^#{1,3} /gm, ""), 174) as string[];
  for (const line of lines) {
    if (y > 274) {
      doc.addPage();
      y = nonBinding ? 28 : 20;
    }
    doc.text(line, 18, y);
    y += 4.6;
  }
  const count = doc.getNumberOfPages();
  for (let i = 1; i <= count; i++) {
    doc.setPage(i);
    if (nonBinding) {
      doc.setTextColor(160, 20, 20);
      doc.setFontSize(10);
      doc.text("NON-BINDING TEST / DRAFT — NOT FOR PRODUCTION SIGNATURE", 18, 15);
    }
    doc.setTextColor(80, 85, 95);
    doc.setFontSize(7);
    doc.text(`${id} | Template ${t.version} | Page ${i} of ${count}`, 18, 289);
  }
  doc.setProperties({
    title: t.title,
    author: "Atlas Mega Ventures LLC",
    subject: nonBinding ? "Non-binding agreement draft" : "Partner agreement",
  });
  return Buffer.from(doc.output("arraybuffer"));
}
