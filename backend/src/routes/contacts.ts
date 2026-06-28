import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";

const app = new Hono();
app.use("*", authMiddleware);

app.get("/", async (c) => {
  const pessoas = await prisma.pessoa.findMany({ orderBy: { name: "asc" }, take: 500 });
  return c.json(pessoas);
});

app.post(
  "/",
  zValidator("json", z.object({ name: z.string().min(1), phone: z.string().optional() })),
  async (c) => {
    const pessoa = await prisma.pessoa.create({ data: c.req.valid("json") });
    return c.json(pessoa, 201);
  }
);

export default app;
