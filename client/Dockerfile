# Angular app Dockerfile
FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./

RUN npm i

COPY . .

RUN npm run build --prod

# Nginx Dockerfile
FROM nginx:alpine

COPY --from=build /app/dist/client/browser /usr/share/nginx/html

COPY ./nginx.conf /etc/nginx/conf.d/default.conf
