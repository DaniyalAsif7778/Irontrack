FROM node:20
WORKDIR /app

COPY package*.json ./
COPY server/package*.json server/
COPY client/package*.json client/
RUN npm ci -w server --include-workspace-root

COPY server server
RUN npm run build -w server

ENV NODE_ENV=production
EXPOSE 5000
CMD ["node", "server/dist/server.js"]