# ── Stage 1: dependencias de producción ──────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ── Stage 2: imagen final ─────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

# Usuario no-root
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 --ingroup nodejs nodeuser

# Dependencias de producción + código fuente
COPY --from=deps --chown=nodeuser:nodejs /app/node_modules ./node_modules
COPY --chown=nodeuser:nodejs src/        ./src/
COPY --chown=nodeuser:nodejs package.json ./

USER nodeuser

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# /healthz devuelve {"status":"ok"} — sin autenticación
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/healthz || exit 1

CMD ["node", "src/server.js"]
