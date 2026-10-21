# Render Docker deploy: build the Vite SPA, serve with nginx + SPA fallback.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Render injects PORT; nginx listens there at runtime via the envsubst below.
EXPOSE 80
CMD ["sh", "-c", "envsubst '$PORT' < /etc/nginx/conf.d/default.conf > /tmp/nginx.conf && cp /tmp/nginx.conf /etc/nginx/conf.d/default.conf && exec nginx -g 'daemon off;'"]
