import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import authRouter from "./auth.js";

import {
  pool,
  garantirEstruturaBanco
} from "./db.js";

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

import gamesRouter, {
  garantirTabelasJogos
} from "./games.js";


const __filename =
  fileURLToPath(import.meta.url);

const __dirname =
  path.dirname(__filename);

const app =
  express();


app.use(
  express.json({
    limit: "2mb"
  })
);

app.use(
  express.urlencoded({
    extended: true
  })
);


app.use(
  "/api/auth",
  authRouter
);


/* =========================================================
   ATALHOS DE AUTENTICAÇÃO ADMINISTRATIVA
========================================================= */

app.post(
  "/api/admin-login",
  (req, res, next) => {
    req.url =
      "/admin-login";

    authRouter.handle(
      req,
      res,
      next
    );
  }
);


app.get(
  "/api/admin-session",
  (req, res, next) => {
    req.url =
      "/admin-session";

    authRouter.handle(
      req,
      res,
      next
    );
  }
);


app.post(
  "/api/admin-logout",
  (req, res, next) => {
    req.url =
      "/admin-logout";

    authRouter.handle(
      req,
      res,
      next
    );
  }
);


/* =========================
   ARQUIVOS FRONTEND
========================= */

const frontendPath =
  path.join(
    __dirname,
    "../frontend"
  );


app.use(
  express.static(
    frontendPath
  )
);


/* =========================
   CONFIGURAÇÃO INICIAL
========================= */

await garantirEstruturaBanco();

await garantirConfiguracoes();

await garantirTabelasJogos();


/* =========================
   FUNÇÕES AUXILIARES
========================= */

function numero(
  valor,
  padrao = 0
) {
  const n =
    Number(valor);

  return Number.isFinite(n)
    ? n
    : padrao;
}


function arredondar(
  valor
) {
  return Math.round(
    (
      Number(valor) +
      Number.EPSILON
    ) * 100
  ) / 100;
}


function obterIp(
  req
) {
  return (
    req.headers[
      "x-forwarded-for"
    ]
      ?.split(",")[0]
      ?.trim() ||
    req.socket?.remoteAddress ||
    null
  );
}


function obterTokenAdmin(
  req
) {
  const cookies =
    req.headers.cookie ||
    "";

  const match =
    cookies.match(
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
    validarSessaoAdmin(
      token
    );

  if (!sessao) {
    return res
      .status(401)
      .json({
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

  const saldoBanco =
    numero(
      user.balance
    );

  /*
    Compatibilidade com contas antigas:

    Se a conta possui saldo no campo antigo
    "balance", mas os campos separados de
    bônus e dinheiro ainda estão zerados,
    usamos o saldo antigo como saldo em dinheiro.

    Isso evita que o sistema mostre R$ 0,00
    quando a conta possui saldo registrado.
  */

  let bonusFinal =
    bonus;

  let cashFinal =
    cash;

  if (
    bonusFinal <= 0 &&
    cashFinal <= 0 &&
    saldoBanco > 0
  ) {
    cashFinal =
      saldoBanco;
  }

  const reserved =
    numero(
      user.reserved_balance
    );

  const balance =
    arredondar(
      bonusFinal +
      cashFinal
    );

  return {
    id:
      user.id,

    username:
      user.username,

    balance,

    bonusBalance:
      arredondar(
        bonusFinal
      ),

    cashBalance:
      arredondar(
        cashFinal
      ),

    reservedBalance:
      arredondar(
        reserved
      ),

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
  async (
    req,
    res
  ) => {
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

      console.error(
        error
      );

      res
        .status(500)
        .json({
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
  async (
    req,
    res
  ) => {
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

      console.error(
        error
      );

      res
        .status(500)
        .json({
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
  async (
    req,
    res
  ) => {
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

      console.error(
        error
      );

      res
        .status(500)
        .json({
          message:
            "Erro ao carregar configurações."
        });
    }
  }
);


app.put(
  "/api/admin/settings",
  exigirAdmin,
  async (
    req,
    res
  ) => {
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
          req.headers[
            "user-agent"
          ] ||
          null
      });

      res.json({
        ok: true,
        message:
          "Configurações salvas com sucesso."
      });

    } catch (error) {

      console.error(
        error
      );

      res
        .status(500)
        .json({
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
  async (
    req,
    res
  ) => {
    try {

      const user =
        await obterUsuario(
          req.params.userId
        );

      if (!user) {
        return res
          .status(404)
          .json({
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

      console.error(
        error
      );

      res
        .status(500)
        .json({
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
  async (
    req,
    res
  ) => {

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
          numero(
            amount
          )
        );

      if (
        !userId ||
        !Number.isFinite(
          valor
        ) ||
        valor <= 0
      ) {
        return res
          .status(400)
          .json({
            message:
              "Informe um valor de depósito válido."
          });
      }

      const user =
        await obterUsuario(
          userId
        );

      if (!user) {
        return res
          .status(404)
          .json({
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

      res
        .status(201)
        .json({
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

      console.error(
        error
      );

      res
        .status(500)
        .json({
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
  async (
    req,
    res
  ) => {

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
          numero(
            amount
          )
        );

      if (
        !userId ||
        !Number.isFinite(
          valor
        ) ||
        valor <= 0
      ) {
        return res
          .status(400)
          .json({
            message:
              "Informe um valor de saque válido."
          });
      }

      const user =
        await obterUsuario(
          userId
        );

      if (!user) {
        return res
          .status(404)
          .json({
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
        return res
          .status(400)
          .json({
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
        return res
          .status(400)
          .json({
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

      res
        .status(201)
        .json({
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

      console.error(
        error
      );

      res
        .status(500)
        .json({
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
  async (
    req,
    res
  ) => {

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

      console.error(
        error
      );

      res
        .status(500)
        .json({
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
  async (
    req,
    res
  ) => {

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

      console.error(
        error
      );

      res
        .status(500)
        .json({
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
  async (
    req,
    res
  ) => {

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
        depositResult.rows.length ===
        0
      ) {

        await client.query(
          "ROLLBACK"
        );

        return res
          .status(404)
          .json({
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

        return res
          .status(400)
          .json({
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

      console.error(
        error
      );

      res
        .status(500)
        .json({
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
  async (
    req,
    res
  ) => {

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
        result.rows.length ===
        0
      ) {
        return res
          .status(404)
          .json({
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
        return res
          .status(400)
          .json({
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

      console.error(
        error
      );

      res
        .status(500)
        .json({
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
  async (
    req,
    res
  ) => {

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
        result.rows.length ===
        0
      ) {

        await client.query(
          "ROLLBACK"
        );

        return res
          .status(404)
          .json({
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

        return res
          .status(400)
          .json({
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

        return res
          .status(400)
          .json({
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

      console.error(
        error
      );

      res
        .status(500)
        .json({
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
  async (
    req,
    res
  ) => {

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
        result.rows.length ===
        0
      ) {

        await client.query(
          "ROLLBACK"
        );

        return res
          .status(404)
          .json({
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

        return res
          .status(400)
          .json({
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

      console.error(
        error
      );

      res
        .status(500)
        .json({
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
  async (
    req,
    res
  ) => {

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
        result.rows.length ===
        0
      ) {

        return res
          .status(404)
          .json({
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

        return res
          .status(400)
          .json({
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

      console.error(
        error
      );

      res
        .status(500)
        .json({
          message:
            "Erro ao concluir saque."
        });
    }
  }
);


/* =========================================================
   ROLETA DA SORTE — 10 SETORES
========================================================= */

const ROLETA_SORTE_PADRAO = [
  {
    index: 0,
    label: "2×",
    type: "prize",
    multiplier: 2,
    probability: 9
  },

  {
    index: 1,
    label: "X",
    type: "zero",
    multiplier: 0,
    probability: 15.7
  },

  {
    index: 2,
    label: "3×",
    type: "prize",
    multiplier: 3,
    probability: 5
  },

  {
    index: 3,
    label: "X",
    type: "zero",
    multiplier: 0,
    probability: 15.7
  },

  {
    index: 4,
    label: "4×",
    type: "prize",
    multiplier: 4,
    probability: 3
  },

  {
    index: 5,
    label: "X",
    type: "zero",
    multiplier: 0,
    probability: 15.7
  },

  {
    index: 6,
    label: "🍀",
    type: "sorte",
    multiplier: 0,
    probability: 3.5
  },

  {
    index: 7,
    label: "X",
    type: "zero",
    multiplier: 0,
    probability: 15.7
  },

  {
    index: 8,
    label: "5×",
    type: "prize",
    multiplier: 5,
    probability: 1
  },

  {
    index: 9,
    label: "X",
    type: "zero",
    multiplier: 0,
    probability: 15.7
  }
];


/* =========================================================
   VALIDAÇÃO DOS 10 SETORES
========================================================= */

function validarSegmentosRoleta(
  segmentos
) {

  if (
    !Array.isArray(
      segmentos
    ) ||
    segmentos.length !== 10
  ) {
    throw new Error(
      "A Roleta da Sorte precisa ter exatamente 10 setores."
    );
  }

  let totalProbabilidade =
    0;

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
            `Tipo inválido no setor ${index + 1}.`
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
            `Probabilidade inválida no setor ${index + 1}.`
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
              `O multiplicador do setor ${index + 1} deve estar entre 2× e 100×.`
            );
          }

        } else {

          multiplier =
            0;
        }

        totalProbabilidade +=
          probability;

        return {

          index,

          label:
            segmento.label ||
            (
              tipo === "zero"
                ? "X"
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


/* =========================================================
   CARREGAR CONFIGURAÇÃO DA ROLETA
========================================================= */

async function carregarSegmentosRoleta() {

  const configuracao =
    await obterConfiguracao(
      "roulette_segments_json",
      null
    );


  if (!configuracao) {

    return ROLETA_SORTE_PADRAO.map(
      segmento => ({
        ...segmento
      })
    );
  }


  try {

    const segmentos =
      JSON.parse(
        configuracao
      );

    const validos =
      validarSegmentosRoleta(
        segmentos
      );


    return validos.map(
      (
        segmento,
        index
      ) => ({
        ...segmento,
        index
      })
    );

  } catch (error) {

    console.error(
      "Erro na configuração da roleta:",
      error
    );

    return ROLETA_SORTE_PADRAO.map(
      segmento => ({
        ...segmento
      })
    );
  }
}


/* =========================================================
   SORTEIO DA ROLETA
========================================================= */

function sortearResultadoRoleta(
  segmentos
) {

  const aleatorio =
    crypto.randomInt(
      0,
      1000000
    ) / 10000;

  let acumulado =
    0;


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


/* =========================================================
   ROLETA — GIRO
========================================================= */

app.post(
  "/api/roulette/spin",
  async (
    req,
    res
  ) => {

    const client =
      await pool.connect();


    try {

      const userId =
        req.body?.userId;

      const betInformada =
        req.body?.betAmount ??
        req.body?.bet;

      const freeSpin =
        Boolean(
          req.body?.freeSpin
        );


      const valorAposta =
        arredondar(
          numero(
            betInformada
          )
        );


      /*
        =====================================================
        LIMITES DA ROLETA
        =====================================================

        Se as configurações antigas estiverem gravadas
        como 0, 0 ou valores inválidos, usamos automaticamente:

        MÍNIMO = R$ 0,50
        MÁXIMO = R$ 100,00

        Isso impede que uma configuração antiga de R$ 0,00
        bloqueie a roleta.
      */

      const configuracaoMinima =
        await obterConfiguracao(
          "roulette_popular_min_bet",
          null
        );

      const configuracaoMaxima =
        await obterConfiguracao(
          "roulette_popular_max_bet",
          null
        );


      let minimoFinal =
        Number(
          configuracaoMinima
        );

      let maximoFinal =
        Number(
          configuracaoMaxima
        );


      /*
        Se a configuração específica não existir
        ou estiver zerada/inválida, tenta a configuração
        antiga da roleta.
      */

      if (
        !Number.isFinite(
          minimoFinal
        ) ||
        minimoFinal <= 0
      ) {

        minimoFinal =
          Number(
            await obterConfiguracao(
              "roulette_min_bet",
              "0.50"
            )
          );
      }


      if (
        !Number.isFinite(
          maximoFinal
        ) ||
        maximoFinal <= 0
      ) {

        maximoFinal =
          Number(
            await obterConfiguracao(
              "roulette_max_bet",
              "100"
            )
          );
      }


      /*
        Última proteção.

        Nunca permitir que a roleta fique com
        mínimo ou máximo iguais a zero.
      */

      if (
        !Number.isFinite(
          minimoFinal
        ) ||
        minimoFinal <= 0
      ) {

        minimoFinal =
          0.50;
      }


      if (
        !Number.isFinite(
          maximoFinal
        ) ||
        maximoFinal <= 0
      ) {

        maximoFinal =
          100;
      }


      /*
        Se por alguma configuração antiga o máximo
        ficar abaixo do mínimo, corrigimos automaticamente.
      */

      if (
        maximoFinal <
        minimoFinal
      ) {

        maximoFinal =
          100;

        if (
          maximoFinal <
          minimoFinal
        ) {

          minimoFinal =
            0.50;
        }
      }


      minimoFinal =
        arredondar(
          minimoFinal
        );

      maximoFinal =
        arredondar(
          maximoFinal
        );


      if (
        !userId ||
        !Number.isFinite(
          valorAposta
        ) ||
        valorAposta <
          minimoFinal ||
        valorAposta >
          maximoFinal
      ) {

        return res
          .status(400)
          .json({

            message:
              `A aposta deve estar entre R$ ${minimoFinal.toFixed(2).replace(".", ",")} e R$ ${maximoFinal.toFixed(2).replace(".", ",")}.`

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
        userResult.rows.length ===
        0
      ) {

        await client.query(
          "ROLLBACK"
        );

        return res
          .status(404)
          .json({
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

      if (
        freeSpin
      ) {

        if (
          freeSpins <= 0
        ) {

          await client.query(
            "ROLLBACK"
          );

          return res
            .status(400)
            .json({
              message:
                "Nenhum giro grátis disponível."
            });
        }


        if (
          freeSpinBet <= 0
        ) {

          freeSpinBet =
            valorAposta;
        }


        freeSpins -=
          1;
      }


      /* =========================
         GIRO PAGO
      ========================= */

      if (
        !freeSpin
      ) {

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

          return res
            .status(400)
            .json({
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
              /*
          =====================================================
          SORTEIO
          =====================================================
        */

        const segmentos =
          await carregarSegmentosRoleta();

        const resultado =
          sortearResultadoRoleta(
            segmentos
          );


        /*
          A aposta usada para cálculo do prêmio é:
          - aposta normal: valorAposta
          - giro grátis: valor configurado do giro grátis
        */

        const apostaBase =
          freeSpin
            ? (
                freeSpinBet > 0
                  ? freeSpinBet
                  : valorAposta
              )
            : valorAposta;


        let premio =
          0;


        /*
          SETOR DE PRÊMIO
        */

        if (
          resultado.type ===
          "prize"
        ) {

          premio =
            arredondar(
              apostaBase *
              numero(
                resultado.multiplier
              )
            );

          cash =
            arredondar(
              cash +
              premio
            );
        }


        /*
          🍀 GIRO GRÁTIS
        */

        if (
          resultado.type ===
          "sorte"
        ) {

          freeSpins +=
            1;

          freeSpinBet =
            arredondar(
              apostaBase
            );
        }


        /*
          =====================================================
          SALDO FINAL
          =====================================================

          O saldo exibido pelo jogador precisa ser exatamente
          a soma do bônus + dinheiro real.
        */

        const saldoFinal =
          arredondar(
            bonus +
            cash
          );


        /*
          =====================================================
          ATUALIZAÇÃO DEFINITIVA DO USUÁRIO
          =====================================================
        */

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
            saldoFinal,
            bonus,
            cash,
            freeSpins,
            freeSpinBet,
            userId
          ]
        );


        /*
          =====================================================
          REGISTRO DO GIRO
          =====================================================
        */

        await client.query(
          `
          INSERT INTO roulette_spins (
            user_id,
            bet_amount,
            result_index,
            result_label,
            multiplier,
            prize_amount,
            free_spin,
            created_at
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            CURRENT_TIMESTAMP
          )
          `,
          [
            userId,
            apostaBase,
            resultado.index,
            resultado.label,
            numero(
              resultado.multiplier
            ),
            premio,
            freeSpin
          ]
        );


        await client.query(
          "COMMIT"
        );


        /*
          =====================================================
          USUÁRIO ATUALIZADO
          =====================================================
        */

        const userAtualizado =
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
            `,
            [
              userId
            ]
          );


        const usuarioFinal =
          userAtualizado.rows[0];


        res.json({

          ok: true,

          result: {

            index:
              resultado.index,

            segmentIndex:
              resultado.index,

            label:
              resultado.label,

            type:
              resultado.type,

            multiplier:
              numero(
                resultado.multiplier
              ),

            prize:
              premio,

            bet:
              apostaBase,

            freeSpin

          },

          user:
            montarDadosUsuario(
              usuarioFinal
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

      res
        .status(500)
        .json({
          message:
            error.message ||
            "Erro ao girar a roleta."
        });

    } finally {

      client.release();

    }
  }
);


/* =========================================================
   CONFIGURAÇÕES PÚBLICAS
========================================================= */

app.get(
  "/api/settings",
  async (
    req,
    res
  ) => {

    try {

      const result =
        await pool.query(
          `
          SELECT
            key,
            value
          FROM settings
          ORDER BY key
          `
        );


      const settings = {};

      for (
        const row of result.rows
      ) {

        settings[
          row.key
        ] =
          row.value;
      }


      res.json({
        ok: true,
        settings
      });

    } catch (error) {

      console.error(
        error
      );

      res
        .status(500)
        .json({
          message:
            "Erro ao carregar configurações."
        });
    }
  }
);


/* =========================================================
   ADMIN — CONFIGURAÇÕES
========================================================= */

app.get(
  "/api/admin/settings",
  exigirAdmin,
  async (
    req,
    res
  ) => {

    try {

      const result =
        await pool.query(
          `
          SELECT
            key,
            value
          FROM settings
          ORDER BY key
          `
        );


      const settings = {};

      for (
        const row of result.rows
      ) {

        settings[
          row.key
        ] =
          row.value;
      }


      res.json({
        ok: true,
        settings
      });

    } catch (error) {

      console.error(
        error
      );

      res
        .status(500)
        .json({
          message:
            "Erro ao carregar configurações."
        });
    }
  }
);


app.post(
  "/api/admin/settings",
  exigirAdmin,
  async (
    req,
    res
  ) => {

    try {

      const settings =
        req.body?.settings ||
        req.body ||
        {};


      for (
        const [
          key,
          value
        ] of Object.entries(
          settings
        )
      ) {

        await pool.query(
          `
          INSERT INTO settings (
            key,
            value
          )
          VALUES (
            $1,
            $2
          )
          ON CONFLICT (key)
          DO UPDATE SET
            value = EXCLUDED.value
          `,
          [
            key,
            String(
              value
            )
          ]
        );
      }


      res.json({
        ok: true
      });

    } catch (error) {

      console.error(
        error
      );

      res
        .status(500)
        .json({
          message:
            "Erro ao salvar configurações."
        });
    }
  }
);


/* =========================================================
   FALLBACK FRONTEND
========================================================= */

app.get(
  "*",
  (
    req,
    res
  ) => {

    if (
      req.path.startsWith(
        "/api/"
      )
    ) {

      return res
        .status(404)
        .json({
          message:
            "Rota não encontrada."
        });
    }


    res.sendFile(
      path.join(
        FRONTEND_DIR,
        "index.html"
      )
    );
  }
);


/* =========================================================
   INICIAR SERVIDOR
========================================================= */

const PORT =
  process.env.PORT ||
  10000;


app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `MyBets rodando na porta ${PORT}`
    );

  }
);
