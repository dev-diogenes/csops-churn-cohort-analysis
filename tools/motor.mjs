// Carrega o motor de cálculo do index.html dentro do Node (sem navegador).
// Usado por gerar_diagnostico.mjs e testar.mjs para que os números batam com o relatório.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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

export async function loadEngine() {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const parts = html.split("<script>");
  const engine = parts[parts.length - 1].split("</script>")[0];
  const document = { querySelector: () => E, querySelectorAll: () => [], addEventListener() {}, createElement: () => E, body: E };
  const papa = await (await fetch("https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js")).text();
  const ctx = vm.createContext({
    document, window: { addEventListener() {}, scrollTo() {} }, navigator: {}, location: {}, innerWidth: 1200, innerHeight: 800,
    matchMedia: () => ({ matches: false }), localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    setTimeout: () => 0, clearTimeout() {}, requestAnimationFrame: () => 0, cancelAnimationFrame() {}, console, Intl, Date, Math, JSON
  });
  vm.runInContext(papa + "\nthis.Papa = Papa;", ctx);
  vm.runInContext(engine, ctx);
  // o motor abre de forma assíncrona (dados lembrados ou exemplo); espera o exemplo carregar
  await new Promise(r => setTimeout(r, 20));
  const run = code => vm.runInContext(code, ctx);
  const loadFiles = files => {
    const [cust, kpi, canc] = files.map(f => fs.readFileSync(f, "utf8"));
    ctx.__files = { cust, kpi, canc };
    run(`
      state.raw = EMPTY_RAW(); state.map = EMPTY_MAP(); state.isSample = false;
      state.raw.clientes = parseCSV(__files.cust); autoMap("clientes");
      state.raw.kpis = parseCSV(__files.kpi); autoMap("kpis");
      if (__files.canc) { state.raw.cancel = parseCSV(__files.canc); autoMap("cancel"); }
    `);
  };
  return { ctx, run, loadFiles };
}
