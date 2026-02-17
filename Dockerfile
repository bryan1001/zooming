FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx tsc && npx vite build

FROM node:20-alpine
WORKDIR /app
RUN npm init -y && npm install express
COPY --from=build /app/dist ./public
COPY server.js .
EXPOSE 5000
CMD ["node", "server.js"]
