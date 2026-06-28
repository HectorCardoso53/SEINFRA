import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import bcrypt from "bcryptjs";
import prisma from "../lib/prisma.js";
import { authMiddleware, requireRole } from "../middleware/auth.js";
import type { JWTPayload, Env } from "../middleware/auth.js";
import { registrar } from "../lib/auditoria.js";

const app = new Hono<Env>();
app.use("*", authMiddleware, requireRole("admin", "master"));

const createSchema = z.object({
  nome: z.string().min(1),
  email: z.string().email(),
  senha: z.string().min(6),
  cpf: z.string().optional(),
  setor: z.string().optional(),
  telefone: z.string().optional(),
  role: z.enum(["visita", "os", "admin", "master"]),
});

const updateSchema = createSchema.partial().omit({ senha: true }).extend({
  senha: z.string().min(6).optional(),
});

app.get("/", async (c) => {
  const users = await prisma.user.findMany({
    select: { id: true, nome: true, email: true, cpf: true, setor: true, telefone: true, role: true, ativo: true, criadoEm: true },
    orderBy: { nome: "asc" },
  });
  return c.json(users);
});

app.post("/", zValidator("json", createSchema), async (c) => {
  const data = c.req.valid("json");
  const requester = c.get("user") as JWTPayload;

  const senha = await bcrypt.hash(data.senha, 10);
  const novo = await prisma.user.create({
    data: { ...data, senha },
    select: { id: true, nome: true, email: true, role: true, ativo: true },
  });

  await registrar({ acao: "criar_usuario", colecao: "users", docId: novo.id, detalhes: { email: novo.email, role: novo.role }, userId: requester.sub, userName: requester.nome, userRole: requester.role });
  return c.json(novo, 201);
});

app.patch("/:id/toggle", async (c) => {
  const requester = c.get("user") as JWTPayload;
  const id = c.req.param("id");
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return c.json({ error: "Usuário não encontrado" }, 404);
  const updated = await prisma.user.update({ where: { id }, data: { ativo: !user.ativo }, select: { id: true, ativo: true } });
  await registrar({ acao: "toggle_status_usuario", colecao: "users", docId: id, detalhes: { ativo: updated.ativo }, userId: requester.sub, userName: requester.nome, userRole: requester.role });
  return c.json(updated);
});

app.patch("/:id", zValidator("json", updateSchema), async (c) => {
  const requester = c.get("user") as JWTPayload;
  const id = c.req.param("id");
  const { senha, ...rest } = c.req.valid("json");
  const data: typeof rest & { senha?: string } = { ...rest };
  if (senha) data.senha = await bcrypt.hash(senha, 10);
  const updated = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, nome: true, email: true, role: true, ativo: true },
  });
  await registrar({ acao: "editar_usuario", colecao: "users", docId: id, detalhes: { senhaAlterada: !!senha }, userId: requester.sub, userName: requester.nome, userRole: requester.role });
  return c.json(updated);
});

app.delete("/:id", requireRole("master"), async (c) => {
  const requester = c.get("user") as JWTPayload;
  const id = c.req.param("id");
  await prisma.user.delete({ where: { id } });
  await registrar({ acao: "excluir_usuario", colecao: "users", docId: id, detalhes: {}, userId: requester.sub, userName: requester.nome, userRole: requester.role });
  return c.json({ ok: true });
});

export default app;
