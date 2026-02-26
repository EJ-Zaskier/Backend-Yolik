# Backend Yolik

Backend API para e-commerce de ropa tradicional regional con Node.js, Express y MongoDB.

## Seguridad y autenticacion

- Autenticacion delegada a Auth0 (Bearer Access Tokens RS256).
- Validacion de token por `issuer` y `audience`.
- RBAC por permisos/scopes en rutas sensibles.
- Provision automatica de usuario local a partir de `sub` de Auth0.
- Rate limiting por dominio funcional (general, dashboard, pagos).

## Variables de entorno requeridas

- `MONGO_URI`
- `PORT`
- `AUTH0_DOMAIN` (ejemplo: `dev-xxxx.us.auth0.com`)
- `AUTH0_API_AUDIENCE` (API Identifier configurado en Auth0)

Opcionales:

- `AUTH0_ISSUER_BASE_URL` (si no se define, se construye desde `AUTH0_DOMAIN`)
- `AUTH0_ROLES_CLAIM` (default: `https://yolik.app/roles`)
- `FRONTEND_URL` (obligatoria en produccion)
- `ENABLE_PAYMENTS` (default `false`, no monta rutas de pago)
- `PAYMENT_PROVIDER` (`stripe`, `mercadopago`, `paypal`)
- `PAYMENT_CURRENCY` (default `MXN`)
- `DASHBOARD_TIMEZONE` (default `UTC`)

## Endpoints principales

- `GET /api/products`
- `GET /api/products/:id`
- `GET /api/auth/me`
- `GET /api/auth/context`
- `GET /api/dashboard/summary`
- `GET /api/dashboard/sales-trend`
- `GET /api/dashboard/top-products`
- `GET /api/dashboard/inventory-alerts`
- `GET /api/payments/config` (solo si `ENABLE_PAYMENTS=true`)
- `POST /api/payments/intents` (solo si `ENABLE_PAYMENTS=true`)

## Permisos sugeridos en Auth0

- `create:orders`
- `read:orders`
- `read:orders:all` (admin)
- `read:dashboard` (admin)
- `create:payments`

## Pagos

La capa de pagos esta preparada con arquitectura de proveedor:

- `stripe`
- `mercadopago`
- `paypal`

Actualmente el adapter esta en modo placeholder y responde que falta integracion real del SDK/webhooks firmados.

## Scripts

- `npm test`
- `npm run test:orders`
