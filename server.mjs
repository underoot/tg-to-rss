import express from "express";

import { main } from "./index.mjs";

const app = express();

app.get("/", (req, res) => {
  const { channelName } = req.query;
  main({ channelName })
    .then((result) => {
      res.set(result.headers);
      res.send(result.body);
    })
    .catch((error) => {
      res.status(500).send(error.message);
    });
});

app.listen(3000);
