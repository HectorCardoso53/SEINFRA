# 🔐 Protegendo credenciais do Firebase

## ⚠️ Situação: chave exposta no repositório público

Se a `apiKey` já foi commitada, **remover o arquivo do git não é suficiente** — ela
ainda fica visível no histórico. Siga os passos abaixo na ordem.

---

## Passo 1 — Revogar a chave imediatamente

1. Acesse [console.firebase.google.com](https://console.firebase.google.com)
2. Selecione o projeto **seinfra-dbf5e**
3. Vá em **Configurações do projeto → Geral → Seus apps**
4. Clique no app Web → **Regenerar chave de API** (ou faça isso pelo Google Cloud Console em APIs & Serviços → Credenciais)
5. Copie a nova chave — ela vai para o `.env` local, nunca no código

---

## Passo 2 — Remover do histórico do Git

Execute no terminal, dentro da pasta do projeto:

```bash
# Instala o BFG (forma mais rápida de limpar histórico)
# Alternativa: use git filter-repo

# Com git filter-repo (recomendado):
pip install git-filter-repo

git filter-repo --path firebase.js --invert-paths
```

Ou, se quiser só substituir o valor da chave no histórico:

```bash
git filter-repo --replace-text <(echo 'AIzaSyAetN1hjVd9LMSUex0c4KGzkzpdSP7AQGU==>CHAVE_REMOVIDA')
```

Depois force push:

```bash
git push origin --force --all
git push origin --force --tags
```

> ⚠️ Avise colaboradores para fazerem `git clone` novo — o histórico reescrito
> torna os clones antigos incompatíveis.

---

## Passo 3 — Configurar o .env local

```bash
# Na raiz do projeto
cp .env.example .env
```

Abra o `.env` e preencha com os valores do Firebase Console.
Verifique que `.env` está no `.gitignore` antes de qualquer commit.

---

## Passo 4 — Verificar se o .gitignore está funcionando

```bash
git status
```

O arquivo `.env` **não deve aparecer** na lista de arquivos a commitar.
Se aparecer, rode:

```bash
git rm --cached .env
git commit -m "remove .env do rastreamento"
```

---

## Passo 5 — Ativar Firebase App Check (proteção extra)

Mesmo com a chave protegida, configure o **App Check** para garantir que só
seu domínio pode usar o projeto Firebase:

1. Firebase Console → **App Check**
2. Ative o provedor **reCAPTCHA v3** para o app Web
3. Adicione seus domínios autorizados em **Authentication → Settings → Authorized domains**

---

## Resumo dos arquivos

| Arquivo | Vai para o git? | Descrição |
|---|---|---|
| `.env` | ❌ NÃO | Credenciais reais — só na sua máquina |
| `.env.example` | ✅ SIM | Modelo vazio para outros devs |
| `.gitignore` | ✅ SIM | Garante que `.env` nunca seja commitado |
| `firebase.js` | ✅ SIM | Sem valores hardcoded — lê do `.env` |
