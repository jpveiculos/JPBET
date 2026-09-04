import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import authRouter from "./auth.js";
import settingsRouter from "./settings.js";
import { pool } from "./db.js";
import { validarSessaoAdmin } from "./adminSession.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendPath = path.join(__dirname, "../frontend");

app.use(express.static(frontendPath));

app.get("/", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

/* =========================================================
   AUXILIARES
========================================================= */

function obterCookie(req, nome) {
  const cookies = String(req.headers.cookie || "")
    .split(";")
    .map(item => item.trim());

  const cookie = cookies.find(item =>
    item.startsWith(`${nome}=`)
  );

  if (!cookie) return null;

  return decodeURIComponent(
    cookie.substring(nome.length + 1)
  );
}

function exigirAdmin(req, res, next) {
  const token = obterCookie(
    req,
    "jpbet_admin_session"
  );

  const sessao = validarSessaoAdmin(token);

  if (!sessao) {
    return res.status(401).json({
      ok: false,
      message: "Sessão administrativa inválida ou expirada."
    });
  }

  req.admin = sessao;

  next();
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
  const adminResult = await client.query(
    `
    SELECT id
    FROM admins
    WHERE username = $1
    LIMIT 1
    `,
    [adminUsername]
  );

  const adminId =
    adminResult.rows.length > 0
      ? adminResult.rows[0].id
      : null;

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
    VALUES ($1, $2, $3, $4, $5, $6)
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

app.use("/api/auth", authRouter);

/* =========================================================
   API DE CONFIGURAÇÕES
========================================================= */

app.use("/api/settings", settingsRouter);

/* =========================================================
   API DA ROLETA
   CRÉDITOS VIRTUAIS
========================================================= */

app.post("/api/roulette/spin", async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      userId,
      betAmount,
      betType,
      betValue
    } = req.body;

    const userIdNumber = Number(userId);
    const bet = Number(betAmount);

    /* =====================================================
       VALIDAÇÃO
    ===================================================== */

    if (
      !Number.isInteger(userIdNumber) ||
      userIdNumber <= 0
    ) {
      return res.status(400).json({
        ok: false,
        message: "Usuário inválido."
      });
    }

    if (
      !Number.isFinite(bet) ||
      bet <= 0
    ) {
      return res.status(400).json({
        ok: false,
        message: "Valor da aposta inválido."
      });
    }

    /* =====================================================
       CONFIGURAÇÕES
    ===================================================== */

    const settingsResult = await pool.query(`
      SELECT setting_key, setting_value
      FROM site_settings
      WHERE setting_key IN (
        'roulette_enabled',
        'roulette_min_bet',
        'roulette_max_bet',
        'virtual_credits_mode'
      )
    `);

    const settings = {};

    for (const row of settingsResult.rows) {
      settings[row.setting_key] =
        row.setting_value;
    }

    const rouletteEnabled =
      String(
        settings.roulette_enabled
      ).toLowerCase() !== "false";

    const virtualCreditsMode =
      String(
        settings.virtual_credits_mode
      ).toLowerCase() !== "false";

    const minBet =
      Number(
        settings.roulette_min_bet || 1
      );

    const maxBet =
      Number(
        settings.roulette_max_bet || 100
      );

    if (!rouletteEnabled) {
      return res.status(403).json({
        ok: false,
        message: "A roleta está desativada."
      });
    }

    if (!virtualCreditsMode) {
      return res.status(403).json({
        ok: false,
        message:
          "A roleta está configurada apenas para créditos virtuais."
      });
    }

    if (
      bet < minBet ||
      bet > maxBet
    ) {
      return res.status(400).json({
        ok: false,
        message:
          `A aposta deve estar entre ${minBet} e ${maxBet} créditos.`
      });
    }

    /* =====================================================
       TIPO DE APOSTA
    ===================================================== */

    const tiposPermitidos = [
      "red",
      "black",
      "number"
    ];

    if (
      !tiposPermitidos.includes(betType)
    ) {
      return res.status(400).json({
        ok: false,
        message:
          "Tipo de aposta inválido."
      });
    }

    let numeroApostado = null;

    if (betType === "number") {
      numeroApostado = Number(betValue);

      if (
        !Number.isInteger(numeroApostado) ||
        numeroApostado < 0 ||
        numeroApostado > 36
      ) {
        return res.status(400).json({
          ok: false,
          message:
            "Número da roleta inválido."
        });
      }
    }

    /* =====================================================
       TRANSAÇÃO
    ===================================================== */

    await client.query("BEGIN");

    const userResult = await client.query(
      `
      SELECT
        id,
        username,
        balance,
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
      await client.query("ROLLBACK");

      return res.status(404).json({
        ok: false,
        message:
          "Usuário não encontrado."
      });
    }

    const user =
      userResult.rows[0];

    const saldoAtual =
      Number(user.balance || 0);

    const saldoReservado =
      Number(user.reserved_balance || 0);

    /*
      Apenas o saldo disponível pode ser utilizado.
    */

    if (saldoAtual < bet) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        ok: false,
        message:
          "Saldo disponível insuficiente.",
        balance: saldoAtual,
        reservedBalance: saldoReservado
      });
    }

    /* =====================================================
       SORTEIO
    ===================================================== */

    const numero =
      Math.floor(Math.random() * 37);

    let cor = "green";

    if (numero !== 0) {
      const numerosVermelhos = [
        1, 3, 5, 7, 9,
        12, 14, 16, 18,
        19, 21, 23, 25,
        27, 30, 32, 34, 36
      ];

      cor =
        numerosVermelhos.includes(numero)
          ? "red"
          : "black";
    }

    /* =====================================================
       PRÊMIO
    ===================================================== */

    let ganhou = false;
    let premio = 0;

    if (betType === "number") {
      if (numero === numeroApostado) {
        ganhou = true;

        // 35:1 + devolução da aposta
        premio = bet * 36;
      }
    }

    if (
      betType === "red" ||
      betType === "black"
    ) {
      if (
        numero !== 0 &&
        cor === betType
      ) {
        ganhou = true;

        // 1:1 + devolução da aposta
        premio = bet * 2;
      }
    }

    /* =====================================================
       ATUALIZAR SALDO
    ===================================================== */

    const novoSaldo =
      saldoAtual - bet + premio;

    await client.query(
      `
      UPDATE users
      SET balance = $1
      WHERE id = $2
      `,
      [
        novoSaldo,
        userIdNumber
      ]
    );

    /* =====================================================
       REGISTRAR GIRO
    ===================================================== */

    const resultadoTexto =
      `${numero}:${cor}:${betType}`;

    const spinResult =
      await client.query(
        `
        INSERT INTO spins
        (
          user_id,
          result,
          amount
        )
        VALUES ($1, $2, $3)
        RETURNING id, created_at
        `,
        [
          userIdNumber,
          resultadoTexto,
          premio
        ]
      );

    /* =====================================================
       REGISTRAR TRANSAÇÃO
    ===================================================== */

    await client.query(
      `
      INSERT INTO transactions
      (
        user_id,
        type,
        amount
      )
      VALUES ($1, $2, $3)
      `,
      [
        userIdNumber,
        ganhou
          ? "roulette_win"
          : "roulette_bet",
        ganhou
          ? premio
          : -bet
      ]
    );

    await client.query("COMMIT");

    return res.json({
      ok: true,

      spin: {
        id:
          spinResult.rows[0].id,
        number: numero,
        color: cor,
        betType,
        betAmount: bet,
        won: ganhou,
        prize: premio
      },

      user: {
        id: user.id,
        username:
          user.username,
        balance:
          Number(novoSaldo),
        reservedBalance:
          saldoReservado
      }
    });

  } catch (error) {

    try {
      await client.query("ROLLBACK");
    } catch (_) {}

    console.error(
      "Erro na roleta:",
      error
    );

    return res.status(500).json({
      ok: false,
      message:
        "Erro interno ao executar a roleta."
    });

  } finally {
    client.release();
  }
});

/* =========================================================
   API FINANCEIRA DO JOGADOR
========================================================= */

/*
   CONSULTAR SALDO
*/

app.get(
  "/api/account/:userId",
  async (req, res) => {

    try {

      const userId =
        Number(req.params.userId);

      if (
        !Number.isInteger(userId) ||
        userId <= 0
      ) {
        return res.status(400).json({
          ok: false,
          message: "Usuário inválido."
        });
      }

      const result =
        await pool.query(
          `
          SELECT
            id,
            username,
            balance,
            reserved_balance,
            (
              balance + reserved_balance
            ) AS total_balance,
            created_at
          FROM users
          WHERE id = $1
          `,
          [userId]
        );

      if (result.rows.length === 0) {
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
          id: user.id,
          username: user.username,
          balance:
            Number(user.balance || 0),
          reservedBalance:
            Number(user.reserved_balance || 0),
          totalBalance:
            Number(user.total_balance || 0),
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
        !Number.isInteger(userIdNumber) ||
        userIdNumber <= 0
      ) {
        return res.status(400).json({
          ok: false,
          message: "Usuário inválido."
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

      return res.status(201).json({
        ok: true,
        message:
          "Solicitação de depósito criada e enviada para análise.",
        deposit:
          result.rows[0]
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
        !Number.isInteger(userIdNumber) ||
        userIdNumber <= 0
      ) {
        return res.status(400).json({
          ok: false,
          message: "Usuário inválido."
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

      if (
        !pixKey ||
        String(pixKey).trim().length === 0
      ) {
        return res.status(400).json({
          ok: false,
          message:
            "Informe a chave Pix."
        });
      }

      await client.query("BEGIN");

      /*
        Bloqueia o usuário durante a operação
        para impedir dois saques simultâneos.
      */

      const userResult =
        await client.query(
          `
          SELECT
            id,
            username,
            balance,
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
        await client.query("ROLLBACK");

        return res.status(404).json({
          ok: false,
          message:
            "Usuário não encontrado."
        });
      }

      const user =
        userResult.rows[0];

      const saldoDisponivel =
        Number(user.balance || 0);

      const saldoReservado =
        Number(user.reserved_balance || 0);

      /*
        O valor precisa sair do saldo disponível
        e entrar no saldo reservado.
      */

      if (
        saldoDisponivel < valor
      ) {
        await client.query("ROLLBACK");

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

      const novoSaldo =
        saldoDisponivel - valor;

      const novaReserva =
        saldoReservado + valor;

      await client.query(
        `
        UPDATE users
        SET
          balance = $1,
          reserved_balance = $2
        WHERE id = $3
        `,
        [
          novoSaldo,
          novaReserva,
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
            pix_key,
            created_at
          `,
          [
            userIdNumber,
            valor,
            String(pixKey).trim(),
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
        ($1, 'withdrawal_reserved', $2)
        `,
        [
          userIdNumber,
          -valor
        ]
      );

      await client.query("COMMIT");

      return res.status(201).json({
        ok: true,
        message:
          "Saque solicitado. O valor foi reservado e está aguardando análise.",
        withdrawal:
          withdrawalResult.rows[0],
        user: {
          id: user.id,
          username:
            user.username,
          balance:
            novoSaldo,
          reservedBalance:
            novaReserva,
          totalBalance:
            novoSaldo + novaReserva
        }
      });

    } catch (error) {

      try {
        await client.query("ROLLBACK");
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
   HISTÓRICO FINANCEIRO DO JOGADOR
========================================================= */

app.get(
  "/api/transactions/:userId",
  async (req, res) => {

    try {

      const userId =
        Number(req.params.userId);

      if (
        !Number.isInteger(userId) ||
        userId <= 0
      ) {
        return res.status(400).json({
          ok: false,
          message: "Usuário inválido."
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
          ORDER BY created_at DESC, id DESC
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
            w.approved_at,
            w.paid_at,
            w.rejected_at,
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
        Number(req.params.id);

      if (
        !Number.isInteger(withdrawalId) ||
        withdrawalId <= 0
      ) {
        return res.status(400).json({
          ok: false,
          message:
            "Saque inválido."
        });
      }

      await client.query("BEGIN");

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
        await client.query("ROLLBACK");

        return res.status(404).json({
          ok: false,
          message:
            "Saque não encontrado."
        });
      }

      const withdrawal =
        result.rows[0];

      if (
        withdrawal.status !== "pending"
      ) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          ok: false,
          message:
            `Este saque não está pendente. Status atual: ${withdrawal.status}.`
        });
      }

      const adminResult =
        await client.query(
          `
          SELECT id
          FROM admins
          WHERE username = $1
          LIMIT 1
          `,
          [req.admin.username]
        );

      const adminId =
        adminResult.rows.length
          ? adminResult.rows[0].id
          : null;

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
            Number(withdrawal.amount),
          userId:
            withdrawal.user_id
        }
      );

      await client.query("COMMIT");

      return res.json({
        ok: true,
        message:
          "Saque aprovado. O valor continua reservado até a baixa/conclusão do pagamento."
      });

    } catch (error) {

      try {
        await client.query("ROLLBACK");
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
   ADMIN - REJEITAR SAQUE E DEVOLVER AO SALDO
========================================================= */

app.post(
  "/api/admin/withdrawals/:id/reject",
  exigirAdmin,
  async (req, res) => {

    const client =
      await pool.connect();

    try {

      const withdrawalId =
        Number(req.params.id);

      const {
        reason
      } = req.body;

      if (
        !Number.isInteger(withdrawalId) ||
        withdrawalId <= 0
      ) {
        return res.status(400).json({
          ok: false,
          message:
            "Saque inválido."
        });
      }

      await client.query("BEGIN");

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
        await client.query("ROLLBACK");

        return res.status(404).json({
          ok: false,
          message:
            "Saque não encontrado."
        });
      }

      const withdrawal =
        withdrawalResult.rows[0];

      if (
        withdrawal.status !== "pending"
      ) {
        await client.query("ROLLBACK");

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
        await client.query("ROLLBACK");

        return res.status(404).json({
          ok: false,
          message:
            "Usuário do saque não encontrado."
        });
      }

      const user =
        userResult.rows[0];

      const valor =
        Number(withdrawal.amount);

      const saldoAtual =
        Number(user.balance || 0);

      const reservadoAtual =
        Number(user.reserved_balance || 0);

      if (
        reservadoAtual < valor
      ) {
        await client.query("ROLLBACK");

        return res.status(409).json({
          ok: false,
          message:
            "A reserva desse saque não possui saldo suficiente para devolução."
        });
      }

      const novoSaldo =
        saldoAtual + valor;

      const novaReserva =
        reservadoAtual - valor;

      const adminResult =
        await client.query(
          `
          SELECT id
          FROM admins
          WHERE username = $1
          LIMIT 1
          `,
          [req.admin.username]
        );

      const adminId =
        adminResult.rows.length
          ? adminResult.rows[0].id
          : null;

      await client.query(
        `
        UPDATE users
        SET
          balance = $1,
          reserved_balance = $2
        WHERE id = $3
        `,
        [
          novoSaldo,
          novaReserva,
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
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        `,
        [
          reason || "Saque rejeitado.",
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
        ($1, 'withdrawal_refunded', $2)
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
          amount: valor,
          userId:
            withdrawal.user_id,
          reason:
            reason || "Saque rejeitado."
        }
      );

      await client.query("COMMIT");

      return res.json({
        ok: true,
        message:
          "Saque rejeitado e valor devolvido ao saldo disponível.",
        user: {
          balance: novoSaldo,
          reservedBalance: novaReserva,
          totalBalance:
            novoSaldo + novaReserva
        }
      });

    } catch (error) {

      try {
        await client.query("ROLLBACK");
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
        Number(req.params.id);

      if (
        !Number.isInteger(withdrawalId) ||
        withdrawalId <= 0
      ) {
        return res.status(400).json({
          ok: false,
          message:
            "Saque inválido."
        });
      }

      await client.query("BEGIN");

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
        await client.query("ROLLBACK");

        return res.status(404).json({
          ok: false,
          message:
            "Saque não encontrado."
        });
      }

      const withdrawal =
        withdrawalResult.rows[0];

      if (
        withdrawal.status !== "approved"
      ) {
        await client.query("ROLLBACK");

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
        await client.query("ROLLBACK");

        return res.status(404).json({
          ok: false,
          message:
            "Usuário do saque não encontrado."
        });
      }

      const user =
        userResult.rows[0];

      const valor =
        Number(withdrawal.amount);

      const saldoAtual =
        Number(user.balance || 0);

      const reservadoAtual =
        Number(user.reserved_balance || 0);

      if (
        reservadoAtual < valor
      ) {
        await client.query("ROLLBACK");

        return res.status(409).json({
          ok: false,
          message:
            "O valor reservado não é suficiente para concluir este saque."
        });
      }

      /*
        Aqui ocorre a BAIXA definitiva.

        O valor já havia saído do saldo disponível
        quando o saque foi solicitado.

        Agora somente removemos a reserva.
      */

      const novaReserva =
        reservadoAtual - valor;

      const adminResult =
        await client.query(
          `
          SELECT id
          FROM admins
          WHERE username = $1
          LIMIT 1
          `,
          [req.admin.username]
        );

      const adminId =
        adminResult.rows.length
          ? adminResult.rows[0].id
          : null;

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
        ($1, 'withdrawal_paid', $2)
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
          amount: valor,
          userId:
            withdrawal.user_id
        }
      );

      await client.query("COMMIT");

      return res.json({
        ok: true,
        message:
          "Saque concluído. O valor reservado foi baixado.",
        user: {
          balance: saldoAtual,
          reservedBalance:
            novaReserva,
          totalBalance:
            saldoAtual + novaReserva
        }
      });

    } catch (error) {

      try {
        await client.query("ROLLBACK");
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
            d.approved_at,
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
        Number(req.params.id);

      if (
        !Number.isInteger(depositId) ||
        depositId <= 0
      ) {
        return res.status(400).json({
          ok: false,
          message:
            "Depósito inválido."
        });
      }

      await client.query("BEGIN");

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
        await client.query("ROLLBACK");

        return res.status(404).json({
          ok: false,
          message:
            "Depósito não encontrado."
        });
      }

      const deposit =
        depositResult.rows[0];

      if (
        deposit.status !== "pending"
      ) {
        await client.query("ROLLBACK");

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
        await client.query("ROLLBACK");

        return res.status(404).json({
          ok: false,
          message:
            "Usuário do depósito não encontrado."
        });
      }

      const user =
        userResult.rows[0];

      const saldoAtual =
        Number(user.balance || 0);

      const valor =
        Number(deposit.amount);

      const novoSaldo =
        saldoAtual + valor;

      const adminResult =
        await client.query(
          `
          SELECT id
          FROM admins
          WHERE username = $1
          LIMIT 1
          `,
          [req.admin.username]
        );

      const adminId =
        adminResult.rows.length
          ? adminResult.rows[0].id
          : null;

      await client.query(
        `
        UPDATE users
        SET balance = $1
        WHERE id = $2
        `,
        [
          novoSaldo,
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
        ($1, 'deposit_approved', $2)
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
          amount: valor,
          userId:
            deposit.user_id
        }
      );

      await client.query("COMMIT");

      return res.json({
        ok: true,
        message:
          "Depósito aprovado e saldo creditado.",
        balance:
          novoSaldo
      });

    } catch (error) {

      try {
        await client.query("ROLLBACK");
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
        Number(req.params.id);

      const {
        reason
      } = req.body;

      if (
        !Number.isInteger(depositId) ||
        depositId <= 0
      ) {
        return res.status(400).json({
          ok: false,
          message:
            "Depósito inválido."
        });
      }

      await client.query("BEGIN");

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
        await client.query("ROLLBACK");

        return res.status(404).json({
          ok: false,
          message:
            "Depósito não encontrado."
        });
      }

      const deposit =
        result.rows[0];

      if (
        deposit.status !== "pending"
      ) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          ok: false,
          message:
            `Este depósito não está pendente. Status atual: ${deposit.status}.`
        });
      }

      const adminResult =
        await client.query(
          `
          SELECT id
          FROM admins
          WHERE username = $1
          LIMIT 1
          `,
          [req.admin.username]
        );

      const adminId =
        adminResult.rows.length
          ? adminResult.rows[0].id
          : null;

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
          reason || "Depósito rejeitado.",
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
            Number(deposit.amount),
          userId:
            deposit.user_id,
          reason:
            reason || "Depósito rejeitado."
        }
      );

      await client.query("COMMIT");

      return res.json({
        ok: true,
        message:
          "Depósito rejeitado."
      });

    } catch (error) {

      try {
        await client.query("ROLLBACK");
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
            reserved_balance,
            (
              balance + reserved_balance
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

app.listen(PORT, () => {
  console.log(
    `JPBET rodando na porta ${PORT}`
  );
});
