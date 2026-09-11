import express from "express";
import { pool } from "./db.js";
import { validarSessaoAdmin } from "./adminSession.js";

const router = express.Router();

/* =========================
   VERIFICAR ADMIN
========================= */

function exigirAdmin(req, res, next) {
  const cookiesHeader = req.headers.cookie || "";
  const cookies = {};

  cookiesHeader.split(";").forEach((cookie) => {
    const partes = cookie.trim().split("=");

    if (partes.length < 2) {
      return;
    }

    const nome = partes.shift().trim();
    const valor = partes.join("=").trim();

    try {
      cookies[nome] = decodeURIComponent(valor);
    } catch (_) {
      cookies[nome] = valor;
    }
  });

  const token = cookies.jpbet_admin_session || null;
  const sessao = validarSessaoAdmin(token);

  if (!sessao) {
    return res.status(401).json({
      ok: false,
      message: "Acesso administrativo necessário."
    });
  }

  req.admin = sessao;
  next();
}

/* =========================
   CONFIGURAÇÕES PADRÃO
========================= */

const configuracoesPadrao = [
  /* IDENTIDADE */
  ["site_name", "JPBET"],
  ["site_title", "JPBET - Plataforma de Jogos"],
  ["site_description", "Uma experiência de jogos moderna, rápida e pensada para dispositivos móveis."],
  ["footer_text", "© 2026 JPBET — Plataforma de demonstração."],

  /* BÔNUS E SAQUE */
  ["bonus_system_enabled", "true"],
  ["initial_bonus_amount", "100"],
  ["bonus_wager_requirement", "100"],

  /* NOTIFICAÇÕES / WHATSAPP */
  ["notification_enabled", "false"],
  ["notification_deposit_requested", "true"],
  ["notification_withdrawal_requested", "true"],
  ["notification_deposit_approved", "true"],
  ["notification_deposit_rejected", "true"],
  ["notification_withdrawal_approved", "true"],
  ["notification_withdrawal_rejected", "true"],
  ["notification_withdrawal_completed", "true"],
  ["notification_webhook_url", ""],
  ["notification_webhook_token", ""],
  ["notification_recipient", ""],

  /* ROLETA */
  ["roulette_enabled", "true"],
  ["roulette_min_bet", "0.50"],
  ["roulette_max_bet", "100"],
  ["roulette_rtp", "50"],
  ["roulette_replay_probability", "8"],
  ["roulette_free_spin_enabled", "true"],
  ["roulette_segments_json", "[{\"label\":\"2x\",\"type\":\"prize\",\"multiplier\":2,\"probability\":5},{\"label\":\"X\",\"type\":\"zero\",\"multiplier\":0,\"probability\":5},{\"label\":\"X\",\"type\":\"zero\",\"multiplier\":0,\"probability\":5},{\"label\":\"X\",\"type\":\"zero\",\"multiplier\":0,\"probability\":5},{\"label\":\"X\",\"type\":\"zero\",\"multiplier\":0,\"probability\":5},{\"label\":\"2x\",\"type\":\"prize\",\"multiplier\":2,\"probability\":5},{\"label\":\"X\",\"type\":\"zero\",\"multiplier\":0,\"probability\":5},{\"label\":\"X\",\"type\":\"zero\",\"multiplier\":0,\"probability\":5},{\"label\":\"X\",\"type\":\"zero\",\"multiplier\":0,\"probability\":5},{\"label\":\"X\",\"type\":\"zero\",\"multiplier\":0,\"probability\":5},{\"label\":\"2x\",\"type\":\"prize\",\"multiplier\":2,\"probability\":5},{\"label\":\"X\",\"type\":\"zero\",\"multiplier\":0,\"probability\":5},{\"label\":\"X\",\"type\":\"zero\",\"multiplier\":0,\"probability\":5},{\"label\":\"X\",\"type\":\"zero\",\"multiplier\":0,\"probability\":5},{\"label\":\"X\",\"type\":\"zero\",\"multiplier\":0,\"probability\":5},{\"label\":\"2x\",\"type\":\"prize\",\"multiplier\":2,\"probability\":5},{\"label\":\"X\",\"type\":\"zero\",\"multiplier\":0,\"probability\":5},{\"label\":\"X\",\"type\":\"zero\",\"multiplier\":0,\"probability\":5},{\"label\":\"X\",\"type\":\"zero\",\"multiplier\":0,\"probability\":5},{\"label\":\"X\",\"type\":\"zero\",\"multiplier\":0,\"probability\":5}]"],
  ["roulette_animation_ms", "1800"],
  ["roulette_red_color", "#e51f35"],
  ["roulette_black_color", "#171717"],
  ["roulette_green_color", "#08a83e"],
  ["roulette_accent_color", "#ffd43b"],
  ["roulette_background_color", "#fff7d6"],

  /* APARÊNCIA DO DASHBOARD */
  ["dashboard_background", "#f5f7ff"],
  ["dashboard_card_color", "#ffffff"],
  ["dashboard_primary_color", "#ffcc00"],
  ["dashboard_secondary_color", "#6c3cff"],
  ["dashboard_text_color", "#171717"],

  /* BOTÕES */
  ["primary_button_text", "ENTRAR NA PLATAFORMA"],
  ["login_button_text", "ENTRAR"],
  ["register_button_text", "CRIAR CONTA"],
  ["roulette_button_text", "🎰 JOGAR NA ROLETA"],

  /* MANUTENÇÃO */
  ["maintenance_mode", "false"],
  ["maintenance_message", "Plataforma temporariamente em manutenção."],

  /* TEXTOS DO DASHBOARD */
  ["dashboard_welcome_text", "Bem-vindo à plataforma JPBET."],
  ["balance_title", "Seu saldo"],
  ["account_title", "Minha conta"],
  ["logout_button_text", "SAIR DA CONTA"],
  ["deposit_button_text", "💰 DEPOSITAR"],
  ["withdraw_button_text", "💸 SACAR"],
  ["history_button_text", "📋 HISTÓRICO"],

  /* CRÉDITOS VIRTUAIS */
  ["virtual_credits_mode", "true"],
  ["virtual_credits_text", "Esta plataforma utiliza créditos virtuais para demonstração."],
  ["virtual_credits_disclaimer", "Os créditos desta versão não representam dinheiro real."],
  ["virtual_credits_notice", "🎮 Esta versão utiliza exclusivamente créditos virtuais para demonstração. Os créditos não representam dinheiro real."],

  /* PIX / DEPÓSITOS */
  ["pix_enabled", "true"],
  ["pix_key", "38135fb2-dd1f-44aa-ab51-d2670ee36c7d"],
  ["pix_key_type", "aleatoria"],
  ["pix_receiver_name", "João Paulo da Silva"],
  ["pix_city", "Paramirim"],
  ["pix_description", "JPBET"],
  ["pix_instructions", "Após realizar o Pix, clique em JÁ FIZ O PIX. O crédito será liberado somente após a conferência do administrador."]
];

/* =========================
   CRIAR TABELA
========================= */

async function inicializarConfiguracoes() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS site_settings (
        id SERIAL PRIMARY KEY,
        setting_key VARCHAR(100) UNIQUE NOT NULL,
        setting_value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    for (const [key, value] of configuracoesPadrao) {
      await pool.query(
        `
        INSERT INTO site_settings
        (
          setting_key,
          setting_value
        )
        VALUES
        ($1, $2)
        ON CONFLICT (setting_key)
        DO NOTHING
        `,
        [key, value]
      );
    }

    // Migra somente o modelo antigo padrão da roleta. Configurações
    // personalizadas diferentes continuam intactas.
    const rouletteCurrent = await pool.query(`
      SELECT setting_value FROM site_settings
      WHERE setting_key = 'roulette_segments_json' LIMIT 1
    `);
    const currentRoulette = String(rouletteCurrent.rows[0]?.setting_value || '');
    if (currentRoulette.includes('JOGUE NOVAMENTE') || currentRoulette.includes('"multiplier":1')) {
      const novoPadrao = configuracoesPadrao.find(([key]) => key === 'roulette_segments_json')?.[1];
      if (novoPadrao) {
        await pool.query(`UPDATE site_settings SET setting_value = $1, updated_at = CURRENT_TIMESTAMP WHERE setting_key = 'roulette_segments_json'`, [novoPadrao]);
      }
    }

    // Migração específica do prêmio 4: o índice 10 era 4x na versão anterior.
    // Mantém as demais configurações e altera somente esse prêmio para 2x.
    if (currentRoulette) {
      try {
        const segmentos = JSON.parse(currentRoulette);
        if (Array.isArray(segmentos) && segmentos.length === 20) {
          let alterado = false;
          const atualizados = segmentos.map((segmento, index) => {
            if (
              index === 10 &&
              String(segmento?.type || '').toLowerCase() === 'prize' &&
              Number(segmento?.multiplier) === 4
            ) {
              alterado = true;
              return {
                ...segmento,
                label: '2x',
                multiplier: 2
              };
            }
            return segmento;
          });

          if (alterado) {
            await pool.query(
              `UPDATE site_settings SET setting_value = $1, updated_at = CURRENT_TIMESTAMP WHERE setting_key = 'roulette_segments_json'`,
              [JSON.stringify(atualizados)]
            );
            console.log('Prêmio 4 da roleta atualizado de 4x para 2x.');
          }
        }
      } catch (error) {
        console.warn('Não foi possível migrar automaticamente o prêmio 4 da roleta:', error.message);
      }
    }

    console.log(
      "Configurações do JPBET inicializadas com sucesso."
    );
  } catch (error) {
    console.error(
      "Erro ao inicializar configurações:",
      error
    );
  }
}

inicializarConfiguracoes();

/* =========================
   CONFIGURAÇÕES PÚBLICAS
========================= */

router.get(
  "/public",
  async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          setting_key,
          setting_value
        FROM site_settings
        WHERE setting_key NOT LIKE 'notification_%'
        ORDER BY setting_key
      `);

      const settings = {};

      for (const row of result.rows) {
        settings[row.setting_key] =
          row.setting_value;
      }

      res.json({
        ok: true,
        settings
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        message:
          "Erro ao carregar configurações públicas."
      });
    }
  }
);

/* =========================
   LISTAR CONFIGURAÇÕES
   SOMENTE ADMIN
========================= */

router.get(
  "/",
  exigirAdmin,
  async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          setting_key,
          setting_value,
          updated_at
        FROM site_settings
        ORDER BY setting_key
      `);

      res.json({
        ok: true,
        settings: result.rows
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        message:
          "Erro ao carregar configurações."
      });
    }
  }
);

/* =========================
   BUSCAR UMA CONFIGURAÇÃO
   SOMENTE ADMIN
========================= */

router.get(
  "/:key",
  exigirAdmin,
  async (req, res) => {
    try {
      const { key } = req.params;

      const result = await pool.query(
        `
        SELECT
          setting_key,
          setting_value,
          updated_at
        FROM site_settings
        WHERE setting_key = $1
        LIMIT 1
        `,
        [key]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          ok: false,
          message:
            "Configuração não encontrada."
        });
      }

      res.json({
        ok: true,
        setting: result.rows[0]
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        message:
          "Erro ao buscar configuração."
      });
    }
  }
);

/* =========================
   ALTERAR CONFIGURAÇÃO
   SOMENTE ADMIN
========================= */

router.put(
  "/:key",
  exigirAdmin,
  async (req, res) => {
    try {
      const { key } = req.params;
      const { value } = req.body;

      if (!key || key.length > 100) {
        return res.status(400).json({
          ok: false,
          message:
            "Chave de configuração inválida."
        });
      }

      if (
        value === undefined ||
        value === null
      ) {
        return res.status(400).json({
          ok: false,
          message:
            "Informe o novo valor."
        });
      }

      const result = await pool.query(
        `
        INSERT INTO site_settings
        (
          setting_key,
          setting_value,
          updated_at
        )
        VALUES
        (
          $1,
          $2,
          CURRENT_TIMESTAMP
        )
        ON CONFLICT (setting_key)
        DO UPDATE SET
          setting_value =
            EXCLUDED.setting_value,
          updated_at =
            CURRENT_TIMESTAMP
        RETURNING
          setting_key,
          setting_value,
          updated_at
        `,
        [
          key,
          String(value)
        ]
      );

      res.json({
        ok: true,
        message:
          "Configuração atualizada com sucesso.",
        setting: result.rows[0]
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        message:
          "Erro ao atualizar configuração."
      });
    }
  }
);

/* =========================
   ALTERAR VÁRIAS
   SOMENTE ADMIN
========================= */

router.put(
  "/",
  exigirAdmin,
  async (req, res) => {
    try {
      const settings = req.body;

      if (
        !settings ||
        typeof settings !== "object" ||
        Array.isArray(settings)
      ) {
        return res.status(400).json({
          ok: false,
          message:
            "Formato de configurações inválido."
        });
      }

      const entradas =
        Object.entries(settings);

      if (entradas.length === 0) {
        return res.status(400).json({
          ok: false,
          message:
            "Nenhuma configuração foi enviada."
        });
      }

      for (const [key, value] of entradas) {
        if (
          !key ||
          key.length > 100
        ) {
          continue;
        }

        if (
          value === undefined ||
          value === null
        ) {
          continue;
        }

        await pool.query(
          `
          INSERT INTO site_settings
          (
            setting_key,
            setting_value,
            updated_at
          )
          VALUES
          (
            $1,
            $2,
            CURRENT_TIMESTAMP
          )
          ON CONFLICT (setting_key)
          DO UPDATE SET
            setting_value =
              EXCLUDED.setting_value,
            updated_at =
              CURRENT_TIMESTAMP
          `,
          [
            key,
            String(value)
          ]
        );
      }

      res.json({
        ok: true,
        message:
          "Configurações atualizadas com sucesso."
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        message:
          "Erro ao atualizar configurações."
      });
    }
  }
);

export default router;
