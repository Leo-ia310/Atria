FROM node:22-alpine AS base
WORKDIR /workspace
COPY package.json ./
COPY packages/contracts/package.json ./packages/contracts/package.json
COPY apps/api/package.json ./apps/api/package.json
RUN npm install

FROM node:22-alpine AS builder
WORKDIR /workspace
COPY --from=base /workspace/node_modules ./node_modules
COPY . .
RUN npm run db:generate --workspace @atria/api
RUN npm run build --workspace @atria/contracts
RUN npm run build --workspace @atria/api

FROM node:22-alpine AS runner
WORKDIR /workspace
ENV NODE_ENV=production
COPY --from=builder /workspace/package.json ./package.json
COPY --from=builder /workspace/node_modules ./node_modules
COPY --from=builder /workspace/apps/api/dist ./apps/api/dist
COPY --from=builder /workspace/apps/api/package.json ./apps/api/package.json
COPY --from=builder /workspace/apps/api/prisma ./apps/api/prisma
COPY --from=builder /workspace/packages/contracts/dist ./packages/contracts/dist
EXPOSE 4000
CMD ["node", "apps/api/dist/main.js"]
