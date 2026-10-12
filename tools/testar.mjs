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

if (d.backtest) check("teste no tempo aprende só com o passado", d.backtest.trained, true);

// NRR com o MRR de 12 meses atrás
const nrr = run("(() => { const M = build(); const r = nrr12(M.clients, M.ref); return r && Math.round(r.nrr * 1000) / 1000; })()");
check("NRR calculado", nrr != null && nrr > 0.5 && nrr < 1.5, true);
// histórico de KPI por linha (ficha do cliente)
check("histórico de KPI", run("build().clients.some(c => Object.values(c.hist).some(h => h.length >= 3))"), true);
// relatório exportável: tabelas montadas a partir do último render
const ex = run("(() => { renderReport(); const t = exportTables(); return t ? Object.keys(t).sort() : null; })()");
check("tabelas do relatório exportado", ex && ["ativos-em-risco.csv", "cancelados-classificados.csv", "clientes-analisados.csv", "indicadores.csv", "serie-mensal.csv"].every(k => ex.includes(k)), true);

// sinais de churn: assinatura de cada motivo
const sg = run(`(() => { state.level = "org"; renderReport(); const M0 = build(); const m = signalModel(M0, view(M0));
  const top = mot => (m.sigs.find(x => x.motivo === mot) || { top: [] }).top.map(x => x.fam + "|" + x.f);
  const S = signalSources(), exitTk = [...S.tk.values()].flat().filter(e => e.exit).length;
  // contrato vigente em T: o valor não pode mudar só porque a linha vai cancelar depois
  const lc = M0.clients.find(c => c.churned && (S.ct.get(c.id) || []).length === 1 && c.dataCanc - c.inicio > 200 * 864e5);
  const T = lc.dataCanc - 40 * 864e5, f = featuresAt(lc, T, S, null, []);
  return { motivos: m.sigs.length, suporte: top("suporte"), concorrente: top("concorrente"), corte: top("corte_custos"), exitTk, fotos: m.snapshots, semVazamento: f.ct_mrr_d90 === 0 && f.ct_encerrados === 0 && f.ct_renov > 0, casos: interviewCases(m).length }; })()`);
check("assinaturas por motivo", sg.motivos >= 4, true);
check("suporte aparece em tickets", sg.suporte.some(x => x.startsWith("Suporte|")), true);
check("concorrente aparece em sponsor novo", sg.concorrente.includes("Relacionamento|sp_novo"), true);
check("pedidos de cancelamento marcados para sair das variáveis", sg.exitTk > 30, true);
check("contrato aparece em corte de custos", sg.corte.some(x => x.startsWith("Contrato|")), true);
check("fim do contrato vigente não vaza a saída", sg.semVazamento, true);
check("casos para entrevista por motivo", sg.casos >= 3, true);

// hierarquia: linhas de grupo/organização não contam como cliente
check("linhas de hierarquia ignoradas", run("build().notes.length"), 1);
// cortes: mexer no corte reclassifica sem reprocessar os arquivos
check("cache do build", run("build() === build()"), true);

console.log(fail ? `\n${fail} teste(s) falharam` : "\ntodos os testes passaram");
process.exitCode = fail ? 1 : 0;
