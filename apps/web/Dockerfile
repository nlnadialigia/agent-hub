FROM node:lts-alpine AS build

RUN npm install -g pnpm@12.16.1

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/web/package.json ./apps/web/
COPY apps/api/package.json ./apps/api/

RUN pnpm install

COPY apps/web ./apps/web

WORKDIR /app/apps/web
RUN pnpm build

EXPOSE 3000

CMD ["pnpm", "preview", "--host", "--port", "3000"]
