# Angular app Dockerfile
FROM node:lts-alpine AS build

WORKDIR /app

# clar cache
RUN npm cache clean --force

COPY package.json ./

RUN npm i

COPY . .

RUN npm run build --prod

# Nginx Dockerfile
FROM nginx:alpine

COPY --from=build /app/dist/client/browser /usr/share/nginx/html

COPY ./nginx.conf /etc/nginx/conf.d/default.conf
