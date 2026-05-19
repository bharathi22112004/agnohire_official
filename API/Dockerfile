FROM node:20-alpine AS base

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
COPY prisma ./prisma
RUN npx prisma generate

EXPOSE 5000
CMD ["node", "src/app.js"]
