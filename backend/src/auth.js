import express from "express";
import { pool } from "./db.js";
import {
  criarSessaoAdmin,
  removerSessaoAdmin
} from "./adminSession.js";
import { registrarAuditoria } from "./audit.js";
const router = express.Router();
/* =========================
   INICIALIZAÇÃO DOS ADMINS
========================= */
async function inicializarAdmins() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await pool.query(`
      INSERT INTO admins (username, password_hash)
      VALUES ('admin', '123456')
      ON CONFLICT (username) DO NOTHING;
    `);
    console.log("Tabela admins inicializada com sucesso.");
  } catch (error) {
    console.error(
      "Erro ao inicializar tabela admins:",
      error
    );
  }
}
inicializarAdmins();
/* =========================
   VERIFICAÇÃO DO BANCO
========================= */
router.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({
      ok: true,
      database: "connected"
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      ok: false,
      database: "error"
    });
  }
});
/* =========================
   CADASTRO DE USUÁRIO
========================= */
router.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({
        message: "Informe usuário e senha."
      });
    }
    if (username.length < 3) {
      return res.status(400).json({
        message:
          "O usuário deve ter pelo menos 3 caracteres."
      });
    }
    if (password.length < 4) {
      return res.status(400).json({
        message:
          "A senha deve ter pelo menos 4 caracteres."
      });
    }
    const existingUser = await pool.query(
      `
      SELECT id
      FROM users
      WHERE username = $1
      LIMIT 1
      `,
      [username]
    );
    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        message: "Esse usuário já existe."
      });
    }
    const result = await pool.query(
      `
      INSERT INTO users
      (username, password_hash, balance)
      VALUES ($1, $2, 0)
      RETURNING id, username, balance
      `,
      [username, password]
    );
    /* =========================
       AUDITORIA — CADASTRO
    ========================= */
    await registrarAuditoria({
      userId: result.rows[0].id,
      action: "CADASTRO_USUARIO",
      module: "AUTENTICACAO",
      targetType: "USER",
      targetId: result.rows[0].id,
      newValue: {
        username: result.rows[0].username
      },
      details: "Novo usuário cadastrado.",
      result: "SUCCESS",
      ipAddress: obterIp(req),
      userAgent: req.headers["user-agent"] || null
    });
    res.status(201).json({
      ok: true,
      message: "Usuário criado com sucesso.",
      user: result.rows[0]
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Erro interno do servidor."
    });
  }
});
/* =========================
   LOGIN DE USUÁRIO
========================= */
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      await registrarAuditoria({
        action: "LOGIN_FALHA",
        module: "AUTENTICACAO",
        targetType: "USER",
        targetId: username || null,
        details: "Tentativa de login sem usuário ou senha.",
        result: "FAILURE",
        ipAddress: obterIp(req),
        userAgent: req.headers["user-agent"] || null
      });
      return res.status(400).json({
        message: "Informe usuário e senha."
      });
    }
    const result = await pool.query(
      `
      SELECT id, username, password_hash, balance
      FROM users
      WHERE username = $1
      LIMIT 1
      `,
      [username]
    );
    if (result.rows.length === 0) {
      await registrarAuditoria({
        action: "LOGIN_FALHA",
        module: "AUTENTICACAO",
        targetType: "USER",
        targetId: username,
        details: "Usuário não encontrado.",
        result: "FAILURE",
        ipAddress: obterIp(req),
        userAgent: req.headers["user-agent"] || null
      });
      return res.status(401).json({
        message: "Usuário ou senha inválidos."
      });
    }
    const user = result.rows[0];
    if (user.password_hash !== password) {
      await registrarAuditoria({
        userId: user.id,
        action: "LOGIN_FALHA",
        module: "AUTENTICACAO",
        targetType: "USER",
        targetId: user.id,
        details: "Senha inválida.",
        result: "FAILURE",
        ipAddress: obterIp(req),
        userAgent: req.headers["user-agent"] || null
      });
      return res.status(401).json({
        message: "Usuário ou senha inválidos."
      });
    }
    /* =========================
       AUDITORIA — LOGIN SUCESSO
    ========================= */
    await registrarAuditoria({
      userId: user.id,
      action: "LOGIN_SUCESSO",
      module: "AUTENTICACAO",
      targetType: "USER",
      targetId: user.id,
      details: "Login realizado com sucesso.",
      result: "SUCCESS",
      ipAddress: obterIp(req),
      userAgent: req.headers["user-agent"] || null
    });
    res.json({
      ok: true,
      user: {
        id: user.id,
        username: user.username,
        balance: user.balance
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Erro interno do servidor."
    });
  }
});
/* =========================
   LOGIN ADMINISTRATIVO
========================= */
router.post("/admin-login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await pool.query(
      `
      SELECT id, username, password_hash
      FROM admins
      WHERE username = $1
      LIMIT 1
      `,
      [username]
    );
    if (result.rows.length > 0) {
      const admin = result.rows[0];
      if (admin.password_hash === password) {
        const token =
          criarSessaoAdmin(admin.username);
        res.setHeader(
          "Set-Cookie",
          `jpbet_admin_session=${token}; HttpOnly; Path=/; SameSite=Strict; Secure`
        );
        await registrarAuditoria({
          action: "ADMIN_LOGIN_SUCESSO",
          module: "ADMINISTRACAO",
          targetType: "ADMIN",
          targetId: admin.id,
          details: "Login administrativo realizado com sucesso.",
          result: "SUCCESS",
          ipAddress: obterIp(req),
          userAgent: req.headers["user-agent"] || null
        });
        return res.json({
          ok: true,
          admin: true,
          username: admin.username
        });
      }
    }
    /* Administrador definido pelas variáveis do Render */
    const adminUser =
      process.env.ADMIN_USER || "admin";
    const adminPassword =
      process.env.ADMIN_PASSWORD;
    if (
      adminPassword &&
      username === adminUser &&
      password === adminPassword
    ) {
      const token =
        criarSessaoAdmin(adminUser);
      res.setHeader(
        "Set-Cookie",
        `jpbet_admin_session=${token}; HttpOnly; Path=/; SameSite=Strict; Secure`
      );
      await registrarAuditoria({
        action: "ADMIN_LOGIN_SUCESSO",
        module: "ADMINISTRACAO",
        targetType: "ADMIN",
        targetId: adminUser,
        details: "Login administrativo realizado com credenciais do Render.",
        result: "SUCCESS",
        ipAddress: obterIp(req),
        userAgent: req.headers["user-agent"] || null
      });
      return res.json({
        ok: true,
        admin: true,
        username: adminUser
      });
    }
    /* =========================
       AUDITORIA — LOGIN ADMIN FALHO
    ========================= */
    await registrarAuditoria({
      action: "ADMIN_LOGIN_FALHA",
      module: "ADMINISTRACAO",
      targetType: "ADMIN",
      targetId: username || null,
      details: "Credenciais administrativas inválidas.",
      result: "FAILURE",
      ipAddress: obterIp(req),
      userAgent: req.headers["user-agent"] || null
    });
    return res.status(401).json({
      message:
        "Credenciais administrativas inválidas."
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Erro ao realizar login administrativo."
    });
  }
});
/* =========================
   LOGOUT ADMINISTRATIVO
========================= */
router.post("/admin-logout", async (req, res) => {
  try {
    const cookies = req.headers.cookie || "";
    const match =
      cookies.match(
        /(?:^|;\s*)jpbet_admin_session=([^;]+)/
      );
    if (match) {
      removerSessaoAdmin(match[1]);
    }
    res.setHeader(
      "Set-Cookie",
      "jpbet_admin_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict; Secure"
    );
    res.json({
      ok: true,
      message: "Sessão administrativa encerrada."
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Erro ao sair."
    });
  }
});
/* =========================
   CADASTRAR ADMINISTRADOR
========================= */
router.post("/admin-register", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({
        message: "Informe usuário e senha."
      });
    }
    if (username.length < 3) {
      return res.status(400).json({
        message:
          "O usuário deve ter pelo menos 3 caracteres."
      });
    }
    if (password.length < 4) {
      return res.status(400).json({
        message:
          "A senha deve ter pelo menos 4 caracteres."
      });
    }
    const existingAdmin = await pool.query(
      `
      SELECT id
      FROM admins
      WHERE username = $1
      LIMIT 1
      `,
      [username]
    );
    if (existingAdmin.rows.length > 0) {
      return res.status(409).json({
        message: "Esse administrador já existe."
      });
    }
    const result = await pool.query(
      `
      INSERT INTO admins
      (username, password_hash)
      VALUES ($1, $2)
      RETURNING id, username, created_at
      `,
      [username, password]
    );
    res.status(201).json({
      ok: true,
      message:
        "Administrador criado com sucesso.",
      admin: result.rows[0]
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message:
        "Erro interno do servidor."
    });
  }
});
/* =========================
   FUNÇÃO AUXILIAR — IP
========================= */
function obterIp(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    null
  );
}
export default router;
