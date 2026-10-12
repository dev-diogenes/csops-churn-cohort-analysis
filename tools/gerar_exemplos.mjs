// Gera os CSVs de exemplo em exemplos/ a partir do mesmo gerador do relatório (makeSample).
// Eles alimentam a API simulada (node tools/servidor.mjs --mock) e servem de modelo preenchido.
//
// Uso: node tools/gerar_exemplos.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEngine } from "./motor.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { run } = await loadEngine();
const s = run("makeSample()");
const files = { clientes: "customer.csv", kpis: "kpi.csv", tickets: "tickets.csv", nps: "nps.csv", tarefas: "tarefas.csv", uso: "uso.csv", contratos: "contratos.csv" };
for (const [k, f] of Object.entries(files)) {
  fs.writeFileSync(path.join(root, "exemplos", f), s[k] + "\n");
  console.log(`exemplos/${f}: ${s[k].split("\n").length - 1} linhas`);
}
