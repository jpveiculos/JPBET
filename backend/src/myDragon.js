import express from "express";
import { randomInt } from "crypto";
import { pool } from "./db.js";

const router = express.Router();

/*
=========================================================
 MY DRAGON
 Jogo 5x3
 Integrado ao saldo verdadeiro/fictício do MyBets
=========================================================
*/

const SYMBOLS = [
  {
    id: "dragon",
    label: "🐉",
    multiplier: 50
  },
  {
    id: "diamond",
    label: "💎",
    multiplier: 20
  },
  {
    id: "crown",
    label: "👑",
    multiplier: 15
  },
  {
    id: "coin",
    label: "🪙",
    multiplier: 10
  },
  {
    id: "fire",
    label: "🔥",
    multiplier: 8
  },
  {
    id: "trophy",
    label: "🏆",
    multiplier: 6
  },
  {
    id: "clover",
    label: "🍀",
    multiplier: 5
  },
  {
    id: "seven",
    label: "7️⃣",
    multiplier: 25
  }
];

const MIN_BET = 1.00;


/* =====================================================
   UTILITÁRIOS
===================================================== */

function numero(valor, fallback = 0) {
  const n = Number(valor);

  return Number.isFinite(n)
    ? n
    : fallback;
}


function dinheiro(valor) {
  return Number(
    numero(valor).toFixed(2)
  );
}


/*
=========================================================
 SORTEIO SEGURO NO SERVIDOR
=========================================================
*/

function sortearSimbolo() {
  const index =
    randomInt(SYMBOLS.length);

  return SYMBOLS[index];
}


function sortearGrade() {
  const grade = [];

  for (let i = 0; i < 15; i++) {
    grade.push(sortearSimbolo());
  }

  return grade;
}


/*
=========================================================
 CALCULA PRÊMIO
=========================================================
*/

function calcularPremio(grade, aposta) {

  const contagem = {};

  for (const simbolo of grade) {

    contagem[simbolo.id] =
      (contagem[simbolo.id] || 0) + 1;

  }

  let melhorPremio = 0;
  let simboloVencedor = null;
  let quantidade = 0;
  let multiplicador = 0;

  for (const simbolo of SYMBOLS) {

    const quantidadeAtual =
      contagem[simbolo.id] || 0;

    if (quantidadeAtual >= 3) {

      const premio =
        dinheiro(
          aposta * simbolo.multiplier
        );

      if (premio > melhorPremio) {

        melhorPremio = premio;
        simboloVencedor = simbolo;
        quantidade = quantidadeAtual;
        multiplicador = simbolo.multiplier;

      }

    }

  }

  return {
    won: melhorPremio > 0,
    prize: melhorPremio,
    symbol: simboloVencedor
      ? simboloVencedor.id
      : null,
    label: simboloVencedor
      ? simboloVencedor.label
      : null,
    count: quantidade,
    multiplier: multiplicador
  };
}


/*
=========================================================
 CONFIGURAÇÃO
=========================================================
*/

router.get(
  "/config",
  async (_req, res) => {

    return res.json({
      ok: true,

      game: {
        id: "my-dragon",
        name: "My Dragon",
        type: "SLOT",

        rows: 3,
        columns: 5,

        minBet: MIN_BET,

        symbols: SYMBOLS.map(
          simbolo => ({
            id: simbolo.id,
            label: simbolo.label,
            multiplier: simbolo.multiplier
          })
        )
      }
    });

  }
);


/*
=========================================================
 GIRO
=========================================================
*/

router.post(
  "/spin",
  async (req, res) => {

    const client =
      await pool.connect();

    try {

      const userId =
        Number(req.body?.userId);

      const betAmount =
        Number(req.body?.betAmount);


      /*
      -----------------------------
      VALIDA USUÁRIO
      -----------------------------
      */

      if (
        !Number.isInteger(userId) ||
        userId <= 0
      ) {

        return res.status(400).json({
          ok: false,
          message: "Usuário inválido."
        });

      }


      /*
      -----------------------------
      VALIDA APOSTA
      -----------------------------
      */

      if (
        !Number.isFinite(betAmount) ||
        betAmount < MIN_BET
      ) {

        return res.status(400).json({
          ok: false,
          message:
            "A aposta mínima é R$ 1,00."
        });

      }


      const bet =
        dinheiro(betAmount);


      /*
      -----------------------------
      INICIA TRANSAÇÃO
      -----------------------------
      */

      await client.query("BEGIN");


      /*
      -----------------------------
      BLOQUEIA O USUÁRIO
      -----------------------------
      */

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
            bonus_wager_progress
          FROM users
          WHERE id = $1
          FOR UPDATE
          `,
          [userId]
        );


      if (!userResult.rows.length) {

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


      /*
      -----------------------------
      SALDOS
      -----------------------------
      */

      const bonus =
        Math.max(
          0,
          numero(user.bonus_balance)
        );

      const cash =
        Math.max(
          0,
          numero(user.cash_balance)
        );

      const reserved =
        Math.max(
          0,
          numero(user.reserved_balance)
        );


      /*
      O saldo mostrado ao jogador é o
      balance. O jogo trabalha somente
      com o saldo disponível existente
      em bônus + saldo em dinheiro.
      */

      const available =
        dinheiro(
          bonus + cash
        );


      if (available < bet) {

        await client.query(
          "ROLLBACK"
        );

        return res.status(400).json({
          ok: false,
          message:
            "Saldo disponível insuficiente.",
          balance:
            dinheiro(user.balance),
          reservedBalance:
            dinheiro(reserved)
        });

      }


      /*
      -----------------------------
      SORTEIO
      -----------------------------
      */

      const grade =
        sortearGrade();


      /*
      -----------------------------
      CALCULA RESULTADO
      -----------------------------
      */

      const resultado =
        calcularPremio(
          grade,
          bet
        );


      const prize =
        dinheiro(resultado.prize);


      const netResult =
        dinheiro(
          prize - bet
        );


      /*
      -----------------------------
      CONSUMO DO BÔNUS
      -----------------------------
      */

      const bonusUsed =
        Math.min(
          bonus,
          bet
        );


      const cashUsed =
        dinheiro(
          bet - bonusUsed
        );


      const newBonus =
        dinheiro(
          bonus - bonusUsed
        );


      /*
      -----------------------------
      NOVO CASH
      -----------------------------
      */

      const newCash =
        dinheiro(
          cash -
          cashUsed +
          prize
        );


      /*
      -----------------------------
      NOVO SALDO
      -----------------------------
      */

      const newBalance =
        dinheiro(
          newBonus +
          newCash
        );


      /*
      -----------------------------
      PROGRESSO DO BÔNUS
      -----------------------------
      */

      let requirement = 100;

      try {

        const setting =
          await client.query(
            `
            SELECT setting_value
            FROM site_settings
            WHERE setting_key = $1
            LIMIT 1
            `,
            ["bonus_wager_requirement"]
          );

        if (
          setting.rows.length
        ) {

          const configured =
            Number(
              setting.rows[0]
                .setting_value
            );

          if (
            Number.isFinite(configured) &&
            configured > 0
          ) {

            requirement =
              configured;

          }

        }

      } catch (_) {
        requirement = 100;
      }


      const oldProgress =
        numero(
          user.bonus_wager_progress
        );


      const newProgress =
        dinheiro(
          Math.min(
            requirement,
            oldProgress + bonusUsed
          )
        );


      /*
      -----------------------------
      ATUALIZA USUÁRIO
      -----------------------------
      */

      await client.query(
        `
        UPDATE users
        SET
          balance = $1,
          bonus_balance = $2,
          cash_balance = $3,
          bonus_wager_progress = $4,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $5
        `,
        [
          newBalance,
          newBonus,
          newCash,
          newProgress,
          userId
        ]
      );


      /*
      -----------------------------
      TEXTO DO RESULTADO
      -----------------------------
      */

      const resultText =
        resultado.won

          ? `my-dragon:${resultado.symbol}:${resultado.multiplier}x:${resultado.count}`

          : "my-dragon:PERCA";


      /*
      -----------------------------
      HISTÓRICO DE GIROS
      -----------------------------
      */

      const spinResult =
        await client.query(
          `
          INSERT INTO spins
          (
            user_id,
            result,
            amount
          )
          VALUES
          ($1, $2, $3)
          RETURNING id, created_at
          `,
          [
            userId,
            resultText,
            netResult
          ]
        );


      /*
      -----------------------------
      TRANSAÇÃO
      -----------------------------
      */

      await client.query(
        `
        INSERT INTO transactions
        (
          user_id,
          type,
          amount
        )
        VALUES
        ($1, $2, $3)
        `,
        [
          userId,
          resultado.won
            ? "my_dragon_prize_win"
            : "my_dragon_bet",

          resultado.won
            ? netResult
            : -bet
        ]
      );


      /*
      -----------------------------
      CONFIRMA
      -----------------------------
      */

      await client.query(
        "COMMIT"
      );


      /*
      -----------------------------
      RESPOSTA
      -----------------------------
      */

      return res.json({

        ok: true,

        spin: {

          id:
            spinResult.rows[0].id,

          gameId:
            "my-dragon",

          grid:
            grade.map(
              simbolo => ({
                id: simbolo.id,
                label: simbolo.label
              })
            ),

          won:
            resultado.won,

          prize:
            prize,

          netResult:
            netResult,

          multiplier:
            resultado.multiplier,

          winningSymbol:
            resultado.symbol,

          winningLabel:
            resultado.label,

          winningCount:
            resultado.count,

          betAmount:
            bet

        },

        user: {

          id:
            user.id,

          username:
            user.username,

          balance:
            newBalance,

          bonusBalance:
            newBonus,

          cashBalance:
            newCash,

          reservedBalance:
            reserved,

          bonusWagerProgress:
            newProgress,

          bonusWagerRequirement:
            requirement

        }

      });

    } catch (error) {

      try {
        await client.query(
          "ROLLBACK"
        );
      } catch (_) {}

      console.error(
        "Erro no My Dragon:",
        error
      );

      return res.status(500).json({
        ok: false,
        message:
          "Erro interno ao executar o My Dragon."
      });

    } finally {

      client.release();

    }

  }
);


export default router;
