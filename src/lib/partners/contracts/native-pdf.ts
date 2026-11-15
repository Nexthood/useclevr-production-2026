import { PDFDocument } from "pdf-lib";
import { jsPDF } from "jspdf";
import { canonical } from "./domain";
import { legalFont } from "./pdf";
import type { NativeAttestation, NativeSignaturePayload } from "./native-crypto";

export async function nativeExecutedPdf(
  source: Buffer,
  receipts: NativeAttestation<NativeSignaturePayload>[],
) {
  const certificate = new jsPDF({ unit: "mm", format: "a4", compress: true });
  certificate.addFileToVFS("PartnerNotoSans.ttf", legalFont());
  certificate.addFont("PartnerNotoSans.ttf", "PartnerNotoSans", "normal");
  certificate.setFont("PartnerNotoSans");
  certificate.setFontSize(9);
  const text = [
    "USECLEVR ELECTRONIC SIGNATURE EVIDENCE CERTIFICATE",
    "Email-verified affirmative signing actions, attested by UseClevr using Ed25519.",
    "This is not a qualified electronic signature, independent identity proof or trusted timestamp.",
    "The approved agreement pages precede this certificate. The exact source PDF and signed receipts are attached as files.",
    ...receipts.flatMap((r) => [
      `Role: ${r.payload.role}; legal name: ${r.payload.legalName}`,
      `Verified email: ${r.payload.verifiedEmail}; reference: ${r.payload.signerReference}`,
      `Email verified UTC: ${r.payload.verifiedAt}; document presented UTC: ${r.payload.documentPresentedAt}`,
      `Signed UTC: ${r.payload.signedAt}; contract: ${r.payload.contractId}`,
      `Source SHA-256: ${r.payload.sourceChecksum}`,
      `Consent: ${r.payload.consentVersion}; ${r.payload.consentText}`,
      `Evidence SHA-256: ${r.checksum}; previous: ${r.payload.previousEvidenceHash || "none"}`,
      `Attestation key ID: ${r.keyId}; Ed25519: ${r.signature}`,
    ]),
    "The separately archived, signed execution manifest binds the final PDF SHA-256 to these receipts. Commercial activation requires a separate administrator decision.",
  ].join("\n\n");
  const glyphs = certificate.getFont().metadata as unknown as {
    characterToGlyph: (code: number) => number;
  };
  for (const char of text)
    if (char.codePointAt(0)! >= 32 && !glyphs.characterToGlyph(char.codePointAt(0)!))
      throw new Error("Unsupported certificate glyph");
  let y = 18;
  for (const line of certificate.splitTextToSize(text, 174) as string[]) {
    if (y > 276) {
      certificate.addPage();
      y = 18;
    }
    certificate.text(line, 18, y);
    y += 4.6;
  }
  const pdf = await PDFDocument.load(source);
  const evidence = await PDFDocument.load(certificate.output("arraybuffer"));
  for (const page of await pdf.copyPages(evidence, evidence.getPageIndices())) pdf.addPage(page);
  await pdf.attach(source, "approved-source.pdf", {
    mimeType: "application/pdf",
    description: "Exact immutable source accepted by both signers",
  });
  await pdf.attach(Buffer.from(canonical(receipts)), "signing-receipts.json", {
    mimeType: "application/json",
  });
  return Buffer.from(await pdf.save());
}
