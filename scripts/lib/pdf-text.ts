import * as fs from "node:fs";

const TEXT_OPERATOR_PATTERN =
  /\(((?:\\[\s\S]|[^\\()])*)\)\s*(?:Tj|')|\[((?:\\[\s\S]|[^\]])*)\]\s*TJ/g;
const STRING_LITERAL_PATTERN = /\(((?:\\[\s\S]|[^\\()])*)\)/g;

function decodePdfString(value: string) {
  return value.replace(/\\([0-7]{1,3}|[nrtbf()\\])/g, (_, token: string) => {
    if (/^[0-7]+$/.test(token)) {
      return String.fromCharCode(Number.parseInt(token, 8));
    }
    switch (token) {
      case "n":
        return "\n";
      case "r":
        return "\r";
      case "t":
        return "\t";
      case "b":
        return "\b";
      case "f":
        return "\f";
      default:
        return token;
    }
  });
}

export function extractPdfText(pdfPath: string) {
  const pdf = fs.readFileSync(pdfPath).toString("latin1");
  const lines: string[] = [];
  for (const match of pdf.matchAll(TEXT_OPERATOR_PATTERN)) {
    const literal = match[1];
    const arrayContent = match[2];
    if (literal !== undefined) {
      lines.push(decodePdfString(literal));
    } else if (arrayContent !== undefined) {
      const parts = Array.from(arrayContent.matchAll(STRING_LITERAL_PATTERN), (part) =>
        decodePdfString(part[1] ?? ""),
      );
      lines.push(parts.join(""));
    }
  }
  if (lines.length === 0) {
    throw new Error(
      `PDF text extraction found no text operators in ${pdfPath}; report PDFs must keep uncompressed text streams`,
    );
  }
  return lines.join("\n");
}
