FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json .
COPY src ./src
RUN npm run build

CMD ["sh", "-c", "npx prisma db push && node dist/index.js"]
