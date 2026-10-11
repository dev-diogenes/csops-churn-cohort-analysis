// Executado dentro do motor do index.html (ver gerar_diagnostico.mjs). Devolve os agregados do painel de diagnóstico.
(() => {
  const M0 = build();
  if (!M0) throw new Error("Sem dados: anexe pelo menos customer.csv.");
  state.filters = [];
  state.level = M0.hier.org ? "org" : "linha";
  const M = view(M0);
  const dimOf = re => M.dims.find(d => re.test(norm(d))) || null;
  state.dimPeer = dimOf(/plano|plan|porte|tier|size/) || "";
  state.dimBar = dimOf(/segment|setor|vertical|industry/) || M.dims[0] || null;
  const csmDim = dimOf(/owner|csm|responsavel/);
  const stats = kpiStats(M);
  const sig = computeRisk(M, stats, state.dimPeer || null);

  const E = M.clients, act = E.filter(c => !c.churned), ch = E.filter(c => c.churned);
  const sumF = a => a.reduce((t, v) => t + (Number.isFinite(v) ? v : 0), 0);
  const iso = t => t == null ? null : new Date(t).toISOString().slice(0, 10);
  const attr = (c, d) => d ? c.attrs[d] : null;
  const exposure = sumF(E.map(c => c.tenure));
  const chDated = ch.filter(c => Number.isFinite(c.tenure)).length;
  const monthly = exposure ? chDated / exposure : null;
  const ten = ch.map(c => c.tenure).filter(Number.isFinite).sort((a, b) => a - b);
  const mrrAct = sumF(act.map(c => c.mrr)), mrrLost = sumF(ch.map(c => c.mrrPerdido));
  const count = cls => E.filter(c => c.cls === cls).length;
  const hi = act.filter(c => c.cls === "alto");
  const rowsCustomer = state.raw.clientes ? state.raw.clientes.rows.length : 0;

  const kpis = {
    base: E.length, lines: M.lines.length, rowsCustomer, active: act.length, churned: ch.length, rate: ch.length / E.length,
    monthly, exposure, mrrActive: mrrAct, mrrLost, mrrLostShare: mrrLost + mrrAct ? mrrLost / (mrrLost + mrrAct) : null,
    medianTenure: ten.length ? quantile(ten, .5) : null, p25Tenure: ten.length ? quantile(ten, .25) : null, p75Tenure: ten.length ? quantile(ten, .75) : null,
    partial: E.filter(c => c.partial).length, partialLost: sumF(E.filter(c => c.partial).map(c => c.partialLost)),
    anormal: count("anormal"), fraco: count("fraco"), esperado: count("esperado"), scoredChurned: ch.filter(c => c.risk != null).length,
    alto: hi.length, altoMrr: sumF(hi.map(c => c.mrr)), atencao: count("atencao"), ok: count("ok"), ref: iso(M.ref)
  };

  // retenção: coortes e curva de sobrevivência (Kaplan-Meier, mês a mês)
  const D = cohortData(M);
  const cohorts = D ? { byMonth: D.byMonth, steps: D.steps, rows: D.rows.map(r => ({ k: r.k, n: r.n, ch: r.ch, cells: r.cells.map(c => c ? [c.r, c.n, c.lost] : null) })) } : null;
  const valid = E.filter(c => Number.isFinite(c.tenure) && !(c.churned && c.dataCanc == null));
  const maxT = Math.min(36, Math.floor(Math.max(0, ...valid.map(c => c.tenure))));
  const km = list => {
    let S = 1; const pts = [[0, 1, list.length]];
    for (let t = 0; t < maxT; t++) {
      const atRisk = list.filter(c => c.tenure >= t).length; if (atRisk < 10) break;
      const d = list.filter(c => c.churned && c.tenure >= t && c.tenure < t + 1).length;
      S *= 1 - d / atRisk; pts.push([t + 1, S, atRisk]);
    }
    return pts;
  };
  const survival = { all: km(valid), by: [], dim: state.dimPeer ? pretty(state.dimPeer) : null };
  if (state.dimPeer) {
    const vals = [...new Set(valid.map(c => c.attrs[state.dimPeer]))];
    if (vals.length <= 5) survival.by = vals.sort().map(v => ({ k: v, pts: km(valid.filter(c => c.attrs[state.dimPeer] === v)) }));
  }

  // onde está o churn: taxa por perfil e teste z
  const p = ch.length / E.length;
  const groupRates = (list, d, base) => {
    const g = new Map();
    for (const c of list) { const k = c.attrs[d]; if (!g.has(k)) g.set(k, { k, n: 0, ch: 0, mrr: 0 }); const o = g.get(k); o.n++; if (c.churned) { o.ch++; o.mrr += Number.isFinite(c.mrrPerdido) ? c.mrrPerdido : 0; } }
    return [...g.values()].map(o => ({ ...o, r: o.ch / o.n, z: base > 0 && base < 1 ? (o.ch / o.n - base) / Math.sqrt(base * (1 - base) / o.n) : 0 })).sort((a, b) => b.r - a.r).slice(0, 15);
  };
  const profiles = M.dims.filter(d => d !== "__produto").map(d => ({ dim: d, label: pretty(d), rows: groupRates(E, d, p) }));
  state.level = "linha";
  const ML = view(M0);
  const pl = ML.clients.filter(c => c.churned).length / ML.clients.length;
  const productRates = M0.hier.produto ? { base: pl, rows: groupRates(ML.clients, "__produto", pl) } : null;
  state.level = M0.hier.org ? "org" : "linha";

  // indicadores: distribuição e efeito
  const q = a => a.length ? [.1, .25, .5, .75, .9].map(x => quantile(a, x)) : null;
  const sigCols = new Set(sig.map(s => s.col));
  const kpiStatsOut = stats.map(s => ({ col: s.col, label: pretty(s.col), unit: s.unit, inv: s.inv, contrary: s.contrary, d: s.d, w: sigCols.has(s.col) ? Math.min(Math.abs(s.d), 2) : 0, a: q(s.a), b: q(s.b), na: s.a.length, nb: s.b.length, ma: s.ma, mb: s.mb }))
    .sort((x, y) => (Math.abs(y.d) || 0) - (Math.abs(x.d) || 0));

  // trajetória: média de cada KPI nos meses antes do cancelamento (linhas) x ativos antes da data de corte
  const K = state.raw.kpis, mK = state.map.kpis, tcol = mK.tipo || mK.nomeKpi;
  const trajectory = {};
  if (K && K.rows.length && mK.id && mK.data) {
    const byId = new Map(M0.clients.map(c => [c.id, c]));
    const typeToCol = {}; for (const [name, meta] of Object.entries(M0.kpiMeta)) if (meta.type != null) typeToCol[meta.type] = name;
    const acc = {};
    const add = (col, grp, k, v) => { const a = (acc[col] ??= { canc: {}, ativo: {} })[grp]; (a[k] ??= [0, 0]); a[k][0] += v; a[k][1]++; };
    for (const r of K.rows) {
      const c = byId.get(String(r[mK.id] ?? "").trim().toLowerCase()); if (!c) continue;
      const d = toDate(r[mK.data]); if (d == null) continue;
      let grp, k;
      if (c.churned) { if (!c.dataCanc || d >= c.dataCanc) continue; grp = "canc"; k = Math.floor(monthsBetween(d, c.dataCanc)) + 1; }
      else { grp = "ativo"; k = Math.floor(monthsBetween(d, M.ref)) + 1; }
      if (k < 1 || k > 6) continue;
      if (tcol && mK.valor) { const col = typeToCol[String(r[tcol] ?? "").trim()]; const v = toNum(r[mK.valor]); if (col && Number.isFinite(v)) add(col, grp, k, v); }
      else for (const col of M0.kpiCols) { const v = toNum(r[col]); if (Number.isFinite(v)) add(col, grp, k, v); }
    }
    for (const [col, g] of Object.entries(acc)) {
      const ser = grp => [6, 5, 4, 3, 2, 1].map(k => g[grp][k] && g[grp][k][1] >= 3 ? g[grp][k][0] / g[grp][k][1] : null);
      trajectory[col] = { label: pretty(col), canc: ser("canc"), ativo: ser("ativo"), n: [6, 5, 4, 3, 2, 1].map(k => (g.canc[k] || [0, 0])[1]) };
    }
  }

  // qualidade do score: ROC, AUC, decis e cortes (na mesma base em que foi calculado)
  const scored = E.filter(c => c.risk != null);
  let quality = null;
  if (scored.length > 10 && scored.some(c => c.churned) && scored.some(c => !c.churned)) {
    const sorted = scored.slice().sort((a, b) => b.risk - a.risk), P = sorted.filter(c => c.churned).length, N = sorted.length - P;
    let tp = 0, fp = 0; const roc = [[0, 0]];
    sorted.forEach((c, i) => { c.churned ? tp++ : fp++; if (i === sorted.length - 1 || sorted[i + 1].risk !== c.risk) roc.push([fp / N, tp / P]); });
    const step = Math.max(1, Math.floor(roc.length / 60)); const rocS = roc.filter((x, i) => i % step === 0 || i === roc.length - 1);
    let auc = 0; for (let i = 1; i < roc.length; i++) auc += (roc[i][0] - roc[i - 1][0]) * (roc[i][1] + roc[i - 1][1]) / 2;
    const deciles = Array.from({ length: 10 }, (_, i) => { const part = sorted.slice(Math.floor(i * sorted.length / 10), Math.floor((i + 1) * sorted.length / 10)); return { n: part.length, ch: part.filter(c => c.churned).length, min: part.length ? part[part.length - 1].risk : null }; });
    const cut = t => { const above = scored.filter(c => c.risk >= t); return { t, flagged: above.length, churnedFlagged: above.filter(c => c.churned).length, recall: above.filter(c => c.churned).length / P, precision: above.length ? above.filter(c => c.churned).length / above.length : null }; };
    const hist = grp => { const h = Array(10).fill(0); for (const c of scored.filter(c => c.churned === grp)) h[Math.min(9, Math.floor(c.risk * 10))]++; return h; };
    quality = { auc, roc: rocS, deciles, cuts: [cut(.5), cut(.65), cut(.7)], histActive: hist(false), histChurned: hist(true), P, N, scores: sorted.map(c => [Math.round(c.risk * 1000) / 1000, c.churned ? 1 : 0]) };
  }

  // casos
  const caseOf = c => ({ nome: c.nome || c.label, id: c.label, setor: attr(c, state.dimBar), porte: attr(c, state.dimPeer), csm: attr(c, csmDim), lines: c.lines, linesCanc: c.linesCanc, mrr: c.churned ? c.mrrPerdido : c.mrr, tenure: c.tenure, risk: c.risk, cls: c.cls, motivo: c.motivo, descricao: c.descricao, dataCanc: iso(c.dataCanc), sinais: c.churned && c.cls === "anormal" ? healthyText(c) : drvText(c), peer: c.peerLabel });
  const anomalies = ch.filter(c => c.cls === "anormal").sort((a, b) => a.risk - b.risk).map(caseOf);
  const atRisk = act.filter(c => c.risk != null && c.risk >= .55).sort((a, b) => b.risk - a.risk).map(caseOf);
  const mot = new Map();
  for (const c of ch) { const k = c.motivo || "(não informado)"; if (!mot.has(k)) mot.set(k, { k, anormal: 0, fraco: 0, esperado: 0, na: 0, mrr: 0 }); const o = mot.get(k); o[c.cls in o ? c.cls : "na"]++; o.mrr += Number.isFinite(c.mrrPerdido) ? c.mrrPerdido : 0; }
  const reasons = [...mot.values()].sort((a, b) => (b.anormal + b.fraco + b.esperado + b.na) - (a.anormal + a.fraco + a.esperado + a.na));
  const tenureBuckets = [[0, 3], [3, 6], [6, 12], [12, 18], [18, 24], [24, 36], [36, 999]].map(([a, b]) => ({ a, b, n: ten.filter(x => x >= a && x < b).length }));

  // carteira de CSM ajustada pelo mix de clientes (setor × porte)
  let csm = null;
  if (csmDim) {
    const seg = [state.dimBar, state.dimPeer].filter(Boolean);
    const cellKey = c => seg.map(d => c.attrs[d]).join("|");
    const cell = new Map();
    for (const c of E) { const k = cellKey(c); if (!cell.has(k)) cell.set(k, [0, 0]); const o = cell.get(k); o[0]++; if (c.churned) o[1]++; }
    const g = new Map();
    for (const c of E) { const k = c.attrs[csmDim]; if (!g.has(k)) g.set(k, { k, n: 0, ch: 0, exp: 0, mrr: 0, alto: 0 }); const o = g.get(k); const cr = cell.get(cellKey(c)); o.n++; o.exp += cr[1] / cr[0]; if (c.churned) { o.ch++; o.mrr += Number.isFinite(c.mrrPerdido) ? c.mrrPerdido : 0; } if (c.cls === "alto") o.alto++; }
    csm = { dim: pretty(csmDim), mix: seg.map(pretty), rows: [...g.values()].map(o => ({ ...o, r: o.ch / o.n, ratio: o.exp ? o.ch / o.exp : null })).sort((a, b) => (b.ratio || 0) - (a.ratio || 0)) };
  }

  // hierarquia: churn parcial e contágio dentro do grupo econômico
  let hierarchy = null;
  if (M0.hier.org) {
    const byOrg = new Map();
    for (const c of M0.clients) { if (!c.h || !c.h.org) continue; if (!byOrg.has(c.h.org)) byOrg.set(c.h.org, []); byOrg.get(c.h.org).push(c); }
    const multi = [...byOrg.values()].filter(a => a.length > 1);
    const partialOrgs = multi.filter(a => a.some(c => c.churned) && a.some(c => !c.churned));
    const firstProduct = new Map();
    for (const a of partialOrgs) for (const c of a.filter(x => x.churned)) { const k = c.hl ? c.hl.__produto : "?"; firstProduct.set(k, (firstProduct.get(k) || 0) + 1); }
    let contagion = null;
    if (M0.hier.grupo) {
      const byGroup = new Map();
      for (const e of E) { const g = e.f[M.hier.grupo]; if (!g || /^\(/.test(g)) continue; if (!byGroup.has(g)) byGroup.set(g, []); byGroup.get(g).push(e); }
      const groupsMulti = [...byGroup.values()].filter(a => a.length > 1);
      let exposed = 0, followed = 0, withChurn = 0;
      for (const a of groupsMulti) {
        const first = a.filter(e => e.churned && e.dataCanc != null).sort((x, y) => x.dataCanc - y.dataCanc)[0]; if (!first) continue;
        withChurn++;
        for (const e of a) {
          if (e === first || e.inicio == null || e.inicio > first.dataCanc || (e.churned && e.dataCanc != null && e.dataCanc <= first.dataCanc)) continue;
          if (M.ref - first.dataCanc < 183 * 864e5) continue;
          exposed++;
          if (e.churned && e.dataCanc != null && e.dataCanc - first.dataCanc <= 183 * 864e5) followed++;
        }
      }
      contagion = { groups: byGroup.size, groupsMulti: groupsMulti.length, withChurn, exposed, followed, rate: exposed ? followed / exposed : null, baseline: monthly != null ? 1 - Math.pow(1 - monthly, 6) : null };
    }
    hierarchy = { orgs: byOrg.size, multi: multi.length, partial: partialOrgs.length, fullChurnMulti: multi.filter(a => a.every(c => c.churned)).length, firstProduct: [...firstProduct.entries()].sort((a, b) => b[1] - a[1]), contagion, productRates };
  }

  // qualidade dos dados
  const L = M0.clients, n = L.length || 1, mC = state.map.clientes;
  const typeCounts = {};
  if (mC.tipo && state.raw.clientes) for (const r of state.raw.clientes.rows) { const t = String(r[mC.tipo] ?? "").trim() || "(vazio)"; typeCounts[t] = (typeCounts[t] || 0) + 1; }
  let kMin = null, kMax = null;
  if (K && mK.data) for (const r of K.rows) { const d = toDate(r[mK.data]); if (d == null) continue; if (kMin == null || d < kMin) kMin = d; if (kMax == null || d > kMax) kMax = d; }
  const lChurn = L.filter(c => c.churned);
  const completeness = [
    ["Data de início", L.filter(c => c.inicio != null).length / n],
    ["Nome", L.filter(c => c.nome).length / n],
    ...M0.dims.map(d => [pretty(d), L.filter(c => c.attrs[d] && !/^\(/.test(c.attrs[d])).length / n]),
    ["MRR", L.filter(c => Number.isFinite(c.mrr)).length / n],
    ["Motivo (cancelados)", lChurn.length ? lChurn.filter(c => c.motivo).length / lChurn.length : null],
    ["Algum KPI", L.filter(c => Object.values(c.kpi).some(Number.isFinite)).length / n]
  ];
  const dataQuality = {
    rowsCustomer, linesCounted: M0.clients.length, typeCounts, kpiRows: K ? K.rows.length : 0, kpiTypes: M0.kpiCols.length, kpiFrom: iso(kMin), kpiTo: iso(kMax),
    completeness, warnings: M0.warnings, notes: M0.notes, mapping: { clientes: state.map.clientes, kpis: state.map.kpis }
  };

  const out = {
    generatedAt: new Date().toISOString().slice(0, 10), isSample: __isSample, level: M.noun[1], levelOne: M.noun[0], peerDim: state.dimPeer ? pretty(state.dimPeer) : null, segDim: state.dimBar ? pretty(state.dimBar) : null,
    kpis, cohorts, survival, profiles, kpiStats: kpiStatsOut, trajectory, quality, anomalies, atRisk, reasons, tenureBuckets, csm, hierarchy, dataQuality
  };
  const round = v => typeof v === "number" ? (Number.isFinite(v) ? Math.round(v * 10000) / 10000 : null) : Array.isArray(v) ? v.map(round) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, round(x)])) : v;
  return round(out);
})();
