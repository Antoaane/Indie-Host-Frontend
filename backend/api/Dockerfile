FROM node:24-alpine AS base
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig*.json ./
COPY scripts ./scripts
COPY prisma ./prisma
# Configuration de la ligne de commande Prisma 7 (URL de la base pour `migrate deploy`, service migrate).
COPY prisma.config.ts ./
COPY src ./src
# Carte du code (floorplan) servie à l'administration : domains/admin/floorplanMap.ts.
COPY assets ./assets

RUN npm run build

EXPOSE 4000
CMD ["npm", "run", "start:docker"]
