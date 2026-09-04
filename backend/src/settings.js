import express from "express";
import { pool } from "./db.js";
import { validarSessaoAdmin } from "./adminSession.js";
const router = express.Router();
/* =========================
   VERIFICAR ADMIN
========================= */
function exigirAdmin(req, res, next) {
  const cookies =
    req.headers.cookie || "";
  const match =
    cookies.match(
      /(?:^|;\s*)jpbet_admin_session=([^;]+)/
    );
  const token =
    match ? match[1] : null;
  const sessao =
    validarSessaoAdmin(token);
  if (!sessao) {
    return res.status(401).json({
      ok: false,
      message:
        "Acesso administrativo necessário."
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
  [
    "site_name",
    "JPBET"
  ],
  [
    "site_title",
    "JPBET - Plataforma de Jogos"
  ],
  [
    "site_description",
    "Uma experiência de jogos moderna, rápida e pensada para dispositivos móveis."
  ],
  [
    "footer_text",
    "© 2026 JPBET — Plataforma de demonstração."
  ],
  /* ROLETA */
  [
    "roulette_enabled",
    "true"
  ],
  [
    "roulette_min_bet",
    "1"
  ],
  [
    "roulette_max_bet",
    "100"
  ],
  [
    "roulette_rtp",
    "95"
  ],
  [
    "roulette_sound_enabled",
    "true"
  ],
  [
    "roulette_animation_ms",
    "4800"
  ],
  [
    "roulette_red_color",
    "#e51f35"
  ],
  [
    "roulette_black_color",
    "#171717"
  ],
  [
    "roulette_green_color",
    "#08a83e"
  ],
  [
    "roulette_accent_color",
    "#ffd43b"
  ],
  [
    "roulette_background_color",
    "#fff7d6"
  ],
  /* APARÊNCIA DO DASHBOARD */
  [
    "dashboard_background",
    "#f5f7ff"
  ],
  [
    "dashboard_card_color",
    "#ffffff"
  ],
  [
    "dashboard_primary_color",
    "#ffcc00"
  ],
  [
    "dashboard_secondary_color",
    "#6c3cff"
  ],
  [
    "dashboard_text_color",
    "#171717"
  ],
  /* BOTÕES */
  [
    "primary_button_text",
    "ENTRAR NA PLATAFORMA"
  ],
  [
    "login_button_text",
    "ENTRAR"
  ],
  [
    "register_button_text",
    "CRIAR CONTA"
  ],
  [
    "roulette_button_text",
    "🎰 JOGAR NA ROLETA"
  ],
  /* MANUTENÇÃO */
  [
    "maintenance_mode",
    "false"
  ],
  [
    "maintenance_message",
    "Plataforma temporariamente em manutenção."
  ],
  /* TEXTOS DO DASHBOARD */
  [
    "dashboard_welcome_text",
    "Bem-vindo à plataforma JPBET."
  ],
  [
    "balance_title",
    "Seu saldo"
  ],
  [
    "account_title",
    "Minha conta"
  ],
  [
    "logout_button_text",
    "SAIR DA CONTA"
  ],
  [
    "deposit_button_text",
    "💰 DEPOSITAR"
  ],
  [
    "withdraw_button_text",
    "💸 SACAR"
  ],
  [
    "history_button_text",
    "📋 HISTÓRICO"
  ],
  /* CRÉDITOS VIRTUAIS */
  [
    "virtual_credits_mode",
    "true"
  ],
  [
    "virtual_credits_text",
    "Esta plataforma utiliza créditos virtuais para demonstração."
  ],
  [
    "virtual_credits_disclaimer",
    "Os créditos desta versão não representam dinheiro real."
  ]
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
    for (
      const [key, value]
      of configuracoesPadrao
    ) {
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
      const result =
        await pool.query(`
          SELECT
            setting_key,
            setting_value
          FROM site_settings
          ORDER BY setting_key
        `);
      const settings = {};
      for (
        const row
        of result.rows
      ) {
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
      const result =
        await pool.query(`
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
      const { key } =
        req.params;
      const result =
        await pool.query(
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
      if (
        result.rows.length === 0
      ) {
        return res.status(404).json({
          ok: false,
          message:
            "Configuração não encontrada."
        });
      }
      res.json({
        ok: true,
        setting:
          result.rows[0]
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
      const { key } =
        req.params;
      const { value } =
        req.body;
      if (
        !key ||
        key.length > 100
      ) {
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
      const result =
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
        setting:
          result.rows[0]
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
      const settings =
        req.body;
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
      if (
        entradas.length === 0
      ) {
        return res.status(400).json({
          ok: false,
          message:
            "Nenhuma configuração foi enviada."
        });
      }
      for (
        const [key, value]
        of entradas
      ) {
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
