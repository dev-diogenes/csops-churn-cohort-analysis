// Servidor local do relatório + ponte para a API da SenseData.
//
// A API da SenseData não aceita chamadas feitas direto do navegador (CORS), então o relatório
// chama /api/sensedata/... neste servidor, que repassa a chamada para https://api.sensedata.io
// com o token informado na página. Só repassa GET e só para hosts *.sensedata.io.
//
// Uso:
//   node tools/servidor.mjs            → http://localhost:8787 (API real; token informado na página)
//   node tools/servidor.mjs --mock     → API simulada com os dados de exemplo, para testar sem token
//   PORT=9000 node tools/servidor.mjs  → outra porta
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = +process.env.PORT || 8787;
const MOCK = process.argv.includes("--mock") || process.env.SENSEDATA_MOCK === "1";
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".csv": "text/csv; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ".sql": "text/plain; charset=utf-8", ".md": "text/plain; charset=utf-8" };
const allowedHost = h => h === "api.sensedata.io" || h.endsWith(".sensedata.io");
const json = (res, status, body, extra = {}) => { res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra }); res.end(JSON.stringify(body)); };

async function proxy(req, res, rest, search) {
  if (rest === "/health") return json(res, 200, { ok: true, mock: MOCK });
  if (req.method !== "GET") return json(res, 405, { errors: [{ msg: "A ponte só repassa leituras (GET)." }] });
  const auth = req.headers.authorization;
  if (!auth || !/^Bearer\s+\S+/.test(auth)) return json(res, 401, { errors: [{ msg: "Informe o token da SenseData." }] });
  if (MOCK) return mock(res, rest, new URLSearchParams(search));
  let base;
  try { base = new URL(req.headers["x-sensedata-base"] || "https://api.sensedata.io"); } catch (e) { return json(res, 400, { errors: [{ msg: "URL da API inválida." }] }); }
  if (base.protocol !== "https:" || !allowedHost(base.hostname)) return json(res, 400, { errors: [{ msg: "A ponte só conversa com endereços https da SenseData (*.sensedata.io)." }] });
  try {
    const up = await fetch(new URL(rest + search, base.origin), { headers: { authorization: auth, accept: "application/json" } });
    const headers = { "content-type": up.headers.get("content-type") || "application/json", "cache-control": "no-store" };
    const ra = up.headers.get("retry-after"); if (ra) headers["retry-after"] = ra;
    res.writeHead(up.status, headers);
    res.end(Buffer.from(await up.arrayBuffer()));
  } catch (e) {
    json(res, 502, { errors: [{ msg: `Não foi possível falar com a SenseData: ${e.message}` }] });
  }
}

// ---------------------------------------------------------------- API simulada (--mock)
// Converte os CSVs de exemplo para o formato da API v2: customers, kpis, kpis/last, contracts, me e as rotas de sinais
// (support_tickets, nps, tasks, tasks_checkin, customers_notes, usage_time, default_usage, contacts).
function csv(file) {
  const text = fs.readFileSync(path.join(root, "exemplos", file), "utf8").trim();
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; }
    else if (ch === '"') q = true; else if (ch === ",") { row.push(cell); cell = ""; } else if (ch === "\n") { row.push(cell.replace(/\r$/, "")); rows.push(row); row = []; cell = ""; } else cell += ch;
  }
  row.push(cell); rows.push(row);
  const [head, ...body] = rows;
  return body.map(r => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
}
let MOCKDATA = null;
function mockData() {
  if (MOCKDATA) return MOCKDATA;
  const cust = csv("customer.csv").filter(c => !c.hierarchy_type || c.hierarchy_type === "produto");
  const users = new Map();
  const customers = cust.map(c => {
    if (!users.has(c.cs_owner)) users.set(c.cs_owner, { id: users.size + 1, name: c.cs_owner, username: c.cs_owner.toLowerCase().replace(/\s+/g, ".") });
    return { id: +c.id, id_legacy: c.id, group: c.group || null, name_contract: c.name, name: c.name, cnpj: c.cnpj, status: c.dt_cancel ? { id: 2, description: "Inativo", enabled: false } : { id: 1, description: "Ativo", enabled: true }, state: c.state, city: null, size: c.size, stage: null, dt_register: c.dt_register, industry: c.industry, salesperson: null, cs: users.get(c.cs_owner), csm: null, dt_cancel: c.dt_cancel || null, cancel_tag: c.cancel_tag || null, cancel_description: c.cancel_description || null, custom_fields: { produto: c.product }, created_at: c.dt_register + "T00:00:00", updated_at: null, country: "Brasil" };
  });
  const contracts = cust.map((c, i) => ({ id: i + 1, id_customer: +c.id, customer: { id: +c.id, name: c.name }, model: "MRR", monthly_payment: +c.mrr || 0, start_date: c.dt_register, end_date: c.dt_cancel || null, status: c.dt_cancel ? { id: 2, description: "Cancelado", enabled: false } : { id: 1, description: "Ativo", enabled: true }, plan: c.product, is_subscription: true }));
  const kpis = csv("kpi.csv").map(k => ({ id_customer: +k.id_customer, customer: { id: +k.id_customer }, ref_date: k.ref_date.slice(0, 10), type: { id: +k.type, name: k.kpi_name.toLowerCase().replace(/\W+/g, "_"), description: k.kpi_name, unit: "", inv_proportional: k.inv_proportional === "true", is_custom: false, active: true }, value: +k.value }));
  const last = kpis.reduce((m, k) => k.ref_date > m ? k.ref_date : m, "");
  // sinais de churn no formato da API v2
  const opt = f => fs.existsSync(path.join(root, "exemplos", f)) ? csv(f) : [];
  const support_tickets = opt("tickets.csv").map((t, i) => ({ id: i + 1, id_customer: +t.id_customer, created_on: t.created_on, end_date: t.end_date || null, expire_date: t.expire_date || null, priority: t.priority, category: t.category, type: t.type, title: t.title, status: t.end_date ? "Resolvido" : "Aberto" }));
  const nps = opt("nps.csv").map((n, i) => ({ id: i + 1, id_customer: +n.id_customer, customer: { id: +n.id_customer }, survey_date: n.survey_date, score: +n.score, role: n.role, tags: n.tags }));
  const ta = opt("tarefas.csv");
  const tasks = ta.filter(t => t.kind === "tarefa").map((t, i) => ({ id: i + 1, id_customer: +t.id_customer, customer: { id: +t.id_customer }, type: { id: 1, description: t.type }, status: { id: t.end_date ? 3 : 1, description: t.end_date ? "Concluída" : "Pendente" }, created_on: t.created_on, created_at: t.created_on, due_date: t.due_date || null, end_date: t.end_date || null, playbook: t.playbook ? { id: 1, name: t.playbook } : null, tags: t.tags }));
  const tasks_checkin = ta.filter(t => t.kind === "visita").map((t, i) => ({ id: i + 1, task: { id: i + 1, customer: { id: +t.id_customer } }, checkin_at: t.created_on, checkout_at: t.end_date || t.created_on }));
  const customers_notes = ta.filter(t => t.kind === "nota").map((t, i) => ({ id: i + 1, customer: { id: +t.id_customer }, created_on: t.created_on, description: "nota", deleted: false }));
  const uso = opt("uso.csv");
  const usage_time = uso.map((u, i) => ({ id: i + 1, id_customer: +u.id_customer, ref_date: u.ref_date, active_users: +u.active_users, contracted_users: +u.contracted_users, registered_users: +u.contracted_users, usage_time: +u.usage_time }));
  const default_usage = uso.flatMap(u => Array.from({ length: +u.modules || 0 }, (_, k) => ({ id_customer: +u.id_customer, customer: { id: +u.id_customer }, ref_date: u.ref_date, product: "Produto", module: "M" + (k + 1), action: "acesso", amount: 1 })));
  const contacts = csv("customer.csv").filter(c => c.sponsor_desde).map((c, i) => ({ id: i + 1, id_customer: +c.id, customer: { id: +c.id }, is_main_sponsor: true, is_active: true, name: "Sponsor " + c.id, created_at: c.sponsor_desde }));
  return (MOCKDATA = { customers, contracts, kpis, last, support_tickets, nps, tasks, tasks_checkin, customers_notes, usage_time, default_usage, contacts });
}
function page(res, key, items, q) {
  const limit = Math.max(1, Math.min(+q.get("limit") || 10, 10000)), p = Math.max(1, +q.get("page") || 1);
  const slice = items.slice((p - 1) * limit, p * limit);
  json(res, 200, { [key]: slice, per_page: limit, current_page: p, count: slice.length, next_page: p * limit < items.length ? p + 1 : null });
}
function mock(res, rest, q) {
  const D = mockData();
  if (rest === "/v2/me") return json(res, 200, { name: "SenseData (simulada)", tenant: "exemplo", username: "usuario.teste" });
  if (rest === "/v2/customers") return page(res, "customers", D.customers, q);
  if (rest === "/v2/contracts") return page(res, "contracts", D.contracts, q);
  // filtro de data "campo:start" das rotas de sinais
  const since = (items, field) => { const a = q.get(field + ":start"); return a ? items.filter(x => String(x[field] || "") >= a) : items; };
  if (rest === "/v2/support_tickets") return page(res, "support_tickets", since(D.support_tickets, "created_on"), q);
  if (rest === "/v2/nps") return page(res, "nps", since(D.nps, "survey_date"), q);
  if (rest === "/v2/tasks") return page(res, "tasks", since(D.tasks, "created_at"), q);
  if (rest === "/v2/tasks_checkin") return page(res, "tasks_checkin", since(D.tasks_checkin, "checkin_at"), q);
  if (rest === "/v2/customers_notes") return page(res, "customers_notes", since(D.customers_notes, "created_on"), q);
  if (rest === "/v2/usage_time") return page(res, "usage_time", since(D.usage_time, "ref_date"), q);
  if (rest === "/v2/default_usage") return page(res, "default_usage", since(D.default_usage, "ref_date"), q);
  if (rest === "/v2/contacts") return page(res, "contacts", D.contacts, q);
  if (rest === "/v2/kpis/last") return page(res, "kpis", D.kpis.filter(k => k.ref_date === D.last), q);
  if (rest === "/v2/kpis") {
    const a = q.get("ref_date:start") || "0000", b = q.get("ref_date:end") || "9999";
    return page(res, "kpis", D.kpis.filter(k => k.ref_date >= a && k.ref_date <= b), q);
  }
  json(res, 404, { errors: [{ msg: "Endpoint não simulado." }] });
}

// ---------------------------------------------------------------- arquivos do relatório
function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname).replace(/^\/+/, "") || "index.html";
  const file = path.resolve(root, rel);
  if (!file.startsWith(root + path.sep) && file !== root) { res.writeHead(403); return res.end(); }
  fs.stat(file, (err, st) => {
    const target = !err && st.isDirectory() ? path.join(file, "index.html") : file;
    fs.readFile(target, (e, buf) => {
      if (e) { res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }); return res.end("Não encontrado"); }
      res.writeHead(200, { "content-type": TYPES[path.extname(target).toLowerCase()] || "application/octet-stream", "cache-control": "no-cache" });
      res.end(buf);
    });
  });
}

http.createServer((req, res) => {
  const u = new URL(req.url, "http://localhost");
  if (u.pathname.startsWith("/api/sensedata/")) return proxy(req, res, u.pathname.slice("/api/sensedata".length), u.search);
  serveStatic(req, res, u.pathname);
}).listen(port, "127.0.0.1", () => {
  console.log(`Relatório em http://localhost:${port}${MOCK ? "  (API da SenseData simulada com os dados de exemplo)" : ""}`);
});
