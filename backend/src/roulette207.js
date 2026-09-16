import express from "express";
import { pool } from "./db.js";

const router = express.Router();

// Roleta nova: 207 posições lógicas.
// 9 posições premiadas: 2x, 3x, 4x, 5x, 6x, 7x, 8x, 9x e 10x.
// As outras 198 posições são PERDA.
// Não existe RTP neste motor: a probabilidade é definida diretamente pela distribuição
// das 207 posições (cada posição lógica tem a mesma chance de ser sorteada).
const TOTAL_SECTORS = 207;
const LOSS_SECTORS = 198;
const BET_AMOUNT = 1;
const PRIZES = [2, 3, 4, 5, 6, 7, 8, 9, 10];
const PRIZE_INDEXES = [0, 23, 46, 69, 92, 115, 138, 161, 184];

function sortearSetor() {
  return Math.floor(Math.random() * TOTAL_SECTORS);
}

router.get("/config", (req, res) => {
  res.json({
    ok: true,
    roulette: {
      id: "roulette207",
      betAmount: BET_AMOUNT,
      totalSectors: TOTAL_SECTORS,
      prizeSectors: PRIZES.length,
      lossSectors: LOSS_SECTORS,
      prizes: PRIZES.map((multiplier, position) => ({
        position,
        multiplier,
        sector: PRIZE_INDEXES[position],
        probabilityPercent: Number((100 / TOTAL_SECTORS).toFixed(6))
      }))
    }
  });
});

router.post("/spin", async (req, res) => {
  const client = await pool.connect();
  try {
    const userId = Number(req.body?.userId);
    const betAmount = Number(req.body?.betAmount);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ ok: false, message: "Usuário inválido." });
    }
    if (!Number.isFinite(betAmount) || Math.abs(betAmount - BET_AMOUNT) > 0.001) {
      return res.status(400).json({ ok: false, message: "A aposta da Roleta 207 é fixa em R$ 1,00." });
    }

    await client.query("BEGIN");
    const userResult = await client.query(
      `SELECT id,username,balance,bonus_balance,cash_balance,bonus_wager_progress,reserved_balance
       FROM users WHERE id=$1 FOR UPDATE`,
      [userId]
    );

    if (!userResult.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ ok: false, message: "Usuário não encontrado." });
    }

    const user = userResult.rows[0];
    const bonus = Math.max(0, Number(user.bonus_balance || 0));
    const cash = Math.max(0, Number(user.cash_balance || 0));
    const available = Number((bonus + cash).toFixed(2));

    if (available < BET_AMOUNT) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        ok: false,
        message: "Saldo disponível insuficiente.",
        balance: Number(user.balance || 0),
        reservedBalance: Number(user.reserved_balance || 0)
      });
    }

    const sector = sortearSetor();
    const prizePosition = PRIZE_INDEXES.indexOf(sector);
    const multiplier = prizePosition >= 0 ? PRIZES[prizePosition] : 0;
    const prize = multiplier > 0 ? Number((BET_AMOUNT * multiplier).toFixed(2)) : 0;

    const bonusUsed = Math.min(bonus, BET_AMOUNT);
    const cashUsed = BET_AMOUNT - bonusUsed;
    const newBonus = Number((bonus - bonusUsed).toFixed(2));
    const newCash = Number((cash - cashUsed + prize).toFixed(2));
    const newBalance = Number((newBonus + newCash).toFixed(2));

    const requirementResult = await client.query(
      `SELECT setting_value FROM site_settings WHERE setting_key='bonus_wager_requirement' LIMIT 1`
    );
    const requirement = Number(requirementResult.rows[0]?.setting_value || "100") || 100;
    const newProgress = Number(
      Math.min(requirement, Number(user.bonus_wager_progress || 0) + bonusUsed).toFixed(2)
    );

    await client.query(
      `UPDATE users SET balance=$1,bonus_balance=$2,cash_balance=$3,bonus_wager_progress=$4 WHERE id=$5`,
      [newBalance, newBonus, newCash, newProgress, userId]
    );

    const resultText = `${sector}:${multiplier > 0 ? `${multiplier}x` : "PERCA"}:${multiplier > 0 ? "prize" : "loss"}`;
    const spinResult = await client.query(
      `INSERT INTO spins(user_id,result,amount) VALUES($1,$2,$3) RETURNING id,created_at`,
      [userId, resultText, prize]
    );

    await client.query(
      `INSERT INTO transactions(user_id,type,amount) VALUES($1,$2,$3)`,
      [userId, multiplier > 0 ? "roulette207_prize_win" : "roulette207_bet", multiplier > 0 ? prize : -BET_AMOUNT]
    );

    await client.query("COMMIT");

    return res.json({
      ok: true,
      spin: {
        id: spinResult.rows[0].id,
        rouletteId: "roulette207",
        sector,
        resultType: multiplier > 0 ? "prize" : "loss",
        multiplier,
        prize,
        betAmount: BET_AMOUNT,
        totalSectors: TOTAL_SECTORS,
        prizeSectors: PRIZE_INDEXES,
        lossSectors: LOSS_SECTORS
      },
      user: {
        id: user.id,
        username: user.username,
        balance: newBalance,
        bonusBalance: newBonus,
        cashBalance: newCash,
        bonusWagerProgress: newProgress,
        bonusWagerRequirement: requirement,
        reservedBalance: Number(user.reserved_balance || 0)
      }
    });
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch (_) {}
    console.error("Erro na Roleta 207:", error);
    return res.status(500).json({ ok: false, message: "Erro interno ao executar a Roleta 207." });
  } finally {
    client.release();
  }
});

export default router;
