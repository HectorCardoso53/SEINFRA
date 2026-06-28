import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma.js";
import { authMiddleware, type JWTPayload } from "../middleware/auth.js";

const app = new Hono();

app.post(
  "/login",
  zValidator("json", z.object({ email: z.string().email(), senha: z.string().min(1) })),
  async (c) => {
    const { email, senha } = c.req.valid("json");

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.ativo) {
      return c.json({ error: "E-mail ou senha inválidos" }, 401);
    }

    const valid = await bcrypt.compare(senha, user.senha);
    if (!valid) {
      return c.json({ error: "E-mail ou senha inválidos" }, 401);
    }

    const payload: JWTPayload = { sub: user.id, email: user.email, role: user.role, nome: user.nome };
    const token = jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: "8h" });

    return c.json({
      token,
      user: { id: user.id, nome: user.nome, email: user.email, role: user.role, setor: user.setor },
    });
  }
);

app.get("/me", authMiddleware, async (c) => {
  const payload = c.get("user") as JWTPayload;
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, nome: true, email: true, role: true, setor: true, ativo: true },
  });
  if (!user || !user.ativo) return c.json({ error: "Usuário não encontrado" }, 404);
  return c.json(user);
});

app.post("/logout", authMiddleware, (c) => c.json({ ok: true }));

export default app;
