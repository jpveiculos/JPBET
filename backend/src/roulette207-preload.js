import express from "express";
import roulette207Router from "./roulette207.js";
import myDragonRouter from "./myDragon.js";

const originalListen =
  express.application.listen;

express.application.listen =
  function (...args) {

    this.use(
      "/api/roulette207",
      roulette207Router
    );

    this.use(
      "/api/my-dragon",
      myDragonRouter
    );

    return originalListen.apply(
      this,
      args
    );
  };
