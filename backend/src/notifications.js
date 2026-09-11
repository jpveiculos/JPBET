import { pool } from "./db.js";

function asBool(value, fallback = false) {
  if (value === undefined || value === null) return fallback;
  return ["true", "1", "yes", "sim", "on"].includes(String(value).toLowerCase());
}

async function obterConfiguracoesNotificacao() {
  const result = await pool.query(`
    SELECT setting_key, setting_value
    FROM site_settings
    WHERE setting_key LIKE 'notification_%'
       OR setting_key = 'whatsapp_%'
  `);
  const settings = {};
  for (const row of result.rows) settings[row.setting_key] = row.setting_value;
  return settings;
}

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

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

export async function enviarNotificacao(evento, dados = {}) {
  try {
    const settings = await obterConfiguracoesNotificacao();
    const enabled = asBool(settings.notification_enabled, false);
    const eventEnabled = asBool(settings[`notification_${evento}`], true);
    const webhookUrl = String(settings.notification_webhook_url || "").trim();
    const recipient = String(settings.notification_recipient || "").trim();

    if (!enabled || !eventEnabled || !webhookUrl) {
      return { ok: false, skipped: true, reason: !enabled ? "disabled" : "not_configured" };
    }

    const message = montarMensagemNotificacao(evento, dados);
    const token = String(settings.notification_webhook_token || "").trim();
    const headers = {
      "Content-Type": "application/json"
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        event: evento,
        recipient,
        message,
        data: dados,
        source: "MyBets"
      })
    });

    const responseText = await response.text();
    if (!response.ok) {
      console.error("Falha na notificação externa MyBets:", response.status, responseText.slice(0, 500));
      return { ok: false, status: response.status };
    }

    return { ok: true, status: response.status };
  } catch (error) {
    console.error("Erro ao enviar notificação MyBets:", error);
    return { ok: false, error: error.message };
  }
}
