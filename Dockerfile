# Stage 1 — build
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx ng build --configuration production

# Stage 2 — test
FROM node:22-alpine AS test
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
CMD ["npx", "ng", "test", "--watch=false"]

# Stage 3 — serve
FROM nginx:alpine
COPY --from=builder /app/dist/openapi-spec-generator/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf.template
EXPOSE 80
# YOUTRACK_URL is substituted into nginx.conf at container start.
# Example: docker run -e YOUTRACK_URL=http://127.0.0.1:8080 ...
# Defaults to a no-op URL so nginx starts even without the variable set.
ENV YOUTRACK_URL="http://127.0.0.1:8080"
CMD ["/bin/sh", "-c", "envsubst '${YOUTRACK_URL}' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf && nginx -g 'daemon off;'"]