FROM node:20
WORKDIR /app

COPY . .
RUN npm ci -w server --include-workspace-root
RUN npm run build -w server

ENV NODE_ENV=production
EXPOSE 5000
CMD ["node", "server/dist/server.js"]