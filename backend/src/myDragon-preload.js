import express from "express";
import myDragonRouter from "./myDragon.js";

const originalListen =
  express.application.listen;

express.application.listen =
  function (...args) {

    this.use(
      "/api/my-dragon",
      myDragonRouter
    );

    return originalListen.apply(
      this,
      args
    );

  };
