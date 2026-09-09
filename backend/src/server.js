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
      CREATE INDEX IF NOT EXISTS
      idx_deposits_user_id
      ON deposits(user_id);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS
      idx_deposits_status
      ON deposits(status);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS
      idx_withdrawals_user_id
      ON withdrawals(user_id);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS
      idx_withdrawals_status
      ON withdrawals(status);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS
      idx_admin_audit_logs_admin_id
      ON admin_audit_logs(admin_id);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS
      idx_admin_audit_logs_created_at
      ON admin_audit_logs(created_at);
    `);
    console.log(
      "Banco JPBET inicializado com sucesso."
    );
  } catch (error) {
    console.error(
      "Erro ao inicializar banco:",
      error
    );
    throw error;
  }
}
/* =========================================================
   FRONTEND
========================================================= */
const __filename =
  fileURLToPath(import.meta.url);
const __dirname =
  path.dirname(__filename);
const frontendPath =
  path.join(
    __dirname,
    "../frontend"
  );
app.use(
  express.static(frontendPath)
);
app.get(
  "/",
  (req, res) => {
    res.sendFile(
      path.join(
        frontendPath,
        "index.html"
      )
    );
  }
);
/* =========================================================
   AUXILIARES
========================================================= */
function obterCookie(req, nome) {
  const cookies =
    String(
      req.headers.cookie || ""
    )
      .split(";")
      .map(
        item =>
          item.trim()
      );
  const cookie =
    cookies.find(
      item =>
        item.startsWith(
          `${nome}=`
        )
    );
  if (!cookie) {
    return null;
  }
  return decodeURIComponent(
    cookie.substring(
      nome.length + 1
    )
  );
}
function exigirAdmin(
  req,
  res,
  next
) {
  const token =
    obterCookie(
      req,
      "jpbet_admin_session"
    );
  const sessao =
    validarSessaoAdmin(
      token
    );
  if (!sessao) {
    return res.status(401).json({
      ok: false,
      message:
        "Sessão administrativa inválida ou expirada."
    });
  }
  req.admin =
    sessao;
  next();
}
async function obterAdminId(
  client,
  username
) {
  const result =
    await client.query(
      `
      SELECT id
      FROM admins
      WHERE username = $1
      LIMIT 1
      `,
      [username]
    );
  return result.rows.length
    ? result.rows[0].id
    : null;
}
async function registrarAuditoria(
  client,
  adminUsername,
  action,
  targetType,
  targetId,
  description,
  metadata = null
) {
  const adminId =
    await obterAdminId(
      client,
      adminUsername
    );
  await client.query(
    `
    INSERT INTO admin_audit_logs
    (
      admin_id,
      action,
      target_type,
      target_id,
      description,
      metadata
    )
    VALUES
    (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6
    )
    `,
    [
      adminId,
      action,
      targetType,
      targetId,
      description,
      metadata
        ? JSON.stringify(metadata)
        : null
    ]
  );
}
/* =========================================================
   API DE AUTENTICAÇÃO
========================================================= */
app.use(
  "/api/auth",
  authRouter
);
/* =========================================================
   API DE CONFIGURAÇÕES
========================================================= */
app.use(
  "/api/settings",
  settingsRouter
);
/* =========================================================
   REGRAS DE BÔNUS / SALDO / SAQUE
========================================================= */
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
  return {
    bonusUsed,
    cashUsed,
    bonusAfter: Number((bonus - bonusUsed).toFixed(2)),
    cashAfter: Number((cash - cashUsed).toFixed(2))
  };
}

function totalSaldo(bonusBalance, cashBalance) {
  return Number((Math.max(0, Number(bonusBalance) || 0) + Math.max(0, Number(cashBalance) || 0)).toFixed(2));
}

async function obterConfiguracao(chave, padrao = null) {
  try {
    const result = await pool.query(`SELECT setting_value FROM site_settings WHERE setting_key = $1 LIMIT 1`, [chave]);
    return result.rows[0]?.setting_value ?? padrao;
  } catch (_) {
    return padrao;
  }
}

/* =========================================================
   API DA ROLETA
   ROLETA ÚNICA - 10 FATIAS
========================================================= */

const ROLETTE_DEFAULT_SEGMENTS = [
  {
    "label": "❌",
    "type": "zero",
    "multiplier": 0,
    "probability": 10
  },
  {
    "label": "2x",
    "type": "prize",
    "multiplier": 2,
    "probability": 10
  },
  {
    "label": "❌",
    "type": "zero",
    "multiplier": 0,
    "probability": 10
  },
  {
    "label": "3x",
    "type": "prize",
    "multiplier": 3,
    "probability": 10
  },
  {
    "label": "❌",
    "type": "zero",
    "multiplier": 0,
    "probability": 10
  },
  {
    "label": "4x",
    "type": "prize",
    "multiplier": 4,
    "probability": 10
  },
  {
    "label": "❌",
    "type": "zero",
    "multiplier": 0,
    "probability": 10
  },
  {
    "label": "5x",
    "type": "prize",
    "multiplier": 5,
    "probability": 10
  },
  {
    "label": "❌",
    "type": "zero",
    "multiplier": 0,
    "probability": 10
  },
  {
    "label": "🍀",
    "type": "sorte",
    "multiplier": 0,
    "probability": 10
  }
];

function carregarSegmentosRoleta(valor) {
  try {
    const parsed = JSON.parse(String(valor || ""));
    if (!Array.isArray(parsed) || parsed.length !== 10) {
      throw new Error("A roleta precisa ter exatamente 10 fatias.");
    }

    return parsed.map((segmento, index) => {
      const label = String(segmento?.label ?? "").trim();
      const type = String(segmento?.type ?? "zero").trim().toLowerCase();
      const multiplier = Number(segmento?.multiplier ?? 0);
      const weight = Number(segmento?.probability ?? 0);

      if (!label || !["zero", "sorte", "prize"].includes(type)) {
        throw new Error(`Configuração inválida na fatia ${index + 1}.`);
      }
      if (!Number.isFinite(weight) || weight < 0) {
        throw new Error(`Peso inválido na fatia ${index + 1}.`);
      }
      if (!Number.isFinite(multiplier) || multiplier < 0 || multiplier > 100) {
        throw new Error(`Multiplicador inválido na fatia ${index + 1}.`);
      }
      if (type === "prize" && (multiplier < 2 || multiplier > 100)) {
        throw new Error(`O multiplicador da fatia ${index + 1} deve estar entre 2x e 100x.`);
      }
      if (type !== "prize" && multiplier !== 0) {
        throw new Error(`A fatia ${index + 1} não pode ter multiplicador de prêmio.`);
      }
      return { label, type, multiplier, probability: weight };
    });
  } catch (error) {
    console.warn("Configuração da roleta inválida; usando padrão:", error.message);
    return ROLETTE_DEFAULT_SEGMENTS;
  }
}

function numeroAleatorioSeguro() {
  return Math.random();
}

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
  return Number((bet * Number(segmento.multiplier)).toFixed(2));
}

function sortearResultadoRoleta({ segmentos }) {
  const pesos = segmentos.map((segmento) => Math.max(0, Number(segmento.probability) || 0));
  return escolherIndiceComPesos(pesos);
}


app.post(
  "/api/roulette/spin",
  async (req, res) => {
    const client = await pool.connect();
    try {
      const {
        userId,
        betAmount,
        betType,
        betValue,
        rouletteId,
        selectedIndex,
        freeSpin = false
      } = req.body;

      const userIdNumber = Number(userId);
      const requestedBet = Number(betAmount);
      const requestedFreeSpin = freeSpin === true || freeSpin === "true";

      if (!Number.isInteger(userIdNumber) || userIdNumber <= 0) {
        return res.status(400).json({ ok: false, message: "Usuário inválido." });
      }

      if (!Number.isFinite(requestedBet) || requestedBet <= 0) {
        return res.status(400).json({ ok: false, message: "Valor da aposta inválido." });
      }

      const settingsResult = await pool.query(`
        SELECT setting_key, setting_value
        FROM site_settings
        WHERE setting_key IN (
          'roulette_enabled',
          'roulette_min_bet',
          'roulette_max_bet',
          'roulette_rtp',
                    'roulette_free_spin_enabled',
          'roulette_segments_json',
          'virtual_credits_mode',
          'bonus_system_enabled',
          'initial_bonus_amount',
          'bonus_wager_requirement'
        )
      `);

      const settings = {};
      for (const row of settingsResult.rows) settings[row.setting_key] = row.setting_value;

      const rouletteEnabled = String(settings.roulette_enabled).toLowerCase() !== "false";
      const virtualCreditsMode = String(settings.virtual_credits_mode).toLowerCase() !== "false";
      const freeSpinEnabled = String(settings.roulette_free_spin_enabled).toLowerCase() !== "false";
      const minBet = Number(settings.roulette_min_bet || 0.5);
      const maxBet = Number(settings.roulette_max_bet || 100);
      const rtp = normalizarPercentual(settings.roulette_rtp, 50);
      const segmentos = carregarSegmentosRoleta(settings.roulette_segments_json);

      if (!rouletteEnabled) {
        return res.status(403).json({ ok: false, message: "A roleta está desativada." });
      }
      if (!virtualCreditsMode) {
        return res.status(403).json({ ok: false, message: "A roleta está configurada apenas para créditos virtuais." });
      }
      if (String(betType || "").toLowerCase() !== "roulette") {
        return res.status(400).json({ ok: false, message: "Tipo de roleta inválido." });
      }
      if (String(rouletteId || "sorte").toLowerCase() !== "sorte") {
        return res.status(400).json({ ok: false, message: "A JPBET utiliza uma única roleta." });
      }

      const indiceEscolhido = null;

      await client.query("BEGIN");

      const userResult = await client.query(`
        SELECT id, username, balance, bonus_balance, cash_balance, bonus_wager_progress, reserved_balance
        FROM users
        WHERE id = $1
        FOR UPDATE
      `, [userIdNumber]);

      if (userResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ ok: false, message: "Usuário não encontrado." });
      }

      const user = userResult.rows[0];
      const saldoAtual = Number(user.balance || 0);
      const bonusAtual = Number(user.bonus_balance || 0);
      const cashAtual = Number(user.cash_balance || 0);
      const progressoBonusAtual = Number(user.bonus_wager_progress || 0);
      const saldoReservado = Number(user.reserved_balance || 0);
      const regraBonus = obterRegraBonus(settings);
      const freeSpinCount = Math.max(0, Number(user.roulette_free_spins || 0));
      const freeSpinBet = Number(user.roulette_free_spin_bet || 0);

      if (requestedFreeSpin) {
        if (!freeSpinEnabled) {
          await client.query("ROLLBACK");
          return res.status(403).json({ ok: false, message: "Giro grátis desativado pelo administrador." });
        }
        if (freeSpinCount <= 0 || !(freeSpinBet > 0)) {
          await client.query("ROLLBACK");
          return res.status(400).json({ ok: false, message: "Nenhum giro grátis disponível." });
        }
      }

      const bet = requestedFreeSpin ? freeSpinBet : requestedBet;

      if (!requestedFreeSpin && (bet < minBet || bet > maxBet)) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          ok: false,
          message: `A aposta deve estar entre ${minBet} e ${maxBet} créditos.`
        });
      }

      if (!requestedFreeSpin && totalSaldo(bonusAtual, cashAtual) < bet) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          ok: false,
          message: "Saldo disponível insuficiente.",
          balance: saldoAtual,
          reservedBalance: saldoReservado
        });
      }

      const indiceResultado = sortearResultadoRoleta({ segmentos });

      const resultado = segmentos[indiceResultado];
      const escolhido = resultado;
      const ganhou = resultado.type === "prize" && Number(resultado.multiplier) >= 2;
      const premio = ganhou ? calcularPremioSegmento(resultado, bet) : 0;
      const ganhouReplay = resultado.type === "sorte" && freeSpinEnabled;
      const consumo = requestedFreeSpin
        ? { bonusUsed: 0, cashUsed: 0, bonusAfter: bonusAtual, cashAfter: cashAtual }
        : calcularConsumoAposta(bonusAtual, cashAtual, bet);
      const novoBonus = consumo.bonusAfter;
      const novoCash = Number((consumo.cashAfter + premio).toFixed(2));
      const novoSaldo = totalSaldo(novoBonus, novoCash);
      const novoProgressoBonus = requestedFreeSpin
        ? progressoBonusAtual
        : Number(Math.min(
            regraBonus.requirement,
            progressoBonusAtual + consumo.bonusUsed
          ).toFixed(2));

      if (requestedFreeSpin) {
        await client.query(`
          UPDATE users
          SET
            balance = $1,
            bonus_balance = $2,
            cash_balance = $3,
            bonus_wager_progress = $4,
            roulette_free_spins = GREATEST(0, roulette_free_spins - 1),
            roulette_free_spin_bet = CASE
              WHEN $5 THEN roulette_free_spin_bet
              ELSE 0
            END
          WHERE id = $6
        `, [novoSaldo, novoBonus, novoCash, novoProgressoBonus, ganhouReplay, userIdNumber]);
      } else {
        await client.query(`
          UPDATE users
          SET
            balance = $1,
            bonus_balance = $2,
            cash_balance = $3,
            bonus_wager_progress = $4,
            roulette_free_spins = CASE WHEN $5 THEN roulette_free_spins + 1 ELSE roulette_free_spins END,
            roulette_free_spin_bet = CASE WHEN $5 THEN $6 ELSE roulette_free_spin_bet END
          WHERE id = $7
        `, [novoSaldo, novoBonus, novoCash, novoProgressoBonus, ganhouReplay, bet, userIdNumber]);
      }

      const resultadoTexto = `${indiceResultado}:${resultado.label}:${resultado.type}${ganhouReplay ? ":SORTE" : ""}`;
      const spinResult = await client.query(`
        INSERT INTO spins (user_id, result, amount)
        VALUES ($1, $2, $3)
        RETURNING id, created_at
      `, [userIdNumber, resultadoTexto, premio]);

      await client.query(`
        INSERT INTO transactions (user_id, type, amount)
        VALUES ($1, $2, $3)
      `, [
        userIdNumber,
        ganhou ? (requestedFreeSpin ? "roulette_free_spin_win" : "roulette_win") : "roulette_bet",
        requestedFreeSpin ? premio : (ganhou ? premio : -bet)
      ]);

      await client.query("COMMIT");

      return res.json({
        ok: true,
        spin: {
          id: spinResult.rows[0].id,
          rouletteId: "sorte",
          index: indiceResultado,
          result: resultado.label,
          resultType: resultado.type,
          multiplier: Number(resultado.multiplier),
          selectedIndex: null,
          selected: null,
          betType: "roulette",
          betAmount: bet,
          freeSpin: requestedFreeSpin,
          won: ganhou,
          prize: premio,
          replay: false,
          sorte: ganhouReplay,
          freeSpinsAvailable: requestedFreeSpin
            ? Math.max(0, freeSpinCount - 1 + (ganhouReplay ? 1 : 0))
            : freeSpinCount + (ganhouReplay ? 1 : 0),
          rtp: rtp,
          weight: Number(resultado.weight || 0)
        },
        user: {
          id: user.id,
          username: user.username,
          balance: Number(novoSaldo),
          bonusBalance: Number(novoBonus),
          cashBalance: Number(novoCash),
          bonusWagerProgress: Number(novoProgressoBonus),
          bonusWagerRequirement: Number(regraBonus.requirement),
          withdrawalEnabled: saqueLiberado({ bonusBalance: novoBonus, bonusWagerProgress: novoProgressoBonus, requirement: regraBonus.requirement }),
          reservedBalance: saldoReservado,
          rouletteFreeSpins: requestedFreeSpin
            ? Math.max(0, freeSpinCount - 1 + (ganhouReplay ? 1 : 0))
            : freeSpinCount + (ganhouReplay ? 1 : 0),
          rouletteFreeSpinBet: ganhouReplay ? Number(bet) : 0
        }
      });
    } catch (error) {
      try { await client.query("ROLLBACK"); } catch (_) {}
      console.error("Erro na roleta:", error);
      return res.status(500).json({ ok: false, message: "Erro interno ao executar a roleta." });
    } finally {
      client.release();
    }
  }
);
/* =========================================================
   CONSULTAR SALDO
========================================================= */
app.get(
  "/api/account/:userId",
  async (req, res) => {
    try {
      const userId =
        Number(
          req.params.userId
        );
      if (
        !Number.isInteger(
          userId
        ) ||
        userId <= 0
      ) {
        return res.status(400).json({
          ok: false,
          message:
            "Usuário inválido."
        });
      }
      const result =
        await pool.query(
          `
          SELECT
            id,
            username,
            balance,
            bonus_balance,
            cash_balance,
            bonus_wager_progress,
            reserved_balance,
            roulette_free_spins,
            roulette_free_spin_bet,
            (
              balance +
              reserved_balance
            ) AS total_balance,
            created_at
          FROM users
          WHERE id = $1
          `,
          [userId]
        );
      if (
        result.rows.length === 0
      ) {
        return res.status(404).json({
          ok: false,
          message:
            "Usuário não encontrado."
        });
      }
      const user =
        result.rows[0];
      return res.json({
        ok: true,
        user: {
          id:
            user.id,
          username:
            user.username,
          balance:
            Number(
              user.balance || 0
            ),
          bonusBalance: Number(user.bonus_balance || 0),
          cashBalance: Number(user.cash_balance || 0),
          bonusWagerProgress: Number(user.bonus_wager_progress || 0),
          bonusWagerRequirement: Number((await obterConfiguracao("bonus_wager_requirement", "100"))),
          withdrawalEnabled: saqueLiberado({
            bonusBalance: user.bonus_balance,
            bonusWagerProgress: user.bonus_wager_progress,
            requirement: Number((await obterConfiguracao("bonus_wager_requirement", "100")))
          }),
          reservedBalance:
            Number(
              user.reserved_balance || 0
            ),
          rouletteFreeSpins:
            Math.max(0, Number(user.roulette_free_spins || 0)),
          rouletteFreeSpinBet:
            Number(user.roulette_free_spin_bet || 0),
          totalBalance:
            Number(
              user.total_balance || 0
            ),
          createdAt:
            user.created_at
        }
      });
    } catch (error) {
      console.error(
        "Erro ao consultar conta:",
        error
      );
      return res.status(500).json({
        ok: false,
        message:
          "Erro interno ao consultar conta."
      });
    }
  }
);
/* =========================================================
   SOLICITAR DEPÓSITO
========================================================= */
app.post(
  "/api/deposits",
  async (req, res) => {
    const client =
      await pool.connect();
    try {
      const {
        userId,
        amount,
        playerNote
      } = req.body;
      const userIdNumber =
        Number(userId);
      const valor =
        Number(amount);
      if (
        !Number.isInteger(
          userIdNumber
        ) ||
        userIdNumber <= 0
      ) {
        return res.status(400).json({
          ok: false,
          message:
            "Usuário inválido."
        });
      }
      if (
        !Number.isFinite(valor) ||
        valor <= 0
      ) {
        return res.status(400).json({
          ok: false,
          message:
            "Valor do depósito inválido."
        });
      }
      const userResult =
        await client.query(
          `
          SELECT id
          FROM users
          WHERE id = $1
          `,
          [userIdNumber]
        );
      if (
        userResult.rows.length === 0
      ) {
        return res.status(404).json({
          ok: false,
          message:
            "Usuário não encontrado."
        });
      }
      const result =
        await client.query(
          `
          INSERT INTO deposits
          (
            user_id,
            amount,
            status,
            payment_method,
            player_note
          )
          VALUES
          (
            $1,
            $2,
            'pending',
            'pix',
            $3
          )
          RETURNING
            id,
            user_id,
            amount,
            status,
            created_at
          `,
          [
            userIdNumber,
            valor,
            playerNote || null
          ]
        );
      const deposit = result.rows[0];
      enviarNotificacao("deposit_requested", {
        id: deposit.id,
        userId: deposit.user_id,
        amount: Number(deposit.amount)
      }).catch(() => {});
      return res.status(201).json({
        ok: true,
        message:
          "Solicitação de depósito criada e enviada para análise.",
        deposit
      });
    } catch (error) {
      console.error(
        "Erro ao criar depósito:",
        error
      );
      return res.status(500).json({
        ok: false,
        message:
          "Erro interno ao criar depósito."
      });
    } finally {
      client.release();
    }
  }
);
/* =========================================================
   SOLICITAR SAQUE
========================================================= */
app.post(
  "/api/withdrawals",
  async (req, res) => {
    const client =
      await pool.connect();
    try {
      const {
        userId,
        amount,
        pixKey,
        playerNote
      } = req.body;
      const userIdNumber =
        Number(userId);
      const valor =
        Number(amount);
      if (
        !Number.isInteger(
          userIdNumber
        ) ||
        userIdNumber <= 0
      ) {
        return res.status(400).json({
          ok: false,
          message:
            "Usuário inválido."
        });
      }
      if (
        !Number.isFinite(valor) ||
        valor <= 0
      ) {
        return res.status(400).json({
          ok: false,
          message:
            "Valor do saque inválido."
        });
      }
      const chavePix =
        String(
          pixKey || ""
        ).trim();
      if (!chavePix) {
        return res.status(400).json({
          ok: false,
          message:
            "Informe a chave Pix."
        });
      }
      const bonusRequirement = Number(await obterConfiguracao("bonus_wager_requirement", "100")) || 100;
      await client.query(
        "BEGIN"
      );
      const userResult =
        await client.query(
          `
          SELECT
            id,
            username,
            balance,
            bonus_balance,
            cash_balance,
            bonus_wager_progress,
            reserved_balance
          FROM users
          WHERE id = $1
          FOR UPDATE
          `,
          [userIdNumber]
        );
      if (
        userResult.rows.length === 0
      ) {
        await client.query(
          "ROLLBACK"
        );
        return res.status(404).json({
          ok: false,
          message:
            "Usuário não encontrado."
        });
      }
      const user =
        userResult.rows[0];
      const saldoDisponivel = Number(user.balance || 0);
      const bonusDisponivel = Number(user.bonus_balance || 0);
      const cashDisponivel = Number(user.cash_balance || 0);
      const progressoBonus = Number(user.bonus_wager_progress || 0);
      const saldoReservado = Number(user.reserved_balance || 0);
      if (!saqueLiberado({ bonusBalance: bonusDisponivel, bonusWagerProgress: progressoBonus, requirement: bonusRequirement })) {
        await client.query("ROLLBACK");
        return res.status(403).json({
          ok: false,
          message: bonusDisponivel > 0
            ? "O saque está bloqueado enquanto houver saldo de bônus. O bônus precisa ser consumido primeiro."
            : `O jogador precisa apostar/acumular R$ ${bonusRequirement.toFixed(2).replace('.', ',')} em valor de apostas para liberar o botão de saque.`,
          bonusBalance: bonusDisponivel,
          bonusWagerProgress: progressoBonus,
          bonusWagerRequirement: bonusRequirement,
          withdrawalEnabled: false
        });
      }
      if (cashDisponivel < valor) {
        await client.query(
          "ROLLBACK"
        );
        return res.status(400).json({
          ok: false,
          message:
            "Saldo disponível insuficiente.",
          balance:
            saldoDisponivel,
          reservedBalance:
            saldoReservado
        });
      }
      const novoCash = Number((cashDisponivel - valor).toFixed(2));
      const novoSaldo = totalSaldo(bonusDisponivel, novoCash);
      const novaReserva =
        saldoReservado +
        valor;
      await client.query(
        `
        UPDATE users
        SET
          balance = $1,
          bonus_balance = $3,
          cash_balance = $4,
          reserved_balance = $2
        WHERE id = $5
        `,
        [
          novoSaldo,
          novaReserva,
          bonusDisponivel,
          novoCash,
          userIdNumber
        ]
      );
      const withdrawalResult =
        await client.query(
          `
          INSERT INTO withdrawals
          (
            user_id,
            amount,
            status,
            withdrawal_method,
            pix_key,
            player_note
          )
          VALUES
          (
            $1,
            $2,
            'pending',
            'pix',
            $3,
            $4
          )
          RETURNING
            id,
            user_id,
            amount,
            status,
            withdrawal_method,
            pix_key,
            player_note,
            created_at
          `,
          [
            userIdNumber,
            valor,
            chavePix,
            playerNote || null
          ]
        );
      await client.query(
        `
        INSERT INTO transactions
        (
          user_id,
          type,
          amount
        )
        VALUES
        (
          $1,
          'withdrawal_reserved',
          $2
        )
        `,
        [
          userIdNumber,
          -valor
        ]
      );
      await registrarAuditoriaSistema({
        userId:
          userIdNumber,
        action:
          "SAQUE_SOLICITADO",
        module:
          "withdrawals",
        targetType:
          "withdrawal",
        targetId:
          withdrawalResult.rows[0].id,
        newValue: {
          amount:
            valor,
          status:
            "pending",
          withdrawalMethod:
            "pix"
        },
        details:
          "Jogador solicitou um saque via Pix.",
        result:
          "SUCCESS",
        ipAddress:
          req.headers["x-forwarded-for"] ||
          req.socket.remoteAddress ||
          null,
        userAgent:
          req.headers["user-agent"] ||
          null
      });
      await client.query(
        "COMMIT"
      );
      enviarNotificacao("withdrawal_requested", {
        id: withdrawalResult.rows[0].id,
        userId: userIdNumber,
        username: user.username,
        amount: valor
      }).catch(() => {});
      return res.status(201).json({
        ok: true,
        message:
          "Saque solicitado. O valor foi reservado e está aguardando análise.",
        withdrawal:
          withdrawalResult.rows[0],
        user: {
          id:
            user.id,
          username:
            user.username,
          balance:
            novoSaldo,
          reservedBalance:
            novaReserva,
          totalBalance:
            novoSaldo +
            novaReserva
        }
      });
    } catch (error) {
      try {
        await client.query(
          "ROLLBACK"
        );
      } catch (_) {}
      console.error(
        "Erro ao solicitar saque:",
        error
      );
      return res.status(500).json({
        ok: false,
        message:
          "Erro interno ao solicitar saque."
      });
    } finally {
      client.release();
    }
  }
);
/* =========================================================
   HISTÓRICO FINANCEIRO
========================================================= */
app.get(
  "/api/transactions/:userId",
  async (req, res) => {
    try {
      const userId =
        Number(
          req.params.userId
        );
      if (
        !Number.isInteger(
          userId
        ) ||
        userId <= 0
      ) {
        return res.status(400).json({
          ok: false,
          message:
            "Usuário inválido."
        });
      }
      const result =
        await pool.query(
          `
          SELECT
            id,
            type,
            amount,
            created_at
          FROM transactions
          WHERE user_id = $1
          ORDER BY
            created_at DESC,
            id DESC
          `,
          [userId]
        );
      return res.json({
        ok: true,
        transactions:
          result.rows
      });
    } catch (error) {
      console.error(
        "Erro ao consultar transações:",
        error
      );
      return res.status(500).json({
        ok: false,
        message:
          "Erro interno ao consultar histórico."
      });
    }
  }
);
/* =========================================================
   ADMIN - ADICIONAR CRÉDITOS
========================================================= */
app.post(
  "/api/admin/users/:id/add-credits",
  exigirAdmin,
  async (req, res) => {
    const client =
      await pool.connect();
    try {
      const userId =
        Number(
          req.params.id
        );
      const valor =
        Number(
          req.body.amount
        );
      const reason =
        String(
          req.body.reason || ""
        ).trim();
      if (
        !Number.isInteger(
          userId
        ) ||
        userId <= 0
      ) {
        return res.status(400).json({
          ok: false,
          message:
            "Usuário inválido."
        });
      }
      if (
        !Number.isFinite(
          valor
        ) ||
        valor <= 0
      ) {
        return res.status(400).json({
          ok: false,
          message:
            "Informe um valor de créditos válido."
        });
      }
      if (!reason) {
        return res.status(400).json({
          ok: false,
          message:
            "Informe o motivo da alteração."
        });
      }
      await client.query(
        "BEGIN"
      );
      const userResult =
        await client.query(
          `
          SELECT
            id,
            username,
            balance,
            bonus_balance,
            cash_balance,
            bonus_wager_progress,
            reserved_balance
          FROM users
          WHERE id = $1
          FOR UPDATE
          `,
          [userId]
        );
      if (
        userResult.rows.length === 0
      ) {
        await client.query(
          "ROLLBACK"
        );
        return res.status(404).json({
          ok: false,
          message:
            "Usuário não encontrado."
        });
      }
      const user =
        userResult.rows[0];
      const saldoAntes = Number(user.balance || 0);
      const bonusAntes = Number(user.bonus_balance || 0);
      const cashAntes = Number(user.cash_balance || 0);
      const saldoReservado = Number(user.reserved_balance || 0);
      const bonusDepois = Number((bonusAntes + valor).toFixed(2));
      const cashDepois = cashAntes;
      const saldoDepois = totalSaldo(bonusDepois, cashDepois);
      await client.query(
        `
        UPDATE users
        SET balance = $1,
            bonus_balance = $2
        WHERE id = $3
        `,
        [
          saldoDepois,
          bonusDepois,
          userId
        ]
      );
      await client.query(
        `
        INSERT INTO transactions
        (
          user_id,
          type,
          amount
        )
        VALUES
        (
          $1,
          'admin_credit_added',
          $2
        )
        `,
        [
          userId,
          valor
        ]
      );
      await registrarAuditoria(
        client,
        req.admin.username,
        "credits_added",
        "user",
        userId,
        "Créditos adicionados manualmente pelo administrador.",
        {
          username:
            user.username,
          amount:
            valor,
          balanceBefore:
            saldoAntes,
          balanceAfter:
            saldoDepois,
          reservedBalance:
            saldoReservado,
          reason
        }
      );
      await client.query(
        "COMMIT"
      );
      return res.json({
        ok: true,
        message:
          "Créditos adicionados com sucesso.",
        user: {
          id:
            user.id,
          username:
            user.username,
          balance:
            saldoDepois,
          reservedBalance:
            saldoReservado,
          totalBalance:
            saldoDepois +
            saldoReservado
        }
      });
    } catch (error) {
      try {
        await client.query(
          "ROLLBACK"
        );
      } catch (_) {}
      console.error(
        "Erro ao adicionar créditos:",
        error
      );
      return res.status(500).json({
        ok: false,
        message:
          "Erro interno ao adicionar créditos."
      });
    } finally {
      client.release();
    }
  }
);
/* =========================================================
   ADMIN - REMOVER CRÉDITOS
========================================================= */
app.post(
  "/api/admin/users/:id/remove-credits",
  exigirAdmin,
  async (req, res) => {
    const client =
      await pool.connect();
    try {
      const userId =
        Number(
          req.params.id
        );
      const valor =
        Number(
          req.body.amount
        );
      const reason =
        String(
          req.body.reason || ""
        ).trim();
      if (
        !Number.isInteger(
          userId
        ) ||
        userId <= 0
      ) {
        return res.status(400).json({
          ok: false,
          message:
            "Usuário inválido."
        });
      }
      if (
        !Number.isFinite(
          valor
        ) ||
        valor <= 0
      ) {
        return res.status(400).json({
          ok: false,
          message:
            "Informe um valor de créditos válido."
        });
      }
      if (!reason) {
        return res.status(400).json({
          ok: false,
          message:
            "Informe o motivo da alteração."
        });
      }
      await client.query(
        "BEGIN"
      );
      const userResult =
        await client.query(
          `
          SELECT
            id,
            username,
            balance,
            bonus_balance,
            cash_balance,
            bonus_wager_progress,
            reserved_balance
          FROM users
          WHERE id = $1
          FOR UPDATE
          `,
          [userId]
        );
      if (
        userResult.rows.length === 0
      ) {
        await client.query(
          "ROLLBACK"
        );
        return res.status(404).json({
          ok: false,
          message:
            "Usuário não encontrado."
        });
      }
      const user =
        userResult.rows[0];
      const saldoAntes = Number(user.balance || 0);
      const bonusAntes = Number(user.bonus_balance || 0);
      const cashAntes = Number(user.cash_balance || 0);
      const saldoReservado = Number(user.reserved_balance || 0);
      if (totalSaldo(bonusAntes, cashAntes) < valor) {
        await client.query(
          "ROLLBACK"
        );
        return res.status(400).json({
          ok: false,
          message:
            "O usuário não possui saldo disponível suficiente para essa remoção.",
          balance:
            saldoAntes,
          reservedBalance:
            saldoReservado
        });
      }
      const bonusRemovido = Math.min(bonusAntes, valor);
      const cashRemovido = Math.max(0, valor - bonusRemovido);
      const bonusDepois = Number((bonusAntes - bonusRemovido).toFixed(2));
      const cashDepois = Number((cashAntes - cashRemovido).toFixed(2));
      const saldoDepois = totalSaldo(bonusDepois, cashDepois);
      await client.query(
        `
        UPDATE users
        SET balance = $1,
            bonus_balance = $2,
            cash_balance = $3
        WHERE id = $4
        `,
        [
          saldoDepois,
          bonusDepois,
          cashDepois,
          userId
        ]
      );
      await client.query(
        `
        INSERT INTO transactions
        (
          user_id,
          type,
          amount
        )
        VALUES
        (
          $1,
          'admin_credit_removed',
          $2
        )
        `,
        [
          userId,
          -valor
        ]
      );
      await registrarAuditoria(
        client,
        req.admin.username,
        "credits_removed",
        "user",
        userId,
        "Créditos removidos manualmente pelo administrador.",
        {
          username:
            user.username,
          amount:
            valor,
          balanceBefore:
            saldoAntes,
          balanceAfter:
            saldoDepois,
          reservedBalance:
            saldoReservado,
          reason
        }
      );
      await client.query(
        "COMMIT"
      );
      return res.json({
        ok: true,
        message:
          "Créditos removidos com sucesso.",
        user: {
          id:
            user.id,
          username:
            user.username,
          balance:
            saldoDepois,
          reservedBalance:
            saldoReservado,
          totalBalance:
            saldoDepois +
            saldoReservado
        }
      });
    } catch (error) {
      try {
        await client.query(
          "ROLLBACK"
        );
      } catch (_) {}
      console.error(
        "Erro ao remover créditos:",
        error
      );
      return res.status(500).json({
        ok: false,
        message:
          "Erro interno ao remover créditos."
      });
    } finally {
      client.release();
    }
  }
);
/* =========================================================
   ADMIN - TESTAR NOTIFICAÇÃO
========================================================= */
app.post("/api/admin/notifications/test", exigirAdmin, async (req, res) => {
  try {
    const result = await enviarNotificacao("test", {
      admin: req.admin.username,
      sentAt: new Date().toISOString()
    });
    if (!result.ok && !result.skipped) {
      return res.status(502).json({ ok: false, message: "O serviço externo não respondeu corretamente.", result });
    }
    if (result.skipped) {
      return res.status(400).json({ ok: false, message: "Ative as notificações e configure o endereço de integração antes do teste." });
    }
    return res.json({ ok: true, message: "Notificação de teste enviada." });
  } catch (error) {
    console.error("Erro ao testar notificação:", error);
    return res.status(500).json({ ok: false, message: "Erro interno ao testar notificação." });
  }
});

/* =========================================================
   ADMIN - LISTAR SAQUES
========================================================= */
app.get(
  "/api/admin/withdrawals",
  exigirAdmin,
  async (req, res) => {
    try {
      const result =
        await pool.query(
          `
          SELECT
            w.id,
            w.user_id,
            u.username,
            w.amount,
            w.status,
            w.withdrawal_method,
            w.pix_key,
            w.player_note,
            w.admin_note,
            w.rejection_reason,
            w.approved_by,
            w.approved_at,
            w.paid_by,
            w.paid_at,
            w.rejected_by,
            w.rejected_at,
            w.refunded_by,
            w.refunded_at,
            w.created_at,
            w.updated_at
          FROM withdrawals w
          INNER JOIN users u
            ON u.id = w.user_id
          ORDER BY
            w.created_at DESC,
            w.id DESC
          `
        );
      return res.json({
        ok: true,
        withdrawals:
          result.rows
      });
    } catch (error) {
      console.error(
        "Erro ao listar saques:",
        error
      );
      return res.status(500).json({
        ok: false,
        message:
          "Erro interno ao listar saques."
      });
    }
  }
);
/* =========================================================
   ADMIN - APROVAR SAQUE
========================================================= */
app.post(
  "/api/admin/withdrawals/:id/approve",
  exigirAdmin,
  async (req, res) => {
    const client =
      await pool.connect();
    try {
      const withdrawalId =
        Number(
          req.params.id
        );
      if (
        !Number.isInteger(
          withdrawalId
        ) ||
        withdrawalId <= 0
      ) {
        return res.status(400).json({
          ok: false,
          message:
            "Saque inválido."
        });
      }
      await client.query(
        "BEGIN"
      );
      const result =
        await client.query(
          `
          SELECT
            id,
            user_id,
            amount,
            status
          FROM withdrawals
          WHERE id = $1
          FOR UPDATE
          `,
          [withdrawalId]
        );
      if (
        result.rows.length === 0
      ) {
        await client.query(
          "ROLLBACK"
        );
        return res.status(404).json({
          ok: false,
          message:
            "Saque não encontrado."
        });
      }
      const withdrawal =
        result.rows[0];
      if (
        withdrawal.status !==
        "pending"
      ) {
        await client.query(
          "ROLLBACK"
        );
        return res.status(400).json({
          ok: false,
          message:
            `Este saque não está pendente. Status atual: ${withdrawal.status}.`
        });
      }
      const adminId =
        await obterAdminId(
          client,
          req.admin.username
        );
      await client.query(
        `
        UPDATE withdrawals
        SET
          status = 'approved',
          approved_by = $1,
          approved_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        `,
        [
          adminId,
          withdrawalId
        ]
      );
      await registrarAuditoria(
        client,
        req.admin.username,
        "withdrawal_approved",
        "withdrawal",
        withdrawalId,
        "Saque aprovado pelo administrador.",
        {
          amount:
            Number(
              withdrawal.amount
            ),
          userId:
            withdrawal.user_id
        }
      );
      await client.query(
        "COMMIT"
      );
      enviarNotificacao("withdrawal_approved", { id: withdrawalId, userId: withdrawal.user_id, amount: Number(withdrawal.amount) }).catch(() => {});
      return res.json({
        ok: true,
        message:
          "Saque aprovado. O valor continua reservado até a baixa/conclusão do pagamento."
      });
    } catch (error) {
      try {
        await client.query(
          "ROLLBACK"
        );
      } catch (_) {}
      console.error(
        "Erro ao aprovar saque:",
        error
      );
      return res.status(500).json({
        ok: false,
        message:
          "Erro interno ao aprovar saque."
      });
    } finally {
      client.release();
    }
  }
);
/* =========================================================
   ADMIN - REJEITAR SAQUE
========================================================= */
app.post(
  "/api/admin/withdrawals/:id/reject",
  exigirAdmin,
  async (req, res) => {
    const client =
      await pool.connect();
    try {
      const withdrawalId =
        Number(
          req.params.id
        );
      const reason =
        String(
          req.body.reason || ""
        ).trim();
      if (
        !Number.isInteger(
          withdrawalId
        ) ||
        withdrawalId <= 0
      ) {
        return res.status(400).json({
          ok: false,
          message:
            "Saque inválido."
        });
      }
      await client.query(
        "BEGIN"
      );
      const withdrawalResult =
        await client.query(
          `
          SELECT
            id,
            user_id,
            amount,
            status
          FROM withdrawals
          WHERE id = $1
          FOR UPDATE
          `,
          [withdrawalId]
        );
      if (
        withdrawalResult.rows.length === 0
      ) {
        await client.query(
          "ROLLBACK"
        );
        return res.status(404).json({
          ok: false,
          message:
            "Saque não encontrado."
        });
      }
      const withdrawal =
        withdrawalResult.rows[0];
      if (
        withdrawal.status !==
        "pending"
      ) {
        await client.query(
          "ROLLBACK"
        );
        return res.status(400).json({
          ok: false,
          message:
            `Este saque não pode ser rejeitado. Status atual: ${withdrawal.status}.`
        });
      }
      const userResult =
        await client.query(
          `
          SELECT
            id,
            balance,
            bonus_balance,
            cash_balance,
            reserved_balance
          FROM users
          WHERE id = $1
          FOR UPDATE
          `,
          [withdrawal.user_id]
        );
      if (
        userResult.rows.length === 0
      ) {
        await client.query(
          "ROLLBACK"
        );
        return res.status(404).json({
          ok: false,
          message:
            "Usuário do saque não encontrado."
        });
      }
      const user =
        userResult.rows[0];
      const valor =
        Number(
          withdrawal.amount
        );
      const saldoAtual = Number(user.balance || 0);
      const bonusAtual = Number(user.bonus_balance || 0);
      const cashAtual = Number(user.cash_balance || 0);
      const reservadoAtual =
        Number(
          user.reserved_balance || 0
        );
      if (
        reservadoAtual < valor
      ) {
        await client.query(
          "ROLLBACK"
        );
        return res.status(409).json({
          ok: false,
          message:
            "A reserva desse saque não possui saldo suficiente para devolução."
        });
      }
      const novoCash = Number((cashAtual + valor).toFixed(2));
      const novoSaldo = totalSaldo(bonusAtual, novoCash);
      const novaReserva =
        reservadoAtual -
        valor;
      const adminId =
        await obterAdminId(
          client,
          req.admin.username
        );
      await client.query(
        `
        UPDATE users
        SET
          balance = $1,
          cash_balance = $3,
          reserved_balance = $2
        WHERE id = $4
        `,
        [
          novoSaldo,
          novaReserva,
          novoCash,
          withdrawal.user_id
        ]
      );
      await client.query(
        `
        UPDATE withdrawals
        SET
          status = 'rejected',
          rejection_reason = $1,
          rejected_by = $2,
          rejected_at = CURRENT_TIMESTAMP,
          refunded_by = $2,
          refunded_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        `,
        [
          reason ||
            "Saque rejeitado.",
          adminId,
          withdrawalId
        ]
      );
      await client.query(
        `
        INSERT INTO transactions
        (
          user_id,
          type,
          amount
        )
        VALUES
        (
          $1,
          'withdrawal_refunded',
          $2
        )
        `,
        [
          withdrawal.user_id,
          valor
        ]
      );
      await registrarAuditoria(
        client,
        req.admin.username,
        "withdrawal_rejected",
        "withdrawal",
        withdrawalId,
        "Saque rejeitado e valor devolvido ao saldo disponível.",
        {
          amount:
            valor,
          userId:
            withdrawal.user_id,
          reason:
            reason ||
            "Saque rejeitado.",
          balanceBefore:
            saldoAtual,
          balanceAfter:
            novoSaldo,
          reservedBefore:
            reservadoAtual,
          reservedAfter:
            novaReserva
        }
      );
      await client.query(
        "COMMIT"
      );
      enviarNotificacao("withdrawal_rejected", {
        id: withdrawalId,
        userId: withdrawal.user_id,
        amount: valor,
        reason: reason || "Saque rejeitado."
      }).catch(() => {});
      return res.json({
        ok: true,
        message:
          "Saque rejeitado e valor devolvido ao saldo disponível.",
        user: {
          balance:
            novoSaldo,
          reservedBalance:
            novaReserva,
          totalBalance:
            novoSaldo +
            novaReserva
        }
      });
    } catch (error) {
      try {
        await client.query(
          "ROLLBACK"
        );
      } catch (_) {}
      console.error(
        "Erro ao rejeitar saque:",
        error
      );
      return res.status(500).json({
        ok: false,
        message:
          "Erro interno ao rejeitar saque."
      });
    } finally {
      client.release();
    }
  }
);
/* =========================================================
   ADMIN - DAR BAIXA / CONCLUIR SAQUE
========================================================= */
app.post(
  "/api/admin/withdrawals/:id/complete",
  exigirAdmin,
  async (req, res) => {
    const client =
      await pool.connect();
    try {
      const withdrawalId =
        Number(
          req.params.id
        );
      if (
        !Number.isInteger(
          withdrawalId
        ) ||
        withdrawalId <= 0
      ) {
        return res.status(400).json({
          ok: false,
          message:
            "Saque inválido."
        });
      }
      await client.query(
        "BEGIN"
      );
      const withdrawalResult =
        await client.query(
          `
          SELECT
            id,
            user_id,
            amount,
            status
          FROM withdrawals
          WHERE id = $1
          FOR UPDATE
          `,
          [withdrawalId]
        );
      if (
        withdrawalResult.rows.length === 0
      ) {
        await client.query(
          "ROLLBACK"
        );
        return res.status(404).json({
          ok: false,
          message:
            "Saque não encontrado."
        });
      }
      const withdrawal =
        withdrawalResult.rows[0];
      if (
        withdrawal.status !==
        "approved"
      ) {
        await client.query(
          "ROLLBACK"
        );
        return res.status(400).json({
          ok: false,
          message:
            "Somente saques aprovados podem receber baixa."
        });
      }
      const userResult =
        await client.query(
          `
          SELECT
            id,
            balance,
            bonus_balance,
            cash_balance,
            reserved_balance
          FROM users
          WHERE id = $1
          FOR UPDATE
          `,
          [withdrawal.user_id]
        );
      if (
        userResult.rows.length === 0
      ) {
        await client.query(
          "ROLLBACK"
        );
        return res.status(404).json({
          ok: false,
          message:
            "Usuário do saque não encontrado."
        });
      }
      const user =
        userResult.rows[0];
      const valor =
        Number(
          withdrawal.amount
        );
      const saldoAtual =
        Number(
          user.balance || 0
        );
      const reservadoAtual =
        Number(
          user.reserved_balance || 0
        );
      if (
        reservadoAtual < valor
      ) {
        await client.query(
          "ROLLBACK"
        );
        return res.status(409).json({
          ok: false,
          message:
            "O valor reservado não é suficiente para concluir este saque."
        });
      }
      const novaReserva =
        reservadoAtual -
        valor;
      const adminId =
        await obterAdminId(
          client,
          req.admin.username
        );
      await client.query(
        `
        UPDATE users
        SET
          reserved_balance = $1
        WHERE id = $2
        `,
        [
          novaReserva,
          withdrawal.user_id
        ]
      );
      await client.query(
        `
        UPDATE withdrawals
        SET
          status = 'paid',
          paid_by = $1,
          paid_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        `,
        [
          adminId,
          withdrawalId
        ]
      );
      await client.query(
        `
        INSERT INTO transactions
        (
          user_id,
          type,
          amount
        )
        VALUES
        (
          $1,
          'withdrawal_paid',
          $2
        )
        `,
        [
          withdrawal.user_id,
          -valor
        ]
      );
      await registrarAuditoria(
        client,
        req.admin.username,
        "withdrawal_completed",
        "withdrawal",
        withdrawalId,
        "Saque concluído e valor reservado baixado definitivamente.",
        {
          amount:
            valor,
          userId:
            withdrawal.user_id,
          balance:
            saldoAtual,
          reservedBefore:
            reservadoAtual,
          reservedAfter:
            novaReserva
        }
      );
      await client.query(
        "COMMIT"
      );
      enviarNotificacao("withdrawal_completed", {
        id: withdrawalId,
        userId: withdrawal.user_id,
        amount: valor
      }).catch(() => {});
      return res.json({
        ok: true,
        message:
          "Saque concluído. O valor reservado foi baixado.",
        user: {
          balance:
            saldoAtual,
          reservedBalance:
            novaReserva,
          totalBalance:
            saldoAtual +
            novaReserva
        }
      });
    } catch (error) {
      try {
        await client.query(
          "ROLLBACK"
        );
      } catch (_) {}
      console.error(
        "Erro ao concluir saque:",
        error
      );
      return res.status(500).json({
        ok: false,
        message:
          "Erro interno ao concluir saque."
      });
    } finally {
      client.release();
    }
  }
);
/* =========================================================
   ADMIN - LISTAR DEPÓSITOS
========================================================= */
app.get(
  "/api/admin/deposits",
  exigirAdmin,
  async (req, res) => {
    try {
      const result =
        await pool.query(
          `
          SELECT
            d.id,
            d.user_id,
            u.username,
            d.amount,
            d.status,
            d.payment_method,
            d.player_note,
            d.admin_note,
            d.approved_by,
            d.approved_at,
            d.rejected_by,
            d.rejected_at,
            d.created_at,
            d.updated_at
          FROM deposits d
          INNER JOIN users u
            ON u.id = d.user_id
          ORDER BY
            d.created_at DESC,
            d.id DESC
          `
        );
      return res.json({
        ok: true,
        deposits:
          result.rows
      });
    } catch (error) {
      console.error(
        "Erro ao listar depósitos:",
        error
      );
      return res.status(500).json({
        ok: false,
        message:
          "Erro interno ao listar depósitos."
      });
    }
  }
);
/* =========================================================
   ADMIN - APROVAR DEPÓSITO
========================================================= */
app.post(
  "/api/admin/deposits/:id/approve",
  exigirAdmin,
  async (req, res) => {
    const client =
      await pool.connect();
    try {
      const depositId =
        Number(
          req.params.id
        );
      if (
        !Number.isInteger(
          depositId
        ) ||
        depositId <= 0
      ) {
        return res.status(400).json({
          ok: false,
          message:
            "Depósito inválido."
        });
      }
      await client.query(
        "BEGIN"
      );
      const depositResult =
        await client.query(
          `
          SELECT
            id,
            user_id,
            amount,
            status
          FROM deposits
          WHERE id = $1
          FOR UPDATE
          `,
          [depositId]
        );
      if (
        depositResult.rows.length === 0
      ) {
        await client.query(
          "ROLLBACK"
        );
        return res.status(404).json({
          ok: false,
          message:
            "Depósito não encontrado."
        });
      }
      const deposit =
        depositResult.rows[0];
      if (
        deposit.status !==
        "pending"
      ) {
        await client.query(
          "ROLLBACK"
        );
        return res.status(400).json({
          ok: false,
          message:
            `Este depósito não está pendente. Status atual: ${deposit.status}.`
        });
      }
      const userResult =
        await client.query(
          `
          SELECT
            id,
            balance,
            bonus_balance,
            cash_balance,
            bonus_wager_progress,
            reserved_balance
          FROM users
          WHERE id = $1
          FOR UPDATE
          `,
          [deposit.user_id]
        );
      if (
        userResult.rows.length === 0
      ) {
        await client.query(
          "ROLLBACK"
        );
        return res.status(404).json({
          ok: false,
          message:
            "Usuário do depósito não encontrado."
        });
      }
      const user =
        userResult.rows[0];
      const saldoAtual = Number(user.balance || 0);
      const bonusAtual = Number(user.bonus_balance || 0);
      const cashAtual = Number(user.cash_balance || 0);
      const valor = Number(deposit.amount);
      const novoCash = Number((cashAtual + valor).toFixed(2));
      const novoSaldo = totalSaldo(bonusAtual, novoCash);
      const adminId =
        await obterAdminId(
          client,
          req.admin.username
        );
      await client.query(
        `
        UPDATE users
        SET balance = $1,
            cash_balance = $2
        WHERE id = $3
        `,
        [
          novoSaldo,
          novoCash,
          deposit.user_id
        ]
      );
      await client.query(
        `
        UPDATE deposits
        SET
          status = 'approved',
          approved_by = $1,
          approved_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        `,
        [
          adminId,
          depositId
        ]
      );
      await client.query(
        `
        INSERT INTO transactions
        (
          user_id,
          type,
          amount
        )
        VALUES
        (
          $1,
          'deposit_approved',
          $2
        )
        `,
        [
          deposit.user_id,
          valor
        ]
      );
      await registrarAuditoria(
        client,
        req.admin.username,
        "deposit_approved",
        "deposit",
        depositId,
        "Depósito aprovado e créditos adicionados ao saldo disponível.",
        {
          amount:
            valor,
          userId:
            deposit.user_id,
          balanceBefore:
            saldoAtual,
          balanceAfter:
            novoSaldo
        }
      );
      await client.query(
        "COMMIT"
      );
      enviarNotificacao("deposit_approved", { id: depositId, userId: deposit.user_id, amount: valor }).catch(() => {});
      return res.json({
        ok: true,
        message:
          "Depósito aprovado e saldo creditado.",
        balance:
          novoSaldo
      });
    } catch (error) {
      try {
        await client.query(
          "ROLLBACK"
        );
      } catch (_) {}
      console.error(
        "Erro ao aprovar depósito:",
        error
      );
      return res.status(500).json({
        ok: false,
        message:
          "Erro interno ao aprovar depósito."
      });
    } finally {
      client.release();
    }
  }
);
/* =========================================================
   ADMIN - REJEITAR DEPÓSITO
========================================================= */
app.post(
  "/api/admin/deposits/:id/reject",
  exigirAdmin,
  async (req, res) => {
    const client =
      await pool.connect();
    try {
      const depositId =
        Number(
          req.params.id
        );
      const reason =
        String(
          req.body.reason || ""
        ).trim();
      if (
        !Number.isInteger(
          depositId
        ) ||
        depositId <= 0
      ) {
        return res.status(400).json({
          ok: false,
          message:
            "Depósito inválido."
        });
      }
      await client.query(
        "BEGIN"
      );
      const result =
        await client.query(
          `
          SELECT
            id,
            user_id,
            amount,
            status
          FROM deposits
          WHERE id = $1
          FOR UPDATE
          `,
          [depositId]
        );
      if (
        result.rows.length === 0
      ) {
        await client.query(
          "ROLLBACK"
        );
        return res.status(404).json({
          ok: false,
          message:
            "Depósito não encontrado."
        });
      }
      const deposit =
        result.rows[0];
      if (
        deposit.status !==
        "pending"
      ) {
        await client.query(
          "ROLLBACK"
        );
        return res.status(400).json({
          ok: false,
          message:
            `Este depósito não está pendente. Status atual: ${deposit.status}.`
        });
      }
      const adminId =
        await obterAdminId(
          client,
          req.admin.username
        );
      await client.query(
        `
        UPDATE deposits
        SET
          status = 'rejected',
          admin_note = $1,
          rejected_by = $2,
          rejected_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        `,
        [
          reason ||
            "Depósito rejeitado.",
          adminId,
          depositId
        ]
      );
      await registrarAuditoria(
        client,
        req.admin.username,
        "deposit_rejected",
        "deposit",
        depositId,
        "Depósito rejeitado pelo administrador.",
        {
          amount:
            Number(
              deposit.amount
            ),
          userId:
            deposit.user_id,
          reason:
            reason ||
            "Depósito rejeitado."
        }
      );
      await client.query(
        "COMMIT"
      );
      enviarNotificacao("deposit_rejected", { id: depositId, userId: deposit.user_id, amount: Number(deposit.amount), reason: reason || "Depósito rejeitado." }).catch(() => {});
      return res.json({
        ok: true,
        message:
          "Depósito rejeitado."
      });
    } catch (error) {
      try {
        await client.query(
          "ROLLBACK"
        );
      } catch (_) {}
      console.error(
        "Erro ao rejeitar depósito:",
        error
      );
      return res.status(500).json({
        ok: false,
        message:
          "Erro interno ao rejeitar depósito."
      });
    } finally {
      client.release();
    }
  }
);
/* =========================================================
   ADMIN - LISTAR USUÁRIOS
========================================================= */
app.get(
  "/api/admin/users",
  exigirAdmin,
  async (req, res) => {
    try {
      const result =
        await pool.query(
          `
          SELECT
            id,
            username,
            balance,
            bonus_balance,
            cash_balance,
            bonus_wager_progress,
            reserved_balance,
            (
              balance +
              reserved_balance
            ) AS total_balance,
            created_at
          FROM users
          ORDER BY
            created_at DESC,
            id DESC
          `
        );
      return res.json({
        ok: true,
        users:
          result.rows
      });
    } catch (error) {
      console.error(
        "Erro ao listar usuários:",
        error
      );
      return res.status(500).json({
        ok: false,
        message:
          "Erro interno ao listar usuários."
      });
    }
  }
);
/* =========================================================
   ADMIN - CONSULTAR AUDITORIA
========================================================= */
app.get(
  "/api/admin/audit-logs",
  exigirAdmin,
  async (req, res) => {
    try {
      const result =
        await pool.query(
          `
          SELECT
            l.id,
            l.admin_id,
            a.username AS admin_username,
            l.action,
            l.target_type,
            l.target_id,
            l.description,
            l.metadata,
            l.created_at
          FROM admin_audit_logs l
          LEFT JOIN admins a
            ON a.id = l.admin_id
          ORDER BY
            l.created_at DESC,
            l.id DESC
          LIMIT 500
          `
        );
      return res.json({
        ok: true,
        logs:
          result.rows
      });
    } catch (error) {
      console.error(
        "Erro ao consultar auditoria:",
        error
      );
      return res.status(500).json({
        ok: false,
        message:
          "Erro interno ao consultar auditoria."
      });
    }
  }
);
/* =========================================================
   SERVIDOR
========================================================= */
const PORT =
  Number(
    process.env.PORT || 3000
  );
inicializarBanco()
  .then(() => {
    app.listen(
      PORT,
      () => {
        console.log(
          `JPBET rodando na porta ${PORT}`
        );
      }
    );
  })
  .catch(error => {
    console.error(
      "JPBET não pôde iniciar:",
      error
    );
    process.exit(1);
  });
