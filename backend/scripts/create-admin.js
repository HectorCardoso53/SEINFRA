const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");
require("dotenv").config();

const prisma = new PrismaClient();

async function main() {
  const senha = await bcrypt.hash("Seinfra@2025", 10);
  const user = await prisma.user.upsert({
    where:  { email: "admin@seinfra.gov.br" },
    update: { senha, role: "master", ativo: true },
    create: {
      nome:  "ADMINISTRADOR MASTER",
      email: "admin@seinfra.gov.br",
      senha,
      role:  "master",
      ativo: true,
    },
  });
  console.log("Usuário master criado:", user.email);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
