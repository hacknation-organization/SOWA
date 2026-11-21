const TRANSLITERATION: Record<string, string> = {
  ą: "a", ć: "c", ę: "e", ł: "l", ń: "n", ó: "o", ś: "s", ź: "z", ż: "z",
  Ą: "A", Ć: "C", Ę: "E", Ł: "L", Ń: "N", Ó: "O", Ś: "S", Ź: "Z", Ż: "Z",
  "„": '"', "”": '"', "–": "-", "—": "-", "…": "...", "•": "-", "’": "'",
};

const LINES_PER_PAGE = 52;

function ascii(text: string): string {
  return text
    .replace(/[^\x20-\x7E]/g, (ch) => TRANSLITERATION[ch] ?? "?")
    .replace(/[\\()]/g, (ch) => `\\${ch}`);
}

function wrap(line: string, width = 95): string[] {
  if (line.length <= width) return [line];
  const out: string[] = [];
  let cur = "";
  for (const word of line.split(" ")) {
    if ((cur + " " + word).trim().length > width) {
      out.push(cur);
      cur = word;
    } else cur = (cur + " " + word).trim();
  }
  if (cur) out.push(cur);
  return out;
}

export function buildPdf(lines: string[]): Blob {
  const all = lines.flatMap((l) => wrap(l));
  const pages: string[][] = [];
  for (let i = 0; i < all.length; i += LINES_PER_PAGE) pages.push(all.slice(i, i + LINES_PER_PAGE));
  if (pages.length === 0) pages.push([""]);

  const objects: string[] = [];
  const pageIds = pages.map((_, i) => 4 + i * 2);
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  pages.forEach((pageLines, i) => {
    const pageId = pageIds[i];
    const stream =
      "BT /F1 10 Tf 50 800 Td 14 TL\n" +
      pageLines.map((l) => `(${ascii(l)}) Tj T*`).join("\n") +
      "\nET";
    objects[pageId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] ` +
      `/Resources << /Font << /F1 3 0 R >> >> /Contents ${pageId + 1} 0 R >>`;
    objects[pageId + 1] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = pdf.length;
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) {
    pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Blob([pdf], { type: "application/pdf" });
}
