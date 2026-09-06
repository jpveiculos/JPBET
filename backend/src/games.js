import express from "express";

import { pool } from "./db.js";
import { validarSessaoAdmin } from "./adminSession.js";

import {
  executarSpin,
  obterJogoPadrao,
  normalizarConfiguracaoJogo,
  listarJogosPadrao
} from "./gameEngine.js";

const router = express.Router();

/* =========================================================
   FUNÇÕES AUXILIARES
========================================================= */

function numero(valor, padrao = 0) {
  const n = Number(valor);

  return Number.isFinite(n)
    ? n
    : padrao;
}

function arredondar(valor) {
  return Math.round(
    (Number(valor) + Number.EPSILON) * 100
  ) / 100;
}

/* =========================================================
   ADMIN
========================================================= */

function obterTokenAdmin(req) {
  const cookies =
    req.headers.cookie || "";

  const match =
    cookies.match(
      /(?:^|;\s*)jpbet_admin_session=([^;]+)/
    );

  return match
    ? match[1]
    : null;
}

function exigirAdmin(req, res, next) {
  const token =
    obterTokenAdmin(req);

  const sessao =
    validarSessaoAdmin(token);

  if (!sessao) {
    return res.status(401).json({
      message:
        "Sessão administrativa inválida ou expirada."
    });
  }

  req.adminSession =
    sessao;

  next();
}

/* =========================================================
   CONFIGURAÇÃO PÚBLICA
========================================================= */

function limparConfigPublica(config) {
  if (!config) {
    return null;
  }

  return {
    ...config,

    minBet:
      arredondar(
        numero(
          config.minBet,
          1
        )
      ),

    maxBet:
      arredondar(
        numero(
          config.maxBet,
          1000
        )
      ),

    reels:
      Math.max(
        1,
        Math.floor(
          numero(
            config.reels,
            3
          )
        )
      ),

    rows:
      Math.max(
        1,
        Math.floor(
          numero(
            config.rows,
            3
          )
        )
      ),

    lines:
      Array.isArray(
        config.lines
      )
        ? config.lines
        : [],

    symbols:
      Array.isArray(
        config.symbols
      )
        ? config.symbols
        : [],

    bonus:
      config.bonus &&
      typeof config.bonus === "object"
        ? config.bonus
        : {}
  };
}

/* =========================================================
   TABELAS
========================================================= */

async function garantirTabelasJogos() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS game_settings (
      game_id TEXT PRIMARY KEY,
      config JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
        DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS game_rounds (
      id BIGSERIAL PRIMARY KEY,

      round_id TEXT NOT NULL UNIQUE,

      user_id TEXT NOT NULL,

      game_id TEXT NOT NULL,

      bet NUMERIC(14,2)
        NOT NULL DEFAULT 0,

      win NUMERIC(14,2)
        NOT NULL DEFAULT 0,

      free_spin BOOLEAN
        NOT NULL DEFAULT FALSE,

      result JSONB NOT NULL,

      created_at TIMESTAMPTZ
        NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS
    idx_game_rounds_user_created
    ON game_rounds (
      user_id,
      created_at DESC
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS
    idx_game_rounds_game_created
    ON game_rounds (
      game_id,
      created_at DESC
    )
  `);

  const padroes =
    listarJogosPadrao();

  for (const config of padroes) {
    const normalizada =
      normalizarConfiguracaoJogo(
        config
      );

    await pool.query(
      `
      INSERT INTO game_settings (
        game_id,
        config
      )
      VALUES (
        $1,
        $2::jsonb
      )
      ON CONFLICT (game_id)
      DO NOTHING
      `,
      [
        normalizada.id,
        JSON.stringify(
          normalizada
        )
      ]
    );
  }
}

/* =========================================================
   OBTER CONFIGURAÇÃO
========================================================= */

async function obterConfiguracaoJogo(
  gameId
) {
  const result =
    await pool.query(
      `
      SELECT config
      FROM game_settings
      WHERE game_id = $1
      LIMIT 1
      `,
      [gameId]
    );

  if (
    result.rows.length > 0
  ) {
    return normalizarConfiguracaoJogo(
      result.rows[0].config
    );
  }

  const padrao =
    obterJogoPadrao(
      gameId
    );

  if (!padrao) {
    return null;
  }

  const normalizada =
    normalizarConfiguracaoJogo(
      padrao
    );

  await pool.query(
    `
    INSERT INTO game_settings (
      game_id,
      config
    )
    VALUES (
      $1,
      $2::jsonb
    )
    ON CONFLICT (game_id)
    DO NOTHING
    `,
    [
      gameId,
      JSON.stringify(
        normalizada
      )
    ]
  );

  return normalizada;
}

/* =========================================================
   LISTAR CONFIGURAÇÕES
========================================================= */

async function listarConfiguracoesJogos() {
  const padroes =
    listarJogosPadrao();

  const result =
    await pool.query(
      `
      SELECT
        game_id,
        config
      FROM game_settings
      ORDER BY game_id
      `
    );

  const mapa =
    new Map(
      result.rows.map(
        (row) => [
          row.game_id,
          normalizarConfiguracaoJogo(
            row.config
          )
        ]
      )
    );

  return padroes
    .map(
      (padrao) => {
        const config =
          mapa.get(
            padrao.id
          ) ||
          normalizarConfiguracaoJogo(
            padrao
          );

        return limparConfigPublica(
          config
        );
      }
    )
    .filter(Boolean);
}

/* =========================================================
   VALIDAR APOSTA
========================================================= */

function validarAposta(
  aposta,
  config
) {
  const valor =
    arredondar(
      numero(
        aposta,
        NaN
      )
    );

  if (
    !Number.isFinite(
      valor
    ) ||
    valor <= 0
  ) {
    return {
      ok: false,
      message:
        "Informe uma aposta válida."
    };
  }

  const min =
    arredondar(
      numero(
        config.minBet,
        1
      )
    );

  const max =
    arredondar(
      numero(
        config.maxBet,
        1000
      )
    );

  if (
    valor < min
  ) {
    return {
      ok: false,
      message:
        `A aposta mínima é ${min.toFixed(2)}.`
    };
  }

  if (
    valor > max
  ) {
    return {
      ok: false,
      message:
        `A aposta máxima é ${max.toFixed(2)}.`
    };
  }

  return {
    ok: true,
    value: valor
  };
}

/* =========================================================
   USUÁRIO
========================================================= */

async function obterUsuarioBloqueado(
  client,
  userId
) {
  const result =
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

  return (
    result.rows[0] ||
    null
  );
}

function saldoUsuario(user) {
  return arredondar(
    numero(
      user?.bonus_balance,
      0
    ) +
    numero(
      user?.cash_balance,
      0
    )
  );
}

/* =========================================================
   CONSUMIR SALDO
========================================================= */

function consumirSaldo(
  user,
  valor
) {
  let bonus =
    numero(
      user.bonus_balance,
      0
    );

  let cash =
    numero(
      user.cash_balance,
      0
    );

  let restante =
    arredondar(
      valor
    );

  const usadoBonus =
    Math.min(
      bonus,
      restante
    );

  bonus =
    arredondar(
      bonus -
      usadoBonus
    );

  restante =
    arredondar(
      restante -
      usadoBonus
    );

  const usadoCash =
    Math.min(
      cash,
      restante
    );

  cash =
    arredondar(
      cash -
      usadoCash
    );

  restante =
    arredondar(
      restante -
      usadoCash
    );

  if (
    restante > 0.001
  ) {
    return null;
  }

  return {
    bonus,
    cash,

    usadoBonus:
      arredondar(
        usadoBonus
      ),

    usadoCash:
      arredondar(
        usadoCash
      )
  };
}

/* =========================================================
   CREDITAR PRÊMIO
========================================================= */

async function creditarPremio(
  client,
  userId,
  valor
) {
  if (
    valor <= 0
  ) {
    return;
  }

  await client.query(
    `
    UPDATE users
    SET
      cash_balance =
        COALESCE(
          cash_balance,
          0
        ) + $1,

      balance =
        COALESCE(
          bonus_balance,
          0
        ) +
        COALESCE(
          cash_balance,
          0
        ) +
        $1

    WHERE id = $2
    `,
    [
      valor,
      userId
    ]
  );
}

/* =========================================================
   MONTAR USUÁRIO
========================================================= */

function montarUsuarioAtualizado(
  user,
  bonus,
  cash
) {
  const bonusValue =
    arredondar(
      bonus
    );

  const cashValue =
    arredondar(
      cash
    );

  return {
    id:
      user.id,

    username:
      user.username,

    balance:
      arredondar(
        bonusValue +
        cashValue
      ),

    bonusBalance:
      bonusValue,

    cashBalance:
      cashValue,

    reservedBalance:
      arredondar(
        numero(
          user.reserved_balance,
          0
        )
      ),

    bonusWagerProgress:
      arredondar(
        numero(
          user.bonus_wager_progress,
          0
        )
      )
  };
}

/* =========================================================
   GET /api/games
========================================================= */

router.get(
  "/",
  async (
    req,
    res
  ) => {
    try {
      await garantirTabelasJogos();

      const games =
        await listarConfiguracoesJogos();

      res.json({
        ok: true,

        games:
          games.filter(
            (game) =>
              game.enabled !== false
          )
      });
    } catch (error) {
      console.error(
        "Erro ao listar jogos:",
        error
      );

      res.status(500).json({
        message:
          "Não foi possível carregar os jogos."
      });
    }
  }
);

/* =========================================================
   GET /api/games/admin
========================================================= */

router.get(
  "/admin",
  exigirAdmin,
  async (
    req,
    res
  ) => {
    try {
      await garantirTabelasJogos();

      res.json({
        ok: true,

        games:
          await listarConfiguracoesJogos()
      });
    } catch (error) {
      console.error(
        "Erro ao carregar configurações:",
        error
      );

      res.status(500).json({
        message:
          "Não foi possível carregar as configurações dos jogos."
      });
    }
  }
);

/* =========================================================
   GET /api/games/admin/:gameId
========================================================= */

router.get(
  "/admin/:gameId",
  exigirAdmin,
  async (
    req,
    res
  ) => {
    try {
      await garantirTabelasJogos();

      const game =
        await obterConfiguracaoJogo(
          req.params.gameId
        );

      if (!game) {
        return res.status(404).json({
          message:
            "Jogo não encontrado."
        });
      }

      res.json({
        ok: true,
        game
      });
    } catch (error) {
      console.error(
        "Erro ao carregar configuração:",
        error
      );

      res.status(500).json({
        message:
          "Não foi possível carregar a configuração."
      });
    }
  }
);

/* =========================================================
   PUT /api/games/admin/:gameId
========================================================= */

router.put(
  "/admin/:gameId",
  exigirAdmin,
  async (
    req,
    res
  ) => {
    try {
      await garantirTabelasJogos();

      const gameId =
        String(
          req.params.gameId ||
          ""
        ).trim();

      const existente =
        await obterConfiguracaoJogo(
          gameId
        );

      if (!existente) {
        return res.status(404).json({
          message:
            "Jogo não encontrado."
        });
      }

      const recebido =
        req.body?.game ||
        req.body;

      if (
        !recebido ||
        typeof recebido !== "object" ||
        Array.isArray(
          recebido
        )
      ) {
        return res.status(400).json({
          message:
            "Configuração inválida."
        });
      }

      const configuracao =
        normalizarConfiguracaoJogo({
          ...existente,
          ...recebido,
          id: gameId
        });

      const min =
        numero(
          configuracao.minBet,
          1
        );

      const max =
        numero(
          configuracao.maxBet,
          1000
        );

      if (
        min <= 0 ||
        max < min
      ) {
        return res.status(400).json({
          message:
            "Os limites de aposta são inválidos."
        });
      }

      await pool.query(
        `
        INSERT INTO game_settings (
          game_id,
          config,
          updated_at
        )
        VALUES (
          $1,
          $2::jsonb,
          CURRENT_TIMESTAMP
        )

        ON CONFLICT (
          game_id
        )

        DO UPDATE SET
          config =
            EXCLUDED.config,

          updated_at =
            CURRENT_TIMESTAMP
        `,
        [
          gameId,
          JSON.stringify(
            configuracao
          )
        ]
      );

      res.json({
        ok: true,
        game:
          configuracao
      });
    } catch (error) {
      console.error(
        "Erro ao salvar configuração:",
        error
      );

      res.status(500).json({
        message:
          "Não foi possível salvar a configuração do jogo."
      });
    }
  }
);

/* =========================================================
   POST /api/games/spin
========================================================= */

router.post(
  "/spin",
  async (
    req,
    res
  ) => {
    const userId =
      req.body?.userId;

    const gameId =
      String(
        req.body?.gameId ||
        ""
      ).trim();

    if (
      !userId ||
      !gameId
    ) {
      return res.status(400).json({
        message:
          "Usuário e jogo são obrigatórios."
      });
    }

    let client;

    try {
      await garantirTabelasJogos();

      const config =
        await obterConfiguracaoJogo(
          gameId
        );

      if (
        !config ||
        config.enabled === false
      ) {
        return res.status(404).json({
          message:
            "Jogo indisponível."
        });
      }

      const validacao =
        validarAposta(
          req.body?.bet,
          config
        );

      if (
        !validacao.ok
      ) {
        return res.status(400).json({
          message:
            validacao.message
        });
      }

      const aposta =
        validacao.value;

      client =
        await pool.connect();

      await client.query(
        "BEGIN"
      );

      const user =
        await obterUsuarioBloqueado(
          client,
          userId
        );

      if (!user) {
        await client.query(
          "ROLLBACK"
        );

        return res.status(404).json({
          message:
            "Usuário não encontrado."
        });
      }

      const saldoAntes =
        saldoUsuario(
          user
        );

      if (
        saldoAntes + 0.001 <
        aposta
      ) {
        await client.query(
          "ROLLBACK"
        );

        return res.status(400).json({
          message:
            "Saldo insuficiente."
        });
      }

      const consumo =
        consumirSaldo(
          user,
          aposta
        );

      if (!consumo) {
        await client.query(
          "ROLLBACK"
        );

        return res.status(400).json({
          message:
            "Saldo insuficiente."
        });
      }

      /*
       * O servidor nunca confia em
       * freeSpin enviado pelo navegador.
       */
      const resultado =
        executarSpin({
          config,
          bet: aposta,
          freeSpin: false
        });

      const premio =
        arredondar(
          numero(
            resultado.win,
            0
          )
        );

      /*
       * Primeiro retira a aposta.
       */
      await client.query(
        `
        UPDATE users
        SET
          bonus_balance = $1,
          cash_balance = $2,
          balance = $1 + $2
        WHERE id = $3
        `,
        [
          consumo.bonus,
          consumo.cash,
          userId
        ]
      );

      /*
       * Depois acrescenta o prêmio.
       */
      if (
        premio > 0
      ) {
        await creditarPremio(
          client,
          userId,
          premio
        );
      }

      const userDepoisResult =
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
          LIMIT 1
          `,
          [userId]
        );

      const userDepois =
        userDepoisResult
          .rows[0];

      /*
       * Registra a rodada.
       */
      await client.query(
        `
        INSERT INTO game_rounds (
          round_id,
          user_id,
          game_id,
          bet,
          win,
          free_spin,
          result
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7::jsonb
        )
        `,
        [
          resultado.roundId,

          String(
            userId
          ),

          gameId,

          aposta,

          premio,

          false,

          JSON.stringify(
            resultado
          )
        ]
      );

      await client.query(
        "COMMIT"
      );

      res.json({
        ok: true,

        round:
          resultado,

        user:
          montarUsuarioAtualizado(
            userDepois,
            numero(
              userDepois.bonus_balance,
              0
            ),
            numero(
              userDepois.cash_balance,
              0
            )
          ),

        saldoAntes,

        saldoDepois:
          saldoUsuario(
            userDepois
          )
      });
    } catch (error) {
      if (client) {
        try {
          await client.query(
            "ROLLBACK"
          );
        } catch (_) {}
      }

      console.error(
        "Erro ao executar jogo:",
        error
      );

      res.status(500).json({
        message:
          "Não foi possível concluir a rodada."
      });
    } finally {
      if (client) {
        client.release();
      }
    }
  }
);

/* =========================================================
   GET /api/games/:gameId
========================================================= */

router.get(
  "/:gameId",
  async (
    req,
    res
  ) => {
    try {
      await garantirTabelasJogos();

      const game =
        await obterConfiguracaoJogo(
          req.params.gameId
        );

      if (
        !game ||
        game.enabled === false
      ) {
        return res.status(404).json({
          message:
            "Jogo não encontrado."
        });
      }

      res.json({
        ok: true,

        game:
          limparConfigPublica(
            game
          )
      });
    } catch (error) {
      console.error(
        "Erro ao carregar jogo:",
        error
      );

      res.status(500).json({
        message:
          "Não foi possível carregar o jogo."
      });
    }
  }
);

/* =========================================================
   EXPORTAÇÃO
========================================================= */

export {
  garantirTabelasJogos
};

export default router;
