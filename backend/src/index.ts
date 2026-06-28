import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import "dotenv/config";

import authRoutes from "./routes/auth.js";
import ordersRoutes from "./routes/orders.js";
import visitsRoutes from "./routes/visits.js";
import usersRoutes from "./routes/users.js";
import contactsRoutes from "./routes/contacts.js";
import termsRoutes from "./routes/terms.js";

const app = new Hono();

app.use("*", logger());
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  })
);

app.route("/api/auth", authRoutes);
app.route("/api/orders", ordersRoutes);
app.route("/api/visits", visitsRoutes);
app.route("/api/users", usersRoutes);
app.route("/api/contacts", contactsRoutes);
app.route("/api/terms", termsRoutes);

app.get("/api/health", (c) => c.json({ status: "ok" }));

const port = parseInt(process.env.PORT || "3001");
serve({ fetch: app.fetch, port }, () => {
  console.log(`SEINFRA API rodando na porta ${port}`);
});
