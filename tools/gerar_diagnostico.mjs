// Gera os dados do painel de diagnóstico (diagnostico.html) usando o mesmo motor de cálculo do index.html.
//
// Uso:
//   node tools/gerar_diagnostico.mjs                                  → dados de exemplo do index.html
//   node tools/gerar_diagnostico.mjs customer.csv kpi.csv [cancel.csv] → seus arquivos
//
// O resultado é gravado dentro de diagnostico.html, entre /*DATA:START*/ e /*DATA:END*/.
import fs from "node:fs";
import path from "node:path";
import { loadEngine, root } from "./motor.mjs";

const files = process.argv.slice(2);
const { ctx, run, loadFiles } = await loadEngine();
if (files.length) loadFiles(files);
ctx.__isSample = !files.length;
// mesmo cálculo do botão "Diagnóstico de Churn" do relatório
const data = run("diagnosticData(__isSample)");

const out = path.join(root, "diagnostico.html");
const page = fs.readFileSync(out, "utf8");
const json = JSON.stringify(data);
fs.writeFileSync(out, page.replace(/\/\*DATA:START\*\/[\s\S]*?\/\*DATA:END\*\//, () => `/*DATA:START*/${json}/*DATA:END*/`));
console.log(`diagnostico.html atualizado: ${data.kpis.base} ${data.level.toLowerCase()}, ${data.kpis.churned} cancelamentos, ${(json.length / 1024).toFixed(0)} KB de dados`);
