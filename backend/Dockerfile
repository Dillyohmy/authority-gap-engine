FROM node:22-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

COPY package*.json ./

RUN npm install

RUN npx playwright install --with-deps chromium

COPY . .

RUN npm run build

RUN npm prune --omit=dev

EXPOSE 4000

CMD ["node", "dist/server.js"]