import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import { authMiddleware, type JWTPayload } from "../middleware/auth.js";
import { registrar } from "../lib/auditoria.js";

const app = new Hono<{ Variables: { user: JWTPayload } }>();
app.use("*", authMiddleware);

const visitSchema = z.object({
  name: z.string().min(1),
  cpf: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  reference: z.string().optional(),
  date: z.string().optional(),
});

app.get("/", async (c) => {
  const { search, limit = "300" } = c.req.query();
  const where = search ? { name: { contains: search.toUpperCase(), mode: "insensitive" as const } } : {};
  const visitas = await prisma.visita.findMany({ where, orderBy: { createdAt: "desc" }, take: parseInt(limit) });
  return c.json(visitas);
});

app.get("/:id", async (c) => {
  const visita = await prisma.visita.findUnique({ where: { id: c.req.param("id") } });
  if (!visita) return c.json({ error: "Visita não encontrada" }, 404);
  return c.json(visita);
});

app.post("/", zValidator("json", visitSchema), async (c) => {
  const data = c.req.valid("json");
  const user = c.get("user") as JWTPayload;
  const visita = await prisma.visita.create({ data });
  await registrar({ acao: "criar_visita", colecao: "visitas", docId: visita.id, detalhes: { nome: visita.name }, userId: user.sub, userName: user.nome, userRole: user.role });
  return c.json(visita, 201);
});

app.patch("/:id", zValidator("json", visitSchema.partial()), async (c) => {
  const user = c.get("user") as JWTPayload;
  const id = c.req.param("id");
  const visita = await prisma.visita.update({ where: { id }, data: c.req.valid("json") });
  await registrar({ acao: "editar_visita", colecao: "visitas", docId: id, detalhes: {}, userId: user.sub, userName: user.nome, userRole: user.role });
  return c.json(visita);
});

app.delete("/:id", async (c) => {
  const user = c.get("user") as JWTPayload;
  const id = c.req.param("id");
  await prisma.visita.delete({ where: { id } });
  await registrar({ acao: "excluir_visita", colecao: "visitas", docId: id, detalhes: {}, userId: user.sub, userName: user.nome, userRole: user.role });
  return c.json({ ok: true });
});

export default app;
