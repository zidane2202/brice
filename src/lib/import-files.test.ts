import assert from "node:assert/strict";
import test from "node:test";
import { strToU8, zipSync } from "fflate";
import { extractImportFile } from "./import-files.ts";

test("an Excel sheet becomes tab-separated text, shared strings included", () => {
  const xlsx = zipSync({
    "xl/workbook.xml": strToU8("<workbook/>"),
    "xl/sharedStrings.xml": strToU8("<sst><si><t>Nom</t></si><si><t>Tél</t></si><si><t>Jean &amp; Paul</t></si></sst>"),
    "xl/worksheets/sheet1.xml": strToU8(
      '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row><row r="2"><c r="A2" t="s"><v>2</v></c><c r="C2"><v>699000000</v></c></row></sheetData></worksheet>'
    ),
  });
  const result = extractImportFile("clients.xlsx", "", xlsx);
  assert.equal(result.kind, "text");
  assert.equal(result.kind === "text" && result.text, "# sheet1.xml\nNom\tTél\nJean & Paul\t\t699000000");
});

test("a Word document becomes plain text, one paragraph per line", () => {
  const docx = zipSync({
    "word/document.xml": strToU8("<w:document><w:body><w:p><w:r><w:t>Jean 699000000</w:t></w:r></w:p><w:p><w:r><w:t>Aïcha Netflix</w:t></w:r></w:p></w:body></w:document>"),
  });
  const result = extractImportFile("liste.docx", "", docx);
  assert.equal(result.kind === "text" && result.text, "Jean 699000000\nAïcha Netflix");
});

test("images and PDFs are passed through, plain text is decoded, binaries are refused", () => {
  assert.equal(extractImportFile("capture.PNG", "", new Uint8Array([1, 2, 3])).kind, "image");
  assert.equal(extractImportFile("liste.pdf", "application/pdf", new Uint8Array([1])).kind, "pdf");
  const text = extractImportFile("contacts.vcf", "", strToU8("BEGIN:VCARD\nFN:Jean\nTEL:699000000\nEND:VCARD"));
  assert.equal(text.kind === "text" && text.text.includes("TEL:699000000"), true);
  assert.equal(extractImportFile("photo.heic", "", new Uint8Array([0])).kind, "unsupported");
  assert.equal(extractImportFile("data.bin", "", new Uint8Array(Array.from({ length: 200 }, (_, i) => i % 32))).kind, "unsupported");
});
