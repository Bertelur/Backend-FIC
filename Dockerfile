# syntax=docker/dockerfile:1

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./

COPY --from=deps /app/node_modules ./node_modules

COPY tsconfig*.json ./
COPY src ./src

RUN npm run build

FROM node:22-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --fund=false \
  && npm cache clean --force

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

COPY .env ./.env

RUN chown -R node:node /app
USER node

EXPOSE 3000
CMD ["node", "dist/index.js"]
