// backend/src/games.js

import express from "express";
import { pool } from "./db.js";
import {
  DEFAULT_GAMES,
  obterJogoPadrao,
  normalizarConfiguracaoJogo,
  executarSpin,
  arredondar,
  gerarIdRodada
} from "./gameEngine.js";
import { validarSessaoAdmin } from "./adminSession.js";
import { registrarAuditoria } from "./audit.js";

const router = express.Router();

/* =========================================================
   BANCO DE DADOS
========================================================= */

export async function garantirTabelasJogos() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS game_configs (
      id TEXT PRIMARY KEY,
      config JSONB NOT NULL,
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS game_rounds (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      game_id TEXT NOT NULL,
      bet NUMERIC(14,2) NOT NULL DEFAULT 0,
      win NUMERIC(14,2) NOT NULL DEFAULT 0,
      free_spin BOOLEAN NOT NULL DEFAULT FALSE,
      result JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  /*
   * Cria as configurações iniciais dos jogos somente se
   * ainda não existirem.
   */
  for (const game of Object.values(DEFAULT_GAMES)) {
    await pool.query(
      `
        INSERT INTO game_configs
          (id, config, enabled)
        VALUES
          ($1, $2::jsonb, $3)
        ON CONFLICT (id) DO NOTHING
      `,
      [
        game.id,
        JSON.stringify(game),
        game.enabled !== false
      ]
    );
  }
}

/* =========================================================
   FUNÇÕES AUXILIARES
========================================================= */

function numero(valor, padrao = 0) {
  const n = Number(valor);
  return Number.isFinite(n) ? n : padrao;
}

function obterTokenAdmin(req) {
  const cookies =
    req.headers.cookie || "";

  const match = cookies.match(
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
      ok: false,
      message:
        "Sessão administrativa inválida ou expirada."
    });
  }

  req.adminSession = sessao;

  next();
}

async function obterUsuario(userId) {
  const result =
    await pool.query(
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

  return result.rows[0] || null;
}

async function obterConfiguracaoJogo(gameId) {
  const result =
    await pool.query(
      `
        SELECT
          id,
          config,
          enabled
        FROM game_configs
        WHERE id = $1
        LIMIT 1
      `,
      [gameId]
    );

  if (
    result.rows.length === 0
  ) {
    return null;
  }

  const row =
    result.rows[0];

  const config =
    normalizarConfiguracaoJogo(
      row.config
    );

  if (!config) {
    return null;
  }

  config.enabled =
    row.enabled !== false;

  return config;
}

function montarUsuario(usuario) {
  return {
    id: usuario.id,
    username: usuario.username,
    balance: numero(
      usuario.balance
    ),
    bonusBalance: numero(
      usuario.bonus_balance
    ),
    cashBalance: numero(
      usuario.cash_balance
    ),
    reservedBalance: numero(
      usuario.reserved_balance
    ),
    bonusWagerProgress: numero(
      usuario.bonus_wager_progress
    )
  };
}

/*
 * O sistema atual do JPBET ainda identifica o jogador pelo
 * userId enviado pelo frontend.
 *
 * A estrutura abaixo mantém compatibilidade com o sistema
 * atual. A autenticação do jogador poderá ser endurecida
 * posteriormente com uma sessão/token próprio.
 */
function obterUserId(req) {
  const bodyUserId =
    req.body?.userId;

  const queryUserId =
    req.query?.userId;

  const paramsUserId =
    req.params?.userId;

  return (
    bodyUserId ??
    queryUserId ??
    paramsUserId ??
    null
  );
}

/* =========================================================
   LISTA PÚBLICA DE JOGOS
========================================================= */

router.get(
  "/",
  async (req, res) => {
    try {
      const result =
        await pool.query(`
          SELECT
            id,
            config,
            enabled,
            updated_at
          FROM game_configs
          WHERE enabled = TRUE
          ORDER BY created_at ASC
        `);

      const jogos =
        result.rows.map(
          (row) => {
            const config =
              normalizarConfiguracaoJogo(
                row.config
              );

            if (!config) {
              return null;
            }

            return {
              id: config.id,
              name: config.name,
              enabled: true,
              reels: config.reels,
              rows: config.rows,
              minBet: config.minBet,
              maxBet: config.maxBet,
              lines:
                Array.isArray(
                  config.lines
                )
                  ? config.lines.length
                  : 0,
              symbols:
                config.symbols
            };
          }
        ).filter(Boolean);

      return res.json({
        ok: true,
        games: jogos
      });
    } catch (error) {
      console.error(
        "Erro ao listar jogos:",
        error
      );

      return res.status(500).json({
        ok: false,
        message:
          "Não foi possível carregar os jogos."
      });
    }
  }
);

/* =========================================================
   CONFIGURAÇÃO PÚBLICA DE UM JOGO
========================================================= */

router.get(
  "/:gameId",
  async (req, res) => {
    try {
      const {
        gameId
      } = req.params;

      const config =
        await obterConfiguracaoJogo(
          gameId
        );

      if (!config) {
        return res.status(404).json({
          ok: false,
          message:
            "Jogo não encontrado."
        });
      }

      if (config.enabled === false) {
        return res.status(403).json({
          ok: false,
          message:
            "Este jogo está desativado."
        });
      }

      return res.json({
        ok: true,
        game: {
          id: config.id,
          name: config.name,
          reels: config.reels,
          rows: config.rows,
          minBet: config.minBet,
          maxBet: config.maxBet,
          lines: config.lines,
          symbols: config.symbols,
          paytable: config.paytable,
          wildSymbols:
            config.wildSymbols,
          scatterSymbols:
            config.scatterSymbols,
          bonus: config.bonus
        }
      });
    } catch (error) {
      console.error(
        "Erro ao carregar jogo:",
        error
      );

      return res.status(500).json({
        ok: false,
        message:
          "Não foi possível carregar o jogo."
      });
    }
  }
);

/* =========================================================
   GIRAR / APOSTAR
========================================================= */

router.post(
  "/spin",
  async (req, res) => {
    const client =
      await pool.connect();

    try {
      const {
        gameId,
        bet,
        freeSpin = false
      } = req.body || {};

      const userId =
        obterUserId(req);

      if (!userId) {
        return res.status(400).json({
          ok: false,
          message:
            "Usuário não informado."
        });
      }

      const valorAposta =
        arredondar(
          numero(
            bet,
            0
          )
        );

      if (
        !gameId ||
        !Number.isFinite(
          Number(valorAposta)
        )
      ) {
        return res.status(400).json({
          ok: false,
          message:
            "Jogo ou aposta inválida."
        });
      }

      if (
        valorAposta <= 0 &&
        !freeSpin
      ) {
        return res.status(400).json({
          ok: false,
          message:
            "Informe um valor de aposta válido."
        });
      }

      const config =
        await obterConfiguracaoJogo(
          gameId
        );

      if (!config) {
        return res.status(404).json({
          ok: false,
          message:
            "Jogo não encontrado."
        });
      }

      if (
        config.enabled === false
      ) {
        return res.status(403).json({
          ok: false,
          message:
            "Este jogo está desativado."
        });
      }

      if (
        !freeSpin &&
        valorAposta < config.minBet
      ) {
        return res.status(400).json({
          ok: false,
          message:
            `A aposta mínima é ${config.minBet}.`
        });
      }

      if (
        !freeSpin &&
        valorAposta > config.maxBet
      ) {
        return res.status(400).json({
          ok: false,
          message:
            `A aposta máxima é ${config.maxBet}.`
        });
      }

      await client.query(
        "BEGIN"
      );

      const usuarioResult =
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

      if (
        usuarioResult.rows.length === 0
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

      const usuario =
        usuarioResult.rows[0];

      let bonusBalance =
        numero(
          usuario.bonus_balance
        );

      let cashBalance =
        numero(
          usuario.cash_balance
        );

      let balance =
        numero(
          usuario.balance
        );

      let bonusWagerProgress =
        numero(
          usuario.bonus_wager_progress
        );

      /*
       * Para um giro normal:
       * primeiro utiliza saldo de bônus,
       * depois saldo em dinheiro.
       */
      let usadoBonus = 0;
      let usadoCash = 0;

      if (!freeSpin) {
        let restante =
          valorAposta;

        usadoBonus =
          Math.min(
            bonusBalance,
            restante
          );

        restante =
          arredondar(
            restante -
            usadoBonus
          );

        usadoCash =
          Math.min(
            cashBalance,
            restante
          );

        restante =
          arredondar(
            restante -
            usadoCash
          );

        if (restante > 0) {
          await client.query(
            "ROLLBACK"
          );

          return res.status(400).json({
            ok: false,
            message:
              "Saldo insuficiente para realizar esta aposta.",
            balance,
            bonusBalance,
            cashBalance
          });
        }

        bonusBalance =
          arredondar(
            bonusBalance -
            usadoBonus
          );

        cashBalance =
          arredondar(
            cashBalance -
            usadoCash
          );

        balance =
          arredondar(
            balance -
            valorAposta
          );

        /*
         * A aposta feita com saldo de bônus
         * aumenta o progresso do bônus.
         */
        if (usadoBonus > 0) {
          bonusWagerProgress =
            arredondar(
              bonusWagerProgress +
              usadoBonus
            );
        }
      }

      /*
       * Executa o resultado do jogo.
       */
      const resultado =
        executarSpin({
          config,
          bet:
            freeSpin
              ? 0
              : valorAposta,
          freeSpin:
            Boolean(freeSpin)
        });

      const premio =
        arredondar(
          numero(
            resultado.win,
            0
          )
        );

      /*
       * O prêmio volta para o saldo.
       *
       * Mantemos a regra do projeto:
       * prêmio de uma aposta que utilizou bônus
       * retorna para bonus_balance.
       *
       * Se a aposta utilizou somente dinheiro,
       * o prêmio retorna para cash_balance.
       */
      if (!freeSpin) {
        if (usadoBonus > 0) {
          bonusBalance =
            arredondar(
              bonusBalance +
              premio
            );
        } else {
          cashBalance =
            arredondar(
              cashBalance +
              premio
            );
        }

        balance =
          arredondar(
            balance +
            premio
          );
      } else {
        /*
         * Em free spin, o prêmio é colocado
         * no saldo de bônus.
         */
        bonusBalance =
          arredondar(
            bonusBalance +
            premio
          );

        balance =
          arredondar(
            balance +
            premio
          );
      }

      /*
       * Registra a rodada.
       */
      const roundId =
        resultado.roundId ||
        gerarIdRodada();

      resultado.roundId =
        roundId;

      await client.query(
        `
          INSERT INTO game_rounds
            (
              id,
              user_id,
              game_id,
              bet,
              win,
              free_spin,
              result
            )
          VALUES
            (
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
          roundId,
          userId,
          gameId,
          freeSpin
            ? 0
            : valorAposta,
          premio,
          Boolean(freeSpin),
          JSON.stringify(
            resultado
          )
        ]
      );

      /*
       * Atualiza o usuário.
       */
      await client.query(
        `
          UPDATE users
          SET
            balance = $1,
            bonus_balance = $2,
            cash_balance = $3,
            bonus_wager_progress = $4
          WHERE id = $5
        `,
        [
          balance,
          bonusBalance,
          cashBalance,
          bonusWagerProgress,
          userId
        ]
      );

      await client.query(
        "COMMIT"
      );

      /*
       * Auditoria administrativa.
       *
       * Falha na auditoria não deve desfazer
       * uma rodada já concluída.
       */
      try {
        await registrarAuditoria({
          action:
            "game_spin",
          adminId: null,
          targetUserId:
            Number(userId),
          metadata: {
            gameId,
            roundId,
            bet:
              freeSpin
                ? 0
                : valorAposta,
            win: premio
          }
        });
      } catch (auditError) {
        console.warn(
          "Não foi possível registrar auditoria do jogo:",
          auditError.message
        );
      }

      const usuarioAtualizado =
        await obterUsuario(
          userId
        );

      return res.json({
        ok: true,

        game: {
          id: config.id,
          name: config.name
        },

        round: resultado,

        user:
          usuarioAtualizado
            ? montarUsuario(
                usuarioAtualizado
              )
            : {
                id: userId,
                balance,
                bonusBalance,
                cashBalance,
                bonusWagerProgress
              }
      });
    } catch (error) {
      try {
        await client.query(
          "ROLLBACK"
        );
      } catch (_) {}

      console.error(
        "Erro no giro do jogo:",
        error
      );

      return res.status(500).json({
        ok: false,
        message:
          "Não foi possível realizar a rodada."
      });
    } finally {
      client.release();
    }
  }
);

/* =========================================================
   HISTÓRICO DO JOGADOR
========================================================= */

router.get(
  "/history/:userId",
  async (req, res) => {
    try {
      const {
        userId
      } = req.params;

      const limit =
        Math.min(
          100,
          Math.max(
            1,
            Math.floor(
              numero(
                req.query.limit,
                30
              )
            )
          )
        );

      const result =
        await pool.query(
          `
            SELECT
              id,
              user_id,
              game_id,
              bet,
              win,
              free_spin,
              result,
              created_at
            FROM game_rounds
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT $2
          `,
          [
            userId,
            limit
          ]
        );

      return res.json({
        ok: true,
        rounds:
          result.rows
      });
    } catch (error) {
      console.error(
        "Erro ao buscar histórico dos jogos:",
        error
      );

      return res.status(500).json({
        ok: false,
        message:
          "Não foi possível carregar o histórico."
      });
    }
  }
);

/* =========================================================
   ADMIN — LISTAR CONFIGURAÇÕES
========================================================= */

router.get(
  "/admin/configs",
  exigirAdmin,
  async (req, res) => {
    try {
      const result =
        await pool.query(`
          SELECT
            id,
            config,
            enabled,
            created_at,
            updated_at
          FROM game_configs
          ORDER BY created_at ASC
        `);

      const games =
        result.rows.map(
          (row) => ({
            id: row.id,
            enabled:
              row.enabled !== false,
            config:
              normalizarConfiguracaoJogo(
                row.config
              ),
            createdAt:
              row.created_at,
            updatedAt:
              row.updated_at
          })
        );

      return res.json({
        ok: true,
        games
      });
    } catch (error) {
      console.error(
        "Erro ao listar configurações:",
        error
      );

      return res.status(500).json({
        ok: false,
        message:
          "Não foi possível carregar as configurações dos jogos."
      });
    }
  }
);

/* =========================================================
   ADMIN — SALVAR CONFIGURAÇÃO
========================================================= */

router.put(
  "/admin/configs/:gameId",
  exigirAdmin,
  async (req, res) => {
    try {
      const {
        gameId
      } = req.params;

      const recebido =
        req.body?.config ||
        req.body;

      if (
        !recebido ||
        typeof recebido !== "object"
      ) {
        return res.status(400).json({
          ok: false,
          message:
            "Configuração inválida."
        });
      }

      const config =
        normalizarConfiguracaoJogo({
          ...recebido,
          id: gameId
        });

      if (!config) {
        return res.status(400).json({
          ok: false,
          message:
            "Não foi possível validar a configuração."
        });
      }

      const enabled =
        req.body?.enabled !== undefined
          ? Boolean(
              req.body.enabled
            )
          : config.enabled !== false;

      config.enabled =
        enabled;

      await pool.query(
        `
          INSERT INTO game_configs
            (
              id,
              config,
              enabled,
              updated_at
            )
          VALUES
            (
              $1,
              $2::jsonb,
              $3,
              NOW()
            )
          ON CONFLICT (id)
          DO UPDATE SET
            config = EXCLUDED.config,
            enabled = EXCLUDED.enabled,
            updated_at = NOW()
        `,
        [
          gameId,
          JSON.stringify(
            config
          ),
          enabled
        ]
      );

      try {
        await registrarAuditoria({
          action:
            "game_config_update",
          adminId:
            req.adminSession?.adminId ||
            req.adminSession?.id ||
            null,
          targetUserId:
            null,
          metadata: {
            gameId,
            enabled
          }
        });
      } catch (auditError) {
        console.warn(
          "Falha ao registrar auditoria:",
          auditError.message
        );
      }

      return res.json({
        ok: true,
        message:
          "Configuração do jogo salva.",
        game: {
          id: gameId,
          enabled,
          config
        }
      });
    } catch (error) {
      console.error(
        "Erro ao salvar configuração do jogo:",
        error
      );

      return res.status(500).json({
        ok: false,
        message:
          "Não foi possível salvar a configuração."
      });
    }
  }
);

/* =========================================================
   ADMIN — ATIVAR/DESATIVAR JOGO
========================================================= */

router.patch(
  "/admin/configs/:gameId/status",
  exigirAdmin,
  async (req, res) => {
    try {
      const {
        gameId
      } = req.params;

      const enabled =
        Boolean(
          req.body?.enabled
        );

      const result =
        await pool.query(
          `
            UPDATE game_configs
            SET
              enabled = $1,
              updated_at = NOW()
            WHERE id = $2
            RETURNING
              id,
              enabled,
              config
          `,
          [
            enabled,
            gameId
          ]
        );

      if (
        result.rows.length === 0
      ) {
        return res.status(404).json({
          ok: false,
          message:
            "Jogo não encontrado."
        });
      }

      try {
        await registrarAuditoria({
          action:
            "game_status_update",
          adminId:
            req.adminSession?.adminId ||
            req.adminSession?.id ||
            null,
          targetUserId:
            null,
          metadata: {
            gameId,
            enabled
          }
        });
      } catch (auditError) {
        console.warn(
          "Falha ao registrar auditoria:",
          auditError.message
        );
      }

      return res.json({
        ok: true,
        game: {
          id:
            result.rows[0].id,
          enabled:
            result.rows[0].enabled
        }
      });
    } catch (error) {
      console.error(
        "Erro ao alterar status do jogo:",
        error
      );

      return res.status(500).json({
        ok: false,
        message:
          "Não foi possível alterar o status do jogo."
      });
    }
  }
);

/* =========================================================
   ADMIN — RESTAURAR PADRÃO
========================================================= */

router.post(
  "/admin/configs/:gameId/reset",
  exigirAdmin,
  async (req, res) => {
    try {
      const {
        gameId
      } = req.params;

      const padrao =
        obterJogoPadrao(
          gameId
        );

      if (!padrao) {
        return res.status(404).json({
          ok: false,
          message:
            "Não existe configuração padrão para este jogo."
        });
      }

      await pool.query(
        `
          UPDATE game_configs
          SET
            config = $1::jsonb,
            enabled = $2,
            updated_at = NOW()
          WHERE id = $3
        `,
        [
          JSON.stringify(
            padrao
          ),
          padrao.enabled !== false,
          gameId
        ]
      );

      try {
        await registrarAuditoria({
          action:
            "game_config_reset",
          adminId:
            req.adminSession?.adminId ||
            req.adminSession?.id ||
            null,
          targetUserId:
            null,
          metadata: {
            gameId
          }
        });
      } catch (auditError) {
        console.warn(
          "Falha ao registrar auditoria:",
          auditError.message
        );
      }

      return res.json({
        ok: true,
        message:
          "Configuração restaurada para o padrão.",
        game: normalizarConfiguracaoJogo(
          padrao
        )
      });
    } catch (error) {
      console.error(
        "Erro ao restaurar jogo:",
        error
      );

      return res.status(500).json({
        ok: false,
        message:
          "Não foi possível restaurar a configuração."
      });
    }
  }
);

/* =========================================================
   ADMIN — HISTÓRICO GERAL
========================================================= */

router.get(
  "/admin/rounds",
  exigirAdmin,
  async (req, res) => {
    try {
      const limit =
        Math.min(
          200,
          Math.max(
            1,
            Math.floor(
              numero(
                req.query.limit,
                100
              )
            )
          )
        );

      const result =
        await pool.query(
          `
            SELECT
              gr.id,
              gr.user_id,
              u.username,
              gr.game_id,
              gr.bet,
              gr.win,
              gr.free_spin,
              gr.result,
              gr.created_at
            FROM game_rounds gr
            LEFT JOIN users u
              ON u.id = gr.user_id
            ORDER BY gr.created_at DESC
            LIMIT $1
          `,
          [limit]
        );

      return res.json({
        ok: true,
        rounds:
          result.rows
      });
    } catch (error) {
      console.error(
        "Erro ao carregar rodadas administrativas:",
        error
      );

      return res.status(500).json({
        ok: false,
        message:
          "Não foi possível carregar as rodadas."
      });
    }
  }
);

/* =========================================================
   EXPORTAÇÃO
========================================================= */

export default router;
