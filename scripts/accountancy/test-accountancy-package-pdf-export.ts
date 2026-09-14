import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  accountancyPackagePdfFilename,
  buildAccountancyPackagePdf,
} from "../../src/lib/accountancy/package-pdf";

function run() {
  testPdfGeneratorReturnsPdfBytes();
  testRouteSendsInlinePdfResponse();
  testButtonValidatesPdfBeforeOpeningTab();
  console.log("Accountancy package PDF export regression tests passed.");
}

function testPdfGeneratorReturnsPdfBytes() {
  const pdf = buildAccountancyPackagePdf({
    companyName: "Acme Ltd",
    taxPeriod: "FY 2026",
    accountantEmail: "accountant@example.com",
    message: "Please review this package.",
    fields: [
      { label: "Company name", value: "Acme Ltd" },
      { label: "Tax period", value: "FY 2026" },
      { label: "Country", value: "Netherlands" },
    ],
  });

  assert.ok(pdf.byteLength > 1000, "PDF export should contain rendered document bytes");
  assert.equal(pdf.subarray(0, 4).toString("utf8"), "%PDF", "PDF export should start with a PDF header");
  assert.equal(accountancyPackagePdfFilename("Acme Ltd"), "acme-ltd-bookkeeping-package.pdf");
}

function testRouteSendsInlinePdfResponse() {
  const routeSource = readFileSync("src/app/api/accountancy/package/pdf/route.ts", "utf8");
  assert.match(routeSource, /Content-Type": "application\/pdf"/, "PDF route must send an application/pdf response");
  assert.match(routeSource, /Content-Disposition": `\$\{disposition\}; filename="\$\{filename\}"`/, "PDF route must send a content-disposition filename");
  assert.match(routeSource, /searchParams\.get\("disposition"\) === "attachment" \? "attachment" : "inline"/, "PDF route must support inline and attachment disposition");
  assert.match(routeSource, /Please sign in before exporting/, "PDF route must keep authenticated access");
}

function testButtonValidatesPdfBeforeOpeningTab() {
  const componentSource = readFileSync("src/components/accountancy/accountancy-package-form.tsx", "utf8");
  const fetchIndex = componentSource.indexOf('fetch("/api/accountancy/package/pdf?disposition=inline"');
  const openIndex = componentSource.indexOf('window.open(objectUrl, "_blank"');

  assert.ok(fetchIndex > -1, "PDF button should call the package PDF route");
  assert.ok(openIndex > fetchIndex, "PDF button should open a tab only after fetching the PDF");
  assert.match(componentSource, /contentType\.toLowerCase\(\)\.includes\("application\/pdf"\)/, "PDF button should validate the response content type");
  assert.match(componentSource, /if \(!response\.ok\)/, "PDF button should handle generation failures before opening a tab");
  assert.doesNotMatch(componentSource, /document\.write\(/, "PDF button should not write printable HTML into a blank tab");
}

run();
