import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRouter from "./auth.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    ok: true,
    message: "JPBET backend funcionando!"
  });
});

app.use("/api/auth", authRouter);

const PORT = Number(process.env.PORT || 3000);

app.listen(PORT, () => {
  console.log(`JPBET backend rodando na porta ${PORT}`);
});
