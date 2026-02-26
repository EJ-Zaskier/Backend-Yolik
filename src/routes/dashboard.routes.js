const express = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const { requirePermissions } = require('../middlewares/role.middleware');
const dashboardController = require('../controllers/dashboard.controller');

const router = express.Router();

router.use(authMiddleware, requirePermissions(['read:dashboard']));
router.get('/summary', dashboardController.getSummary);
router.get('/sales-trend', dashboardController.getSalesTrend);
router.get('/top-products', dashboardController.getTopProducts);
router.get('/inventory-alerts', dashboardController.getInventoryAlerts);

module.exports = router;
