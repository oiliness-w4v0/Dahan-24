import { Hono } from "hono";

const ping = new Hono();

ping.get("/ping", (c) => {
  return c.text("success");
});

export default ping;
