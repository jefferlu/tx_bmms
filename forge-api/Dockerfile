# NestJS app Dockerfile
FROM node:lts-alpine AS build

WORKDIR /app

COPY package*.json ./

RUN npm i

COPY . .

RUN npm run build

# Run production mode
CMD ["npm", "run", "start:prod"]