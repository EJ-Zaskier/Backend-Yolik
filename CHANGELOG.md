# Historial de Cambios (Changelog)

Este documento registra los cambios funcionales, tecnicos y de seguridad
realizados en el backend del proyecto.

Formato adoptado:
- Keep a Changelog
- Versionado Semantico (SemVer)

## [2.0.0] - 2026-02-26

### Resumen Ejecutivo
Esta version introduce una migracion estructural de autenticacion:
se reemplaza el esquema local de JWT/refresh token por Auth0 con
validacion RS256 y control de permisos (RBAC).

Adicionalmente:
- Se implementa dashboard administrativo real con metricas de negocio.
- Se endurece la API contra patrones de inyeccion y errores de configuracion.
- Se prepara la capa de pagos con arquitectura desacoplada por proveedor,
  pero se mantiene desactivada por defecto para evitar superficie de ataque
  mientras no exista decision final del PSP.

Impacto esperado:
- Mayor seguridad operativa y menor deuda tecnica en identidad.
- Mejor trazabilidad de permisos por endpoint.
- Mejor base para escalar a entorno productivo.

---

### Added (Nuevas capacidades)

#### 1) Autenticacion y contexto de sesion con Auth0
- Middleware de autenticacion con verificacion de access token RS256.
- Validacion por `issuer` + `audience`.
- Provision automatica de usuario local a partir del `sub` de Auth0.
- Nuevos endpoints de contexto:
  - `GET /api/auth/me`
  - `GET /api/auth/context`
  - `GET /api/auth/admin-check`

#### 2) RBAC por permisos/scopes
- Middleware reusable para exigir permisos por ruta.
- Integracion de permisos en rutas de ordenes y dashboard.
- Soporte de `permissions` y `scope` dentro del contexto del usuario.

#### 3) Dashboard administrativo
- Endpoints nuevos:
  - `GET /api/dashboard/summary`
  - `GET /api/dashboard/sales-trend`
  - `GET /api/dashboard/top-products`
  - `GET /api/dashboard/inventory-alerts`
- Metricas incluidas:
  - total de ordenes
  - ingresos brutos y pagados
  - ticket promedio
  - ordenes canceladas
  - productos top por ingreso
  - alertas de inventario bajo

#### 4) Capa de pagos preparada (sin pasarela activa)
- Modelo de pagos con soporte para estado transaccional.
- Controlador y rutas de intencion de pago.
- Factoria de proveedor para integraciones futuras (`stripe`, `mercadopago`, `paypal`).
- Arquitectura lista para webhooks y idempotencia.

#### 5) Pruebas adicionales
- Nuevas pruebas de dashboard.
- Nuevas pruebas de modulo de pagos (escenario scaffold).
- Nuevas pruebas de seguridad para filtros de productos (inyeccion y IDs invalidos).

#### 6) Configuracion y documentacion
- `.env.example` para estandarizar configuracion por entorno.
- Actualizacion de README con variables y comportamiento por feature flags.

---

### Changed (Cambios relevantes)

#### 1) Cambio de arquitectura de identidad
- Se migra de autenticacion local a autenticacion delegada en Auth0.
- Las reglas de autorizacion ahora dependen de permisos del token.
- El modelo de usuario se adapta para identidad federada:
  - `authProvider`
  - `auth0Sub`

#### 2) Endurecimiento de filtros en productos
- Se valida estrictamente `category`, `region` y `search`.
- Se bloquean query params con patrones de operador (`$`, `[]`, `.`).
- Se agrega validacion explicita de ObjectId en `GET /api/products/:id`.

#### 3) Montaje condicional de pagos
- Rutas de pagos solo se montan cuando `ENABLE_PAYMENTS=true`.
- Por defecto quedan fuera para reducir complejidad y riesgo mientras no se elija proveedor.

#### 4) Estandarizacion de manejo de errores
- Respuestas consistentes para:
  - token invalido/no autorizado
  - permisos insuficientes
  - conflicto de identidad federada
  - IDs invalidos y errores de validacion

#### 5) Dependencias y salud de seguridad
- Se aplican `overrides` para corregir vulnerabilidades transitivas:
  - `qs`
  - `minimatch`

---

### Removed (Elementos eliminados)

Se retira el flujo legado de autenticacion local y piezas asociadas:
- Endpoints locales de registro/login/refresh/logout.
- Modelo de refresh token local.
- Blacklist de token en memoria.
- Login limiter del flujo legacy.
- Middleware de role-based limiter no utilizado.

Razon:
- Evitar doble modelo de autenticacion.
- Reducir complejidad y riesgos de inconsistencia de sesion.

---

### Security (Detalle de seguridad aplicado)

#### OWASP A01 - Broken Access Control
- Se exige autenticacion + permisos en rutas sensibles (ordenes y dashboard).
- Se consolida control de acceso por middleware central.

#### OWASP A03 - Injection
- Se corrige vector de inyeccion NoSQL en filtros publicos de productos.
- Se agrega validacion de parametros para bloquear operadores en query string.

#### OWASP A05 - Security Misconfiguration
- Validacion de entorno en arranque:
  - `MONGO_URI`
  - `AUTH0_DOMAIN`
  - `AUTH0_API_AUDIENCE`
  - `PORT`
- Politica CORS mas controlada.
- Headers de endurecimiento HTTP activos.

#### OWASP A06 - Vulnerable and Outdated Components
- Se actualiza arbol de dependencias para eliminar findings de auditoria.
- Resultado de verificacion:
  - `npm audit`: 0 vulnerabilidades
  - `npm audit --omit=dev`: 0 vulnerabilidades

#### Riesgo de linking de identidad
- Se evita enlace automatico por email entre identidades distintas de Auth0.
- Se retorna conflicto controlado para forzar vinculacion manual cuando aplique.

---

### Verificacion de calidad y operacion

Estado de pruebas:
- `npm test` -> 8/8 exitosas.

Smoke test backend (sin frontend, sin pagos activos):
- Rutas publicas funcionales (`/api/products`).
- Rutas protegidas responden 401 sin token (comportamiento esperado).
- Rutas de pago retornan 404 con `ENABLE_PAYMENTS=false` (comportamiento esperado).
- Inyeccion en filtros de producto bloqueada (400).

---

### Guia de migracion para clientes API

Breaking changes en v2.0.0:
- Ya no existe login local del backend para obtener tokens.
- Los clientes deben enviar Access Tokens emitidos por Auth0.
- Deben incluir permisos adecuados para cada endpoint.

Permisos sugeridos:
- `create:orders`
- `read:orders`
- `read:orders:all` (admin)
- `read:dashboard` (admin)
- `create:payments` (solo cuando se active pagos)

Variables nuevas clave:
- `AUTH0_DOMAIN`
- `AUTH0_API_AUDIENCE`
- `ENABLE_PAYMENTS` (recomendado `false` hasta definir PSP)

## [1.0.0] - Lanzamiento inicial

### Added
- API base de e-commerce con catalogo, ordenes y seguridad inicial.
