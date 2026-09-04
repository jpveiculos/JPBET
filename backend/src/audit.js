import { pool } from "./db.js";
/**
 * Registra uma ação na auditoria do JPBET.
 *
 * Todos os valores são opcionais, exceto "action".
 */
export async function registrarAuditoria({
  userId = null,
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
} = {}) {
  if (!action) {
    throw new Error("A ação da auditoria é obrigatória.");
  }
  try {
    const query = `
      INSERT INTO audit_logs (
        user_id,
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
        $6::jsonb,
        $7::jsonb,
        $8,
        $9,
        $10,
        $11
      )
      RETURNING *;
    `;
    const values = [
      userId,
      action,
      module,
      targetType,
      targetId !== null ? String(targetId) : null,
      oldValue !== null ? JSON.stringify(oldValue) : null,
      newValue !== null ? JSON.stringify(newValue) : null,
      details,
      result,
      ipAddress,
      userAgent
    ];
    const { rows } = await pool.query(query, values);
    return rows[0];
  } catch (error) {
    console.error(
      "Erro ao registrar auditoria:",
      error
    );
    /*
     * A auditoria não deve derrubar uma operação
     * principal do sistema caso o registro falhe.
     */
    return null;
  }
}
