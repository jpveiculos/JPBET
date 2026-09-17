import express from "express";
import { randomInt } from "crypto";
import { pool } from "./db.js";

const router = express.Router();

/*
 * =========================================================
 * ROLETA 90
 * =========================================================
 *
 * 90 setores no total
 * 9 setores de prêmio
 * 81 setores de perda
 *
 * Cada setor possui a mesma probabilidade:
 *
 * 1 / 90 = 1,111111%
 *
 * 9 prêmios:
 *
 * 9 / 90 = 10%
 */

const TOTAL_SECTORS = 90;

const LOSS_SECTORS = 81;

const DEFAULT_PRIZES = [
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10
];


/*
 * =========================================================
 * POSIÇÕES DOS PRÊMIOS
 * =========================================================
 *
 * Um prêmio a cada 10 setores.
 *
 * 0  = 2x
 * 10 = 3x
 * 20 = 4x
 * 30 = 5x
 * 40 = 6x
 * 50 = 7x
 * 60 = 8x
 * 70 = 9x
 * 80 = 10x
 *
 * Os demais 81 setores são perdas.
 */

const PRIZE_INDEXES = [
  0,
  10,
  20,
  30,
  40,
  50,
  60,
  70,
  80
];


/* =========================================================
   CONFIGURAÇÃO DO BANCO
   ========================================================= */

async function getSetting(
  key,
  fallback
) {

  try {

    const r =
      await pool.query(
        `SELECT setting_value
         FROM site_settings
         WHERE setting_key=$1
         LIMIT 1`,
        [key]
      );

    return (
      r.rows[0]?.setting_value ??
      fallback
    );

  } catch (_) {

    return fallback;

  }

}


/* =========================================================
   CONFIGURAÇÃO DA ROLETA
   ========================================================= */

async function getConfig() {

  let prizes =
    [
      ...DEFAULT_PRIZES
    ];

  let minBet =
    0.50;


  /*
   * Busca os multiplicadores
   * configurados no painel admin.
   */

  try {

    const raw =
      await getSetting(
        "roulette207_prizes",
        JSON.stringify(
          DEFAULT_PRIZES
        )
      );

    const parsed =
      JSON.parse(raw);


    if (
      Array.isArray(parsed) &&
      parsed.length === 9 &&
      parsed.every(
        x =>
          Number.isFinite(
            Number(x)
          ) &&
          Number(x) > 0
      )
    ) {

      prizes =
        parsed.map(Number);

    }

  } catch (_) {}


  /*
   * Busca o valor mínimo da aposta.
   */

  const configuredMin =
    Number(
      await getSetting(
        "roulette207_min_bet",
        "0.50"
      )
    );


  if (
    Number.isFinite(
      configuredMin
    ) &&
    configuredMin >= 0.50
  ) {

    minBet =
      Number(
        configuredMin.toFixed(2)
      );

  }


  return {
    prizes,
    minBet
  };

}


/* =========================================================
   SORTEIO
   ========================================================= */

/*
 * NÃO existe peso artificial aqui.
 *
 * O servidor simplesmente escolhe
 * um dos 90 setores.
 *
 * Todos têm exatamente a mesma chance.
 */

function sortearSetor() {

  return randomInt(
    TOTAL_SECTORS
  );

}


/* =========================================================
   CONFIGURAÇÃO PÚBLICA
   ========================================================= */

router.get(
  "/config",
  async (req, res) => {

    const {
      prizes,
      minBet
    } =
      await getConfig();


    res.json({

      ok: true,

      roulette: {

        id:
          "roulette90",

        minBet,

        totalSectors:
          TOTAL_SECTORS,

        prizeSectors:
          prizes.length,

        lossSectors:
          LOSS_SECTORS,

        /*
         * Cada setor:
         *
         * 100 / 90
         *
         * = 1,111111%
         */

        probabilityPercent:
          Number(
            (
              100 /
              TOTAL_SECTORS
            ).toFixed(6)
          ),

        /*
         * 9 / 90
         *
         * = 10%
         */

        totalPrizeProbabilityPercent:
          Number(
            (
              (
                prizes.length /
                TOTAL_SECTORS
              ) *
              100
            ).toFixed(6)
          ),

        prizes:
          prizes.map(
            (
              multiplier,
              position
            ) => ({

              position,

              multiplier,

              sector:
                PRIZE_INDEXES[
                  position
                ],

              probabilityPercent:
                Number(
                  (
                    100 /
                    TOTAL_SECTORS
                  ).toFixed(6)
                )

            })
          )

      }

    });

  }
);


/* =========================================================
   GIRAR
   ========================================================= */

router.post(
  "/spin",
  async (req, res) => {

    const client =
      await pool.connect();


    try {

      const userId =
        Number(
          req.body?.userId
        );

      const betAmount =
        Number(
          req.body?.betAmount
        );


      const {
        prizes,
        minBet
      } =
        await getConfig();


      /* ---------------------------------------------------
         USUÁRIO
         --------------------------------------------------- */

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


      /* ---------------------------------------------------
         APOSTA
         --------------------------------------------------- */

      if (
        !Number.isFinite(
          betAmount
        ) ||
        betAmount < minBet
      ) {

        return res.status(400).json({

          ok: false,

          message:
            `A aposta mínima é R$ ${minBet
              .toFixed(2)
              .replace(".", ",")}.`

        });

      }


      const bet =
        Number(
          betAmount.toFixed(2)
        );


      /* ---------------------------------------------------
         TRANSAÇÃO
         --------------------------------------------------- */

      await client.query(
        "BEGIN"
      );


      /* ---------------------------------------------------
         BUSCA E BLOQUEIA O USUÁRIO
         --------------------------------------------------- */

      const userResult =
        await client.query(

          `SELECT
            id,
            username,
            balance,
            bonus_balance,
            cash_balance,
            bonus_wager_progress,
            reserved_balance
           FROM users
           WHERE id=$1
           FOR UPDATE`,

          [userId]

        );


      if (
        !userResult.rows.length
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


      /* ---------------------------------------------------
         SALDO DISPONÍVEL
         --------------------------------------------------- */

      const bonus =
        Math.max(
          0,
          Number(
            user.bonus_balance ||
            0
          )
        );


      const cash =
        Math.max(
          0,
          Number(
            user.cash_balance ||
            0
          )
        );


      const available =
        Number(
          (
            bonus +
            cash
          ).toFixed(2)
        );


      if (
        available < bet
      ) {

        await client.query(
          "ROLLBACK"
        );

        return res.status(400).json({

          ok: false,

          message:
            "Saldo disponível insuficiente.",

          balance:
            Number(
              user.balance ||
              0
            ),

          reservedBalance:
            Number(
              user.reserved_balance ||
              0
            )

        });

      }


      /* ---------------------------------------------------
         SORTEIO DOS 90 SETORES
         --------------------------------------------------- */

      const sector =
        sortearSetor();


      /*
       * Verifica se o setor sorteado
       * é um dos 9 setores de prêmio.
       */

      const prizePosition =
        PRIZE_INDEXES.indexOf(
          sector
        );


      const multiplier =
        prizePosition >= 0
          ? prizes[
              prizePosition
            ]
          : 0;


      /* ---------------------------------------------------
         CALCULA O PRÊMIO
         --------------------------------------------------- */

      const prize =
        multiplier > 0

          ? Number(
              (
                bet *
                multiplier
              ).toFixed(2)
            )

          : 0;


      /* ---------------------------------------------------
         UTILIZAÇÃO DO BÔNUS
         --------------------------------------------------- */

      const bonusUsed =
        Math.min(
          bonus,
          bet
        );


      const cashUsed =
        bet -
        bonusUsed;


      const newBonus =
        Number(
          (
            bonus -
            bonusUsed
          ).toFixed(2)
        );


      const newCash =
        Number(
          (
            cash -
            cashUsed +
            prize
          ).toFixed(2)
        );


      const newBalance =
        Number(
          (
            newBonus +
            newCash
          ).toFixed(2)
        );


      /* ---------------------------------------------------
         PROGRESSO DO BÔNUS
         --------------------------------------------------- */

      const requirement =
        Number(
          await getSetting(
            "bonus_wager_requirement",
            "100"
          )
        ) || 100;


      const newProgress =
        Number(
          Math.min(
            requirement,

            Number(
              user.bonus_wager_progress ||
              0
            ) +
            bonusUsed

          ).toFixed(2)
        );


      /* ---------------------------------------------------
         RESULTADO LÍQUIDO
         --------------------------------------------------- */

      const netResult =
        Number(
          (
            prize -
            bet
          ).toFixed(2)
        );


      /* ---------------------------------------------------
         ATUALIZA SALDO
         --------------------------------------------------- */

      await client.query(

        `UPDATE users
         SET
          balance=$1,
          bonus_balance=$2,
          cash_balance=$3,
          bonus_wager_progress=$4
         WHERE id=$5`,

        [
          newBalance,
          newBonus,
          newCash,
          newProgress,
          userId
        ]

      );


      /* ---------------------------------------------------
         RESULTADO PARA O HISTÓRICO
         --------------------------------------------------- */

      const resultText =
        `${sector}:${
          multiplier > 0
            ? `${multiplier}x`
            : "PERCA"
        }:${
          multiplier > 0
            ? "prize"
            : "loss"
        }`;


      /* ---------------------------------------------------
         SALVA SPIN
         --------------------------------------------------- */

      const spinResult =
        await client.query(

          `INSERT INTO spins(
            user_id,
            result,
            amount
          )
          VALUES($1,$2,$3)
          RETURNING id,created_at`,

          [
            userId,
            resultText,
            netResult
          ]

        );


      /* ---------------------------------------------------
         SALVA TRANSAÇÃO
         --------------------------------------------------- */

      await client.query(

        `INSERT INTO transactions(
          user_id,
          type,
          amount
        )
        VALUES($1,$2,$3)`,

        [
          userId,

          multiplier > 0
            ? "roulette207_prize_win"
            : "roulette207_bet",

          netResult

        ]

      );


      /* ---------------------------------------------------
         CONFIRMA
         --------------------------------------------------- */

      await client.query(
        "COMMIT"
      );


      /* ---------------------------------------------------
         RESPOSTA
         --------------------------------------------------- */

      return res.json({

        ok: true,

        spin: {

          id:
            spinResult.rows[0].id,

          rouletteId:
            "roulette90",

          sector,

          resultType:
            multiplier > 0
              ? "prize"
              : "loss",

          multiplier,

          prize,

          netResult,

          betAmount:
            bet,

          totalSectors:
            TOTAL_SECTORS,

          prizeSectors:
            PRIZE_INDEXES,

          prizes

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

          bonusWagerProgress:
            newProgress,

          bonusWagerRequirement:
            requirement,

          reservedBalance:
            Number(
              user.reserved_balance ||
              0
            )

        }

      });


    } catch (error) {

      try {

        await client.query(
          "ROLLBACK"
        );

      } catch (_) {}


      console.error(
        "Erro na Roleta 90:",
        error
      );


      return res.status(500).json({

        ok: false,

        message:
          "Erro interno ao executar a Roleta."

      });


    } finally {

      client.release();

    }

  }
);


export default router;
