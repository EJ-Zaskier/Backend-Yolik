# Backend – Tienda Online de Ropa Tradicional Regional

Backend de una plataforma de **comercio electrónico** enfocada en la venta de **ropa tradicional regional**, desarrollado con **Node.js, Express y MongoDB**, siguiendo **buenas prácticas profesionales de arquitectura, seguridad y escalabilidad**.

El sistema permite la **visualización pública del catálogo de productos sin registro**, pero **requiere autenticación para realizar compras**, replicando el comportamiento de plataformas de e-commerce modernas.

---

## 📌 Características principales

- API REST segura
- Catálogo de productos público (sin login)
- Registro e inicio de sesión con JWT
- Roles de usuario (cliente / administrador)
- Gestión de productos
- Gestión de pedidos
- Dashboard administrativo
- Seguridad integrada (hash de contraseñas, rate limit, control de acceso)
- Arquitectura escalable y mantenible

---

## 🛠️ Stack tecnológico

- **Node.js (LTS)**
- **Express.js**
- **MongoDB**
- **Mongoose**
- **JWT (JSON Web Tokens)**
- **bcrypt**
- **dotenv**
- **express-rate-limit**
- **cors**

---

## 📂 Estructura del proyecto

src/
├── config/
│ └── database.js
├── models/
│ ├── User.model.js
│ ├── Product.model.js
│ ├── Order.model.js
│ └── Payment.model.js
├── controllers/
│ ├── auth.controller.js
│ ├── product.controller.js
│ ├── order.controller.js
│ └── dashboard.controller.js
├── routes/
│ ├── auth.routes.js
│ ├── product.routes.js
│ ├── order.routes.js
│ └── dashboard.routes.js
├── middlewares/
│ ├── auth.middleware.js
│ ├── role.middleware.js
│ └── error.middleware.js
├── app.js
└── server.js
.env
