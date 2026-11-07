FROM node:lts-alpine AS base

# Instala Git, Python 3 + pip (Multi-Runtime), GitHub CLI e utilitários
RUN apk add --no-cache git bash curl openssh openssl python3 py3-pip github-cli && \
    git config --system --add safe.directory '*'

RUN npm install -g pnpm@12.16.1

WORKDIR /app

# Copia configurações do monorepo e lockfile
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/

# Instala dependências
RUN pnpm install

# Copia código fonte da API
COPY apps/api ./apps/api

# Gera cliente Prisma e constrói a API
WORKDIR /app/apps/api
RUN pnpm prisma:generate
RUN pnpm build

EXPOSE 3333

CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node dist/main.js"]
