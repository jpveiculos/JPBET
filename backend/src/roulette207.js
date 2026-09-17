import express from "express";
import { randomInt } from "crypto";
import { pool } from "./db.js";

const router = express.Router();

const TOTAL_SECTORS = 207;
const LOSS_SECTORS = 198;

const DEFAULT_PRIZES = [2, 3, 4, 5, 6, 7, 8, 9, 10];

const PRIZE_INDEXES = [
  0, 23, 46, 69, 92, 115, 138, 161, 184
];

async function getSetting(key, fallback) {
  try {
    const r = await pool.query(
      `SELECT setting_value
       FROM site_settings
       WHERE setting_key=$1
       LIMIT 1`,
      [key]
    );

    return r.rows[0]?.setting_value ?? fallback;
  } catch (_) {
    return fallback;
  }
}

async function getConfig() {
  let prizes = DEFAULT_PRIZES;
  let minBet = 0.50;

  try {
    const raw = await getSetting(
      "roulette207_prizes",
      JSON.stringify(DEFAULT_PRIZES)
    );

    const parsed = JSON.parse(raw);

    if (
      Array.isArray(parsed) &&
      parsed.length === 9 &&
      parsed.every(
        x => Number.isFinite(Number(x)) && Number(x) > 0
      )
    ) {
      prizes = parsed.map(Number);
    }
  } catch (_) {}

  const configuredMin = Number(
    await getSetting("roulette207_min_bet", "0.50")
  );

  if (
    Number.isFinite(configuredMin) &&
    configuredMin >= 0.50
  ) {
    minBet = Number(configuredMin.toFixed(2));
  }

  return {
    prizes,
    minBet
  };
}

/*
 * ROleta 207
 *
 * 207 setores
 * 9 prêmios
 * 198 perdas
 *
 * Probabilidade:
 * 10% total para prêmios
 * 1,111111% para cada prêmio
 *
 * 90% total para perdas
 * 0,454545% para cada perda
 */
function sortearSetor() {
  const draw = randomInt(10_000_000);

  // 10% de chance total para os 9 prêmios
  if (draw < 1_000_000) {
    const prizeIndex = randomInt(PRIZE_INDEXES.length);

    return PRIZE_INDEXES[prizeIndex];
  }

  // 90% de chance total para as 198 perdas
  const lossIndex = randomInt(LOSS_SECTORS);

  let currentLoss = 0;

  for (
    let sector = 0;
    sector < TOTAL_SECTORS;
    sector++
  ) {
    if (PRIZE_INDEXES.includes(sector)) {
      continue;
    }

    if (currentLoss === lossIndex) {
      return sector;
    }

    currentLoss++;
  }

  throw new Error(
    "Não foi possível sortear setor de perda."
  );
}

router.get("/config", async (req, res) => {
  const { prizes, minBet } = await getConfig();

  res.json({
    ok: true,

    roulette: {
      id: "roulette207",

      minBet,

      totalSectors: TOTAL_SECTORS,

      prizeSectors: prizes.length,

      lossSectors: LOSS_SECTORS,

      prizes: prizes.map((multiplier, position) => ({
        position,

        multiplier,

        sector: PRIZE_INDEXES[position],

        // 10% dividido igualmente entre os 9 prêmios
        probabilityPercent: Number(
          (10 / prizes.length).toFixed(6)
        )
      }))
    }
  });
});

router.post("/spin", async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = Number(req.body?.userId);

    const betAmount = Number(req.body?.betAmount);

    const { prizes, minBet } = await getConfig();

    if (
      !Number.isInteger(userId) ||
      userId <= 0
    ) {
      return res.status(400).json({
        ok: false,
        message: "Usuário inválido."
      });
    }

    if (
      !Number.isFinite(betAmount) ||
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

    const bet = Number(
      betAmount.toFixed(2)
    );

    await client.query("BEGIN");

    const userResult = await client.query(
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

    if (!userResult.rows.length) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        ok: false,
        message: "Usuário não encontrado."
      });
    }

    const user = userResult.rows[0];

    const bonus = Math.max(
      0,
      Number(user.bonus_balance || 0)
    );

    const cash = Math.max(
      0,
      Number(user.cash_balance || 0)
    );

    const available = Number(
      (bonus + cash).toFixed(2)
    );

    if (available < bet) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        ok: false,
        message: "Saldo disponível insuficiente.",
        balance: Number(user.balance || 0),
        reservedBalance: Number(
          user.reserved_balance || 0
        )
      });
    }

    // Sorteio com 10% total para prêmios
    const sector = sortearSetor();

    const prizePosition =
      PRIZE_INDEXES.indexOf(sector);

    const multiplier =
      prizePosition >= 0
        ? prizes[prizePosition]
        : 0;

    const prize =
      multiplier > 0
        ? Number(
            (bet * multiplier).toFixed(2)
          )
        : 0;

    const bonusUsed = Math.min(
      bonus,
      bet
    );

    const cashUsed =
      bet - bonusUsed;

    const newBonus = Number(
      (bonus - bonusUsed).toFixed(2)
    );

    const newCash = Number(
      (cash - cashUsed + prize).toFixed(2)
    );

    const newBalance = Number(
      (newBonus + newCash).toFixed(2)
    );

    const requirement = Number(
      await getSetting(
        "bonus_wager_requirement",
        "100"
      )
    ) || 100;

    const newProgress = Number(
      Math.min(
        requirement,
        Number(
          user.bonus_wager_progress || 0
        ) + bonusUsed
      ).toFixed(2)
    );

    const netResult = Number(
      (prize - bet).toFixed(2)
    );

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

    await client.query("COMMIT");

    return res.json({
      ok: true,

      spin: {
        id: spinResult.rows[0].id,

        rouletteId: "roulette207",

        sector,

        resultType:
          multiplier > 0
            ? "prize"
            : "loss",

        multiplier,

        prize,

        netResult,

        betAmount: bet,

        totalSectors:
          TOTAL_SECTORS,

        prizeSectors:
          PRIZE_INDEXES,

        prizes
      },

      user: {
        id: user.id,

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
            user.reserved_balance || 0
          )
      }
    });

  } catch (error) {

    try {
      await client.query("ROLLBACK");
    } catch (_) {}

    console.error(
      "Erro na Roleta 207:",
      error
    );

    return res.status(500).json({
      ok: false,
      message:
        "Erro interno ao executar a Roleta 207."
    });

  } finally {

    client.release();

  }
});

export default router;
