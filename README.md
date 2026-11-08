# 🤖 Agent Hub — Squad Autônoma Multi-Plataforma & Multi-Stack

> **Plataforma de Engenharia Autônoma orientada a Multi-Agentes com Gateway Multi-LLM OmniRoute, Desacoplamento N:M de Boards/Git, Ambientes Sandbox via Git Worktrees e Scanner Poliglota.**

[![Node.js](https://img.shields.io/badge/Node.js-v26%20LTS-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-v12-F69220?logo=pnpm&logoColor=white)](https://pnpm.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10.x-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-Cyan%20Theme-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Prisma](https://img.shields.io/badge/Prisma-5.22-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Docker Compose](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![OmniRoute](https://img.shields.io/badge/OmniRoute-Multi--LLM%20:20128-8B5CF6)](https://github.com/diegosouzapw/omniroute)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 📑 Sumário

- [Visão Geral](#-visão-geral)
- [Principais Capacidades](#-principais-capacidades)
- [Arquitetura & Topologia de Portas](#-arquitetura--topologia-de-portas)
- [A Squad de Especialistas & Modelos](#-a-squad-de-especialistas--modelos)
- [Gateway OmniRoute & Economia de Modelos](#-gateway-omniroute--economia-de-modelos)
- [Guia das 6 Abas da Interface Web](#-guia-das-6-abas-da-interface-web)
- [Pastas Monitoradas & Scanner Poliglota](#-pastas-monitoradas--scanner-poliglota)
- [Instalação & Quickstart](#-instalação--quickstart)
- [Variáveis de Ambiente (`.env`)](#-variáveis-de-ambiente-env)
- [Governança Git & CI/CD](#-governança-git--cicd)
- [Licença](#-licença)

---

## 🌟 Visão Geral

O **Agent Hub** é um monorepo corporativo projetado para transformar especificações e cards de tarefas (vindas do GitHub Issues, Kanbanize/Businessmap, Jira, Trello ou manuais) em código auditado, testado e entregue como Pull Requests em repositórios remotos (GitHub, Azure DevOps, GitLab ou Bitbucket).

A aplicação opera através de um **Orquestrador Tech Lead** que analisa as instruções da tarefa, planeja uma arquitetura executiva orientada a texto (Diagnóstico Antigravity) e coordena até **5 Agentes Especialistas** atuando em um ambiente isolado de **Git Worktree**.

```
[ Board / Tarefa ] ──> [ Orquestrador Tech Lead ] ──> [ Diagnóstico & Grill-Me ]
                              │
       ┌──────────────────────┼──────────────────────┐
       ▼                      ▼                      ▼
 [ DB & ORM ]       [ Backend Node/Python ]    [ Frontend / QA ]
       └──────────────────────┬──────────────────────┘
                              ▼
        [ Git Worktree Sandbox & Testes Unitários ]
                              ▼
      [ Relatório Executivo & Pull Request Automatizado ]
```

---

## ⚡ Principais Capacidades

* **Desacoplamento N:M Total**: Você pode buscar um Card no **Kanbanize**, gerar o código em um repositório interno do **Azure DevOps** e respeitar a branch alvo (`develop`, `main`, etc.) de forma totalmente transparente.
* **Squad com 6 Agentes Plugáveis**: Orquestrador, Backend Node/TS, Backend Python, Frontend Web, Banco de Dados/ORM e QA/DevOps.
* **Economia Inteligente de Tokens**: Orquestrador Tech Lead configurado para usar modelo de alta capacidade pago (`gemini-2.5-pro`), enquanto todos os especialistas executam com modelos 100% gratuitos via **OmniRoute** (`deepseek-v3-free`, `qwen-2.5-coder-free`, `gemini-2.5-flash-free`).
* **Scanner Poliglota com Pastas Monitoradas**: Mapeamento dinâmico de pastas-raiz do host (`/home/nlnadialigia/suzano`, `/home/nlnadialigia/www`) com re-varredura em 1 clique e filtragem instantânea na interface.
* **Diagnóstico Textual & Refinamento Iterativo**: Diagnóstico técnico focado em entendimento de negócio, diagrama de entidades e perguntas de clarificação (`grill-me`), com loop interativo antes de autorizar a implementação.
* **Relatório Executivo Copiável em 1 Clique**: Entrega com botões dedicados para copiar o resumo para o Kanbanize, documentar tarefas ou baixar em Markdown.

---

## 🔌 Arquitetura & Topologia de Portas

O monorepo utiliza **pnpm workspaces** e roda totalmente conteinerizado via **Docker Compose**, sem colidir com portas de outros projetos locais:

| Serviço | Nome do Container | Porta Host | Porta Container | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| **Frontend Web** | `agent_hub_web` | `3001` | `3000` | Interface SPA React + Vite + Tailwind CSS |
| **Backend API** | `agent_hub_api` | `3334` | `3333` | API NestJS + Prisma + WebSockets |
| **Banco de Dados** | `agent_hub_postgres` | `5433` | `5432` | PostgreSQL 18 com volume persistente |
| **Gateway OmniRoute** | `agent_hub_omniroute` | `20128` | `20128` | Gateway Multi-LLM local com cache e balanceamento |

---

## 👥 A Squad de Especialistas & Modelos

Cada agente possui persona técnica, prompt de sistema e parâmetros de temperatura específicos no banco de dados (`SpecialistAgentConfig`):

| Agente | Papel | Modelo Padrão | Custo | Foco de Atuação |
| :--- | :--- | :--- | :--- | :--- |
| **Tech Lead** | `ORCHESTRATOR` | `gemini-2.5-pro` | Pago | Decomposição, arquitetura, design patterns e revisão |
| **Database Agent** | `DATABASE` | `deepseek-v3-free` | Grátis | Schemas Prisma, SQL, Migrations, Seeds e Índices |
| **Node/TS Backend** | `BACKEND_NODE` | `qwen-2.5-coder-free` | Grátis | NestJS, Fastify, Express, Zod e contratos de API |
| **Python Backend** | `BACKEND_PYTHON` | `deepseek-v3-free` | Grátis | FastAPI, Django, Flask, SQLAlchemy e Pydantic |
| **Frontend Web** | `FRONTEND` | `gemini-2.5-flash-free` | Grátis | React, Next.js, Vite, Tailwind CSS, shadcn/ui |
| **QA & DevOps** | `QA_DEVOPS` | `auto` | Grátis | Jest, Vitest, Pytest, Dockerfile, CI/CD e Worktrees |

---

## 🌐 Gateway OmniRoute & Economia de Modelos

O **OmniRoute** opera na porta `:20128` atuando como proxy e agregador local compatível com o protocolo OpenAI:
* **Catálogo Free**: O Agent Hub sincroniza automaticamente os modelos gratuitos ativos no OmniRoute.
* **Resiliência e Fallback**: Se o modelo primário de um especialista atingir rate limit ou instabilidade, o OmniRoute automaticamente faz o failover para o modelo de fallback configurado.
* **Badges Visuais**: A interface categoriza claramente modelos gratuitos com selo esmeralda (`BadgeCheck Grátis`) e modelos pagos com selo ciano (`CreditCard Pago`).

---

## 🖥️ Guia das 6 Abas da Interface Web

A interface web foi desenhada com paleta moderna **Cyan (`cyan-500` / `cyan-600`)** e alternador fluido de tema **Light Mode / Dark Mode**:

### 1. ➕ Inserir Tarefa
* **Seletor de Provedor de Tarefa**: Escolha entre `GitHub Issues`, `Kanbanize`, `Jira`, `Trello`, `Linear` ou `Manual`.
* **Desacoplamento de VCS & Repositório**: Selecione o repositório de destino e a branch alvo de PR (`main`, `develop`, etc.).
* **Modo de Execução**: Escolha entre execução **Em Sequência (Fila)** ou **Concomitante (Imediato)**.
* **Instruções Manuais em Markdown**: Textarea expansível com contador de caracteres para complementar a issue.
* **Painel da Fila Viva**: Visualização inferior das tarefas aguardando ou em processamento em tempo real.

### 2. ⚡ Execução de Tarefa
* **Diagnóstico Estruturado**: Análise da arquitetura, impactos no banco e árvore de decisão (`grill-me`).
* **Caixa de Refinamento Iterativo**: Permite dialogar com a IA antes de autorizar a implementação (Aprovar, Rejeitar ou Refinar).
* **Terminal de Logs ao Vivo**: Logs de execução coloridos e categorizados pelo especialista ativo.
* **Relatório Simples de Entrega**: Resumo executivo final com botões de cópia em 1 clique (`Copiar Tudo`, `Copiar Resumo`, `Copiar Tasks Kanbanize`, `Baixar .md`).

### 3. 🤖 Squad & OmniRoute
* Painel de status em tempo real do OmniRoute Gateway (`:20128`).
* Botão para **Sincronizar Modelos Gratuitos** do catálogo.
* Cards individuais dos 6 Especialistas com sliders de Temperatura (0.0 a 1.0) e dropdowns de modelo primário e fallback.

### 4. 📁 Repositórios & Pastas Monitoradas
* **Cards de Pastas Monitoradas**: Pastas-raiz salvas (`/home/nlnadialigia/suzano`, `/home/nlnadialigia/www`) com contagem de repositórios e data da última varredura.
* **Re-escanear em 1 Clique**: Botão de atualização rápida de subpastas por diretório.
* **Filtro Rápido**: Clique em uma pasta para exibir apenas os repositórios pertencentes a ela.
* **Mapeamento Poliglota**: Detecção automática de Stacks, Linguagem, Frameworks, Gerenciador de Pacotes e editor de `targetBranch`.

### 5. 📜 Histórico
* Listagem completa de execuções com data formatada (`DD/MM/AAAA`).
* Status coloridos (`COMPLETED`, `REJECTED`, `FAILED`).
* Soft-delete com confirmação e botão de restauração.
* Alternador de visualização: **Mostrar Todos** vs. **Apenas Ativos**.

### 6. ⚙️ Configurações & Integrações
* Cofre de credenciais seguro criptografado com **AES-256**.
* Formulários com botões de **Testar Conexão** em tempo real para GitHub, Azure DevOps, Kanbanize, Jira, Trello e OmniRoute.
* Visualizador do caminho base do host configurado nos volumes do Docker.

---

## 📁 Pastas Monitoradas & Scanner Poliglota

O Agent Hub utiliza montagem inteligente de volumes Docker para acessar os repositórios do host sem conflitos de permissões:

```bash
# Exemplo de pastas mapeadas na máquina local
/home/nlnadialigia/
├── suzano/
│   ├── portal-florestal-backend  (NestJS + Prisma + Docker)
│   └── portal-florestal-frontend (Next.js + Tailwind)
└── www/
    ├── church-studio
    ├── cloud-notes
    ├── code-review
    └── ...
```

Ao cadastrar `/home/nlnadialigia/suzano` ou `/home/nlnadialigia/www` na aba de **Repositórios**, o sistema armazena a pasta como uma entidade monitorada no PostgreSQL e vincula todos os sub-projetos Git descobertos.

---

## 🚀 Instalação & Quickstart

### Pré-requisitos
* [Node.js](https://nodejs.org/) v26+ (LTS)
* [pnpm](https://pnpm.io/) v12+
* [Docker & Docker Compose](https://www.docker.com/)

### 1. Clonar o Repositório
```bash
git clone git@github.com:nlnadialigia/agent-hub.git
cd agent-hub
```

### 2. Configurar Variáveis de Ambiente
Copie o modelo de variáveis e ajuste com suas credenciais:
```bash
cp .env.example .env # ou edite o .env existente
```

### 3. Instalar Dependências & Build Local (Opcional)
```bash
pnpm install
pnpm -r build
```

### 4. Subir a Stack Completa no Docker
```bash
docker compose up -d --build
```

### 5. Acessar as Aplicações
* **Frontend Web**: [http://localhost:3001](http://localhost:3001)
* **Backend API**: [http://localhost:3334](http://localhost:3334)
* **OmniRoute Dashboard**: [http://localhost:20128](http://localhost:20128)

---

## 🔑 Variáveis de Ambiente (`.env`)

Principais chaves necessárias para a operação da stack:

```env
# Banco de Dados PostgreSQL Dedicado
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=agent_hub_db
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/agent_hub_db?schema=public"

# Portas e URLs
PORT=3334
VITE_API_URL=http://localhost:3334
VITE_WS_URL=ws://localhost:3334

# Caminhos do Host e Volumes
HOST_REPOS_PATH=/home/nlnadialigia
REPOS_BASE_DIR=/workspace/repos
WORKTREES_BASE_DIR=/workspace/worktrees

# Cofre de Credenciais (Chave de 32 bytes AES-256)
VAULT_SECRET_KEY=sua_chave_secreta_aes_256_aqui

# OmniRoute Gateway Local
OMNIROUTE_BASE_URL=http://localhost:20128/v1
OMNIROUTE_API_KEY=sk-omniroute-local

# Chave do Orquestrador Tech Lead
GEMINI_API_KEY=sua_chave_gemini_aqui

# Integrações VCS & Boards
GITHUB_TOKEN=seu_github_token_aqui
AZURE_DEVOPS_PAT=seu_pat_azure_aqui
AZURE_DEVOPS_ORG_URL=https://dev.azure.com/sua-org
AZURE_DEVOPS_PROJECT=seu-projeto
KANBANIZE_API_KEY=sua_chave_kanbanize_aqui
KANBANIZE_SUBDOMAIN=seu_subdominio
```

---

## 🛡️ Governança Git & CI/CD

O repositório adota políticas estritas de integridade de código:
* **Bloqueio de Push Direto na `main`**: Hook `.githooks/pre-push` ativo impedindo pushes não autorizados.
* **Proibição Estrita de `--no-verify`**: Toda alteração é validada localmente por hooks de lint e testes.
* **Branches e PRs Padronizadas**:
  * Funcionalidades: `feat/<nome>` ou `feat/issue_<numero>`
  * Correções: `fix/<nome>` ou `fix/issue_<numero>`
  * Documentação: `docs/<nome>` ou `docs/issue_<numero>`
* **Fechamento Automático de Issues**: Pull Requests vinculados com `Closes #<número>` finalizam as issues no GitHub no momento do merge.

---

## 📄 Licença

Distribuído sob a Licença **MIT**. Consulte o arquivo [LICENSE](LICENSE) para mais detalhes.

---

<p align="center">
  Desenvolvido com 🩵 por <strong>Nadia Ligia</strong> (2026)
</p>
