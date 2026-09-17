import express from "express";
import { randomInt } from "crypto";
import { pool } from "./db.js";

const router = express.Router();

/*
=========================================================
 MY DRAGON - MATEMATICA INTERNA

 O servidor fornece somente o sorteio aleatorio.
 A distribuicao de resultados pertence a este jogo.
 NAO consulta RTP/configuracao global do servidor.

 RTP teorico alvo: 70%
 Margem teorica: 30%
=========================================================
*/

const SYMBOLS = [
  { id: "dragon",  label: "🐉",  multiplier: 50 },
  { id: "diamond", label: "💎",  multiplier: 20 },
  { id: "crown",   label: "👑",  multiplier: 15 },
  { id: "coin",    label: "🪙",  multiplier: 10 },
  { id: "fire",    label: "🔥",  multiplier: 8 },
  { id: "trophy",  label: "🏆",  multiplier: 6 },
  { id: "clover",  label: "🍀",  multiplier: 5 },
  { id: "seven",   label: "7️⃣", multiplier: 25 }
];

const MIN_BET = 1.00;
const MATH_SCALE = 1_000_000;

/*
 * Probabilidades internas do jogo.
 *
 * O valor esperado e:
 *   0.08*5  + 0.03*6 + 0.008*8 + 0.003*10
 * + 0.001*15 + 0.0003*20 + 0.0001*25 + 0.00005*50
 * = 0.70
 *
 * Portanto o RTP teorico da tabela e 70%.
 * A probabilidade restante e perda (0x).
 *
 * IMPORTANTE: isto e independente de qualquer setting de RTP
 * existente no servidor.
 */
const OUTCOME_TABLE = [
  { symbol: "clover",  multiplier: 5,  probability: 80_000 },
  { symbol: "trophy",  multiplier: 6,  probability: 30_000 },
  { symbol: "fire",    multiplier: 8,  probability: 8_000 },
  { symbol: "coin",    multiplier: 10, probability: 3_000 },
  { symbol: "crown",   multiplier: 15, probability: 1_000 },
  { symbol: "diamond", multiplier: 20, probability: 300 },
  { symbol: "seven",   multiplier: 25, probability: 100 },
  { symbol: "dragon",  multiplier: 50, probability: 50 }
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

function numero(valor, fallback = 0) {
  const n = Number(valor);
  return Number.isFinite(n) ? n : fallback;
}

function dinheiro(valor) {
  return Number(numero(valor).toFixed(2));
}

function symbolById(id) {
  return SYMBOLS.find(symbol => symbol.id === id) || null;
}

/*
 * Sorteio livre: somente um numero aleatorio criptografico.
 * A tabela acima, pertencente ao proprio jogo, transforma esse
 * numero em um resultado com as probabilidades definidas aqui.
 */
function sortearResultado() {
  const ticket = randomInt(MATH_SCALE);

  if (ticket >= WIN_THRESHOLD) {
    return null;
  }

  let acumulado = 0;

  for (const outcome of OUTCOME_TABLE) {
    acumulado += outcome.probability;

    if (ticket < acumulado) {
      const symbol = symbolById(outcome.symbol);
      return {
        symbol,
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
 * Monta uma grade visual sem alterar a probabilidade do resultado.
 * Em uma rodada vencedora, exatamente 3 simbolos do premio aparecem.
 * As outras 12 casas sao preenchidas de modo a nao criar outra
 * combinacao de 3 ou mais.
 */
function montarGrade(resultado) {
  const ids = SYMBOLS.map(symbol => symbol.id);

  if (!resultado) {
    const pool = [];

    // Distribui 15 casas com no maximo 2 ocorrencias por simbolo.
    for (let i = 0; i < 15; i++) {
      pool.push(ids[i % ids.length]);
    }

    return embaralhar(pool).map(symbolId => symbolById(symbolId));
  }

  const outros = ids.filter(id => id !== resultado.symbol.id);
  const pool = [
    resultado.symbol.id,
    resultado.symbol.id,
    resultado.symbol.id
  ];

  // 12 casas restantes: no maximo 2 de cada simbolo.
  for (let i = 0; i < 12; i++) {
    pool.push(outros[i % outros.length]);
  }

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
      id: "my-dragon",
      name: "My Dragon",
      type: "SLOT",
      rows: 3,
      columns: 5,
      minBet: MIN_BET,
      theoreticalRtp: 0.70,
      theoreticalHouseEdge: 0.30,
      symbols: SYMBOLS.map(symbol => ({
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
    const betAmount = Number(req.body?.betAmount);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        ok: false,
        message: "Usuário inválido."
      });
    }

    if (!Number.isFinite(betAmount) || betAmount < MIN_BET) {
      return res.status(400).json({
        ok: false,
        message: "A aposta mínima é R$ 1,00."
      });
    }

    const bet = dinheiro(betAmount);

    await client.query("BEGIN");

    const userResult = await client.query(
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
      await client.query("ROLLBACK");
      return res.status(404).json({
        ok: false,
        message: "Usuário não encontrado."
      });
    }

    const user = userResult.rows[0];
    const bonus = Math.max(0, numero(user.bonus_balance));
    const cash = Math.max(0, numero(user.cash_balance));
    const reserved = Math.max(0, numero(user.reserved_balance));
    const available = dinheiro(bonus + cash);

    if (available < bet) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        ok: false,
        message: "Saldo disponível insuficiente.",
        balance: dinheiro(user.balance),
        reservedBalance: dinheiro(reserved)
      });
    }

    /* O jogo escolhe a categoria usando SOMENTE a sua tabela interna. */
    const resultadoSorteado = sortearResultado();
    const grade = montarGrade(resultadoSorteado);
    const resultado = calcularPremio(resultadoSorteado, bet);
    const prize = dinheiro(resultado.prize);
    const netResult = dinheiro(prize - bet);

    const bonusUsed = Math.min(bonus, bet);
    const cashUsed = dinheiro(bet - bonusUsed);
    const newBonus = dinheiro(bonus - bonusUsed);
    const newCash = dinheiro(cash - cashUsed + prize);
    const newBalance = dinheiro(newBonus + newCash);

    let requirement = 100;

    try {
      const setting = await client.query(
        `
        SELECT setting_value
        FROM site_settings
        WHERE setting_key = $1
        LIMIT 1
        `,
        ["bonus_wager_requirement"]
      );

      if (setting.rows.length) {
        const configured = Number(setting.rows[0].setting_value);
        if (Number.isFinite(configured) && configured > 0) {
          requirement = configured;
        }
      }
    } catch (_) {
      requirement = 100;
    }

    const oldProgress = numero(user.bonus_wager_progress);
    const newProgress = dinheiro(
      Math.min(requirement, oldProgress + bonusUsed)
    );

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
      [newBalance, newBonus, newCash, newProgress, userId]
    );

    const resultText = resultado.won
      ? `my-dragon:${resultado.symbol}:${resultado.multiplier}x:${resultado.count}`
      : "my-dragon:PERCA";

    const spinResult = await client.query(
      `
      INSERT INTO spins (user_id, result, amount)
      VALUES ($1, $2, $3)
      RETURNING id, created_at
      `,
      [userId, resultText, netResult]
    );

    await client.query(
      `
      INSERT INTO transactions (user_id, type, amount)
      VALUES ($1, $2, $3)
      `,
      [
        userId,
        resultado.won ? "my_dragon_prize_win" : "my_dragon_bet",
        resultado.won ? netResult : -bet
      ]
    );

    await client.query("COMMIT");

    return res.json({
      ok: true,
      spin: {
        id: spinResult.rows[0].id,
        gameId: "my-dragon",
        grid: grade.map(symbol => ({
          id: symbol.id,
          label: symbol.label
        })),
        won: resultado.won,
        prize,
        netResult,
        multiplier: resultado.multiplier,
        winningSymbol: resultado.symbol,
        winningLabel: resultado.label,
        winningCount: resultado.count,
        betAmount: bet
      },
      user: {
        id: user.id,
        username: user.username,
        balance: newBalance,
        bonusBalance: newBonus,
        cashBalance: newCash,
        reservedBalance: reserved,
        bonusWagerProgress: newProgress,
        bonusWagerRequirement: requirement
      }
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {}

    console.error("Erro no My Dragon:", error);

    return res.status(500).json({
      ok: false,
      message: "Erro interno ao executar o My Dragon."
    });
  } finally {
    client.release();
  }
});

export default router;
