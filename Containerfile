FROM node:22-alpine

WORKDIR /app

COPY package.json ./
COPY collector ./collector
COPY public ./public

CMD ["node", "collector/collect.mjs"]
