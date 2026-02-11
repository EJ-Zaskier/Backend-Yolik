const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const loginLimiter = require('../middlewares/loginLimiter');
const authMiddleware = require('../middlewares/auth.middleware');
const {
  validateRegister,
  validateLogin,
  validateRefreshTokenRequest
} = require('../middlewares/validation.middleware');

const refreshTokenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    error: 'Demasiados intentos de refresh token. Espera 15 minutos',
    code: 'TOO_MANY_REFRESH_ATTEMPTS'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Registro - con validación
router.post('/register', validateRegister, authController.register);

// Login - con rate limiting y validación
router.post('/login', loginLimiter, validateLogin, authController.login);

// Logout
router.post('/logout', authMiddleware, authController.logout);

// Refresh token
router.post('/refresh-token', refreshTokenLimiter, validateRefreshTokenRequest, authController.refreshToken);

module.exports = router;
