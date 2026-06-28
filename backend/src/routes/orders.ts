import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import { authMiddleware, requireRole } from "../middleware/auth.js";
import type { JWTPayload, Env } from "../middleware/auth.js";
import { Prisma } from "@prisma/client";
import { registrar } from "../lib/auditoria.js";

const app = new Hono<Env>();
app.use("*", authMiddleware);

const ns = z.string().nullable().optional();
const materialSchema = z.object({ nome: z.string(), quantidade: z.number(), unidade: z.string() });
const ordemSchema = z.object({
  tipoOS:              ns,
  dataAbertura:        z.string(),
  nomeSolicitante:     ns,
  cpf:                 ns,
  telefone:            ns,
  telefone2:           ns,
  setorSolicitante:    ns,
  setorResponsavel:    z.string(),
  descricao:           ns,
  local:               ns,
  pontoReferencia:     ns,
  materiais:           z.array(materialSchema).default([]),
  responsavelExecucao: ns,
  responsavelAbertura: ns,
  latitude:            z.number().nullable().optional(),
  longitude:           z.number().nullable().optional(),
  observacaoFinal:     ns,
  assinaturaChefia:    ns,
  assinaturaRecebedor: ns,
  assinaturaEletronica: z.object({
    nome:    z.string(),
    setor:   z.string().optional(),
    email:   z.string().optional(),
    userId:  z.string().optional(),
    data:    z.string().optional(),
    codigo:  z.string().optional(),
  }).nullable().optional(),
  dataEncerramento:    ns,
  status:              z.string().optional(),
});

const stripNull = <T extends Record<string, unknown>>(obj: T): T =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== null)) as T;

// Atenção: rotas estáticas devem vir antes de /:id
app.get("/stats/dashboard", async (c) => {
  const stats = await prisma.estatistica.findUnique({ where: { id: "dashboard" } });
  return c.json(
    stats ?? { total: 0, abertas: 0, andamento: 0, encerradas: 0, totalMateriais: 0, ordensPorMes: Array(12).fill(0) }
  );
});

app.get("/next-number", async (c) => {
  const ano = new Date().getFullYear();
  const agg = await prisma.ordem.aggregate({ _max: { numeroSequencial: true } });
  const proximo = (agg._max.numeroSequencial ?? 0) + 1;
  return c.json({ numero: `OS ${String(proximo).padStart(3, "0")}/${ano} - SEINFRA` });
});

app.get("/", async (c) => {
  const { page = "1", limit = "20", status, diretoria, ano, dataInicio, dataFim } = c.req.query();
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (diretoria) where.setorResponsavel = diretoria;
  if (ano) where.ano = parseInt(ano);
  if (dataInicio && dataFim) where.dataAbertura = { gte: dataInicio, lte: dataFim };
  else if (dataInicio) where.dataAbertura = { gte: dataInicio };
  else if (dataFim) where.dataAbertura = { lte: dataFim };

  const [ordens, total] = await Promise.all([
    prisma.ordem.findMany({ where, orderBy: { numeroSequencial: "desc" }, skip, take: parseInt(limit) }),
    prisma.ordem.count({ where }),
  ]);

  return c.json({ ordens, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
});

app.get("/:id", async (c) => {
  const ordem = await prisma.ordem.findUnique({
    where: { id: c.req.param("id") },
    include: { criador: { select: { nome: true } } },
  });
  if (!ordem) return c.json({ error: "OS não encontrada" }, 404);
  return c.json(ordem);
});

app.post("/", zValidator("json", ordemSchema), async (c) => {
  const data = c.req.valid("json");
  const user = c.get("user") as JWTPayload;
  const ano = new Date().getFullYear();
  const contadorId = `os_${ano}`;

  const ordem = await prisma.$transaction(async (tx) => {
    // Incremento atômico do contador, sempre à frente do MAX real da tabela
    const result = await tx.$queryRaw<[{ ultimo_numero: number }]>`
      INSERT INTO contadores (id, ultimo_numero)
      VALUES (${contadorId}, GREATEST(1, (SELECT COALESCE(MAX(numero_sequencial), 0) + 1 FROM ordens WHERE ano = ${ano})))
      ON CONFLICT (id) DO UPDATE
      SET ultimo_numero = GREATEST(contadores.ultimo_numero + 1, (SELECT COALESCE(MAX(numero_sequencial), 0) + 1 FROM ordens WHERE ano = ${ano}))
      RETURNING ultimo_numero
    `;
    const seq = Number(result[0].ultimo_numero);
    const numero = `OS ${String(seq).padStart(3, "0")}/${ano} - SEINFRA`;

    const { assinaturaEletronica, materiais: _mat, ...rest } = data;
    const novaOrdem = await tx.ordem.create({
      data: {
        ...stripNull(rest),
        numero,
        numeroSequencial: seq,
        ano,
        criadoPor: user.sub,
        materiais: data.materiais as object[],
        assinaturaEletronica: assinaturaEletronica === null ? Prisma.JsonNull : assinaturaEletronica,
      },
    });

    // Atualizar estatísticas
    const mes = new Date(data.dataAbertura).getMonth();
    const stats = await tx.estatistica.findUnique({ where: { id: "dashboard" } });
    const ordensPorMes = ((stats?.ordensPorMes as number[]) ?? Array(12).fill(0)).map(
      (v, i) => (i === mes ? (v || 0) + 1 : v)
    );
    await tx.estatistica.upsert({
      where: { id: "dashboard" },
      update: { total: { increment: 1 }, abertas: { increment: 1 }, totalMateriais: { increment: data.materiais.length }, ordensPorMes, atualizadoEm: new Date() },
      create: { id: "dashboard", total: 1, abertas: 1, totalMateriais: data.materiais.length, ordensPorMes },
    });

    return novaOrdem;
  });

  await registrar({ acao: "criar_os", colecao: "ordens", docId: ordem.id, detalhes: { numero: ordem.numero, setor: ordem.setorResponsavel }, userId: user.sub, userName: user.nome, userRole: user.role });
  return c.json(ordem, 201);
});

app.patch("/:id", zValidator("json", ordemSchema.partial()), async (c) => {
  const user = c.get("user") as JWTPayload;
  const id = c.req.param("id");
  const data = c.req.valid("json");

  const existing = await prisma.ordem.findUnique({ where: { id } });
  if (!existing) return c.json({ error: "OS não encontrada" }, 404);

  const ordem = await prisma.$transaction(async (tx) => {
    const { assinaturaEletronica: ae, materiais: mat, ...restData } = data;
    const updateData: Prisma.OrdemUpdateInput = {
      ...stripNull(restData),
      ...(mat !== undefined ? { materiais: mat as object[] } : {}),
      ...(ae !== undefined ? { assinaturaEletronica: ae === null ? Prisma.JsonNull : ae } : {}),
    };
    const updated = await tx.ordem.update({ where: { id }, data: updateData });

    // Ajustar contadores de status se mudou
    if (data.status && data.status !== existing.status) {
      const dec: Record<string, { decrement: number }> = {};
      const inc: Record<string, { increment: number }> = {};
      if (existing.status === "Aberta") dec.abertas = { decrement: 1 };
      if (existing.status === "Em andamento") dec.andamento = { decrement: 1 };
      if (existing.status === "Encerrada") dec.encerradas = { decrement: 1 };
      if (data.status === "Aberta") inc.abertas = { increment: 1 };
      if (data.status === "Em andamento") inc.andamento = { increment: 1 };
      if (data.status === "Encerrada") inc.encerradas = { increment: 1 };
      await tx.estatistica.update({ where: { id: "dashboard" }, data: { ...dec, ...inc } });
    }

    return updated;
  });

  await registrar({ acao: "editar_os", colecao: "ordens", docId: id, detalhes: { campos: Object.keys(data) }, userId: user.sub, userName: user.nome, userRole: user.role });
  return c.json(ordem);
});

app.delete("/:id", requireRole("admin", "master"), async (c) => {
  const user = c.get("user") as JWTPayload;
  const id = c.req.param("id");

  const existing = await prisma.ordem.findUnique({ where: { id } });
  if (!existing) return c.json({ error: "OS não encontrada" }, 404);

  await prisma.$transaction(async (tx) => {
    await tx.ordem.delete({ where: { id } });

    // Resetar contador para o MAX real do ano, evitando buracos na numeração
    const ano = existing.ano;
    const agg = await tx.ordem.aggregate({ _max: { numeroSequencial: true }, where: { ano } });
    const maxSeq = agg._max.numeroSequencial ?? 0;
    await tx.contador.upsert({
      where:  { id: `os_${ano}` },
      update: { ultimoNumero: maxSeq },
      create: { id: `os_${ano}`, ultimoNumero: maxSeq },
    });

    const dec: Record<string, { decrement: number }> = { total: { decrement: 1 } };
    if (existing.status === "Aberta") dec.abertas = { decrement: 1 };
    if (existing.status === "Em andamento") dec.andamento = { decrement: 1 };
    if (existing.status === "Encerrada") dec.encerradas = { decrement: 1 };
    if (existing.materiais) dec.totalMateriais = { decrement: (existing.materiais as object[]).length };
    await tx.estatistica.update({ where: { id: "dashboard" }, data: dec });
  });

  await registrar({ acao: "excluir_os", colecao: "ordens", docId: id, detalhes: { numero: existing.numero }, userId: user.sub, userName: user.nome, userRole: user.role });
  return c.json({ ok: true });
});

export default app;
