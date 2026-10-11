// Gera os dados do painel de diagnóstico (diagnostico.html) usando o mesmo motor de cálculo do index.html.
//
// Uso:
//   node tools/gerar_diagnostico.mjs                                  → dados de exemplo do index.html
//   node tools/gerar_diagnostico.mjs customer.csv kpi.csv [cancel.csv] → seus arquivos
//
// O resultado é gravado dentro de diagnostico.html, entre /*DATA:START*/ e /*DATA:END*/.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const engine = html.split("<script>")[1].split("</script>")[0];

// DOM falso: o motor desenha a página ao carregar; aqui só os cálculos importam.
const E = new Proxy(function () {}, {
  get(t, k) {
    if (k === Symbol.toPrimitive) return () => "";
    if (k === Symbol.iterator) return [][Symbol.iterator];
    if (k === "hidden") return true;
    if (k === "length") return 0;
    if (k === "dataset") return {};
    if (k === "getBoundingClientRect") return () => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 });
    return E;
  },
  apply() { return E; },
  set() { return true; }
});
const document = { querySelector: () => E, querySelectorAll: () => [], addEventListener() {}, createElement: () => E, body: E };
const papa = await (await fetch("https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js")).text();
const ctx = vm.createContext({ document, window: {}, navigator: {}, location: {}, innerWidth: 1200, innerHeight: 800, matchMedia: () => ({ matches: false }), localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, setTimeout: () => 0, clearTimeout, console, Intl, Date, Math, JSON });
vm.runInContext(papa + "\nthis.Papa = Papa;", ctx);
vm.runInContext(engine, ctx);

const files = process.argv.slice(2);
if (files.length) {
  const [cust, kpi, canc] = files.map(f => fs.readFileSync(f, "utf8"));
  ctx.__files = { cust, kpi, canc };
  vm.runInContext(`
    state.raw = EMPTY_RAW(); state.map = EMPTY_MAP(); state.isSample = false;
    state.raw.clientes = parseCSV(__files.cust); autoMap("clientes");
    state.raw.kpis = parseCSV(__files.kpi); autoMap("kpis");
    if (__files.canc) { state.raw.cancel = parseCSV(__files.canc); autoMap("cancel"); }
  `, ctx);
}
ctx.__isSample = !files.length;
// mesmo cálculo do botão "Diagnóstico de Churn" do relatório
const data = vm.runInContext("diagnosticData(__isSample)", ctx);

const out = path.join(root, "diagnostico.html");
const page = fs.readFileSync(out, "utf8");
const json = JSON.stringify(data);
const next = page.replace(/\/\*DATA:START\*\/[\s\S]*?\/\*DATA:END\*\//, () => `/*DATA:START*/${json}/*DATA:END*/`);
fs.writeFileSync(out, next);
console.log(`diagnostico.html atualizado: ${data.kpis.base} ${data.level.toLowerCase()}, ${data.kpis.churned} cancelamentos, ${(json.length / 1024).toFixed(0)} KB de dados`);
