FROM node:20
WORKDIR /app

COPY . ./
RUN npm install
RUN npm run build

ENV NODE_ENV=production
EXPOSE 5000
CMD ["node", "dist/server.js"]