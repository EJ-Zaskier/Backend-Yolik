const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { requirePermissions } = require('../middlewares/role.middleware');

router.get('/me', authMiddleware, authController.getCurrentSession);
router.get('/context', authMiddleware, authController.getAuthorizationContext);
router.get(
  '/admin-check',
  authMiddleware,
  requirePermissions(['read:dashboard']),
  authController.getAuthorizationContext
);

module.exports = router;
