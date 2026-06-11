# syntax=docker/dockerfile:1

# ---- Build stage: compile the static site with Vite ----
FROM node:20-alpine AS build
WORKDIR /app

# Install dependencies against the lockfile-free manifest.
COPY package.json ./
RUN npm install

# Build the app. VITE_* values are inlined at build time, so pass them as
# build args if you want the live backend baked in. Defaults favor mock mode
# so the image runs standalone for the demo.
ARG VITE_KEEPER_URL=http://localhost:8000
ARG VITE_MOCK=1
ENV VITE_KEEPER_URL=${VITE_KEEPER_URL}
ENV VITE_MOCK=${VITE_MOCK}

COPY . .
RUN npm run build

# ---- Serve stage: nginx serves the static build ----
FROM nginx:1.27-alpine AS serve

# Cloud Run sets PORT; default to 8080 for local runs.
ENV PORT=8080

# Template the server config so ${PORT} is resolved at container start.
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

# The official nginx image renders /etc/nginx/templates/*.template through
# envsubst into /etc/nginx/conf.d on startup, then launches nginx.
CMD ["nginx", "-g", "daemon off;"]
