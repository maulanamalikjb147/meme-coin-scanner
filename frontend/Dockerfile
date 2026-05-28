# ---- SOL/SCREENER frontend (React → nginx) ----

# Stage 1: build
FROM node:20-alpine AS builder

WORKDIR /app

# Backend URL injected at build time (CRA bakes it into JS bundle)
ARG REACT_APP_BACKEND_URL=http://localhost:8001
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL

# Install deps with yarn (lockfile-aware)
COPY package.json yarn.lock* ./
RUN yarn install --frozen-lockfile --network-timeout 600000 || yarn install --network-timeout 600000

# Build
COPY . .
RUN yarn build

# Stage 2: serve static via nginx + proxy /api to backend
FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/build /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost/ >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]
