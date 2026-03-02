const express = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const cartController = require('../controllers/cart.controller');
const {
  validateCartItem,
  validateCartItemQuantity
} = require('../middlewares/validation.middleware');

const router = express.Router();

router.use(authMiddleware);

router.get('/', cartController.getCart);
router.post('/items', validateCartItem, cartController.addCartItem);
router.patch('/items/:productId', validateCartItemQuantity, cartController.updateCartItemQuantity);
router.delete('/items/:productId', cartController.removeCartItem);
router.delete('/', cartController.clearCart);

module.exports = router;
