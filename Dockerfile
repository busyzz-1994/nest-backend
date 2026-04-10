# --- Build stage ---
FROM node:22-slim AS builder

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10 --activate

WORKDIR /app

# 先复制依赖文件，利用 Docker 缓存
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/
COPY prisma.config.ts ./

RUN pnpm install --frozen-lockfile

COPY . .

# prisma generate 需要此环境变量（仅用于生成客户端，不实际连接）
ARG POSTGRES_URL_NON_POOLING
ENV POSTGRES_URL_NON_POOLING=$POSTGRES_URL_NON_POOLING

RUN pnpm build

# 裁剪为生产依赖（保留已生成的 Prisma Client）
RUN pnpm prune --prod

# --- Production stage ---
FROM node:22-slim

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

EXPOSE 4000

CMD ["node", "dist/src/main.js"]
