import express from "express";
import { pool } from "./db.js";

const router = express.Router();

router.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, database: "connected" });
  } catch (error) {
    res.status(500).json({
      ok: false,
      database: "error"
    });
  }
});

export default router;
