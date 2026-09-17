import express from "express";
import { randomInt } from "crypto";
import { pool } from "./db.js";

const router = express.Router();

/*
=========================================================
 MY TIGER - MATEMATICA INTERNA

 O servidor fornece somente o sorteio aleatorio.
 A distribuicao de resultados pertence ao proprio jogo.
 NAO consulta RTP/configuracao global do servidor.

 RTP teorico alvo: 70%
 Margem teorica: 30%
=========================================================
*/

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

const MIN_BET = 1.00;
const MATH_SCALE = 1_000_000;

/*
 * Probabilidades internas.
 *
 * Valor esperado:
 * 0.10*4 + 0.025*8 + 0.005*15
 * + 0.001*20 + 0.0001*25 + 0.00005*50 = 0.70
 *
 * A probabilidade restante e perda (0x).
 */
const OUTCOME_TABLE = [
  { symbol: "orange",  multiplier: 4,  probability: 100_000 },
  { symbol: "coin",    multiplier: 8,  probability: 25_000 },
  { symbol: "diamond", multiplier: 15, probability: 5_000 },
  { symbol: "seven",   multiplier: 20, probability: 1_000 },
  { symbol: "crown",   multiplier: 25, probability: 100 },
  { symbol: "tiger",   multiplier: 50, probability: 50 }
];

const WIN_THRESHOLD = OUTCOME_TABLE.reduce(
  (sum, outcome) => sum + outcome.probability,
  0
);

const THEORETICAL_RTP = OUTCOME_TABLE.reduce(
  (sum, outcome) =>
    sum + (outcome.probability / MATH_SCALE) * outcome.multiplier,
  0
);

function dinheiro(valor) {
  const n = Number(valor);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
}

function symbolById(id) {
  return symbols.find(symbol => symbol.id === id) || null;
}

/* Sorteio livre: um numero aleatorio. A matematica abaixo interpreta o numero. */
function sortearResultado() {
  const ticket = randomInt(MATH_SCALE);

  if (ticket >= WIN_THRESHOLD) return null;

  let acumulado = 0;
  for (const outcome of OUTCOME_TABLE) {
    acumulado += outcome.probability;
    if (ticket < acumulado) {
      return {
        symbol: symbolById(outcome.symbol),
        multiplier: outcome.multiplier
      };
    }
  }

  return null;
}

function embaralhar(lista) {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

/*
 * A grade visual nao decide o resultado.
 * Ela apenas representa o resultado ja sorteado.
 * Em uma vitoria, exatamente 3 simbolos vencedores aparecem.
 * Nas perdas, nenhum simbolo aparece 3 vezes.
 */
function montarGrade(resultado) {
  const ids = symbols.map(symbol => symbol.id);

  if (!resultado) {
    const pool = [];
    for (let i = 0; i < 5; i++) {
      pool.push(ids[i]);
    }
    return embaralhar(pool).map(symbolId => symbolById(symbolId));
  }

  const outros = ids.filter(id => id !== resultado.symbol.id);
  const pool = [
    resultado.symbol.id,
    resultado.symbol.id,
    resultado.symbol.id,
    outros[0],
    outros[1]
  ];

  return embaralhar(pool).map(symbolId => symbolById(symbolId));
}

function calcularPremio(resultado, aposta) {
  if (!resultado || !resultado.symbol) {
    return {
      won: false,
      prize: 0,
      symbol: null,
      label: null,
      count: 0,
      multiplier: 0
    };
  }

  return {
    won: true,
    prize: dinheiro(aposta * resultado.multiplier),
    symbol: resultado.symbol.id,
    label: resultado.symbol.label,
    count: 3,
    multiplier: resultado.multiplier
  };
}

router.get("/config", async (_req, res) => {
  return res.json({
    ok: true,
    game: {
      id: "my-tiger",
      name: "My Tiger",
      type: "SLOT",
      rows: 1,
      columns: 5,
      minBet: MIN_BET,
      theoreticalRtp: THEORETICAL_RTP,
      theoreticalHouseEdge: 1 - THEORETICAL_RTP,
      symbols: symbols.map(symbol => ({
        id: symbol.id,
        label: symbol.label,
        multiplier: symbol.multiplier
      }))
    }
  });
});

router.post("/spin", async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = Number(req.body?.userId);
    const bet = Number(req.body?.betAmount);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ ok: false, message: "Usuário inválido." });
    }

    if (!Number.isFinite(bet) || bet < MIN_BET) {
      return res.status(400).json({ ok: false, message: "Aposta mínima de R$ 1,00." });
    }

    const wager = dinheiro(bet);

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

    if (balance - reserved < wager) {
      await client.query("ROLLBACK");
      return res.status(400).json({ ok: false, message: "Saldo disponível insuficiente." });
    }

    /* Consome saldo disponivel; fundos reservados nunca entram na aposta. */
    let newCash = cash;
    let newBonus = bonus;
    let remaining = wager;

    const fromCash = Math.min(newCash, remaining);
    newCash = dinheiro(newCash - fromCash);
    remaining = dinheiro(remaining - fromCash);

    if (remaining > 0) {
      newBonus = dinheiro(newBonus - remaining);
    }

    /* Resultado matematico independente do RTP do servidor. */
    const resultado = sortearResultado();
    const premioCalculado = calcularPremio(resultado, wager);
    const prize = dinheiro(premioCalculado.prize);
    const netResult = dinheiro(prize - wager);
    const grid = montarGrade(resultado);

    newCash = dinheiro(newCash + prize);
    const newBalance = dinheiro(newCash + newBonus);

    await client.query(
      `UPDATE users SET cash_balance=$1,bonus_balance=$2,balance=$3 WHERE id=$4`,
      [newCash, newBonus, newBalance, userId]
    );

    await client.query(
      `INSERT INTO transactions(user_id,type,amount) VALUES($1,$2,$3)`,
      [
        userId,
        premioCalculado.won ? "my_tiger_win" : "my_tiger_bet",
        netResult
      ]
    );

    await client.query("COMMIT");

    return res.json({
      ok: true,
      spin: {
        grid,
        won: premioCalculado.won,
        multiplier: premioCalculado.multiplier,
        prize,
        winningSymbol: premioCalculado.symbol,
        winningLabel: premioCalculado.label,
        winningCount: premioCalculado.count,
        betAmount: wager
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
