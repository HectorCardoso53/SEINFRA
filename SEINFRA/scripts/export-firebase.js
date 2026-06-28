// scripts/export-firebase.js
// Exporta todas as coleções do Firestore para arquivos JSON em /scripts/backup/
// Uso: node scripts/export-firebase.js

const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

const serviceAccount = require("../serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const COLECOES = [
  "users",
  "ordens",
  "visitas",
  "pessoas",
  "contadores",
  "estatisticas",
  "auditoria",
  "termosAceitos",
];

const BACKUP_DIR = path.join(__dirname, "backup");

async function exportarColecao(nome) {
  const snapshot = await db.collection(nome).get();
  const docs = [];

  snapshot.forEach((doc) => {
    docs.push({ _id: doc.id, ...doc.data() });
  });

  const arquivo = path.join(BACKUP_DIR, `${nome}.json`);
  fs.writeFileSync(arquivo, JSON.stringify(docs, null, 2), "utf8");

  console.log(`✔ ${nome}: ${docs.length} documentos exportados → ${arquivo}`);
  return docs.length;
}

async function main() {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

  console.log("Iniciando exportação do Firestore...\n");

  let total = 0;
  for (const colecao of COLECOES) {
    try {
      total += await exportarColecao(colecao);
    } catch (err) {
      console.error(`✘ Erro ao exportar "${colecao}":`, err.message);
    }
  }

  const meta = {
    exportadoEm: new Date().toISOString(),
    totalDocumentos: total,
    colecoes: COLECOES,
  };
  fs.writeFileSync(path.join(BACKUP_DIR, "_meta.json"), JSON.stringify(meta, null, 2));

  console.log(`\nExportação concluída. Total: ${total} documentos.`);
  console.log(`Backup salvo em: ${BACKUP_DIR}`);
}

main().catch((err) => {
  console.error("Erro fatal:", err);
  process.exit(1);
});
