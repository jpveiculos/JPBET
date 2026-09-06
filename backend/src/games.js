import express from "express";
import { pool } from "./db.js";
import { jogarMaquina } from "./gameEngine.js";

const router = express.Router();

function numero(valor, padrao = 0) {
  const n = Number(valor);
  return Number.isFinite(n) ? n : padrao;
}

function arredondar(valor) {
  return Math.round((Number(valor) + Number.EPSILON) * 100) / 100;
}

/*
========================================================
CONFIGURAÇÕES PADRÃO DAS MÁQUINAS
========================================================
*/

const DEFAULT_GAMES = {

  fortune7: {
    id: "fortune7",
    name: "Fortune 7",
    enabled: true,
    type: "classic",
    reels: 3,
    rows: 1,
    paylines: [
      {
        id: 1,
        positions: [
          { reel: 0, row: 0 },
          { reel: 1, row: 0 },
          { reel: 2, row: 0 }
        ]
      }
    ],

    minBet: 0.10,
    maxBet: 100,

    wild: "WILD",

    symbols: [
      { id: "CHERRY", label: "🍒", weight: 30 },
      { id: "BAR", label: "BAR", weight: 25 },
      { id: "DOUBLE_BAR", label: "BAR BAR", weight: 18 },
      { id: "BELL", label: "🔔", weight: 15 },
      { id: "SEVEN", label: "7", weight: 9 },
      { id: "WILD", label: "★", weight: 3 }
    ],

    payouts: {
      CHERRY: {
        3: 8
      },
      BAR: {
        3: 15
      },
      DOUBLE_BAR: {
        3: 25
      },
      BELL: {
        3: 40
      },
      SEVEN: {
        3: 100
      },
      WILD: {
        3: 250
      }
    },

    jackpot: {
      enabled: true,
      symbol: "SEVEN",
      multiplier: 500
    }
  },

  lucky7: {
    id: "lucky7",
    name: "Lucky 7",
    enabled: true,
    type: "classic",
    reels: 3,
    rows: 1,

    paylines: [
      {
        id: 1,
        positions: [
          { reel: 0, row: 0 },
          { reel: 1, row: 0 },
          { reel: 2, row: 0 }
        ]
      }
    ],

    minBet: 0.10,
    maxBet: 100,

    wild: "WILD",

    symbols: [
      { id: "CHERRY", label: "🍒", weight: 34 },
      { id: "BAR", label: "BAR", weight: 28 },
      { id: "BELL", label: "🔔", weight: 20 },
      { id: "SEVEN", label: "7", weight: 13 },
      { id: "WILD", label: "★", weight: 5 }
    ],

    payouts: {
      CHERRY: {
        3: 10
      },
      BAR: {
        3: 20
      },
      BELL: {
        3: 35
      },
      SEVEN: {
        3: 100
      },
      WILD: {
        3: 500
      }
    },

    jackpot: {
      enabled: true,
      symbol: "SEVEN",
      multiplier: 777
    }
  },

  diamondGold: {
    id: "diamondGold",
    name: "Diamond Gold",
    enabled: true,
    type: "video-slot",
    reels: 5,
    rows: 3,

    paylines: [
      {
        id: 1,
        positions: [
          { reel: 0, row: 1 },
          { reel: 1, row: 1 },
          { reel: 2, row: 1 },
          { reel: 3, row: 1 },
          { reel: 4, row: 1 }
        ]
      },
      {
        id: 2,
        positions: [
          { reel: 0, row: 0 },
          { reel: 1, row: 0 },
          { reel: 2, row: 0 },
          { reel: 3, row: 0 },
          { reel: 4, row: 0 }
        ]
      },
      {
        id: 3,
        positions: [
          { reel: 0, row: 2 },
          { reel: 1, row: 2 },
          { reel: 2, row: 2 },
          { reel: 3, row: 2 },
          { reel: 4, row: 2 }
        ]
      },
      {
        id: 4,
        positions: [
          { reel: 0, row: 0 },
          { reel: 1, row: 1 },
          { reel: 2, row: 2 },
          { reel: 3, row: 1 },
          { reel: 4, row: 0 }
        ]
      },
      {
        id: 5,
        positions: [
          { reel: 0, row: 2 },
          { reel: 1, row: 1 },
          { reel: 2, row: 0 },
          { reel: 3, row: 1 },
          { reel: 4, row: 2 }
        ]
      }
    ],

    minBet: 0.10,
    maxBet: 250,

    wild: "WILD",

    symbols: [
      { id: "CHERRY", label: "🍒", weight: 25 },
      { id: "LEMON", label: "🍋", weight: 22 },
      { id: "BELL", label: "🔔", weight: 18 },
      { id: "BAR", label: "BAR", weight: 14 },
      { id: "SEVEN", label: "7", weight: 10 },
      { id: "DIAMOND", label: "💎", weight: 7 },
      { id: "GOLD", label: "GOLD", weight: 3 },
      { id: "WILD", label: "★", weight: 1 }
    ],

    payouts: {
      CHERRY: {
        3: 2,
        4: 8,
        5: 20
      },
      LEMON: {
        3: 3,
        4: 10,
        5: 30
      },
      BELL: {
        3: 5,
        4: 15,
        5: 50
      },
      BAR: {
        3: 8,
        4: 25,
        5: 75
      },
      SEVEN: {
        3: 15,
        4: 50,
        5: 150
      },
      DIAMOND: {
        3: 25,
        4: 100,
        5: 500
      },
      GOLD: {
        3: 50,
        4: 250,
        5: 1000
      },
      WILD: {
        3: 100,
        4: 500,
        5: 2500
      }
    },

    jackpot: {
      enabled: false,
      symbol: "GOLD",
      multiplier: 0
    }
  },

  royalJackpot: {
    id: "royalJackpot",
    name: "Royal Jackpot",
    enabled: true,
    type: "jackpot",
    reels: 5,
    rows: 3,

    paylines: [
      {
        id: 1,
        positions: [
          { reel: 0, row: 1 },
          { reel: 1, row: 1 },
          { reel: 2, row: 1 },
          { reel: 3, row: 1 },
          { reel: 4, row: 1 }
        ]
      },
      {
        id: 2,
        positions: [
          { reel: 0, row: 0 },
          { reel: 1, row: 0 },
          { reel: 2, row: 0 },
          { reel: 3, row: 0 },
          { reel: 4, row: 0 }
        ]
      },
      {
        id: 3,
        positions: [
          { reel: 0, row: 2 },
          { reel: 1, row: 2 },
          { reel: 2, row: 2 },
          { reel: 3, row: 2 },
          { reel: 4, row: 2 }
        ]
      },
      {
        id: 4,
        positions: [
          { reel: 0, row: 0 },
          { reel: 1, row: 1 },
          { reel: 2, row: 2 },
          { reel: 3, row: 1 },
          { reel: 4, row: 0 }
        ]
      },
      {
        id: 5,
        positions: [
          { reel: 0, row: 2 },
          { reel: 1, row: 1 },
          { reel: 2, row: 0 },
          { reel: 3, row: 1 },
          { reel: 4, row: 2 }
        ]
      }
    ],

    minBet: 0.10,
    maxBet: 500,

    wild: "WILD",

    symbols: [
      { id: "CHERRY", label: "🍒", weight: 25 },
      { id: "BAR", label: "BAR", weight: 22 },
      { id: "BELL", label: "🔔", weight: 18 },
      { id: "SEVEN", label: "7", weight: 13 },
      { id: "DIAMOND", label: "💎", weight: 10 },
      { id: "CROWN", label: "👑", weight: 8 },
      { id: "ROYAL", label: "ROYAL", weight: 3 },
      { id: "WILD", label: "★", weight: 1 }
    ],

    payouts: {
      CHERRY: {
        3: 3,
        4: 10,
        5: 25
      },
      BAR: {
        3: 5,
        4: 20,
        5: 60
      },
      BELL: {
        3: 8,
        4: 30,
        5: 100
      },
      SEVEN: {
        3: 15,
        4: 60,
        5: 200
      },
      DIAMOND: {
        3: 25,
        4: 100,
        5: 400
      },
      CROWN: {
        3: 50,
        4: 200,
        5: 750
      },
      ROYAL: {
        3: 100,
        4: 500,
        5: 2000
      },
      WILD: {
        3: 150,
        4: 750,
        5: 5000
      }
    },

    jackpot: {
      enabled: true,
      symbol: "ROYAL",
      multiplier: 10000
    }
  }
};

/*
========================================================
BANCO
========================================================
*/

async function garantirTabela() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS game_configs (
      game_id VARCHAR(100) PRIMARY KEY,
      config JSONB NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS game_rounds (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      game_id VARCHAR(100) NOT NULL,
      bet NUMERIC(18,2) NOT NULL,
      win NUMERIC(18,2) NOT NULL,
      result JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  for (const config of Object.values(DEFAULT_GAMES)) {
    await pool.query(
      `
      INSERT INTO game_configs
      (game_id, config)
      VALUES ($1, $2)
      ON CONFLICT (game_id) DO NOTHING
      `,
      [
        config.id,
        JSON.stringify(config)
      ]
    );
  }
}

await garantirTabela();

/*
========================================================
CONFIGURAÇÕES
========================================================
*/

async function obterConfig(gameId) {
  const result = await pool.query(
    `
    SELECT config
    FROM game_configs
    WHERE game_id = $1
    LIMIT 1
    `,
    [gameId]
  );

  if (!result.rows.length) {
    return null;
  }

  return result.rows[0].config;
}

router.get("/config", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT game_id, config
      FROM game_configs
      ORDER BY game_id
    `);

    const games = result.rows.map(row => ({
      ...row.config,
      id: row.game_id
    }));

    res.json({
      ok: true,
      games
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Erro ao carregar máquinas."
    });
  }
});

/*
========================================================
ADMIN — CONFIGURAÇÕES
========================================================
*/

router.get(
  "/admin/config",
  async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT game_id, config
        FROM game_configs
        ORDER BY game_id
      `);

      res.json({
        ok: true,
        games: result.rows.map(row => ({
          ...row.config,
          id: row.game_id
        }))
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          "Erro ao carregar configurações das máquinas."
      });
    }
  }
);

router.put(
  "/admin/config/:gameId",
  async (req, res) => {
    try {
      const gameId = req.params.gameId;
      const config = req.body?.config;

      if (!config) {
        return res.status(400).json({
          message:
            "Configuração não informada."
        });
      }

      config.id = gameId;

      await pool.query(
        `
        INSERT INTO game_configs
        (game_id, config, updated_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (game_id)
        DO UPDATE SET
          config = EXCLUDED.config,
          updated_at = CURRENT_TIMESTAMP
        `,
        [
          gameId,
          JSON.stringify(config)
        ]
      );

      res.json({
        ok: true,
        message:
          "Configuração da máquina salva.",
        config
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          "Erro ao salvar configuração."
      });
    }
  }
);

/*
========================================================
JOGAR
========================================================
*/

router.post(
  "/:gameId/spin",
  async (req, res) => {

    const client =
      await pool.connect();

    try {
      const gameId =
        req.params.gameId;

      const userId =
        Number(req.body?.userId);

      const bet =
        arredondar(
          numero(req.body?.bet)
        );

      if (!Number.isInteger(userId)) {
        return res.status(400).json({
          message: "Usuário inválido."
        });
      }

      const config =
        await obterConfig(gameId);

      if (!config) {
        return res.status(404).json({
          message:
            "Máquina não encontrada."
        });
      }

      if (!config.enabled) {
        return res.status(403).json({
          message:
            "Esta máquina está temporariamente desativada."
        });
      }

      const userResult =
        await client.query(
          `
          SELECT
            id,
            username,
            balance,
            bonus_balance,
            cash_balance,
            bonus_wager_progress
          FROM users
          WHERE id = $1
          FOR UPDATE
          `,
          [userId]
        );

      if (!userResult.rows.length) {
        return res.status(404).json({
          message:
            "Usuário não encontrado."
        });
      }

      const user =
        userResult.rows[0];

      const bonus =
        numero(user.bonus_balance);

      const cash =
        numero(user.cash_balance);

      const saldo =
        arredondar(
          bonus + cash
        );

      if (bet > saldo) {
        return res.status(400).json({
          message:
            "Saldo insuficiente."
        });
      }

      /*
        O motor gera o resultado antes da alteração
        financeira, dentro da mesma transação.
      */

      const rodada =
        jogarMaquina(
          config,
          bet
        );

      await client.query("BEGIN");

      /*
        Primeiro usa saldo bônus.
        O restante sai do saldo em dinheiro.
      */

      let retirarBonus =
        Math.min(bonus, bet);

      let retirarCash =
        arredondar(
          bet - retirarBonus
        );

      const novoBonus =
        arredondar(
          bonus - retirarBonus
        );

      const novoCash =
        arredondar(
          cash - retirarCash +
          rodada.win
        );

      const novoBalance =
        arredondar(
          novoBonus + novoCash
        );

      const novoProgress =
        arredondar(
          numero(
            user.bonus_wager_progress
          ) + bet
        );

      await client.query(
        `
        UPDATE users
        SET
          bonus_balance = $1,
          cash_balance = $2,
          balance = $3,
          bonus_wager_progress = $4
        WHERE id = $5
        `,
        [
          novoBonus,
          novoCash,
          novoBalance,
          novoProgress,
          userId
        ]
      );

      const roundResult =
        await client.query(
          `
          INSERT INTO game_rounds
          (
            user_id,
            game_id,
            bet,
            win,
            result
          )
          VALUES
          ($1, $2, $3, $4, $5)
          RETURNING id, created_at
          `,
          [
            userId,
            gameId,
            bet,
            rodada.win,
            JSON.stringify(rodada)
          ]
        );

      await client.query("COMMIT");

      res.json({
        ok: true,

        roundId:
          roundResult.rows[0].id,

        gameId,

        bet,

        win:
          rodada.win,

        jackpotWin:
          rodada.jackpotWin,

        result:
          rodada.result,

        lines:
          rodada.lines,

        balance:
          novoBalance,

        bonusBalance:
          novoBonus,

        cashBalance:
          novoCash,

        bonusWagerProgress:
          novoProgress,

        createdAt:
          roundResult.rows[0].created_at
      });

    } catch (error) {

      await client.query(
        "ROLLBACK"
      );

      console.error(error);

      res.status(500).json({
        message:
          error.message ||
          "Erro ao realizar rodada."
      });

    } finally {
      client.release();
    }
  }
);

/*
========================================================
HISTÓRICO
========================================================
*/

router.get(
  "/history/:userId",
  async (req, res) => {
    try {
      const userId =
        Number(req.params.userId);

      const result =
        await pool.query(
          `
          SELECT
            id,
            game_id,
            bet,
            win,
            result,
            created_at
          FROM game_rounds
          WHERE user_id = $1
          ORDER BY created_at DESC
          LIMIT 50
          `,
          [userId]
        );

      res.json({
        ok: true,
        rounds: result.rows
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          "Erro ao carregar histórico."
      });
    }
  }
);

export default router;
