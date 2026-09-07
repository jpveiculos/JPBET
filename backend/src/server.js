import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import authRouter from "./auth.js";

import { pool } from "./db.js";

import {
  garantirConfiguracoes,
  obterConfiguracao,
  obterConfiguracoes,
  salvarConfiguracao,
  salvarConfiguracoes,
  obterSegmentosPadrao
} from "./settings.js";

import {
  enviarNotificacao
} from "./notifications.js";

import {
  validarSessaoAdmin
} from "./adminSession.js";

import {
  registrarAuditoria
} from "./audit.js";

/* =========================
   SISTEMA DE JOGOS
========================= */

import gamesRouter, {
  garantirTabelasJogos
} from "./games.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(
  "/api/auth",
  authRouter
);
/* =========================
   ARQUIVOS FRONTEND
========================= */

const frontendPath = path.join(
  __dirname,
  "../frontend"
);

app.use(
  express.static(frontendPath)
);

/* =========================
   CONFIGURAÇÃO INICIAL
========================= */

await garantirConfiguracoes();
await garantirTabelasJogos();

/* =========================
   FUNÇÕES AUXILIARES
========================= */

function numero(valor, padrao = 0) {
  const n = Number(valor);

  return Number.isFinite(n)
    ? n
    : padrao;
}

function arredondar(valor) {
  return Math.round(
    (Number(valor) + Number.EPSILON) * 100
  ) / 100;
}

function obterIp(req) {
  return (
    req.headers["x-forwarded-for"]
      ?.split(",")[0]
      ?.trim() ||
    req.socket?.remoteAddress ||
    null
  );
}

function obterTokenAdmin(req) {
  const cookies =
    req.headers.cookie || "";

  const match = cookies.match(
    /(?:^|;\s*)jpbet_admin_session=([^;]+)/
  );

  return match
    ? match[1]
    : null;
}

function exigirAdmin(
  req,
  res,
  next
) {
  const token =
    obterTokenAdmin(req);

  const sessao =
    validarSessaoAdmin(token);

  if (!sessao) {
    return res.status(401).json({
      message:
        "Sessão administrativa inválida ou expirada."
    });
  }

  req.adminSession =
    sessao;

  next();
}

async function obterUsuario(
  userId
) {
  const result =
    await pool.query(
      `
      SELECT
        id,
        username,
        balance,
        bonus_balance,
        cash_balance,
        reserved_balance,
        bonus_wager_progress,
        roulette_free_spins,
        roulette_free_spin_bet
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [userId]
    );

  return (
    result.rows[0] ||
    null
  );
}

async function obterRequisitoBonus() {
  const valor =
    await obterConfiguracao(
      "bonus_wager_requirement",
      "100"
    );

  return numero(
    valor,
    100
  );
}

function montarDadosUsuario(
  user
) {
  const bonus =
    numero(
      user.bonus_balance
    );

  const cash =
    numero(
      user.cash_balance
    );

  const reserved =
    numero(
      user.reserved_balance
    );

  const balance =
    arredondar(
      bonus + cash
    );

  return {
    id: user.id,

    username:
      user.username,

    balance,

    bonusBalance:
      arredondar(bonus),

    cashBalance:
      arredondar(cash),

    reservedBalance:
      arredondar(reserved),

    bonusWagerProgress:
      arredondar(
        numero(
          user.bonus_wager_progress
        )
      ),

    rouletteFreeSpins:
      numero(
        user.roulette_free_spins
      ),

    rouletteFreeSpinBet:
      numero(
        user.roulette_free_spin_bet
      )
  };
}

/* =========================
   HEALTH
========================= */

app.get(
  "/api/health",
  async (req, res) => {
    try {
      await pool.query(
        "SELECT 1"
      );

      res.json({
        ok: true,
        database:
          "connected"
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        database:
          "error"
      });
    }
  }
);

/* =========================
   CONFIGURAÇÕES PÚBLICAS
========================= */

app.get(
  "/api/settings",
  async (req, res) => {
    try {
      const settings =
        await obterConfiguracoes(
          false
        );

      res.json({
        ok: true,
        settings
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          "Erro ao carregar configurações."
      });
    }
  }
);

/* =========================
   CONFIGURAÇÕES ADMIN
========================= */

app.get(
  "/api/admin/settings",
  exigirAdmin,
  async (req, res) => {
    try {
      const settings =
        await obterConfiguracoes(
          true
        );

      res.json({
        ok: true,
        settings
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          "Erro ao carregar configurações."
      });
    }
  }
);

app.put(
  "/api/admin/settings",
  exigirAdmin,
  async (req, res) => {
    try {
      const settings =
        req.body?.settings ||
        req.body ||
        {};

      const oldSettings =
        await obterConfiguracoes(
          true
        );

      await salvarConfiguracoes(
        settings
      );

      await registrarAuditoria({
        adminId:
          req.adminSession?.username ||
          null,

        action:
          "ALTERACAO_CONFIGURACOES",

        module:
          "CONFIGURACOES",

        targetType:
          "SETTINGS",

        oldValue:
          oldSettings,

        newValue:
          settings,

        details:
          "Configurações do sistema alteradas pelo administrador.",

        result:
          "SUCCESS",

        ipAddress:
          obterIp(req),

        userAgent:
          req.headers["user-agent"] ||
          null
      });

      res.json({
        ok: true,
        message:
          "Configurações salvas com sucesso."
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          "Erro ao salvar configurações."
      });
    }
  }
);

/* =========================
   USUÁRIO ATUAL
========================= */

app.get(
  "/api/user/:userId",
  async (req, res) => {
    try {
      const user =
        await obterUsuario(
          req.params.userId
        );

      if (!user) {
        return res.status(404).json({
          message:
            "Usuário não encontrado."
        });
      }

      res.json({
        ok: true,

        user:
          montarDadosUsuario(
            user
          )
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          "Erro ao carregar usuário."
      });
    }
  }
);

/* =========================
   DEPÓSITO — SOLICITAR
========================= */

app.post(
  "/api/deposits",
  async (req, res) => {
    const client =
      await pool.connect();

    try {
      const {
        userId,
        amount,
        method = "manual"
      } = req.body;

      const valor =
        arredondar(
          numero(amount)
        );

      if (
        !userId ||
        !Number.isFinite(
          valor
        ) ||
        valor <= 0
      ) {
        return res.status(400).json({
          message:
            "Informe um valor de depósito válido."
        });
      }

      const user =
        await obterUsuario(
          userId
        );

      if (!user) {
        return res.status(404).json({
          message:
            "Usuário não encontrado."
        });
      }

      await client.query(
        "BEGIN"
      );

      const result =
        await client.query(
          `
          INSERT INTO deposits
          (
            user_id,
            amount,
            method,
            status
          )
          VALUES
          ($1, $2, $3, 'pending')
          RETURNING *
          `,
          [
            userId,
            valor,
            method
          ]
        );

      await client.query(
        "COMMIT"
      );

      await enviarNotificacao(
        "deposit_requested",
        {
          id:
            result.rows[0].id,

          userId:
            user.id,

          username:
            user.username,

          amount:
            valor,

          method
        }
      );

      res.status(201).json({
        ok: true,

        message:
          "Depósito solicitado com sucesso.",

        deposit:
          result.rows[0]
      });
    } catch (error) {
      await client.query(
        "ROLLBACK"
      );

      console.error(error);

      res.status(500).json({
        message:
          "Erro ao solicitar depósito."
      });
    } finally {
      client.release();
    }
  }
);

/* =========================
   SAQUE — SOLICITAR
========================= */

app.post(
  "/api/withdrawals",
  async (req, res) => {
    const client =
      await pool.connect();

    try {
      const {
        userId,
        amount,
        method = "manual",
        pixKey = null
      } = req.body;

      const valor =
        arredondar(
          numero(amount)
        );

      if (
        !userId ||
        !Number.isFinite(
          valor
        ) ||
        valor <= 0
      ) {
        return res.status(400).json({
          message:
            "Informe um valor de saque válido."
        });
      }

      const user =
        await obterUsuario(
          userId
        );

      if (!user) {
        return res.status(404).json({
          message:
            "Usuário não encontrado."
        });
      }

      const bonus =
        numero(
          user.bonus_balance
        );

      const progress =
        numero(
          user.bonus_wager_progress
        );

      const requirement =
        await obterRequisitoBonus();

      if (
        bonus > 0.009 ||
        progress < requirement
      ) {
        return res.status(400).json({
          message:
            `O jogador precisa apostar/acumular R$ ${requirement.toFixed(2).replace(".", ",")} em valor de apostas para liberar o botão de saque.`
        });
      }

      const disponivel =
        arredondar(
          numero(
            user.cash_balance
          ) -
          numero(
            user.reserved_balance
          )
        );

      if (
        valor >
        disponivel
      ) {
        return res.status(400).json({
          message:
            "Saldo disponível insuficiente."
        });
      }

      await client.query(
        "BEGIN"
      );

      const withdrawal =
        await client.query(
          `
          INSERT INTO withdrawals
          (
            user_id,
            amount,
            method,
            pix_key,
            status
          )
          VALUES
          ($1, $2, $3, $4, 'pending')
          RETURNING *
          `,
          [
            userId,
            valor,
            method,
            pixKey
          ]
        );

      await client.query(
        `
        UPDATE users
        SET
          reserved_balance =
            COALESCE(
              reserved_balance,
              0
            ) + $1
        WHERE id = $2
        `,
        [
          valor,
          userId
        ]
      );

      await client.query(
        "COMMIT"
      );

      await enviarNotificacao(
        "withdrawal_requested",
        {
          id:
            withdrawal.rows[0].id,

          userId:
            user.id,

          username:
            user.username,

          amount:
            valor,

          method
        }
      );

      res.status(201).json({
        ok: true,

        message:
          "Saque solicitado com sucesso.",

        withdrawal:
          withdrawal.rows[0]
      });
    } catch (error) {
      await client.query(
        "ROLLBACK"
      );

      console.error(error);

      res.status(500).json({
        message:
          "Erro ao solicitar saque."
      });
    } finally {
      client.release();
    }
  }
);

/* =========================
   ADMIN — DEPÓSITOS
========================= */

app.get(
  "/api/admin/deposits",
  exigirAdmin,
  async (req, res) => {
    try {
      const result =
        await pool.query(
          `
          SELECT
            d.*,
            u.username
          FROM deposits d
          JOIN users u
            ON u.id = d.user_id
          ORDER BY
            d.created_at DESC
          `
        );

      res.json({
        ok: true,

        deposits:
          result.rows
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          "Erro ao carregar depósitos."
      });
    }
  }
);

/* =========================
   ADMIN — SAQUES
========================= */

app.get(
  "/api/admin/withdrawals",
  exigirAdmin,
  async (req, res) => {
    try {
      const result =
        await pool.query(
          `
          SELECT
            w.*,
            u.username
          FROM withdrawals w
          JOIN users u
            ON u.id = w.user_id
          ORDER BY
            w.created_at DESC
          `
        );

      res.json({
        ok: true,

        withdrawals:
          result.rows
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          "Erro ao carregar saques."
      });
    }
  }
);

/* =========================
   ADMIN — APROVAR DEPÓSITO
========================= */

app.post(
  "/api/admin/deposits/:id/approve",
  exigirAdmin,
  async (req, res) => {
    const client =
      await pool.connect();

    try {
      await client.query(
        "BEGIN"
      );

      const depositResult =
        await client.query(
          `
          SELECT
            d.*,
            u.username
          FROM deposits d
          JOIN users u
            ON u.id = d.user_id
          WHERE d.id = $1
          FOR UPDATE
          `,
          [
            req.params.id
          ]
        );

      if (
        depositResult.rows.length === 0
      ) {
        await client.query(
          "ROLLBACK"
        );

        return res.status(404).json({
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
          message:
            "Esse depósito já foi processado."
        });
      }

      await client.query(
        `
        UPDATE deposits
        SET
          status = 'approved',
          processed_at =
            CURRENT_TIMESTAMP
        WHERE id = $1
        `,
        [
          deposit.id
        ]
      );

      await client.query(
        `
        UPDATE users
        SET
          cash_balance =
            COALESCE(
              cash_balance,
              0
            ) + $1,

          balance =
            COALESCE(
              balance,
              0
            ) + $1

        WHERE id = $2
        `,
        [
          numero(
            deposit.amount
          ),

          deposit.user_id
        ]
      );

      await client.query(
        "COMMIT"
      );

      await enviarNotificacao(
        "deposit_approved",
        {
          id:
            deposit.id,

          userId:
            deposit.user_id,

          username:
            deposit.username,

          amount:
            numero(
              deposit.amount
            )
        }
      );

      res.json({
        ok: true,

        message:
          "Depósito aprovado com sucesso."
      });
    } catch (error) {
      await client.query(
        "ROLLBACK"
      );

      console.error(error);

      res.status(500).json({
        message:
          "Erro ao aprovar depósito."
      });
    } finally {
      client.release();
    }
  }
);

/* =========================
   ADMIN — REJEITAR DEPÓSITO
========================= */

app.post(
  "/api/admin/deposits/:id/reject",
  exigirAdmin,
  async (req, res) => {
    try {
      const result =
        await pool.query(
          `
          SELECT
            d.*,
            u.username
          FROM deposits d
          JOIN users u
            ON u.id = d.user_id
          WHERE d.id = $1
          LIMIT 1
          `,
          [
            req.params.id
          ]
        );

      if (
        result.rows.length === 0
      ) {
        return res.status(404).json({
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
        return res.status(400).json({
          message:
            "Esse depósito já foi processado."
        });
      }

      const reason =
        req.body?.reason ||
        "Depósito rejeitado pelo administrador.";

      await pool.query(
        `
        UPDATE deposits
        SET
          status = 'rejected',

          rejection_reason =
            $1,

          processed_at =
            CURRENT_TIMESTAMP

        WHERE id = $2
        `,
        [
          reason,
          deposit.id
        ]
      );

      await enviarNotificacao(
        "deposit_rejected",
        {
          id:
            deposit.id,

          userId:
            deposit.user_id,

          username:
            deposit.username,

          amount:
            numero(
              deposit.amount
            ),

          reason
        }
      );

      res.json({
        ok: true,

        message:
          "Depósito rejeitado."
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          "Erro ao rejeitar depósito."
      });
    }
  }
);

/* =========================
   ADMIN — APROVAR SAQUE
========================= */

app.post(
  "/api/admin/withdrawals/:id/approve",
  exigirAdmin,
  async (req, res) => {
    const client =
      await pool.connect();

    try {
      await client.query(
        "BEGIN"
      );

      const result =
        await client.query(
          `
          SELECT
            w.*,
            u.username,
            u.cash_balance,
            u.reserved_balance
          FROM withdrawals w
          JOIN users u
            ON u.id = w.user_id
          WHERE w.id = $1
          FOR UPDATE
          `,
          [
            req.params.id
          ]
        );

      if (
        result.rows.length === 0
      ) {
        await client.query(
          "ROLLBACK"
        );

        return res.status(404).json({
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
          message:
            "Esse saque já foi processado."
        });
      }

      const valor =
        numero(
          withdrawal.amount
        );

      const cash =
        numero(
          withdrawal.cash_balance
        );

      const reserved =
        numero(
          withdrawal.reserved_balance
        );

      if (
        valor > cash ||
        valor > reserved
      ) {
        await client.query(
          "ROLLBACK"
        );

        return res.status(400).json({
          message:
            "Saldo reservado insuficiente para aprovar o saque."
        });
      }

      await client.query(
        `
        UPDATE withdrawals
        SET
          status = 'approved',
          processed_at =
            CURRENT_TIMESTAMP
        WHERE id = $1
        `,
        [
          withdrawal.id
        ]
      );

      await client.query(
        `
        UPDATE users
        SET
          cash_balance =
            COALESCE(
              cash_balance,
              0
            ) - $1,

          balance =
            COALESCE(
              balance,
              0
            ) - $1,

          reserved_balance =
            GREATEST(
              0,
              COALESCE(
                reserved_balance,
                0
              ) - $1
            )

        WHERE id = $2
        `,
        [
          valor,
          withdrawal.user_id
        ]
      );

      await client.query(
        "COMMIT"
      );

      await enviarNotificacao(
        "withdrawal_approved",
        {
          id:
            withdrawal.id,

          userId:
            withdrawal.user_id,

          username:
            withdrawal.username,

          amount:
            valor
        }
      );

      res.json({
        ok: true,

        message:
          "Saque aprovado."
      });
    } catch (error) {
      await client.query(
        "ROLLBACK"
      );

      console.error(error);

      res.status(500).json({
        message:
          "Erro ao aprovar saque."
      });
    } finally {
      client.release();
    }
  }
);

/* =========================
   ADMIN — REJEITAR SAQUE
========================= */

app.post(
  "/api/admin/withdrawals/:id/reject",
  exigirAdmin,
  async (req, res) => {
    const client =
      await pool.connect();

    try {
      await client.query(
        "BEGIN"
      );

      const result =
        await client.query(
          `
          SELECT
            w.*,
            u.username
          FROM withdrawals w
          JOIN users u
            ON u.id = w.user_id
          WHERE w.id = $1
          FOR UPDATE
          `,
          [
            req.params.id
          ]
        );

      if (
        result.rows.length === 0
      ) {
        await client.query(
          "ROLLBACK"
        );

        return res.status(404).json({
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
          message:
            "Esse saque já foi processado."
        });
      }

      const reason =
        req.body?.reason ||
        "Saque rejeitado pelo administrador.";

      await client.query(
        `
        UPDATE withdrawals
        SET
          status = 'rejected',

          rejection_reason =
            $1,

          processed_at =
            CURRENT_TIMESTAMP

        WHERE id = $2
        `,
        [
          reason,
          withdrawal.id
        ]
      );

      await client.query(
        `
        UPDATE users
        SET
          reserved_balance =
            GREATEST(
              0,
              COALESCE(
                reserved_balance,
                0
              ) - $1
            )

        WHERE id = $2
        `,
        [
          numero(
            withdrawal.amount
          ),

          withdrawal.user_id
        ]
      );

      await client.query(
        "COMMIT"
      );

      await enviarNotificacao(
        "withdrawal_rejected",
        {
          id:
            withdrawal.id,

          userId:
            withdrawal.user_id,

          username:
            withdrawal.username,

          amount:
            numero(
              withdrawal.amount
            ),

          reason
        }
      );

      res.json({
        ok: true,

        message:
          "Saque rejeitado."
      });
    } catch (error) {
      await client.query(
        "ROLLBACK"
      );

      console.error(error);

      res.status(500).json({
        message:
          "Erro ao rejeitar saque."
      });
    } finally {
      client.release();
    }
  }
);

/* =========================
   ADMIN — SAQUE CONCLUÍDO
========================= */

app.post(
  "/api/admin/withdrawals/:id/complete",
  exigirAdmin,
  async (req, res) => {
    try {
      const result =
        await pool.query(
          `
          SELECT
            w.*,
            u.username
          FROM withdrawals w
          JOIN users u
            ON u.id = w.user_id
          WHERE w.id = $1
          LIMIT 1
          `,
          [
            req.params.id
          ]
        );

      if (
        result.rows.length === 0
      ) {
        return res.status(404).json({
          message:
            "Saque não encontrado."
        });
      }

      const withdrawal =
        result.rows[0];

      if (
        withdrawal.status !==
        "approved"
      ) {
        return res.status(400).json({
          message:
            "O saque precisa estar aprovado antes de ser concluído."
        });
      }

      await pool.query(
        `
        UPDATE withdrawals
        SET
          status = 'completed',
          completed_at =
            CURRENT_TIMESTAMP
        WHERE id = $1
        `,
        [
          withdrawal.id
        ]
      );

      await enviarNotificacao(
        "withdrawal_completed",
        {
          id:
            withdrawal.id,

          userId:
            withdrawal.user_id,

          username:
            withdrawal.username,

          amount:
            numero(
              withdrawal.amount
            )
        }
      );

      res.json({
        ok: true,

        message:
          "Saque marcado como concluído."
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          "Erro ao concluir saque."
      });
    }
  }
);

/* =========================
   ROLETAS
========================= */

function validarSegmentosRoleta(
  segmentos
) {
  if (
    !Array.isArray(
      segmentos
    ) ||
    segmentos.length < 12 ||
    segmentos.length > 40
  ) {
    throw new Error(
      "A roleta precisa ter entre 12 e 40 segmentos."
    );
  }

  let totalProbabilidade = 0;

  const normalizados =
    segmentos.map(
      (
        segmento,
        index
      ) => {
        const tipo =
          segmento.type ||
          (
            segmento.multiplier === 0
              ? "zero"
              : "prize"
          );

        if (
          ![
            "zero",
            "sorte",
            "prize"
          ].includes(
            tipo
          )
        ) {
          throw new Error(
            `Tipo inválido no segmento ${index + 1}.`
          );
        }

        const probability =
          numero(
            segmento.probability,
            0
          );

        if (
          probability < 0
        ) {
          throw new Error(
            `Probabilidade inválida no segmento ${index + 1}.`
          );
        }

        let multiplier =
          numero(
            segmento.multiplier,
            0
          );

        if (
          tipo === "prize"
        ) {
          if (
            multiplier < 2 ||
            multiplier > 100
          ) {
            throw new Error(
              `O multiplicador do segmento ${index + 1} deve estar entre 2× e 100×.`
            );
          }
        } else {
          multiplier = 0;
        }

        totalProbabilidade +=
          probability;

        return {
          label:
            segmento.label ||
            (
              tipo === "zero"
                ? "❌"
                : tipo === "sorte"
                  ? "🍀"
                  : `${multiplier}×`
            ),

          type:
            tipo,

          multiplier,

          probability
        };
      }
    );

  if (
    Math.abs(
      totalProbabilidade -
      100
    ) > 0.0001
  ) {
    throw new Error(
      `A soma das probabilidades deve ser 100%. Atualmente está em ${totalProbabilidade}%.`
    );
  }

  return normalizados;
}

async function carregarSegmentosRoleta() {
  const configuracao =
    await obterConfiguracao(
      "roulette_segments_json",
      null
    );

  if (!configuracao) {
    return obterSegmentosPadrao();
  }

  try {
    const segmentos =
      JSON.parse(
        configuracao
      );

    return validarSegmentosRoleta(
      segmentos
    );
  } catch (error) {
    console.error(
      "Erro na configuração da roleta:",
      error
    );

    return obterSegmentosPadrao();
  }
}

function sortearResultadoRoleta(
  segmentos
) {
  const aleatorio =
    crypto.randomInt(
      0,
      1000000
    ) / 10000;

  let acumulado = 0;

  for (
    const segmento of segmentos
  ) {
    acumulado +=
      numero(
        segmento.probability
      );

    if (
      aleatorio <
      acumulado
    ) {
      return segmento;
    }
  }

  return segmentos[
    segmentos.length - 1
  ];
}

/* =========================
   ROLETTE SPIN
========================= */

app.post(
  "/api/roulette/spin",
  async (req, res) => {
    const client =
      await pool.connect();

    try {
      const {
        userId,
        bet,
        freeSpin = false
      } = req.body;

      const valorAposta =
        arredondar(
          numero(bet)
        );

      const minBet =
        numero(
          await obterConfiguracao(
            "roulette_min_bet",
            "0.50"
          ),
          0.5
        );

      const maxBet =
        numero(
          await obterConfiguracao(
            "roulette_max_bet",
            "100"
          ),
          100
        );

      if (
        !userId ||
        !Number.isFinite(
          valorAposta
        ) ||
        valorAposta < minBet ||
        valorAposta > maxBet
      ) {
        return res.status(400).json({
          message:
            `A aposta deve estar entre R$ ${minBet.toFixed(2).replace(".", ",")} e R$ ${maxBet.toFixed(2).replace(".", ",")}.`
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
            reserved_balance,
            bonus_wager_progress,
            roulette_free_spins,
            roulette_free_spin_bet
          FROM users
          WHERE id = $1
          FOR UPDATE
          `,
          [
            userId
          ]
        );

      if (
        userResult.rows.length === 0
      ) {
        await client.query(
          "ROLLBACK"
        );

        return res.status(404).json({
          message:
            "Usuário não encontrado."
        });
      }

      const user =
        userResult.rows[0];

      let bonus =
        numero(
          user.bonus_balance
        );

      let cash =
        numero(
          user.cash_balance
        );

      let freeSpins =
        Math.max(
          0,
          Math.floor(
            numero(
              user.roulette_free_spins
            )
          )
        );

      let freeSpinBet =
        numero(
          user.roulette_free_spin_bet
        );

      /* =========================
         GIRO GRÁTIS
      ========================= */

      if (freeSpin) {
        if (
          freeSpins <= 0
        ) {
          await client.query(
            "ROLLBACK"
          );

          return res.status(400).json({
            message:
              "Nenhum giro grátis disponível."
          });
        }

        if (
          freeSpinBet > 0
        ) {
          /* usa aposta original */
        } else {
          freeSpinBet =
            valorAposta;
        }

        freeSpins -= 1;
      }

      /* =========================
         GIRO PAGO
      ========================= */

      if (!freeSpin) {
        const saldoTotal =
          arredondar(
            bonus + cash
          );

        if (
          saldoTotal <
          valorAposta
        ) {
          await client.query(
            "ROLLBACK"
          );

          return res.status(400).json({
            message:
              "Saldo insuficiente."
          });
        }

        let restante =
          valorAposta;

        const usadoBonus =
          Math.min(
            bonus,
            restante
          );

        bonus =
          arredondar(
            bonus -
            usadoBonus
          );

        restante =
          arredondar(
            restante -
            usadoBonus
          );

        const usadoCash =
          Math.min(
            cash,
            restante
          );

        cash =
          arredondar(
            cash -
            usadoCash
          );

        if (
          usadoBonus > 0
        ) {
          await client.query(
            `
            UPDATE users
            SET
              bonus_wager_progress =
                COALESCE(
                  bonus_wager_progress,
                  0
                ) + $1
            WHERE id = $2
            `,
            [
              usadoBonus,
              userId
            ]
          );
        }
      }

      const segmentos =
        await carregarSegmentosRoleta();

      const resultado =
        sortearResultadoRoleta(
          segmentos
        );

      const multiplicador =
        resultado.type ===
        "prize"
          ? numero(
              resultado.multiplier
            )
          : 0;

      const ganhou =
        resultado.type ===
          "prize" &&
        multiplicador >= 2;

      const ganhouSorte =
        resultado.type ===
        "sorte";

      const valorBase =
        freeSpin
          ? (
              freeSpinBet > 0
                ? freeSpinBet
                : valorAposta
            )
          : valorAposta;

      const premio =
        ganhou
          ? arredondar(
              valorBase *
              multiplicador
            )
          : 0;

      if (
        premio > 0
      ) {
        cash =
          arredondar(
            cash + premio
          );
      }

      if (
        ganhouSorte
      ) {
        freeSpins += 1;

        freeSpinBet =
          valorBase;
      }

      if (
        !ganhouSorte &&
        !freeSpin
      ) {
        if (
          freeSpins <= 0
        ) {
          freeSpinBet = 0;
        }
      }

      const novoBalance =
        arredondar(
          bonus + cash
        );

      await client.query(
        `
        UPDATE users
        SET
          balance = $1,
          bonus_balance = $2,
          cash_balance = $3,
          roulette_free_spins = $4,
          roulette_free_spin_bet = $5
        WHERE id = $6
        `,
        [
          novoBalance,
          bonus,
          cash,
          freeSpins,
          freeSpinBet,
          userId
        ]
      );

      try {
        await client.query(
          `
          INSERT INTO roulette_spins
          (
            user_id,
            bet_amount,
            multiplier,
            result_type,
            prize_amount,
            is_free_spin,
            created_at
          )
          VALUES
          (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            CURRENT_TIMESTAMP
          )
          `,
          [
            userId,
            valorBase,
            multiplicador,
            resultado.type,
            premio,
            freeSpin
          ]
        );
      } catch (_) {
        /* compatibilidade */
      }

      await client.query(
        "COMMIT"
      );

      const usuarioAtual =
        await obterUsuario(
          userId
        );

      res.json({
        ok: true,

        result: {
          label:
            resultado.label,

          type:
            resultado.type,

          resultType:
            resultado.type,

          multiplier:
            multiplicador,

          prize:
            premio,

          ganhou,

          sorte:
            ganhouSorte,

          replay: false,

          freeSpin
        },

        user:
          montarDadosUsuario(
            usuarioAtual
          ),

        freeSpinsAvailable:
          numero(
            usuarioAtual
              ?.roulette_free_spins
          )
      });
    } catch (error) {
      await client.query(
        "ROLLBACK"
      );

      console.error(
        "Erro na roleta:",
        error
      );

      res.status(500).json({
        message:
          "Erro ao girar a roleta."
      });
    } finally {
      client.release();
    }
  }
);

/* =====================================================
   SISTEMA CENTRAL DAS MÁQUINAS
   FORTUNE 7
   DIAMOND GOLD
   ROYAL JACKPOT
   LUCKY 7
===================================================== */

app.use(
  "/api/games",
  gamesRouter
);

/* =========================
   HISTÓRICO DO USUÁRIO
========================= */

app.get(
  "/api/history/:userId",
  async (req, res) => {
    try {
      const limit =
        Math.min(
          100,
          Math.max(
            1,
            parseInt(
              req.query.limit ||
                "50",
              10
            )
          )
        );

      const result =
        await pool.query(
          `
          SELECT
            id,
            user_id,
            bet_amount,
            multiplier,
            result_type,
            prize_amount,
            is_free_spin,
            created_at
          FROM roulette_spins
          WHERE user_id = $1
          ORDER BY
            created_at DESC
          LIMIT $2
          `,
          [
            req.params.userId,
            limit
          ]
        );

      res.json({
        ok: true,

        history:
          result.rows
      });
    } catch (error) {
      console.error(error);

      res.json({
        ok: true,
        history: []
      });
    }
  }
);

/* =========================
   ADMIN — USUÁRIOS
========================= */

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
            reserved_balance,
            bonus_wager_progress,
            roulette_free_spins,
            roulette_free_spin_bet,
            created_at
          FROM users
          ORDER BY
            created_at DESC
          `
        );

      res.json({
        ok: true,

        users:
          result.rows
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          "Erro ao carregar usuários."
      });
    }
  }
);

/* =========================
   ADMIN — ADICIONAR CRÉDITOS
========================= */

app.post(
  "/api/admin/users/:id/add-credit",
  exigirAdmin,
  async (req, res) => {
    try {
      const valor =
        arredondar(
          numero(
            req.body?.amount
          )
        );

      if (
        !Number.isFinite(
          valor
        ) ||
        valor <= 0
      ) {
        return res.status(400).json({
          message:
            "Informe um valor válido."
        });
      }

      const result =
        await pool.query(
          `
          UPDATE users
          SET
            bonus_balance =
              COALESCE(
                bonus_balance,
                0
              ) + $1,

            balance =
              COALESCE(
                balance,
                0
              ) + $1

          WHERE id = $2

          RETURNING *
          `,
          [
            valor,
            req.params.id
          ]
        );

      if (
        result.rows.length === 0
      ) {
        return res.status(404).json({
          message:
            "Usuário não encontrado."
        });
      }

      await registrarAuditoria({
        adminId:
          req.adminSession?.username ||
          null,

        action:
          "ADICIONAR_CREDITOS",

        module:
          "USUARIOS",

        targetType:
          "USER",

        targetId:
          req.params.id,

        newValue: {
          amount:
            valor
        },

        details:
          "Créditos adicionados manualmente pelo administrador.",

        result:
          "SUCCESS",

        ipAddress:
          obterIp(req),

        userAgent:
          req.headers["user-agent"] ||
          null
      });

      res.json({
        ok: true,

        message:
          "Créditos adicionados com sucesso.",

        user:
          montarDadosUsuario(
            result.rows[0]
          )
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          "Erro ao adicionar créditos."
      });
    }
  }
);

/* =========================
   ADMIN — REMOVER CRÉDITOS
========================= */

app.post(
  "/api/admin/users/:id/remove-credit",
  exigirAdmin,
  async (req, res) => {
    try {
      const valor =
        arredondar(
          numero(
            req.body?.amount
          )
        );

      if (
        !Number.isFinite(
          valor
        ) ||
        valor <= 0
      ) {
        return res.status(400).json({
          message:
            "Informe um valor válido."
        });
      }

      const user =
        await obterUsuario(
          req.params.id
        );

      if (!user) {
        return res.status(404).json({
          message:
            "Usuário não encontrado."
        });
      }

      let bonus =
        numero(
          user.bonus_balance
        );

      let cash =
        numero(
          user.cash_balance
        );

      let restante =
        valor;

      const retirarBonus =
        Math.min(
          bonus,
          restante
        );

      bonus =
        arredondar(
          bonus -
          retirarBonus
        );

      restante =
        arredondar(
          restante -
          retirarBonus
        );

      const retirarCash =
        Math.min(
          cash,
          restante
        );

      cash =
        arredondar(
          cash -
          retirarCash
        );

      if (
        restante >
        0.009
      ) {
        return res.status(400).json({
          message:
            "O usuário não possui saldo suficiente."
        });
      }

      const balance =
        arredondar(
          bonus + cash
        );

      const result =
        await pool.query(
          `
          UPDATE users
          SET
            balance = $1,
            bonus_balance = $2,
            cash_balance = $3
          WHERE id = $4
          RETURNING *
          `,
          [
            balance,
            bonus,
            cash,
            req.params.id
          ]
        );

      await registrarAuditoria({
        adminId:
          req.adminSession?.username ||
          null,

        action:
          "REMOVER_CREDITOS",

        module:
          "USUARIOS",

        targetType:
          "USER",

        targetId:
          req.params.id,

        newValue: {
          amount:
            valor
        },

        details:
          "Créditos removidos manualmente pelo administrador.",

        result:
          "SUCCESS",

        ipAddress:
          obterIp(req),

        userAgent:
          req.headers["user-agent"] ||
          null
      });

      res.json({
        ok: true,

        message:
          "Créditos removidos com sucesso.",

        user:
          montarDadosUsuario(
            result.rows[0]
          )
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          "Erro ao remover créditos."
      });
    }
  }
);

/* =========================
   NOTIFICAÇÃO DE TESTE
========================= */

app.post(
  "/api/admin/notifications/test",
  exigirAdmin,
  async (req, res) => {
    try {
      const result =
        await enviarNotificacao(
          "test",
          {
            admin:
              req.adminSession?.username ||
              null
          }
        );

      if (!result.ok) {
        return res.status(400).json({
          ok: false,

          message:
            "Não foi possível enviar a notificação de teste.",

          result
        });
      }

      res.json({
        ok: true,

        message:
          "Notificação de teste enviada com sucesso."
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          "Erro ao testar notificação."
      });
    }
  }
);

/* =========================
   AUDITORIA ADMIN
========================= */

app.get(
  "/api/admin/audit",
  exigirAdmin,
  async (req, res) => {
    try {
      const limit =
        Math.min(
          500,
          Math.max(
            1,
            parseInt(
              req.query.limit ||
                "200",
              10
            )
          )
        );

      const result =
        await pool.query(
          `
          SELECT *
          FROM audit_logs
          ORDER BY
            created_at DESC
          LIMIT $1
          `,
          [
            limit
          ]
        );

      res.json({
        ok: true,

        logs:
          result.rows
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          "Erro ao carregar auditoria."
      });
    }
  }
);

/* =========================
   ROTAS HTML
========================= */

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

app.get(
  "/app",
  (req, res) => {
    res.sendFile(
      path.join(
        frontendPath,
        "dashboard.html"
      )
    );
  }
);

app.get(
  "/dashboard",
  (req, res) => {
    res.sendFile(
      path.join(
        frontendPath,
        "dashboard.html"
      )
    );
  }
);

app.get(
  "/games",
  (req, res) => {
    res.sendFile(
      path.join(
        frontendPath,
        "games.html"
      )
    );
  }
);

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

app.get(
  "/admin-settings",
  (req, res) => {
    res.sendFile(
      path.join(
        frontendPath,
        "admin-settings.html"
      )
    );
  }
);

app.get(
  "/termos",
  (req, res) => {
    res.sendFile(
      path.join(
        frontendPath,
        "termos-uso.html"
      )
    );
  }
);

/* =========================
   ERRO 404 DA API
========================= */

app.use(
  "/api",
  (req, res) => {
    res.status(404).json({
      message:
        "Endpoint não encontrado."
    });
  }
);

/* =========================
   FALLBACK FRONTEND
========================= */

app.use(
  (req, res, next) => {
    if (
      req.method === "GET" &&
      !req.path.startsWith(
        "/api/"
      )
    ) {
      return res.sendFile(
        path.join(
          frontendPath,
          "index.html"
        )
      );
    }

    next();
  }
);

/* =========================
   INICIALIZAÇÃO
========================= */

const PORT =
  process.env.PORT ||
  10000;

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `JPBET iniciado na porta ${PORT}`
    );
  }
);
