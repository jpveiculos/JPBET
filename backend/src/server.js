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
          cash_balance = CASE
            WHEN COALESCE(cash_balance, 0) = 0
              AND COALESCE(bonus_balance, 0) = 0
            THEN COALESCE(balance, 0)
            ELSE COALESCE(cash_balance, 0)
          END,
          bonus_wager_progress = COALESCE(bonus_wager_progress, 0),
          reserved_balance = COALESCE(reserved_balance, 0);
    `);

    await pool.query(`
      UPDATE users
      SET balance = ROUND(
        (
          COALESCE(bonus_balance,0) +
          COALESCE(cash_balance,0)
        )::numeric,
        2
      )
      WHERE balance IS NULL
         OR balance <> ROUND(
           (
             COALESCE(bonus_balance,0) +
             COALESCE(cash_balance,0)
           )::numeric,
           2
         );
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
   ROTA DO PAINEL ADMINISTRATIVO
========================================================= */

app.get(
  "/admin",
  (req, res) => {
    res.sendFile(
      path.join(
        frontendPath,
        "admin.html"
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
  const enabled =
    String(
      settings.bonus_system_enabled ??
      "true"
    ).toLowerCase() !== "false";

  const initialBonus =
    Math.max(
      0,
      Number(
        settings.initial_bonus_amount ??
        100
      ) || 0
    );

  const requirement =
    Math.max(
      0,
      Number(
        settings.bonus_wager_requirement ??
        100
      ) || 0
    );

  return {
    enabled,
    initialBonus,
    requirement
  };
}

function saqueLiberado({
  bonusBalance,
  bonusWagerProgress,
  requirement
}) {
  return (
    Number(
      bonusBalance || 0
    ) <= 0.009 &&
    Number(
      bonusWagerProgress || 0
    ) >=
      Number(
        requirement || 0
      )
  );
}

function calcularConsumoAposta(
  bonusBalance,
  cashBalance,
  bet
) {
  const bonus =
    Math.max(
      0,
      Number(
        bonusBalance
      ) || 0
    );

  const cash =
    Math.max(
      0,
      Number(
        cashBalance
      ) || 0
    );

  const valor =
    Math.max(
      0,
      Number(
        bet
      ) || 0
    );

  const bonusUsed =
    Math.min(
      bonus,
      valor
    );

  const cashUsed =
    Math.max(
      0,
      valor -
        bonusUsed
    );

  return {
    bonusUsed,
    cashUsed,
    bonusAfter:
      Number(
        (
          bonus -
          bonusUsed
        ).toFixed(2)
      ),
    cashAfter:
      Number(
        (
          cash -
          cashUsed
        ).toFixed(2)
      )
  };
}

function totalSaldo(
  bonusBalance,
  cashBalance
) {
  return Number(
    (
      Math.max(
        0,
        Number(
          bonusBalance
        ) || 0
      ) +
      Math.max(
        0,
        Number(
          cashBalance
        ) || 0
      )
    ).toFixed(2)
  );
}

async function obterConfiguracao(
  chave,
  padrao = null
) {
  try {
    const result =
      await pool.query(
        `
        SELECT setting_value
        FROM site_settings
        WHERE setting_key = $1
        LIMIT 1
        `,
        [chave]
      );

    return (
      result.rows[0]
        ?.setting_value ??
      padrao
    );
  } catch (_) {
    return padrao;
  }
}

/* =========================================================
   API DA ROLETA
   ROLETA ÚNICA - 32 FATIAS
========================================================= */

const ROLETTE_DEFAULT_SEGMENTS = [
  {
    "label": "❌",
    "type": "zero",
    "multiplier": 0,
    "probability": 5
  },
  {
    "label": "❌",
    "type": "zero",
    "multiplier": 0,
    "probability": 5
  },
  {
    "label": "❌",
    "type": "zero",
    "multiplier": 0,
    "probability": 5
  },
  {
    "label": "❌",
    "type": "zero",
    "multiplier": 0,
    "probability": 5
  },
  {
    "label": "❌",
    "type": "zero",
    "multiplier": 0,
    "probability": 5
  },
  {
    "label": "2x",
    "type": "prize",
    "multiplier": 2,
    "probability": 5
  },
  {
    "label": "2x",
    "type": "prize",
    "multiplier": 2,
    "probability": 5
  },
  {
    "label": "2x",
    "type": "prize",
    "multiplier": 2,
    "probability": 5
  },
  {
    "label": "3x",
    "type": "prize",
    "multiplier": 3,
    "probability": 5
  },
  {
    "label": "3x",
    "type": "prize",
    "multiplier": 3,
    "probability": 5
  },
  {
    "label": "3x",
    "type": "prize",
    "multiplier": 3,
    "probability": 5
  },
  {
    "label": "5x",
    "type": "prize",
    "multiplier": 5,
    "probability": 5
  },
  {
    "label": "5x",
    "type": "prize",
    "multiplier": 5,
    "probability": 5
  },
  {
    "label": "10x",
    "type": "prize",
    "multiplier": 10,
    "probability": 5
  },
  {
    "label": "20x",
    "type": "prize",
    "multiplier": 20,
    "probability": 5
  },
  {
    "label": "30x",
    "type": "prize",
    "multiplier": 30,
    "probability": 5
  },
  {
    "label": "50x",
    "type": "prize",
    "multiplier": 50,
    "probability": 5
  },
  {
    "label": "75x",
    "type": "prize",
    "multiplier": 75,
    "probability": 5
  },
  {
    "label": "100x",
    "type": "prize",
    "multiplier": 100,
    "probability": 5
  },
  {
    "label": "🍀",
    "type": "sorte",
    "multiplier": 0,
    "probability": 5
  }
];

function carregarSegmentosRoleta(
  valor
) {
  try {
    const parsed =
      JSON.parse(
        String(
          valor || ""
        )
      );

    if (
      !Array.isArray(
        parsed
      ) ||
      parsed.length <
        12 ||
      parsed.length >
        40
    ) {
      throw new Error(
        "A roleta precisa ter entre 12 e 40 fatias."
      );
    }

    return parsed.map(
      (
        segmento,
        index
      ) => {
        const label =
          String(
            segmento?.label ??
            ""
          ).trim();

        const type =
          String(
            segmento?.type ??
            "zero"
          )
            .trim()
            .toLowerCase();

        const multiplier =
          Number(
            segmento?.multiplier ??
            0
          );

        const weight =
          Number(
            segmento?.probability ??
            0
          );

        if (
          !label ||
          ![
            "zero",
            "sorte",
            "prize"
          ].includes(type)
        ) {
          throw new Error(
            `Configuração inválida na fatia ${index + 1}.`
          );
        }

        if (
          !Number.isFinite(
            weight
          ) ||
          weight < 0
        ) {
          throw new Error(
            `Peso inválido na fatia ${index + 1}.`
          );
        }

        if (
          !Number.isFinite(
            multiplier
          ) ||
          multiplier < 0 ||
          multiplier > 100
        ) {
          throw new Error(
            `Multiplicador inválido na fatia ${index + 1}.`
          );
        }

        if (
          type ===
            "prize" &&
          (
            multiplier <
              2 ||
            multiplier >
              100
          )
        ) {
          throw new Error(
            `O multiplicador da fatia ${index + 1} deve estar entre 2x e 100x.`
          );
        }

        if (
          type !==
            "prize" &&
          multiplier !==
            0
        ) {
          throw new Error(
            `A fatia ${index + 1} não pode ter multiplicador de prêmio.`
          );
        }

        return {
          label,
          type,
          multiplier,
          probability:
            weight
        };
      }
    );
  } catch (error) {
    console.warn(
      "Configuração da roleta inválida; usando padrão:",
      error.message
    );

    return ROLETTE_DEFAULT_SEGMENTS;
  }
}

function numeroAleatorioSeguro() {
  return Math.random();
}

function escolherIndiceComPesos(
  pesos
) {
  const total =
    pesos.reduce(
      (
        soma,
        peso
      ) =>
        soma +
        Math.max(
          0,
          Number(
            peso
          ) || 0
        ),
      0
    );

  if (
    !(
      total >
      0
    )
  ) {
    return 0;
  }

  let alvo =
    numeroAleatorioSeguro() *
    total;

  for (
    let i = 0;
    i <
      pesos.length;
    i += 1
  ) {
    alvo -=
      Math.max(
        0,
        Number(
          pesos[i]
        ) || 0
      );

    if (
      alvo <
      0
    ) {
      return i;
    }
  }

  return (
    pesos.length -
    1
  );
}

function normalizarPercentual(
  valor,
  padrao
) {
  const numero =
    Number(
      valor
    );

  if (
    !Number.isFinite(
      numero
    )
  ) {
    return padrao;
  }

  return Math.min(
    100,
    Math.max(
      0,
      numero
    )
  );
}

function calcularPremioSegmento(
  segmento,
  bet
) {
  if (
    !segmento ||
    segmento.type !==
      "prize"
  ) {
    return 0;
  }

  return Number(
    (
      bet *
      Number(
        segmento.multiplier
      )
    ).toFixed(2)
  );
}

function sortearResultadoRoleta({
  segmentos
}) {
  const pesos =
    segmentos.map(
      segmento =>
        Math.max(
          0,
          Number(
            segmento.probability
          ) || 0
        )
    );

  return escolherIndiceComPesos(
    pesos
  );
}

app.post(
  "/api/roulette/spin",
  async (
    req,
    res
  ) => {
    const client =
      await pool.connect();

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

      const userIdNumber =
        Number(
          userId
        );

      const requestedBet =
        Number(
          betAmount
        );

      const requestedFreeSpin =
        freeSpin === true ||
        freeSpin ===
          "true";

      if (
        !Number.isInteger(
          userIdNumber
        ) ||
        userIdNumber <=
          0
      ) {
        return res.status(
          400
        ).json({
          ok: false,
          message:
            "Usuário inválido."
        });
      }

      if (
        !Number.isFinite(
          requestedBet
        ) ||
        requestedBet <=
          0
      ) {
        return res.status(
          400
        ).json({
          ok: false,
          message:
            "Valor da aposta inválido."
        });
      }

      const settingsResult =
        await pool.query(`
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

      const settings =
        {};

      for (
        const row of
          settingsResult.rows
      ) {
        settings[
          row.setting_key
        ] =
          row.setting_value;
      }

      const rouletteEnabled =
        String(
          settings.roulette_enabled
        ).toLowerCase() !==
        "false";

      const virtualCreditsMode =
        String(
          settings.virtual_credits_mode
        ).toLowerCase() !==
        "false";

      const freeSpinEnabled =
        String(
          settings.roulette_free_spin_enabled
        ).toLowerCase() !==
        "false";

      const minBet =
        Number(
          settings.roulette_min_bet ||
            0.5
        );

      const maxBet =
        Number(
          settings.roulette_max_bet ||
            100
        );

      const rtp =
        normalizarPercentual(
          settings.roulette_rtp,
          50
        );

      const segmentos =
        carregarSegmentosRoleta(
          settings.roulette_segments_json
        );

      if (
        !rouletteEnabled
      ) {
        return res.status(
          403
        ).json({
          ok: false,
          message:
            "A roleta está desativada."
        });
      }

      if (
        !virtualCreditsMode
      ) {
        return res.status(
          403
        ).json({
          ok: false,
          message:
            "A roleta está configurada apenas para créditos virtuais."
        });
      }

      if (
        String(
          betType || ""
        ).toLowerCase() !==
        "roulette"
      ) {
        return res.status(
          400
        ).json({
          ok: false,
          message:
            "Tipo de roleta inválido."
        });
      }

      if (
        String(
