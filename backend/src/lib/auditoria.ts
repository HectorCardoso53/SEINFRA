import prisma from "./prisma.js";

interface Params {
  acao: string;
  colecao: string;
  docId?: string | null;
  detalhes?: object;
  userId: string;
  userName: string;
  userRole: string;
}

export async function registrar(params: Params) {
  try {
    await prisma.auditoria.create({ data: params });
  } catch (err) {
    console.error("Auditoria falhou (não bloqueia operação):", err);
  }
}
