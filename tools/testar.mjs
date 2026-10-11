// Testes de regressão do motor de cálculo: roda o index.html no Node com os dados de exemplo
// e confere números conhecidos e casos de leitura de CSV.
//
// Uso: node tools/testar.mjs   (sai com código 1 se algo falhar)
import { loadEngine } from "./motor.mjs";

const { run } = await loadEngine();
let fail = 0;
const check = (name, got, want, tol = 0) => {
  const ok = typeof want === "number" ? Math.abs(got - want) <= tol : JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "ok  " : "FALHA"} ${name}: ${JSON.stringify(got)}${ok ? "" : ` (esperado ${JSON.stringify(want)})`}`);
};

// leitura de números e datas
check("toNum 1.234,56", run('toNum("1.234,56")'), 1234.56, 1e-9);
check("toNum 1234.56", run('toNum("1234.56")'), 1234.56, 1e-9);
check("toNum R$ 2.500", run('toNum("R$ 2.500")'), 2500);
check("toNum 0.125", run('toNum("0.125")'), 0.125, 1e-9);
check("toDate 31/12/2025", run('new Date(toDate("31/12/2025")).toISOString().slice(0,10)'), "2025-12-31");
check("toDate 2026-04-01 00:00:00", run('new Date(toDate("2026-04-01 00:00:00")).toISOString().slice(0,10)'), "2026-04-01");
check("toDate 13/2026 inválida", run('toDate("13/2026")'), null);

// dados de exemplo: números que o relatório mostra
const d = run(`(() => {
  state.level = "org"; state.filters = []; state.cut = { anormal: 50, esperado: 65, atencao: 55, alto: 70 };
  return diagnosticData(true);
})()`);
check("linhas de cliente", d.kpis.lines, 275);
check("organizações", d.kpis.base, 175);
check("canceladas", d.kpis.churned, 39);
check("churn mensal", d.kpis.monthly, 0.0148, 0.0001);
check("anormais", d.kpis.anormal, 7);
check("alto risco", d.kpis.alto, 27);
check("MRR alto risco", d.kpis.altoMrr, 77790);
check("AUC na base", d.quality.auc, 0.779, 0.002);
check("teste no tempo existe", !!d.backtest, true);
if (d.backtest) check("teste no tempo antecipa (AUC > 0,6)", d.backtest.auc > 0.6, true);

// hierarquia: linhas de grupo/organização não contam como cliente
check("linhas de hierarquia ignoradas", run("build().notes.length"), 1);
// cortes: mexer no corte reclassifica sem reprocessar os arquivos
check("cache do build", run("build() === build()"), true);

console.log(fail ? `\n${fail} teste(s) falharam` : "\ntodos os testes passaram");
process.exitCode = fail ? 1 : 0;
