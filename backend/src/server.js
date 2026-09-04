import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import authRouter from "./auth.js";
import settingsRouter from "./settings.js";
import { pool } from "./db.js";
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
/* =========================
   API DE AUTENTICAÇÃO
========================= */
app.use("/api/auth", authRouter);
/* =========================
   API DE CONFIGURAÇÕES
========================= */
app.use("/api/settings", settingsRouter);
/* =========================
   API DA ROLETA
   CRÉDITOS VIRTUAIS
========================= */
app.post("/api/roulette/spin", async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      userId,
      betAmount,
      betType,
      betValue
    } = req.body;
    /* =========================
       VALIDAÇÃO BÁSICA
    ========================= */
    const userIdNumber = Number(userId);
    const bet = Number(betAmount);
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
    /* =========================
       BUSCAR CONFIGURAÇÕES
    ========================= */
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
      settings[row.setting_key] = row.setting_value;
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
    /* =========================
       VALIDAR TIPO DE APOSTA
    ========================= */
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
    /* =========================
       INICIAR TRANSAÇÃO
    ========================= */
    await client.query("BEGIN");
    const userResult = await client.query(
      `
      SELECT id, username, balance
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
      Number(user.balance);
    if (saldoAtual < bet) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        ok: false,
        message:
          "Saldo insuficiente.",
        balance: saldoAtual
      });
    }
    /* =========================
       SORTEIO DA ROLETA
    ========================= */
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
    /* =========================
       CALCULAR PRÊMIO
    ========================= */
    let ganhou = false;
    let premio = 0;
    if (betType === "number") {
      if (numero === numeroApostado) {
        ganhou = true;
        // Pagamento 35:1 + devolução da aposta
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
        // Pagamento 1:1 + devolução da aposta
        premio = bet * 2;
      }
    }
    /* =========================
       ATUALIZAR SALDO
    ========================= */
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
    /* =========================
       REGISTRAR RODADA
    ========================= */
    const resultadoTexto =
      `${numero}:${cor}:${betType}`;
    const spinResult =
      await client.query(
        `
        INSERT INTO spins
        (user_id, result, amount)
        VALUES ($1, $2, $3)
        RETURNING id, created_at
        `,
        [
          userIdNumber,
          resultadoTexto,
          premio
        ]
      );
    /* =========================
       REGISTRAR TRANSAÇÃO
    ========================= */
    await client.query(
      `
      INSERT INTO transactions
      (user_id, type, amount)
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
    /* =========================
       RESPOSTA
    ========================= */
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
          Number(novoSaldo)
      }
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {
      // Ignorar erro do rollback
    }
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
/* =========================
   SERVIDOR
========================= */
const PORT =
  Number(
    process.env.PORT || 3000
  );
app.listen(PORT, () => {
  console.log(
    `JPBET rodando na porta ${PORT}`
  );
});
