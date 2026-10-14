import { Hono } from "hono";
import { timingSafeEqual } from "./auth";
import type { Env } from "./env";
import { pollOpenOrders } from "./orders";
import { admin, connectAll } from "./routes/admin";
import { app as api } from "./routes/app";
import { bot } from "./routes/bot";
import { hooks } from "./routes/hooks";
import { syncTick } from "./sync";

api.route("/admin", admin);

const app = new Hono<{ Bindings: Env }>();
app.route("/api", api);
app.route("/bot", bot);
app.route("/hooks", hooks);

/** One-time setup after deploy: open https://<your-app>/setup/<TG_WEBHOOK_SECRET> in a browser. */
app.get("/setup/:secret", async (c) => {
  if (!timingSafeEqual(c.req.param("secret"), c.env.TG_WEBHOOK_SECRET)) return c.text("Not found", 404);
  try {
    const r = await connectAll(c.env, new URL(c.req.url).origin);
    return c.json({ ok: true, ...r, next: "Open your bot in Telegram and press Start. The first price sync starts within a minute and takes about 20 minutes." });
  } catch (e) {
    return c.json({ ok: false, error: (e as Error).message }, 500);
  }
});

app.onError((e, c) => {
  console.error(e);
  return c.json({ error: "INTERNAL", code: "INTERNAL" }, 500);
});

export default {
  fetch: app.fetch,
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(Promise.allSettled([pollOpenOrders(env), syncTick(env)]).then(() => undefined));
  },
} satisfies ExportedHandler<Env>;
