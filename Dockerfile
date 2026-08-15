FROM node:24-trixie AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN npm run check
RUN npm run build
RUN rm -rf node_modules && npm ci --omit=dev --omit=optional


FROM node:24-trixie-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY --from=build --chown=node:node /app/dist/ ./dist
COPY --from=build --chown=node:node /app/node_modules/ ./node_modules
COPY --from=build --chown=node:node /app/package.json ./

USER node

CMD ["node", "dist/index.js"]
