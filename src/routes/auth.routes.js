const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const loginLimiter = require('../middlewares/loginLimiter'); 

// Solo login usa loginLimiter, registro usa el general
router.post('/register', authController.register);
router.post('/login', loginLimiter, authController.login);


router.post('/logout', authController.logout);
router.post('/refresh-token', authController.refreshToken);

module.exports = router;