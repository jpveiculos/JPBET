import { generateKeyPairSync } from "node:crypto";
import webpush from "web-push";
import { pool } from "./db.js";

function asBool(value, fallback = false) {
  if (value === undefined || value === null) return fallback;
  return ["true", "1", "yes", "sim", "on"].includes(String(value).toLowerCase());
}
function base64url(value) { return Buffer.from(value).toString("base64url"); }
function gerarChavesVapid() {
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const pub = publicKey.export({ format: "jwk" });
  const priv = privateKey.export({ format: "jwk" });
  const publicKeyRaw = Buffer.concat([Buffer.from([4]), Buffer.from(pub.x, "base64url"), Buffer.from(pub.y, "base64url")]);
  return { publicKey: publicKeyRaw.toString("base64url"), privateKey: base64url(Buffer.from(priv.d, "base64url")) };
}
async function garantirInfraPush() {
  await pool.query(`CREATE TABLE IF NOT EXISTS admin_push_config (id INTEGER PRIMARY KEY CHECK (id = 1),public_key TEXT NOT NULL,private_key TEXT NOT NULL,subject TEXT NOT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS admin_push_subscriptions (id SERIAL PRIMARY KEY,endpoint TEXT UNIQUE NOT NULL,subscription_json TEXT NOT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  const existing = await pool.query(`SELECT id FROM admin_push_config WHERE id=1 LIMIT 1`);
  if (!existing.rows.length) {
    const keys = gerarChavesVapid();
    await pool.query(`INSERT INTO admin_push_config(id,public_key,private_key,subject) VALUES(1,$1,$2,$3)`, [keys.publicKey, keys.privateKey, "https://jp-bet.onrender.com/"]);
  }
}
async function obterPushConfig() {
  await garantirInfraPush();
  const result = await pool.query(`SELECT public_key,private_key,subject FROM admin_push_config WHERE id=1 LIMIT 1`);
  if (!result.rows.length) throw new Error("Configuração de push não encontrada.");
  return result.rows[0];
}
async function obterConfiguracoesNotificacao() {
  const result = await pool.query(`SELECT setting_key, setting_value FROM site_settings WHERE setting_key LIKE 'notification_%'`);
  const settings = {};
  for (const row of result.rows) settings[row.setting_key] = row.setting_value;
  return settings;
}
function formatarMoeda(valor) { return Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
export function montarMensagemNotificacao(evento, dados = {}) {
  const usuario = dados.username ? `\n👤 Jogador: ${dados.username}` : "";
  const valor = dados.amount !== undefined ? `\n💰 Valor: ${formatarMoeda(dados.amount)}` : "";
  const id = dados.id ? `\n🆔 ID: ${dados.id}` : "";
  const motivo = dados.reason ? `\n📝 Motivo: ${dados.reason}` : "";
  const textos = {
    deposit_requested: `🔔 MyBets — Novo depósito solicitado${usuario}${valor}${id}`,
    withdrawal_requested: `🔔 MyBets — Novo saque solicitado${usuario}${valor}${id}`,
    deposit_approved: `✅ MyBets — Depósito aprovado${usuario}${valor}${id}`,
    deposit_rejected: `❌ MyBets — Depósito rejeitado${usuario}${valor}${id}${motivo}`,
    withdrawal_approved: `✅ MyBets — Saque aprovado${usuario}${valor}${id}`,
    withdrawal_rejected: `❌ MyBets — Saque rejeitado${usuario}${valor}${id}${motivo}`,
    withdrawal_completed: `💸 MyBets — Saque concluído/pago${usuario}${valor}${id}`,
    test: "🧪 MyBets — Notificação de teste configurada com sucesso."
  };
  return textos[evento] || `🔔 MyBets — Movimentação registrada: ${evento}${usuario}${valor}${id}${motivo}`;
}
export async function obterBadgeCount() {
  try {
    const result = await pool.query(`SELECT (SELECT COUNT(*) FROM deposits WHERE status='pending') + (SELECT COUNT(*) FROM withdrawals WHERE status='pending') AS total`);
    return Math.max(0, Number(result.rows[0]?.total || 0));
  } catch (_) { return 0; }
}
export async function obterChavePublicaPush() { const config = await obterPushConfig(); return config.public_key; }
export async function salvarAssinaturaPush(subscription) {
  await garantirInfraPush();
  if (!subscription || typeof subscription !== "object") throw new Error("Assinatura de push inválida.");
  const endpoint = String(subscription.endpoint || "").trim();
  const p256dh = String(subscription.keys?.p256dh || "").trim();
  const auth = String(subscription.keys?.auth || "").trim();
  if (!endpoint || !p256dh || !auth || endpoint.length > 2000) throw new Error("Assinatura de push incompleta.");
  await pool.query(`INSERT INTO admin_push_subscriptions(endpoint,subscription_json,updated_at) VALUES($1,$2,CURRENT_TIMESTAMP) ON CONFLICT(endpoint) DO UPDATE SET subscription_json=EXCLUDED.subscription_json,updated_at=CURRENT_TIMESTAMP`, [endpoint, JSON.stringify({ endpoint, keys: { p256dh, auth } })]);
  return { ok: true };
}
export async function removerAssinaturaPush(endpoint) {
  const value = String(endpoint || "").trim(); if (!value) return { ok: false };
  await garantirInfraPush(); await pool.query(`DELETE FROM admin_push_subscriptions WHERE endpoint=$1`, [value]); return { ok: true };
}
export async function enviarPushAdmin({ title, body, url = "/admin.html", badge = 0, tag = "mybets-admin" }) {
  const config = await obterPushConfig(); webpush.setVapidDetails(config.subject, config.public_key, config.private_key);
  const result = await pool.query(`SELECT id,endpoint,subscription_json FROM admin_push_subscriptions`);
  if (!result.rows.length) return { ok: false, sent: 0, reason: "no_subscriptions" };
  const payload = JSON.stringify({ title, body, url, badge, tag, icon: "/assets/admin-icon.svg", badgeIcon: "/assets/admin-icon.svg" });
  let sent = 0;
  for (const row of result.rows) {
    try { await webpush.sendNotification(JSON.parse(row.subscription_json), payload, { TTL: 300, urgency: "high" }); sent += 1; }
    catch (error) { const status = Number(error?.statusCode || 0); if (status === 404 || status === 410) await pool.query(`DELETE FROM admin_push_subscriptions WHERE id=$1`, [row.id]); else console.error("Falha no push do MyBets:", status || error?.message || error); }
  }
  return { ok: sent > 0, sent };
}
export async function enviarNotificacao(evento, dados = {}) {
  try {
    if (!["deposit_requested", "withdrawal_requested"].includes(evento)) return { ok: false, skipped: true, reason: "request_only" };
    const settings = await obterConfiguracoesNotificacao();
    const eventEnabled = asBool(settings[`notification_${evento}`], true);
    if (!eventEnabled) return { ok: false, skipped: true, reason: "event_disabled" };
    const dadosCompletos = { ...dados };
    if (!dadosCompletos.username && dadosCompletos.userId) {
      const userResult = await pool.query(`SELECT username FROM users WHERE id=$1 LIMIT 1`, [Number(dadosCompletos.userId)]);
      if (userResult.rows.length) dadosCompletos.username = userResult.rows[0].username;
    }
    const message = montarMensagemNotificacao(evento, dadosCompletos);
    const badge = await obterBadgeCount();
    return await enviarPushAdmin({ title: "MyBets Admin", body: message, url: "/admin.html", badge, tag: `mybets-${evento}` });
  } catch (error) {
    console.error("Erro ao enviar notificação push MyBets:", error);
    return { ok: false, error: error.message };
  }
}
export async function inicializarNotificacoes() {
  try { await garantirInfraPush(); } catch (error) { console.error("Erro ao inicializar infraestrutura de push MyBets:", error); }
}
inicializarNotificacoes();
