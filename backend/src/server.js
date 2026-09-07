import express from "express";
import path from "path";
import { fileURLToPath } from "url";

import {
  pool,
  inicializarBanco
} from "./db.js";

import {
  obterConfiguracao
} from "./settings.js";

import {
  criarSessaoAdmin,
  validarSessaoAdmin,
  removerSessaoAdmin
} from "./adminSession.js";

import {
  enviarNotificacao
} from "./notifications.js";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =========================================================
   CAMINHOS
========================================================= */

const __filename =
  fileURLToPath(import.meta.url);

const __dirname =
  path.dirname(__filename);

const frontendPath =
  path.join(
    __dirname,
    "../frontend"
  );

/* =========================================================
   ARQUIVOS DO FRONTEND
========================================================= */

app.use(
  express.static(frontendPath)
);

/* =========================================================
   PÁGINA INICIAL
========================================================= */

app.get(
  "/",
  (req, res) => {
    res.sendFile(
      path.join(
        frontendPath,
        "index.html"
      )
    );
  }
);

/* =========================================================
   PÁGINA DO ADMINISTRADOR
========================================================= */

app.get(
  "/admin",
  (req, res) => {
    res.sendFile(
      path.join(
        frontendPath,
        "admin.html"
      )
    );
  }
);

/* =========================================================
   ADMIN - MIDDLEWARE
========================================================= */

function exigirAdmin(
  req,
  res,
  next
) {
  try {

    const admin =
      validarSessaoAdmin(req);

    if (!admin) {
      return res.status(401).json({
        ok: false,
        message:
          "Administrador não autenticado."
      });
    }

    req.admin = admin;

    next();

  } catch (error) {

    console.error(
      "Erro ao validar sessão do administrador:",
      error
    );

    return res.status(500).json({
      ok: false,
      message:
        "Erro interno ao validar administrador."
    });
  }
}

/* =========================================================
   CONFIGURAÇÕES
========================================================= */

app.get(
  "/api/settings",
  async (req, res) => {

    try {

      const settings =
        await obterConfiguracao();

      return res.json({
        ok: true,
        settings
      });

    } catch (error) {

      console.error(
        "Erro ao carregar configurações:",
        error
      );

      return res.status(500).json({
        ok: false,
        message:
          "Erro interno ao carregar configurações."
      });
    }
  }
);

/* =========================================================
   ADMIN - TESTAR NOTIFICAÇÃO
========================================================= */

app.post(
  "/api/admin/notifications/test",
  exigirAdmin,
  async (req, res) => {

    try {

      const result =
        await enviarNotificacao(
          "test",
          {
            admin:
              req.admin.username,

            sentAt:
              new Date().toISOString()
          }
        );

      if (
        !result.ok &&
        !result.skipped
      ) {

        return res.status(502).json({
          ok: false,
          message:
            "O serviço externo não respondeu corretamente."
        });
      }

      return res.json({
        ok: true,
        message:
          result.skipped
            ? "Notificação não configurada."
            : "Notificação enviada com sucesso."
      });

    } catch (error) {

      console.error(
        "Erro ao testar notificação:",
        error
      );

      return res.status(500).json({
        ok: false,
        message:
          "Erro interno ao testar notificação."
      });
    }
  }
);

/* =========================================================
   ADMIN - LISTAR USUÁRIOS
========================================================= */

app.get(
  "/api/admin/users",
  exigirAdmin,
  async (req, res) => {

    try {

      const result =
        await pool.query(
          `
          SELECT
            id,
            username,
            balance,
            bonus_balance,
            cash_balance,
            bonus_wager_progress,
            reserved_balance,
            (
              balance +
              reserved_balance
            ) AS total_balance,
            created_at
          FROM users
          ORDER BY
            created_at DESC,
            id DESC
          `
        );

      return res.json({
        ok: true,
        users:
          result.rows
      });

    } catch (error) {

      console.error(
        "Erro ao listar usuários:",
        error
      );

      return res.status(500).json({
        ok: false,
        message:
          "Erro interno ao listar usuários."
      });
    }
  }
);

/* =========================================================
   ADMIN - CONSULTAR AUDITORIA
========================================================= */

app.get(
  "/api/admin/audit-logs",
  exigirAdmin,
  async (req, res) => {

    try {

      const result =
        await pool.query(
          `
          SELECT
            l.id,
            l.admin_id,
            a.username AS admin_username,
            l.action,
            l.target_type,
            l.target_id,
            l.description,
            l.metadata,
            l.created_at
          FROM admin_audit_logs l
          LEFT JOIN admins a
            ON a.id = l.admin_id
          ORDER BY
            l.created_at DESC,
            l.id DESC
          LIMIT 500
          `
        );

      return res.json({
        ok: true,
        logs:
          result.rows
      });

    } catch (error) {

      console.error(
        "Erro ao consultar auditoria:",
        error
      );

      return res.status(500).json({
        ok: false,
        message:
          "Erro interno ao consultar auditoria."
      });
    }
  }
);

/* =========================================================
   SERVIDOR
========================================================= */

const PORT =
  Number(
    process.env.PORT || 3000
  );

inicializarBanco()
  .then(() => {

    app.listen(
      PORT,
      () => {

        console.log(
          `JPBET rodando na porta ${PORT}`
        );

      }
    );

  })
  .catch(error => {

    console.error(
      "JPBET não pôde iniciar:",
      error
    );

    process.exit(1);
  });
