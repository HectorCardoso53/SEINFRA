// scripts/import-to-postgres.js
// Importa o backup do Firebase (JSON) para o PostgreSQL via Prisma
// Uso: node scripts/import-to-postgres.js
//
// ⚠️  ATENÇÃO: Execute UMA VEZ apenas, com o banco vazio.
//      Certifique-se que DATABASE_URL está definida no .env

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

require("dotenv").config();

const prisma = new PrismaClient();
const BACKUP = path.join(__dirname, "../../SEINFRA/scripts/backup");

function ler(arquivo) {
  const caminho = path.join(BACKUP, arquivo);
  if (!fs.existsSync(caminho)) {
    console.warn(`⚠  Arquivo não encontrado: ${caminho}`);
    return [];
  }
  return JSON.parse(fs.readFileSync(caminho, "utf8"));
}

// ─── USUARIOS ────────────────────────────────────────────────────────────────
async function importarUsers() {
  const docs = ler("users.json");
  if (!docs.length) return;

  // Senha temporária para todos os usuários — eles devem trocar no primeiro login
  const SENHA_TEMP = await bcrypt.hash("Seinfra@2025", 10);

  let ok = 0;
  for (const d of docs) {
    try {
      await prisma.user.upsert({
        where: { email: d.email },
        update: {},
        create: {
          id:       d._id,
          nome:     (d.nome || "").toUpperCase(),
          email:    d.email,
          senha:    SENHA_TEMP,
          cpf:      d.cpf || null,
          setor:    d.setor || null,
          telefone: d.telefone || null,
          role:     d.role || "os",
          ativo:    d.ativo !== false,
          criadoEm: d.criadoEm?._seconds ? new Date(d.criadoEm._seconds * 1000) : new Date(),
        },
      });
      ok++;
    } catch (e) {
      console.error(`  ✘ User ${d.email}:`, e.message);
    }
  }
  console.log(`✔ users: ${ok}/${docs.length} importados`);
  console.log(`  ⚠  Senha temporária definida para todos: Seinfra@2025`);
}

// ─── ORDENS ──────────────────────────────────────────────────────────────────
async function importarOrdens() {
  const docs = ler("ordens.json");
  if (!docs.length) return;

  // Busca o primeiro usuário master/admin como criador padrão para OS sem criadoPor
  const fallbackUser = await prisma.user.findFirst({
    where: { role: { in: ["master", "admin"] } },
    select: { id: true },
  });

  let ok = 0;
  for (const d of docs) {
    try {
      // Resolver criadoPor pelo email ou usar fallback
      let criadoPor = fallbackUser?.id;
      if (d.criadoPor) {
        const u = await prisma.user.findFirst({ where: { email: d.criadoPor }, select: { id: true } });
        if (u) criadoPor = u.id;
      }
      if (!criadoPor) continue;

      const dataAbertura =
        d.dataAbertura?._seconds
          ? new Date(d.dataAbertura._seconds * 1000).toISOString().split("T")[0]
          : d.dataAbertura || new Date().toISOString().split("T")[0];

      const ano = parseInt(dataAbertura.split("-")[0]) || new Date().getFullYear();

      await prisma.ordem.upsert({
        where: { numero: d.numero },
        update: {},
        create: {
          id:                  d._id,
          numero:              d.numero,
          numeroSequencial:    d.numeroSequencial || 0,
          ano,
          tipoOS:              d.tipoOS || null,
          status:              d.status || "Aberta",
          dataAbertura,
          dataEncerramento:    d.dataEncerramento?._seconds
            ? new Date(d.dataEncerramento._seconds * 1000).toISOString().split("T")[0]
            : d.dataEncerramento || null,
          nomeSolicitante:     d.nomeSolicitante || null,
          cpf:                 d.cpfSolicitante || null,
          telefone:            d.telefoneSolicitante || null,
          telefone2:           d.telefone2 || null,
          setorSolicitante:    d.setorSolicitante || null,
          setorResponsavel:    d.setorResponsavel || "",
          descricao:           d.descricaoServico || null,
          local:               d.localServico || null,
          pontoReferencia:     d.pontoReferencia || null,
          materiais:           d.materiais || [],
          responsavelExecucao: d.responsavelExecucao || null,
          responsavelAbertura: d.responsavelAbertura || null,
          observacaoFinal:     d.observacaoFinal || null,
          assinaturaChefia:    d.assinaturaChefia || null,
          assinaturaRecebedor: d.assinaturaRecebedor || null,
          assinaturaEletronica: d.assinaturaEletronica || null,
          criadoPor,
          criadoEm: d.criadoEm?._seconds ? new Date(d.criadoEm._seconds * 1000) : new Date(),
        },
      });
      ok++;
    } catch (e) {
      console.error(`  ✘ Ordem ${d.numero}:`, e.message);
    }
  }
  console.log(`✔ ordens: ${ok}/${docs.length} importadas`);
}

// ─── VISITAS ─────────────────────────────────────────────────────────────────
async function importarVisitas() {
  const docs = ler("visitas.json");
  if (!docs.length) return;
  let ok = 0;
  for (const d of docs) {
    try {
      await prisma.visita.upsert({
        where: { id: d._id },
        update: {},
        create: {
          id:        d._id,
          name:      (d.name || "").toUpperCase(),
          address:   d.address || null,
          reference: d.reference || null,
          date:      d.date || null,
          createdAt: d.createdAt ? new Date(d.createdAt) : new Date(),
        },
      });
      ok++;
    } catch (e) {
      console.error(`  ✘ Visita ${d._id}:`, e.message);
    }
  }
  console.log(`✔ visitas: ${ok}/${docs.length} importadas`);
}

// ─── PESSOAS ─────────────────────────────────────────────────────────────────
async function importarPessoas() {
  const docs = ler("pessoas.json");
  if (!docs.length) return;
  let ok = 0;
  for (const d of docs) {
    try {
      await prisma.pessoa.upsert({
        where: { id: d._id },
        update: {},
        create: {
          id:        d._id,
          name:      (d.name || "").toUpperCase(),
          phone:     d.phone || null,
          createdAt: d.createdAt ? new Date(d.createdAt) : new Date(),
        },
      });
      ok++;
    } catch (e) {
      console.error(`  ✘ Pessoa ${d._id}:`, e.message);
    }
  }
  console.log(`✔ pessoas: ${ok}/${docs.length} importadas`);
}

// ─── CONTADORES ──────────────────────────────────────────────────────────────
async function importarContadores() {
  const docs = ler("contadores.json");
  if (!docs.length) return;
  for (const d of docs) {
    try {
      await prisma.contador.upsert({
        where: { id: d._id },
        update: { ultimoNumero: d.ultimoNumero || 0 },
        create: { id: d._id, ultimoNumero: d.ultimoNumero || 0 },
      });
    } catch (e) {
      console.error(`  ✘ Contador ${d._id}:`, e.message);
    }
  }
  console.log(`✔ contadores importados`);
}

// ─── ESTATÍSTICAS ─────────────────────────────────────────────────────────────
async function importarEstatisticas() {
  const docs = ler("estatisticas.json");
  const d = docs.find((x) => x._id === "dashboard");
  if (!d) return;
  try {
    await prisma.estatistica.upsert({
      where: { id: "dashboard" },
      update: {
        total:          d.total || 0,
        abertas:        d.abertas || 0,
        andamento:      d.andamento || 0,
        encerradas:     d.encerradas || 0,
        totalMateriais: d.totalMateriais || 0,
        ordensPorMes:   d.ordensPorMes || Array(12).fill(0),
      },
      create: {
        id:             "dashboard",
        total:          d.total || 0,
        abertas:        d.abertas || 0,
        andamento:      d.andamento || 0,
        encerradas:     d.encerradas || 0,
        totalMateriais: d.totalMateriais || 0,
        ordensPorMes:   d.ordensPorMes || Array(12).fill(0),
      },
    });
    console.log(`✔ estatisticas importadas (total: ${d.total})`);
  } catch (e) {
    console.error("  ✘ Estatísticas:", e.message);
  }
}

// ─── TERMOS ACEITOS ──────────────────────────────────────────────────────────
async function importarTermos() {
  const docs = ler("termosAceitos.json");
  if (!docs.length) return;
  let ok = 0;
  for (const d of docs) {
    // d._id é o UID do Firebase → mapeado para o userId pelo email
    const user = await prisma.user.findUnique({ where: { id: d._id } }).catch(() => null);
    if (!user) continue;
    try {
      await prisma.termoAceito.upsert({
        where: { userId: d._id },
        update: {},
        create: {
          userId:    d._id,
          aceito:    d.aceito !== false,
          dataAceite: d.dataAceite?._seconds ? new Date(d.dataAceite._seconds * 1000) : new Date(),
        },
      });
      ok++;
    } catch (e) {
      console.error(`  ✘ Termo ${d._id}:`, e.message);
    }
  }
  console.log(`✔ termosAceitos: ${ok}/${docs.length} importados`);
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
  console.log("═══════════════════════════════════════════");
  console.log(" SEINFRA — Importação Firebase → PostgreSQL");
  console.log("═══════════════════════════════════════════\n");

  // Ordem importa ANTES de auditoria (auditoria referencia userId)
  await importarUsers();
  await importarVisitas();
  await importarPessoas();
  await importarContadores();
  await importarEstatisticas();
  await importarOrdens();
  await importarTermos();

  console.log("\n✅ Importação concluída!");
  console.log("   Lembre de pedir para todos os usuários trocarem a senha no primeiro login.");
}

main()
  .catch((e) => { console.error("\n❌ Erro fatal:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
