# Backend Yolik

Backend API para e-commerce de ropa tradicional regional con Node.js, Express y MongoDB.

## Seguridad y autenticacion

- Autenticacion delegada a Auth0 con Access Tokens RS256.
- Validacion estricta de `issuer` y `audience`.
- RBAC por roles, permisos y scopes en rutas sensibles.
- Provision automatica de usuario local a partir de `sub` de Auth0.
- Respuesta de sesion minimizada: `/api/auth/me` no expone correo ni `auth0Sub`.
- Rate limiting por dominio funcional (general, API, dashboard, pagos).

## Variables de entorno requeridas

- `MONGO_URI`
- `PORT`
- `AUTH0_DOMAIN` (ejemplo: `dev-xxxx.us.auth0.com`)
- `AUTH0_API_AUDIENCE` (API Identifier configurado en Auth0)

Opcionales:

- `AUTH0_ISSUER_BASE_URL` (si no se define, se construye desde `AUTH0_DOMAIN`)
- `AUTH0_ROLES_CLAIM` (default: `https://yolik.app/roles`)
- `AUTH0_USERNAME_CLAIM` (default: `https://yolik.app/username`)
- `FRONTEND_URL` (obligatoria en produccion)
- `ENABLE_PAYMENTS` (default `false`, no monta rutas de pago)
- `PAYMENT_PROVIDER` (`stripe`, `mercadopago`, `paypal`)
- `PAYMENT_CURRENCY` (default `MXN`)
- `DASHBOARD_TIMEZONE` (default `UTC`)

## Endpoints principales

- `GET /healthz`
- `GET /api/products`
- `GET /api/products/:id`
- `GET /api/auth/me`
- `GET /api/auth/context`
- `GET /api/cart`
- `POST /api/cart/items`
- `PATCH /api/cart/items/:productId`
- `DELETE /api/cart/items/:productId`
- `DELETE /api/cart`
- `POST /api/orders`
- `GET /api/orders/my-orders`
- `GET /api/orders/:id`
- `GET /api/dashboard/summary`
- `GET /api/dashboard/sales-trend`
- `GET /api/dashboard/top-products`
- `GET /api/dashboard/inventory-alerts`
- `GET /api/dashboard/products` (admin)
- `POST /api/dashboard/products` (admin)
- `PATCH /api/dashboard/products/:id` (admin)
- `DELETE /api/dashboard/products/:id` (admin, baja lógica)
- `PATCH /api/dashboard/products/:id/restore` (admin)
- `GET /api/payments/config` (solo si `ENABLE_PAYMENTS=true`)
- `POST /api/payments/intents` (solo si `ENABLE_PAYMENTS=true`)

## Acceso publico vs autenticado

- Publico (sin cuenta): catalogo (`GET /api/products`, `GET /api/products/:id`).
- Requiere sesion: carrito, ordenes, dashboard, pagos.
- Gestion de productos (dashboard admin): alta, edición, baja lógica y restauración.

## Roles y permisos en Auth0

Roles usados por backend:

- `user`
- `admin`

Permisos sugeridos:

- `create:orders`
- `read:orders`
- `read:orders:all` (admin)
- `read:dashboard` (admin)
- `create:payments`

## Configuracion Auth0 para pedir username en UI

Esta parte se configura en Auth0 Dashboard (no desde backend):

1. En `Authentication` > `Database` > tu conexion de base de datos, habilita `Requires Username`.
2. En `Authentication` > `Database` > `Attributes`, define que `username` sea requerido en signup.
3. En `Actions` > `Flows` > `Login`, agrega una Action Post-Login para enviar username al Access Token:

```js
exports.onExecutePostLogin = async (event, api) => {
  const username = event.user.username || event.user.nickname || event.user.given_name;
  if (username) {
    api.accessToken.setCustomClaim('https://yolik.app/username', username);
  }
};
```

4. En backend, configura `AUTH0_USERNAME_CLAIM=https://yolik.app/username`.

Nota: si Auth0 no envia username valido, backend usa fallback seguro tipo `Usuario-xxxxxx` para evitar mostrar correo como nombre.

## Compra con precisión monetaria

- El backend calcula subtotales, impuestos, envío y total en centavos (cálculo atómico) para evitar errores de redondeo.
- En cada item de orden se guarda:
  - `price`
  - `originalPrice`
  - `discountPerUnit`
  - `discountPercent`
- Si el producto no existe o está inactivo al comprar, la orden falla con `PRODUCT_NOT_AVAILABLE`.

## Pagos

La capa de pagos esta preparada con arquitectura de proveedor:

- `stripe`
- `mercadopago`
- `paypal`

Actualmente el adapter esta en modo placeholder y responde que falta integracion real del SDK/webhooks firmados.

## Scripts

- `npm start`
- `npm run dev`
- `npm test`
- `npm run test:orders`
- `npm run test:dashboard`
- `npm run test:payments`
- `npm run test:security`
