/* Un Supabase in miniatura per provare l'app senza Docker:
   - /auth/v1/user, /auth/v1/token, /auth/v1/logout: il minimo di GoTrue (JWT HS256 firmati col segreto)
   - /rest/v1/*: inoltro a PostgREST (che applica la RLS con request.jwt.claims)
   Uso: node tests/e2e/supalite.js  (variabili: SUPALITE_PORT, PGRST_URL, JWT_SECRET) */
const http = require("http");
const crypto = require("crypto");

const PORT = +(process.env.SUPALITE_PORT || 54329);
const PGRST = process.env.PGRST_URL || "http://127.0.0.1:3011";
const SECRET = process.env.JWT_SECRET || "pedibus-e2e-jwt-secret-abcdefghijklmnopqrstuvwxyz0123456789";

const b64u = (s) => Buffer.from(s).toString("base64url");
function sign(payload) {
  const h = b64u(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const p = b64u(JSON.stringify(payload));
  const sig = crypto.createHmac("sha256", SECRET).update(`${h}.${p}`).digest("base64url");
  return `${h}.${p}.${sig}`;
}
function verify(token) {
  const [h, p, sig] = (token || "").split(".");
  if (!h || !p || !sig) return null;
  const atteso = crypto.createHmac("sha256", SECRET).update(`${h}.${p}`).digest("base64url");
  if (atteso !== sig) return null;
  const payload = JSON.parse(Buffer.from(p, "base64url").toString());
  if (payload.exp && payload.exp < Date.now() / 1000) return null;
  return payload;
}
function utente(claims) {
  return {
    id: claims.sub, aud: "authenticated", role: "authenticated", phone: claims.phone || "", email: claims.email || "",
    app_metadata: { provider: "phone" }, user_metadata: {}, created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z",
    identities: [], is_anonymous: false,
  };
}
function sessione(claims) {
  const access_token = sign(claims);
  return { access_token, token_type: "bearer", expires_in: 3600 * 24 * 30, expires_at: claims.exp, refresh_token: "r-" + claims.sub, user: utente(claims) };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const json = (code, body) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };
  const bearer = (req.headers.authorization || "").replace(/^Bearer /i, "");

  if (url.pathname === "/auth/v1/user") {
    const c = verify(bearer);
    return c && c.role === "authenticated" ? json(200, utente(c)) : json(401, { message: "invalid JWT", code: 401 });
  }
  if (url.pathname === "/auth/v1/token") {
    let body = ""; for await (const ch of req) body += ch;
    const { refresh_token } = JSON.parse(body || "{}");
    const sub = (refresh_token || "").replace(/^r-/, "");
    if (!sub) return json(400, { message: "refresh token non valido" });
    return json(200, sessione({ sub, role: "authenticated", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 * 24 * 30 }));
  }
  if (url.pathname === "/auth/v1/logout") { res.writeHead(204); return res.end(); }

  if (url.pathname.startsWith("/rest/v1/")) {
    const target = PGRST + url.pathname.replace("/rest/v1", "") + url.search;
    const headers = {};
    for (const k of ["authorization", "content-type", "prefer", "accept", "range", "accept-profile", "content-profile", "x-client-info"]) if (req.headers[k]) headers[k] = req.headers[k];
    let body = ""; for await (const ch of req) body += ch;
    try {
      const r = await fetch(target, { method: req.method, headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : body });
      const out = Buffer.from(await r.arrayBuffer());
      const h = {}; r.headers.forEach((v, k) => { if (!["content-encoding", "transfer-encoding", "connection"].includes(k)) h[k] = v; });
      res.writeHead(r.status, h); return res.end(out);
    } catch (e) { return json(502, { message: "PostgREST non raggiungibile: " + e.message }); }
  }
  json(404, { message: "non trovato: " + url.pathname });
});

module.exports = { sign, sessione };
if (require.main === module && process.argv[2] !== "token") {
  server.listen(PORT, () => console.log(`supalite su http://127.0.0.1:${PORT} → ${PGRST}`));
}
if (require.main === module && process.argv[2] === "token") {
  // node supalite.js token <uuid> [phone] → stampa un cookie di sessione pronto per @supabase/ssr
  const sub = process.argv[3], phone = process.argv[4] || "";
  const s = sessione({ sub, phone, role: "authenticated", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 * 24 * 30 });
  console.log("base64-" + Buffer.from(JSON.stringify(s)).toString("base64url"));
  process.exit(0);
}
