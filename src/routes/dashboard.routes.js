const express = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const { requirePermissions } = require('../middlewares/role.middleware');
const dashboardController = require('../controllers/dashboard.controller');
const productController = require('../controllers/product.controller');
const {
  validateProductCreateRequest,
  validateProductUpdateRequest
} = require('../middlewares/validation.middleware');

const router = express.Router();

router.use(authMiddleware, requirePermissions(['read:dashboard']));
router.get('/summary', dashboardController.getSummary);
router.get('/sales-trend', dashboardController.getSalesTrend);
router.get('/top-products', dashboardController.getTopProducts);
router.get('/inventory-alerts', dashboardController.getInventoryAlerts);
router.get('/products', productController.getDashboardProducts);
router.post('/products', validateProductCreateRequest, productController.createProduct);
router.patch('/products/:id', validateProductUpdateRequest, productController.updateProduct);
router.delete('/products/:id', productController.deleteProduct);
router.patch('/products/:id/restore', productController.restoreProduct);

module.exports = router;
