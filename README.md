# INFRASIS OS — Sistema de Gestão de Ordens de Serviço

Sistema web da **Secretaria Municipal de Infraestrutura (SEINFRA)** do município de Oriximiná para gestão de Ordens de Serviço e agendamento de visitas.

---

## Sumário

1. [Visão Geral](#visão-geral)
2. [Funcionalidades](#funcionalidades)
3. [Tecnologias](#tecnologias)
4. [Estrutura do Projeto](#estrutura-do-projeto)
5. [Perfis de Acesso](#perfis-de-acesso)
6. [Instalação e Deploy](#instalação-e-deploy)
7. [Variáveis de Ambiente](#variáveis-de-ambiente)
8. [Endpoints da API](#endpoints-da-api)
9. [Banco de Dados](#banco-de-dados)
10. [Numeração de OS](#numeração-de-os)

---

## Visão Geral

O INFRASIS OS é um sistema interno que substitui o controle manual de ordens de serviço. Ele oferece:

- Criação, edição e encerramento de Ordens de Serviço com controle de materiais
- Registro e consulta de visitas agendadas
- Dashboard com estatísticas em tempo real
- Relatórios por diretoria, status, período e materiais utilizados
- Controle de acesso por perfil de usuário
- Trilha de auditoria de todas as ações
- Assinatura eletrônica nas ordens

---

## Funcionalidades

### Módulo de Ordens de Serviço (`dashboard.html`)

| Recurso | Descrição |
|---------|-----------|
| **Dashboard** | Totais de OS por status, gráfico de ordens por mês |
| **Criar OS** | Formulário completo com dados do solicitante, setor, descrição, local, materiais, coordenadas GPS |
| **Listar OS** | Paginação, filtros por status, diretoria, ano e período |
| **Editar OS** | Atualização parcial de qualquer campo |
| **Encerrar OS** | Alteração de status com data de encerramento e observação final |
| **Assinar OS** | Assinatura eletrônica do responsável |
| **Relatórios** | Exportação e visualização de ordens filtradas |
| **Materiais por Mês** | Relatório de materiais utilizados com seleção de ano e mês |
| **Pendências** | Lista de OS sem assinatura (admin/master) |
| **Usuários** | Cadastro e gerenciamento de usuários (admin/master) |

### Módulo de Visitas (`home.html`)

| Recurso | Descrição |
|---------|-----------|
| **Cadastrar Visita** | Registro de visitantes com nome, CPF, telefone, endereço e data |
| **Listar Visitas** | Busca por nome e listagem paginada |
| **Dashboard** | Contador total de visitas registradas |

---

## Tecnologias

### Backend
- **[Hono](https://hono.dev/)** — Framework web leve para Node.js
- **[Prisma](https://www.prisma.io/)** — ORM para PostgreSQL
- **[PostgreSQL 16](https://www.postgresql.org/)** — Banco de dados relacional
- **[bcryptjs](https://github.com/dcodeIO/bcrypt.js)** — Hash de senhas
- **[jsonwebtoken](https://github.com/auth0/node-jsonwebtoken)** — Autenticação JWT
- **[Zod](https://zod.dev/)** — Validação de esquemas
- **TypeScript** — Tipagem estática

### Frontend
- HTML5 + CSS3 + JavaScript puro (ES Modules)
- [SweetAlert2](https://sweetalert2.github.io/) — Alertas e confirmações
- [Chart.js](https://www.chartjs.org/) — Gráficos do dashboard
- [jsPDF](https://github.com/parallax/jsPDF) — Geração de PDF das OS

### Infraestrutura
- **Docker + Docker Compose** — Containerização e orquestração
- **Nginx** — Servir o frontend e proxy reverso para a API

---

## Estrutura do Projeto

```
SEINFRA-main/
├── backend/                    # API REST
│   ├── src/
│   │   ├── index.ts           # Ponto de entrada da aplicação
│   │   ├── routes/
│   │   │   ├── auth.ts        # Login, logout, /me
│   │   │   ├── orders.ts      # CRUD de Ordens de Serviço
│   │   │   ├── users.ts       # Gerenciamento de usuários
│   │   │   ├── visits.ts      # CRUD de Visitas
│   │   │   ├── contacts.ts    # Cadastro de pessoas/contatos
│   │   │   └── terms.ts       # Aceite de termos de uso
│   │   ├── middleware/
│   │   │   └── auth.ts        # Verificação de JWT e perfis
│   │   └── lib/
│   │       ├── prisma.ts      # Cliente Prisma singleton
│   │       └── auditoria.ts   # Registro de auditoria
│   ├── prisma/
│   │   └── schema.prisma      # Modelos do banco de dados
│   ├── Dockerfile
│   └── package.json
│
├── SEINFRA/                    # Frontend
│   ├── index.html             # Tela de login
│   ├── servicos.html          # Seleção de módulo (OS ou Visita)
│   ├── dashboard.html         # Módulo de Ordens de Serviço
│   ├── home.html              # Módulo de Visitas
│   └── assets/
│       ├── css/               # Estilos
│       ├── js/
│       │   ├── api.js         # Client HTTP com token JWT
│       │   ├── auth.js        # Gerenciamento de sessão no frontend
│       │   ├── firestore.js   # Adaptador frontend ↔ backend (mapeia campos)
│       │   ├── admin-users.js # Gerenciamento de usuários
│       │   └── os/
│       │       ├── app.js     # Inicialização da página de OS
│       │       ├── ordens.js  # Lógica de CRUD de OS
│       │       ├── filtros.js # Filtros e relatórios
│       │       ├── ui.js      # Navegação e componentes de UI
│       │       ├── utils.js   # Funções puras (formatação, validação)
│       │       └── impressao.js # Geração de PDF
│       └── img/
│
├── nginx/
│   └── nginx.conf             # Configuração do proxy reverso
├── docker-compose.yml
└── .env.example
```

---

## Perfis de Acesso

O sistema possui quatro perfis com permissões crescentes:

| Perfil | Cor | Descrição |
|--------|-----|-----------|
| `visita` | Cinza | Acesso apenas ao módulo de Visitas |
| `os` | Azul | Acesso apenas ao módulo de Ordens de Serviço |
| `admin` | Laranja | Acesso a OS + gerenciamento de usuários (exceto excluir) |
| `master` | Vermelho | Acesso total ao sistema |

### Permissões detalhadas

| Ação | visita | os | admin | master |
|------|:------:|:--:|:-----:|:------:|
| Ver e criar OS | ❌ | ✅ | ✅ | ✅ |
| Editar OS | ❌ | ✅ | ✅ | ✅ |
| Excluir OS | ❌ | ❌ | ✅ | ✅ |
| Ver e criar Visitas | ✅ | ❌ | ✅ | ✅ |
| Ver Pendências | ❌ | ❌ | ✅ | ✅ |
| Cadastrar usuários | ❌ | ❌ | ✅ | ✅ |
| Editar/Inativar usuários | ❌ | ❌ | ✅ | ✅ |
| Excluir usuários | ❌ | ❌ | ❌ | ✅ |

### Setores por Diretoria

O sistema valida o setor solicitante com base na diretoria responsável selecionada:

- **Diretoria Administrativa** — Recepção, RH, Compras, Comunicação, Almoxarifado, Logística, etc.
- **Diretoria de Saneamento** — Hidráulico, Esgotamento, Sistema de Abastecimento de Água, etc.
- **Diretoria de Limpeza Urbana** — Capina, Papa-lixo, Caçamba, Bueiros, Resíduos, etc.
- **Diretoria de Infraestrutura** — Terraplanagem, Oficinas, Solda, Elétrica, Asfalto, Pintura, etc.
- **Diretoria de Aeroporto** — Pouso, Controle de Passageiros, Segurança Aeroportuária, etc.

---

## Instalação e Deploy

### Pré-requisitos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado e rodando

### Passo a passo

**1. Clone o repositório e entre na pasta:**

```bash
git clone <url-do-repositorio>
cd SEINFRA-main
```

**2. Configure as variáveis de ambiente:**

```bash
cp .env.example backend/.env
# Edite backend/.env com suas configurações
```

**3. Suba os containers:**

```bash
cd backend
docker-compose up -d
```

Isso inicia:
- `seinfra_db` — PostgreSQL na porta `5438`
- `seinfra_api` — API REST na porta `3001`

**4. Abra o sistema no navegador:**

Abra o arquivo `SEINFRA/index.html` diretamente no navegador ou sirva com qualquer servidor estático.

**5. Acesso inicial:**

| Campo | Valor |
|-------|-------|
| Email | (cadastrado pelo master) |
| Senha padrão | `Seinfra@2025` |

> **Atenção:** Altere as senhas após o primeiro acesso.

### Reiniciar após desligar o computador

```bash
# Abrir Docker Desktop
# Depois, na pasta backend:
cd backend
docker-compose up -d
```

---

## Variáveis de Ambiente

Arquivo: `backend/.env`

```env
DATABASE_URL=postgresql://seinfra:SENHA@localhost:5438/seinfra
JWT_SECRET=sua_chave_secreta_aqui_use_algo_longo
POSTGRES_PASSWORD=SENHA_DO_BANCO
PORT=3001
```

---

## Endpoints da API

Base URL: `http://localhost:3001/api`

### Autenticação (`/auth`)

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| POST | `/auth/login` | Login com email e senha | Não |
| GET | `/auth/me` | Dados do usuário logado | Sim |
| POST | `/auth/logout` | Encerrar sessão | Sim |

### Ordens de Serviço (`/orders`)

| Método | Rota | Descrição | Perfil mínimo |
|--------|------|-----------|---------------|
| GET | `/orders/stats/dashboard` | Estatísticas do dashboard | Qualquer |
| GET | `/orders/next-number` | Próximo número de OS | Qualquer |
| GET | `/orders` | Listar OS (paginado, com filtros) | Qualquer |
| GET | `/orders/:id` | Buscar OS por ID | Qualquer |
| POST | `/orders` | Criar nova OS | Qualquer |
| PATCH | `/orders/:id` | Atualizar OS | Qualquer |
| DELETE | `/orders/:id` | Excluir OS | admin/master |

**Filtros disponíveis em `GET /orders`:**

```
?page=1&limit=20&status=Aberta&diretoria=DIRETORIA+DE+INFRAESTRUTURA&ano=2026&dataInicio=2026-01-01&dataFim=2026-12-31
```

### Usuários (`/users`) — admin/master

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/users` | Listar todos os usuários |
| POST | `/users` | Criar usuário |
| PATCH | `/users/:id` | Editar usuário (nome, setor, telefone, role, senha) |
| PATCH | `/users/:id/toggle` | Ativar/Inativar usuário |
| DELETE | `/users/:id` | Excluir usuário (master only) |

### Visitas (`/visits`)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/visits` | Listar visitas (com `?search=nome&limit=50`) |
| GET | `/visits/:id` | Buscar visita por ID |
| POST | `/visits` | Registrar visita |
| PATCH | `/visits/:id` | Atualizar visita |
| DELETE | `/visits/:id` | Excluir visita |

### Termos (`/terms`)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/terms/check` | Verificar se usuário aceitou os termos |
| POST | `/terms/accept` | Registrar aceite dos termos |

---

## Banco de Dados

### Principais Tabelas

```
users              — Usuários do sistema
ordens             — Ordens de Serviço
visitas            — Registro de visitas
contadores         — Controle de numeração sequencial por ano
estatisticas       — Cache de estatísticas do dashboard (id = "dashboard")
auditoria          — Log de todas as ações realizadas
termos_aceitos     — Registro de aceite dos termos de uso
pessoas            — Cadastro de contatos/pessoas
```

### Auditoria

Toda ação de criação, edição ou exclusão é registrada na tabela `auditoria` com:
- Ação realizada, coleção e ID do documento afetado
- Usuário responsável (ID, nome, perfil)
- Detalhes da ação em JSON
- Timestamp

---

## Numeração de OS

As OS são numeradas sequencialmente por ano no formato:

```
OS 001/2026 - SEINFRA
OS 002/2026 - SEINFRA
...
```

**Regras:**

- O número é gerado atomicamente via SQL (`INSERT ... ON CONFLICT DO UPDATE`) para evitar duplicatas mesmo com criações simultâneas
- Ao excluir uma OS, o contador regride para o MAX real da tabela, garantindo que o próximo número seja o menor disponível
- A criação sempre usa `GREATEST(contador + 1, MAX_ATUAL + 1)` para nunca criar um número menor que o maior existente

---

## Auditoria e Segurança

- Senhas armazenadas com hash `bcrypt` (10 rounds)
- Tokens JWT com validade de **8 horas**
- Token enviado via header `Authorization: Bearer <token>`
- Erros de rede não encerram a sessão — apenas respostas `401` do servidor fazem logout
- Todas as rotas sensíveis requerem autenticação
- Exclusão de usuários restrita ao perfil `master`

---

## Suporte

Em caso de problemas:

1. Verifique se o Docker Desktop está aberto e rodando
2. Na pasta `backend`, rode `docker-compose up -d`
3. Verifique os logs: `docker logs seinfra_api`
4. Verifique o banco: `docker logs seinfra_db`
