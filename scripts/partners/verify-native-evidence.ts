import { readFile } from "node:fs/promises";
import { verifyNativeFiles } from "../../src/lib/partners/contracts/native-crypto";

async function main() {
  // Read private exports outside the repository. No database, email or network access.
  const [manifestPath, pdfPath, sourcePath, trustedKeysPath, ...extra] = process.argv.slice(2);
  if (!manifestPath || !pdfPath || !sourcePath || !trustedKeysPath || extra.length)
    throw new Error(
      "Usage: node -r tsx/esm scripts/partners/verify-native-evidence.ts <manifest.json> <executed.pdf> <source.pdf> <trusted-public-keys.json>",
    );
  try {
    process.env.PARTNER_CONTRACT_NATIVE_PUBLIC_KEYS = await readFile(trustedKeysPath, "utf8");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    const signedPdf = await readFile(pdfPath),
      sourcePdf = await readFile(sourcePath);
    verifyNativeFiles(manifest, signedPdf, sourcePdf);
    console.log(
      "PASS native evidence attestations, receipt chain, source PDF and executed PDF SHA-256 checks",
    );
  } catch {
    console.error(
      "FAIL native evidence verification. Check the trusted public keys and unmodified private exports.",
    );
    process.exitCode = 1;
  }
}
void main().catch(() => {
  console.error("FAIL native evidence verification. Check the required private export paths.");
  process.exitCode = 1;
});
