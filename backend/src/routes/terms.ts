import { Hono } from "hono";
import prisma from "../lib/prisma.js";
import { authMiddleware, type JWTPayload, type Env } from "../middleware/auth.js";

const app = new Hono<Env>();
app.use("*", authMiddleware);

app.get("/check", async (c) => {
  const user = c.get("user") as JWTPayload;
  const termo = await prisma.termoAceito.findUnique({ where: { userId: user.sub } });
  return c.json({ aceito: !!termo?.aceito });
});

app.post("/accept", async (c) => {
  const user = c.get("user") as JWTPayload;
  await prisma.termoAceito.upsert({
    where: { userId: user.sub },
    update: { aceito: true, dataAceite: new Date() },
    create: { userId: user.sub, aceito: true },
  });
  return c.json({ ok: true });
});

export default app;
