FROM node:lts-alpine AS build

WORKDIR /app

COPY package*.json ./

RUN npm i

COPY . .

RUN npm run build --prod

FROM nginx:alpine

COPY --from=build /app/dist/client/browser /usr/share/nginx/html

COPY ./nginx/nginx.conf /etc/nginx/conf.d/default.conf
