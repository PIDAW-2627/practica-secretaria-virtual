FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

# Dependencias primero, para aprovechar la caché de capas
COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src

# La API no se ejecuta como root
RUN mkdir -p uploads && chown node:node uploads
USER node

EXPOSE 3000
CMD ["node", "src/server.js"]
