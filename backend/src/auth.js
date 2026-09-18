import express from "express";
import { pool } from "./db.js";
import {
  criarSessaoAdmin,
  removerSessaoAdmin,
  validarSessaoAdmin
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
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN NOT NULL DEFAULT FALSE;`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_at TIMESTAMP NULL;`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_reason TEXT NULL;`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;`);
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
    let initialBonus = 100;
    try {
      const bonusSetting = await pool.query(`
        SELECT setting_key, setting_value
        FROM site_settings
        WHERE setting_key IN ('initial_bonus_amount', 'bonus_system_enabled')
      `);
      const bonusRow = bonusSetting.rows.find(row => row.setting_key === "initial_bonus_amount");
      const enabledRow = bonusSetting.rows.find(row => row.setting_key === "bonus_system_enabled");
      const configuredBonus = Number(bonusRow?.setting_value);
      const bonusEnabled = String(enabledRow?.setting_value ?? "true").toLowerCase() !== "false";
      if (Number.isFinite(configuredBonus) && configuredBonus >= 0) initialBonus = bonusEnabled ? configuredBonus : 0;
    } catch (_) {}

    const result = await pool.query(
      `
      INSERT INTO users
      (username, password_hash, balance, bonus_balance, cash_balance, bonus_wager_progress)
      VALUES ($1, $2, $3, $3, 0, 0)
      RETURNING id, username, balance, bonus_balance, cash_balance, bonus_wager_progress
      `,
      [username, password, initialBonus]
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
      SELECT id, username, password_hash, balance, bonus_balance, cash_balance, bonus_wager_progress, reserved_balance, is_banned, banned_reason, is_deleted
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
    if (user.is_deleted) return res.status(403).json({ message: "Usuário removido pelo administrador." });
    if (user.is_banned) return res.status(403).json({ message: user.banned_reason ? `Usuário banido. Motivo: ${user.banned_reason}` : "Usuário banido." });
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
        balance: Number(user.balance || 0),
        bonusBalance: Number(user.bonus_balance || 0),
        cashBalance: Number(user.cash_balance || 0),
        bonusWagerProgress: Number(user.bonus_wager_progress || 0),
        reservedBalance: Number(user.reserved_balance || 0)
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
          `mybets_admin_session=${token}; HttpOnly; Path=/; SameSite=Strict; Secure`
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
        `mybets_admin_session=${token}; HttpOnly; Path=/; SameSite=Strict; Secure`
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
        /(?:^|;\s*)mybets_admin_session=([^;]+)/
      );
    if (match) {
      removerSessaoAdmin(match[1]);
    }
    res.setHeader(
      "Set-Cookie",
      "mybets_admin_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict; Secure"
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
function exigirAdmin(req,res,next){ const cookie=String(req.headers.cookie||"").split(";").map(x=>x.trim()).find(x=>x.startsWith("mybets_admin_session=")); const token=cookie?decodeURIComponent(cookie.substring("mybets_admin_session=".length)):null; const sessao=validarSessaoAdmin(token); if(!sessao)return res.status(401).json({ok:false,message:"Sessão administrativa inválida ou expirada."}); req.admin=sessao; next(); }

router.get("/admin-users",exigirAdmin,async(req,res)=>{try{const result=await pool.query(`SELECT id,username,balance,bonus_balance,cash_balance,reserved_balance,is_banned,banned_at,banned_reason,is_deleted,created_at FROM users WHERE COALESCE(is_deleted,FALSE)=FALSE ORDER BY created_at DESC,id DESC`);return res.json({ok:true,users:result.rows})}catch(error){console.error(error);return res.status(500).json({ok:false,message:"Erro interno ao listar usuários."})}});

router.post("/admin-users/:id/ban",exigirAdmin,async(req,res)=>{const client=await pool.connect();try{const userId=Number(req.params.id),reason=String(req.body.reason||"").trim();if(!Number.isInteger(userId)||userId<=0)return res.status(400).json({ok:false,message:"Usuário inválido."});if(!reason)return res.status(400).json({ok:false,message:"Informe o motivo do banimento."});await client.query("BEGIN");const r=await client.query(`SELECT id,username FROM users WHERE id=$1 AND COALESCE(is_deleted,FALSE)=FALSE FOR UPDATE`,[userId]);if(!r.rows.length){await client.query("ROLLBACK");return res.status(404).json({ok:false,message:"Usuário não encontrado."})}await client.query(`UPDATE users SET is_banned=TRUE,banned_at=CURRENT_TIMESTAMP,banned_reason=$1 WHERE id=$2`,[reason,userId]);await client.query("COMMIT");return res.json({ok:true,message:"Usuário banido com sucesso."})}catch(error){try{await client.query("ROLLBACK")}catch(_){}console.error(error);return res.status(500).json({ok:false,message:"Erro interno ao banir usuário."})}finally{client.release()}});

router.post("/admin-users/:id/unban",exigirAdmin,async(req,res)=>{const client=await pool.connect();try{const userId=Number(req.params.id);await client.query("BEGIN");const r=await client.query(`SELECT id FROM users WHERE id=$1 AND COALESCE(is_deleted,FALSE)=FALSE FOR UPDATE`,[userId]);if(!r.rows.length){await client.query("ROLLBACK");return res.status(404).json({ok:false,message:"Usuário não encontrado."})}await client.query(`UPDATE users SET is_banned=FALSE,banned_at=NULL,banned_reason=NULL WHERE id=$1`,[userId]);await client.query("COMMIT");return res.json({ok:true,message:"Usuário desbloqueado com sucesso."})}catch(error){try{await client.query("ROLLBACK")}catch(_){}console.error(error);return res.status(500).json({ok:false,message:"Erro interno ao desbloquear usuário."})}finally{client.release()}});

router.post("/admin-users/:id/remove",exigirAdmin,async(req,res)=>{const client=await pool.connect();try{const userId=Number(req.params.id);if(!Number.isInteger(userId)||userId<=0)return res.status(400).json({ok:false,message:"Usuário inválido."});await client.query("BEGIN");const r=await client.query(`SELECT id,username FROM users WHERE id=$1 AND COALESCE(is_deleted,FALSE)=FALSE FOR UPDATE`,[userId]);if(!r.rows.length){await client.query("ROLLBACK");return res.status(404).json({ok:false,message:"Usuário não encontrado."})}const user=r.rows[0];await client.query(`UPDATE users SET is_deleted=TRUE,is_banned=TRUE,banned_at=CURRENT_TIMESTAMP,banned_reason=$1 WHERE id=$2`,["Usuário removido pelo administrador.",userId]);await client.query("COMMIT");return res.json({ok:true,message:`Usuário "${user.username}" removido com sucesso. O histórico foi preservado.`})}catch(error){try{await client.query("ROLLBACK")}catch(_){}console.error(error);return res.status(500).json({ok:false,message:"Erro interno ao remover usuário."})}finally{client.release()}});

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