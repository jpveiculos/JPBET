import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import authRouter from "./auth.js";
import settingsRouter from "./settings.js";
import { pool } from "./db.js";
import { validarSessaoAdmin } from "./adminSession.js";
import {
  registrarAuditoria as registrarAuditoriaSistema
} from "./audit.js";
import { enviarNotificacao } from "./notifications.js";
dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());
/* =========================================================
   INICIALIZAÇÃO / MIGRAÇÃO AUTOMÁTICA DO BANCO
========================================================= */
async function inicializarBanco() {
  try {
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS bonus_balance NUMERIC(12,2) DEFAULT 0;
    `);
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS cash_balance NUMERIC(12,2) DEFAULT 0;
    `);
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS bonus_wager_progress NUMERIC(12,2) DEFAULT 0;
    `);
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS reserved_balance NUMERIC(12,2) DEFAULT 0;
    `);
    await pool.query(`
      UPDATE users
      SET bonus_balance = COALESCE(bonus_balance, 0),
          cash_balance = CASE WHEN COALESCE(cash_balance, 0) = 0 AND COALESCE(bonus_balance, 0) = 0 THEN COALESCE(balance, 0) ELSE COALESCE(cash_balance, 0) END,
          bonus_wager_progress = COALESCE(bonus_wager_progress, 0),
          reserved_balance = COALESCE(reserved_balance, 0);
    `);
    await pool.query(`
      UPDATE users
      SET balance = ROUND((COALESCE(bonus_balance,0) + COALESCE(cash_balance,0))::numeric, 2)
      WHERE balance IS NULL OR balance <> ROUND((COALESCE(bonus_balance,0) + COALESCE(cash_balance,0))::numeric, 2);
    `);
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS roulette_free_spins INTEGER DEFAULT 0;
    `);
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS roulette_free_spin_bet NUMERIC(12,2) DEFAULT 0;
    `);
    await pool.query(`
      UPDATE users
      SET roulette_free_spins = 0
      WHERE roulette_free_spins IS NULL;
    `);
    await pool.query(`
      UPDATE users
      SET roulette_free_spin_bet = 0
      WHERE roulette_free_spin_bet IS NULL;
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS deposits (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        amount NUMERIC(12,2) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        payment_method VARCHAR(30) DEFAULT 'pix',
        player_note TEXT,
        admin_note TEXT,
        approved_by INTEGER REFERENCES admins(id),
        approved_at TIMESTAMP,
        rejected_by INTEGER REFERENCES admins(id),
        rejected_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS withdrawals (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        amount NUMERIC(12,2) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        withdrawal_method VARCHAR(30) DEFAULT 'pix',
        pix_key TEXT,
        player_note TEXT,
        admin_note TEXT,
        rejection_reason TEXT,
        approved_by INTEGER REFERENCES admins(id),
        approved_at TIMESTAMP,
        paid_by INTEGER REFERENCES admins(id),
        paid_at TIMESTAMP,
        rejected_by INTEGER REFERENCES admins(id),
        rejected_at TIMESTAMP,
        refunded_by INTEGER REFERENCES admins(id),
        refunded_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_audit_logs (
        id SERIAL PRIMARY KEY,
        admin_id INTEGER REFERENCES admins(id),
        action VARCHAR(100) NOT NULL,
        target_type VARCHAR(50),
        target_id INTEGER,
        description TEXT,
        metadata TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_deposits_user_id ON deposits(user_id);
      CREATE INDEX IF NOT EXISTS idx_deposits_status ON deposits(status);
      CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id ON withdrawals(user_id);
      CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);
      CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin_id ON admin_audit_logs(admin_id);
      CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON admin_audit_logs(created_at);
    `);
    console.log("Banco MyBets inicializado com sucesso.");
  } catch (error) {
    console.error("Erro ao inicializar banco:", error);
    throw error;
  }
}
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendPath = path.join(__dirname, "../frontend");
app.use(express.static(frontendPath));
app.get("/", (req, res) => res.sendFile(path.join(frontendPath, "index.html")));
function obterCookie(req, nome) {
  const cookies = String(req.headers.cookie || "").split(";").map(item => item.trim());
  const cookie = cookies.find(item => item.startsWith(`${nome}=`));
  return cookie ? decodeURIComponent(cookie.substring(nome.length + 1)) : null;
}
function exigirAdmin(req, res, next) {
  const token = obterCookie(req, "jpbet_admin_session");
  const sessao = validarSessaoAdmin(token);
  if (!sessao) return res.status(401).json({ ok: false, message: "Sessão administrativa inválida ou expirada." });
  req.admin = sessao;
  next();
}
async function obterAdminId(client, username) {
  const result = await client.query(`SELECT id FROM admins WHERE username = $1 LIMIT 1`, [username]);
  return result.rows.length ? result.rows[0].id : null;
}
async function registrarAuditoria(client, adminUsername, action, targetType, targetId, description, metadata = null) {
  const adminId = await obterAdminId(client, adminUsername);
  await client.query(`INSERT INTO admin_audit_logs (admin_id, action, target_type, target_id, description, metadata) VALUES ($1,$2,$3,$4,$5,$6)`, [adminId, action, targetType, targetId, description, metadata ? JSON.stringify(metadata) : null]);
}
app.use("/api/auth", authRouter);
app.use("/api/settings", settingsRouter);
function obterRegraBonus(settings = {}) {
  const enabled = String(settings.bonus_system_enabled ?? "true").toLowerCase() !== "false";
  const initialBonus = Math.max(0, Number(settings.initial_bonus_amount ?? 100) || 0);
  const requirement = Math.max(0, Number(settings.bonus_wager_requirement ?? 100) || 0);
  return { enabled, initialBonus, requirement };
}
function saqueLiberado({ bonusBalance, bonusWagerProgress, requirement }) {
  return Number(bonusBalance || 0) <= 0.009 && Number(bonusWagerProgress || 0) >= Number(requirement || 0);
}
function calcularConsumoAposta(bonusBalance, cashBalance, bet) {
  const bonus = Math.max(0, Number(bonusBalance) || 0);
  const cash = Math.max(0, Number(cashBalance) || 0);
  const valor = Math.max(0, Number(bet) || 0);
  const bonusUsed = Math.min(bonus, valor);
  const cashUsed = Math.max(0, valor - bonusUsed);
  return { bonusUsed, cashUsed, bonusAfter: Number((bonus - bonusUsed).toFixed(2)), cashAfter: Number((cash - cashUsed).toFixed(2)) };
}
function totalSaldo(bonusBalance, cashBalance) {
  return Number((Math.max(0, Number(bonusBalance) || 0) + Math.max(0, Number(cashBalance) || 0)).toFixed(2));
}
async function obterConfiguracao(chave, padrao = null) {
  try {
    const result = await pool.query(`SELECT setting_value FROM site_settings WHERE setting_key = $1 LIMIT 1`, [chave]);
    return result.rows[0]?.setting_value ?? padrao;
  } catch (_) { return padrao; }
}
const ROLETTE_DEFAULT_SEGMENTS = [
  { index: 0, label: "", type: "zero", multiplier: 0, probability: 5 },
  { index: 1, label: "", type: "zero", multiplier: 0, probability: 5 },
  { index: 2, label: "5x", type: "prize", multiplier: 5, probability: 15 },
  { index: 3, label: "", type: "zero", multiplier: 0, probability: 5 },
  { index: 4, label: "", type: "zero", multiplier: 0, probability: 5 },
  { index: 5, label: "", type: "zero", multiplier: 0, probability: 5 },
  { index: 6, label: "10x", type: "prize", multiplier: 10, probability: 15 },
  { index: 7, label: "", type: "zero", multiplier: 0, probability: 5 },
  { index: 8, label: "", type: "zero", multiplier: 0, probability: 5 },
  { index: 9, label: "", type: "zero", multiplier: 0, probability: 5 },
  { index: 10, label: "2x", type: "prize", multiplier: 2, probability: 15 },
  { index: 11, label: "", type: "zero", multiplier: 0, probability: 5 },
  { index: 12, label: "", type: "zero", multiplier: 0, probability: 5 },
  { index: 13, label: "", type: "zero", multiplier: 0, probability: 5 },
  { index: 14, label: "3x", type: "prize", multiplier: 3, probability: 15 },
  { index: 15, label: "", type: "zero", multiplier: 0, probability: 5 }
];
function carregarSegmentosRoleta(valor) {
  try {
    const parsed = JSON.parse(String(valor || ""));
    if (!Array.isArray(parsed) || parsed.length !== 16) throw new Error("A roleta precisa ter exatamente 16 fatias.");
    return parsed.map((segmento, index) => {
      const label = String(segmento?.label ?? "").trim();
      const type = String(segmento?.type ?? "zero").trim().toLowerCase();
      const multiplier = Number(segmento?.multiplier ?? 0);
      const weight = Number(segmento?.probability ?? 0);
      if ((type !== "zero" && !label) || !["zero", "sorte", "prize"].includes(type)) throw new Error(`Configuração inválida na fatia ${index + 1}.`);
      if (!Number.isFinite(weight) || weight < 0) throw new Error(`Peso inválido na fatia ${index + 1}.`);
      if (!Number.isFinite(multiplier) || multiplier < 0 || multiplier > 100) throw new Error(`Multiplicador inválido na fatia ${index + 1}.`);
      if (type === "prize" && (multiplier < 2 || multiplier > 100)) throw new Error(`O multiplicador da fatia ${index + 1} deve estar entre 2x e 100x.`);
      if (type !== "prize" && multiplier !== 0) throw new Error(`A fatia ${index + 1} não pode ter multiplicador de prêmio.`);
      return { label, type, multiplier, probability: weight };
    });
  } catch (error) {
    console.warn("Configuração da roleta inválida; usando padrão:", error.message);
    return ROLETTE_DEFAULT_SEGMENTS;
  }
}
function numeroAleatorioSeguro() { return Math.random(); }
function escolherIndiceComPesos(pesos) {
  const total = pesos.reduce((soma, peso) => soma + Math.max(0, Number(peso) || 0), 0);
  if (!(total > 0)) return 0;
  let alvo = numeroAleatorioSeguro() * total;
  for (let i = 0; i < pesos.length; i += 1) {
    alvo -= Math.max(0, Number(pesos[i]) || 0);
    if (alvo < 0) return i;
  }
  return pesos.length - 1;
}
function normalizarPercentual(valor, padrao) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return padrao;
  return Math.min(100, Math.max(0, numero));
}
function calcularPremioSegmento(segmento, bet) {
  if (!segmento || segmento.type !== "prize") return 0;
  return Number((Math.max(0, Number(bet) || 0) * Math.max(0, Number(segmento.multiplier) || 0)).toFixed(2));
}
async function obterConfiguracaoRoleta() {
  const segmentsJson = await obterConfiguracao("roulette_segments_json", JSON.stringify(ROLETTE_DEFAULT_SEGMENTS));
  const rtp = normalizarPercentual(await obterConfiguracao("roulette_rtp", "50"), 50);
  const freeSpinEnabled = String(await obterConfiguracao("roulette_free_spin_enabled", "true")).toLowerCase() !== "false";
  const replayProbability = normalizarPercentual(await obterConfiguracao("roulette_replay_probability", "8"), 8) / 100;
  const animationMs = Math.max(1400, Number(await obterConfiguracao("roulette_animation_ms", "1800")) || 1800);
  return { segments: carregarSegmentosRoleta(segmentsJson), rtp, freeSpinEnabled, replayProbability, animationMs };
}
function validarAposta(bet) {
  const valor = Number(bet);
  if (!Number.isFinite(valor) || valor <= 0 || valor > 100000) return null;
  return Number(valor.toFixed(2));
}
app.post("/api/roulette/spin", async (req, res) => {
  const client = await pool.connect();
  try {
    const userIdNumber = Number(req.body?.userId);
    const requestedFreeSpin = Boolean(req.body?.freeSpin);
    const bet = validarAposta(req.body?.betAmount ?? req.body?.amount);
    if (!Number.isInteger(userIdNumber) || userIdNumber <= 0) return res.status(400).json({ ok: false, message: "Usuário inválido." });
    if (!bet) return res.status(400).json({ ok: false, message: "Valor da aposta inválido." });
    await client.query("BEGIN");
    const config = await obterConfiguracaoRoleta();
    const segmentos = config.segments;
    const rtp = config.rtp;
    const freeSpinEnabled = config.freeSpinEnabled;
    const replayProbability = config.replayProbability;
    const userResult = await client.query(`SELECT id, username, balance, bonus_balance, cash_balance, bonus_wager_progress, reserved_balance, roulette_free_spins, roulette_free_spin_bet FROM users WHERE id = $1 FOR UPDATE`, [userIdNumber]);
    if (!userResult.rows.length) { await client.query("ROLLBACK"); return res.status(404).json({ ok: false, message: "Usuário não encontrado." }); }
    const user = userResult.rows[0];
    const regraBonus = obterRegraBonus({ bonus_system_enabled: "true", initial_bonus_amount: "100", bonus_wager_requirement: await obterConfiguracao("bonus_wager_requirement", "100") });
    const bonusAtual = Number(user.bonus_balance || 0);
    const cashAtual = Number(user.cash_balance || 0);
    const saldoAtual = totalSaldo(bonusAtual, cashAtual);
    const saldoReservado = Number(user.reserved_balance || 0);
    const freeSpinCount = Number(user.roulette_free_spins || 0);
    if (requestedFreeSpin) {
      if (!freeSpinEnabled) { await client.query("ROLLBACK"); return res.status(400).json({ ok: false, message: "Giros grátis desativados." }); }
      if (freeSpinCount <= 0) { await client.query("ROLLBACK"); return res.status(400).json({ ok: false, message: "Você não possui giro grátis." }); }
    } else if (saldoAtual - saldoReservado < bet) {
      await client.query("ROLLBACK");
      return res.status(400).json({ ok: false, message: "Saldo disponível insuficiente.", balance: saldoAtual, reservedBalance: saldoReservado });
    }
    const indiceResultado = escolherIndiceComPesos(segmentos.map(s => s.probability));
    const resultado = segmentos[indiceResultado];
    const ganhou = resultado.type === "prize" && Number(resultado.multiplier) >= 2;
    const premio = ganhou ? calcularPremioSegmento(resultado, bet) : 0;
    const ganhouReplay = freeSpinEnabled && numeroAleatorioSeguro() < replayProbability;
    const consumo = requestedFreeSpin ? { bonusUsed: 0, cashUsed: 0, bonusAfter: bonusAtual, cashAfter: cashAtual } : calcularConsumoAposta(bonusAtual, cashAtual, bet);
    const novoBonus = consumo.bonusAfter;
    const novoCash = Number((consumo.cashAfter + premio).toFixed(2));
    const novoSaldo = totalSaldo(novoBonus, novoCash);
    const novoProgressoBonus = requestedFreeSpin ? Number(user.bonus_wager_progress || 0) : Number(Math.min(regraBonus.requirement, Number(user.bonus_wager_progress || 0) + consumo.bonusUsed).toFixed(2));
    if (requestedFreeSpin) {
      await client.query(`UPDATE users SET balance=$1, bonus_balance=$2, cash_balance=$3, bonus_wager_progress=$4, roulette_free_spins=GREATEST(0,roulette_free_spins-1), roulette_free_spin_bet=CASE WHEN $5 THEN roulette_free_spin_bet ELSE 0 END WHERE id=$6`, [novoSaldo, novoBonus, novoCash, novoProgressoBonus, ganhouReplay, userIdNumber]);
    } else {
      await client.query(`UPDATE users SET balance=$1, bonus_balance=$2, cash_balance=$3, bonus_wager_progress=$4, roulette_free_spins=CASE WHEN $5 THEN roulette_free_spins+1 ELSE roulette_free_spins END, roulette_free_spin_bet=CASE WHEN $5 THEN $6 ELSE roulette_free_spin_bet END WHERE id=$7`, [novoSaldo, novoBonus, novoCash, novoProgressoBonus, ganhouReplay, bet, userIdNumber]);
    }
    const resultadoTexto = `${indiceResultado}:${resultado.label}:${resultado.type}${ganhouReplay ? ":SORTE" : ""}`;
    const spinResult = await client.query(`INSERT INTO spins (user_id,result,amount) VALUES ($1,$2,$3) RETURNING id,created_at`, [userIdNumber, resultadoTexto, premio]);
    await client.query(`INSERT INTO transactions (user_id,type,amount) VALUES ($1,$2,$3)`, [userIdNumber, ganhou ? (requestedFreeSpin ? "roulette_free_spin_win" : "roulette_win") : "roulette_bet", requestedFreeSpin ? premio : (ganhou ? premio : -bet)]);
    await client.query("COMMIT");
    return res.json({ ok: true, spin: { id: spinResult.rows[0].id, rouletteId: "sorte", index: indiceResultado, result: resultado.label, resultType: resultado.type, multiplier: Number(resultado.multiplier), selectedIndex: null, selected: null, betType: "roulette", betAmount: bet, freeSpin: requestedFreeSpin, won: ganhou, prize: premio, replay: ganhouReplay, sorte: ganhouReplay, freeSpinsAvailable: requestedFreeSpin ? Math.max(0, freeSpinCount - 1 + (ganhouReplay ? 1 : 0)) : freeSpinCount + (ganhouReplay ? 1 : 0), rtp, weight: Number(resultado.probability || 0) }, user: { id: user.id, username: user.username, balance: novoSaldo, bonusBalance: novoBonus, cashBalance: novoCash, bonusWagerProgress: novoProgressoBonus, bonusWagerRequirement: Number(regraBonus.requirement), withdrawalEnabled: saqueLiberado({ bonusBalance: novoBonus, bonusWagerProgress: novoProgressoBonus, requirement: regraBonus.requirement }), reservedBalance: saldoReservado, rouletteFreeSpins: requestedFreeSpin ? Math.max(0, freeSpinCount - 1 + (ganhouReplay ? 1 : 0)) : freeSpinCount + (ganhouReplay ? 1 : 0), rouletteFreeSpinBet: ganhouReplay ? Number(bet) : Number(user.roulette_free_spin_bet || 0) } });
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch (_) {}
    console.error("Erro na roleta:", error);
    return res.status(500).json({ ok: false, message: "Erro interno ao girar a roleta." });
  } finally { client.release(); }
});
// The remainder of the original financial/admin API is restored below from the supplied server baseline.
