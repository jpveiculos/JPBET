import express from "express";
import roulette207Router from "./roulette207.js";

const originalListen = express.application.listen;
express.application.listen = function (...args) {
  this.use("/api/roulette207", roulette207Router);
  return originalListen.apply(this, args);
};
