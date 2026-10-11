// Função serverless (Vercel) com a mesma ponte de tools/servidor.mjs:
// repassa GET /api/sensedata/<caminho> para https://api.sensedata.io/<caminho> com o token do usuário.
// Publicando o repositório na Vercel, a integração SenseData do relatório funciona sem servidor local.
const allowedHost = h => h === "api.sensedata.io" || h.endsWith(".sensedata.io");

module.exports = async function handler(req, res) {
  const parts = [].concat(req.query.path || []);
  const rest = "/" + parts.join("/");
  res.setHeader("cache-control", "no-store");
  if (rest === "/health") return res.status(200).json({ ok: true, mock: false });
  if (req.method !== "GET") return res.status(405).json({ errors: [{ msg: "A ponte só repassa leituras (GET)." }] });
  const auth = req.headers.authorization;
  if (!auth || !/^Bearer\s+\S+/.test(auth)) return res.status(401).json({ errors: [{ msg: "Informe o token da SenseData." }] });
  let base;
  try { base = new URL(req.headers["x-sensedata-base"] || "https://api.sensedata.io"); } catch (e) { return res.status(400).json({ errors: [{ msg: "URL da API inválida." }] }); }
  if (base.protocol !== "https:" || !allowedHost(base.hostname)) return res.status(400).json({ errors: [{ msg: "A ponte só conversa com endereços https da SenseData (*.sensedata.io)." }] });
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(req.query)) if (k !== "path") [].concat(v).forEach(x => qs.append(k, x));
  try {
    const up = await fetch(new URL(rest + (qs.toString() ? "?" + qs : ""), base.origin), { headers: { authorization: auth, accept: "application/json" } });
    const ra = up.headers.get("retry-after"); if (ra) res.setHeader("retry-after", ra);
    res.setHeader("content-type", up.headers.get("content-type") || "application/json");
    res.status(up.status).send(Buffer.from(await up.arrayBuffer()));
  } catch (e) {
    res.status(502).json({ errors: [{ msg: `Não foi possível falar com a SenseData: ${e.message}` }] });
  }
};
