import express from "express";
import { pool } from "./db.js";

const router = express.Router();

const symbols = [
  { id: "tiger", label: "🐯", multiplier: 50 },
  { id: "crown", label: "👑", multiplier: 25 },
  { id: "diamond", label: "💎", multiplier: 15 },
  { id: "coin", label: "🪙", multiplier: 8 },
  { id: "orange", label: "🍊", multiplier: 4 },
  { id: "lemon", label: "🍋", multiplier: 4 },
  { id: "bell", label: "🔔", multiplier: 10 },
  { id: "seven", label: "7️⃣", multiplier: 20 }
];

function pick() {
  return symbols[Math.floor(Math.random() * symbols.length)];
}

router.post("/spin", async (req, res) => {
  const client = await pool.connect();
  try {
    const userId = Number(req.body?.userId);
    const bet = Number(req.body?.betAmount);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ ok: false, message: "Usuário inválido." });
    }
    if (!Number.isFinite(bet) || bet < 1) {
      return res.status(400).json({ ok: false, message: "Aposta mínima de R$ 1,00." });
    }

    await client.query("BEGIN");
    const result = await client.query(
      `SELECT id,username,balance,bonus_balance,cash_balance,reserved_balance
         FROM users WHERE id=$1 FOR UPDATE`,
      [userId]
    );
    if (!result.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ ok: false, message: "Usuário não encontrado." });
    }

    const user = result.rows[0];
    const balance = Number(user.balance || 0);
    const bonus = Number(user.bonus_balance || 0);
    const cash = Number(user.cash_balance || 0);
    const reserved = Number(user.reserved_balance || 0);

    if (balance - reserved < bet) {
      await client.query("ROLLBACK");
      return res.status(400).json({ ok: false, message: "Saldo disponível insuficiente." });
    }

    // Consume available credits from cash first, then bonus. Reserved withdrawal funds are never used.
    let newCash = cash;
    let newBonus = bonus;
    let remaining = bet;
    const fromCash = Math.min(newCash, remaining);
    newCash = Number((newCash - fromCash).toFixed(2));
    remaining = Number((remaining - fromCash).toFixed(2));
    if (remaining > 0) {
      newBonus = Number((newBonus - remaining).toFixed(2));
    }

    const grid = Array.from({ length: 5 }, pick);
    const counts = {};
    for (const item of grid) counts[item.id] = (counts[item.id] || 0) + 1;

    let multiplier = 0;
    for (const item of symbols) {
      if ((counts[item.id] || 0) >= 3) multiplier = Math.max(multiplier, item.multiplier);
    }

    const prize = Number((bet * multiplier).toFixed(2));
    newCash = Number((newCash + prize).toFixed(2));
    const newBalance = Number((newCash + newBonus).toFixed(2));

    await client.query(
      `UPDATE users SET cash_balance=$1,bonus_balance=$2,balance=$3 WHERE id=$4`,
      [newCash, newBonus, newBalance, userId]
    );
    await client.query(
      `INSERT INTO transactions(user_id,type,amount) VALUES($1,$2,$3)`,
      [userId, prize > 0 ? "my_tiger_win" : "my_tiger_bet", Number((prize - bet).toFixed(2))]
    );
    await client.query("COMMIT");

    return res.json({
      ok: true,
      spin: {
        grid,
        won: prize > 0,
        multiplier,
        prize,
        winningLabel: prize > 0 ? grid.find(x => (counts[x.id] || 0) >= 3)?.label : null
      },
      user: {
        id: user.id,
        username: user.username,
        balance: newBalance,
        bonusBalance: newBonus,
        cashBalance: newCash,
        reservedBalance: reserved
      }
    });
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch (_) {}
    console.error("Erro no My Tiger:", error);
    return res.status(500).json({ ok: false, message: "Erro interno ao realizar o giro." });
  } finally {
    client.release();
  }
});

export default router;
