FROM node:20.19.0-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --include=dev --include=optional

COPY . .
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "run", "start"]
