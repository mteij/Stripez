import { Hono } from "hono";
import { getCookie, setCookie } from "../utils/helpers";
import { randomId } from "../db";

const app = new Hono();

// ---- Auth: Anonymous UID ----
app.post("/anon", async (c) => {
  let uid = getCookie(c, "uid");
  if (!uid) {
    uid = randomId("u");
    setCookie(c, "uid", uid);
  }
  return c.json({ uid });
});

export default app;
