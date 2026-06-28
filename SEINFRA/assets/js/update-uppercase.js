import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  updateDoc,
  doc,
} from "firebase/firestore";

// 🔥 SUA CONFIG FIREBASE AQUI
const firebaseConfig = {
  apiKey: "SUA_KEY",
  authDomain: "SEU_DOMINIO",
  projectId: "SEU_PROJECT_ID",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// função segura
function toUpperSafe(value) {
  if (!value) return value;

  return value
    .toString()
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

async function updateAll() {
  const snapshot = await getDocs(collection(db, "visitas"));

  let count = 0;

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();

    const updated = {
      name: toUpperSafe(data.name),
      address: toUpperSafe(data.address),
      reference: toUpperSafe(data.reference),
      reason: toUpperSafe(data.reason),
    };

    await updateDoc(doc(db, "visitas", docSnap.id), updated);

    count++;
    console.log(`Atualizado: ${docSnap.id}`);
  }

  console.log(`🔥 FINALIZADO: ${count} registros atualizados`);
}

updateAll();