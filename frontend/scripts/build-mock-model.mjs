// Generuje src/lib/api/mock/competency-model.json z oficjalnego Model_kompetencji.xlsx.
// Użycie: node scripts/build-mock-model.mjs [ścieżka/do/Model_kompetencji.xlsx]
// Bez argumentu szuka docs/HackNation/Model_kompetencji.xlsx w katalogach nadrzędnych.
// Identyfikatory (K01, K01-W1) są zgodne ze skryptem importu backendu.
import { existsSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";

const here = dirname(fileURLToPath(import.meta.url));
const frontendDir = resolve(here, "..");
const outFile = join(frontendDir, "src", "lib", "api", "mock", "competency-model.json");

const LEVEL_LABELS = [
  "Znacznie poniżej oczekiwań",
  "Poniżej oczekiwań",
  "Na poziomie oczekiwań",
  "Powyżej oczekiwań",
  "Znacznie powyżej oczekiwań",
];

function findXlsx() {
  if (process.argv[2]) return resolve(process.argv[2]);
  let dir = frontendDir;
  for (;;) {
    const candidate = join(dir, "docs", "HackNation", "Model_kompetencji.xlsx");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error("Nie znaleziono docs/HackNation/Model_kompetencji.xlsx – podaj ścieżkę jako argument.");
}

const clean = (v) => String(v ?? "").replace(/\s+/g, " ").trim();

// Nazwy kompetencji w xlsx są wersalikami – zamieniamy na sentence case z zachowaniem „/”.
function sentenceCase(name) {
  const lower = name.toLocaleLowerCase("pl-PL");
  return lower.charAt(0).toLocaleUpperCase("pl-PL") + lower.slice(1);
}

const xlsxPath = findXlsx();
const wb = XLSX.readFile(xlsxPath);
const rows = (ws) => XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

const index = rows(wb.Sheets[wb.SheetNames[0]])
  .filter((r) => r[0] != null && /^\d+$/.test(String(r[0]).trim()) && r[1])
  .map((r) => ({ lp: Number(String(r[0]).trim()), name: clean(r[1]), count: Number(r[2]) }));

const sheets = wb.SheetNames.slice(1);
if (sheets.length !== index.length) {
  throw new Error(`Spis ma ${index.length} pozycji, a arkuszy kompetencji jest ${sheets.length}`);
}

const competencies = index.map(({ lp, name, count }, i) => {
  const id = `K${String(lp).padStart(2, "0")}`;
  const indicators = [];
  for (const r of rows(wb.Sheets[sheets[i]]).slice(1)) {
    if (!clean(r[0]) || !r.slice(1, 6).some(Boolean)) continue;
    if (clean(r[0]).toLowerCase().startsWith("wskaźnik behawioralny")) continue;
    const descriptions = r.slice(1, 6).map(clean);
    if (descriptions.length !== 5 || descriptions.some((d) => !d)) {
      throw new Error(`Arkusz ${sheets[i]}: niekompletne opisy poziomów dla „${clean(r[0])}”`);
    }
    indicators.push({
      id: `${id}-W${indicators.length + 1}`,
      name: clean(r[0]),
      levels: descriptions.map((description, l) => ({
        level: l + 1,
        label: LEVEL_LABELS[l],
        description,
      })),
    });
  }
  if (indicators.length !== count) {
    throw new Error(`${name}: spis podaje ${count} wskaźników, w arkuszu jest ${indicators.length}`);
  }
  return { id, name: sentenceCase(name), indicators };
});

writeFileSync(outFile, JSON.stringify(competencies, null, 2) + "\n", "utf8");
const total = competencies.reduce((n, c) => n + c.indicators.length, 0);
console.log(`Zapisano ${competencies.length} kompetencji, ${total} wskaźników → ${outFile}`);
