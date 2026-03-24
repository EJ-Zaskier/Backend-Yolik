const express = require('express');
const router = express.Router();
const orderController = require('../controllers/order.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { requirePermissions } = require('../middlewares/role.middleware');
const { validateOrder } = require('../middlewares/validation.middleware');

router.post('/', authMiddleware, requirePermissions(['create:orders']), validateOrder, orderController.createOrder);
router.get('/my-orders', authMiddleware, orderController.getMyOrders);
router.get('/:id', authMiddleware, requirePermissions(['read:orders']), orderController.getOrderById);
router.patch('/:id/status', authMiddleware, requirePermissions(['update:orders']), orderController.updateOrderStatus);

module.exports = router;
