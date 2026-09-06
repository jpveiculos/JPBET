import { pool } from "./db.js";

export async function registrarAuditoria({
  userId = null,
  adminId = null,
  action,
  module = null,
  targetType = null,
  targetId = null,
  oldValue = null,
  newValue = null,
  details = null,
  result = "SUCCESS",
  ipAddress = null,
  userAgent = null
}) {
  try {
    await pool.query(
      `
      INSERT INTO audit_logs (
        user_id,
        admin_id,
        action,
        module,
        target_type,
        target_id,
        old_value,
        new_value,
        details,
        result,
        ip_address,
        user_agent
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12
      )
      `,
      [
        userId,
        adminId,
        action,
        module,
        targetType,
        targetId,
        oldValue
          ? JSON.stringify(oldValue)
          : null,
        newValue
          ? JSON.stringify(newValue)
          : null,
        details,
        result,
        ipAddress,
        userAgent
      ]
    );
  } catch (error) {
    console.error(
      "Erro ao registrar auditoria:",
      error
    );
  }
}
