"use strict";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* =========================
   CONFIGURAÇÃO FIREBASE
   As credenciais vêm de variáveis de ambiente (NUNCA commite valores reais aqui)
   → Leia o README.md para configurar o .env
========================= */
const firebaseConfig = {
  apiKey: "AIzaSyAetN1hjVd9LMSUex0c4KGzkzpdSP7AQGU",
  authDomain: "seinfra-dbf5e.firebaseapp.com",
  projectId: "seinfra-dbf5e",
  storageBucket: "seinfra-dbf5e.firebasestorage.app",
  messagingSenderId: "1033717206698",
  appId: "1:1033717206698:web:accac3ca55338990ea0ad3",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
