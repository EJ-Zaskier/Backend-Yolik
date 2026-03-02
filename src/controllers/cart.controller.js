const mongoose = require('mongoose');
const Cart = require('../models/Cart.model');
const Product = require('../models/Product.model');

const MAX_DISTINCT_ITEMS = 100;

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const fetchActiveProduct = async (productId) =>
  Product.findOne({ _id: productId, active: true })
    .select('name price stock images')
    .lean();

const buildCartResponse = async (cartDoc) => {
  if (!cartDoc || !Array.isArray(cartDoc.items) || cartDoc.items.length === 0) {
    return {
      count: 0,
      totalItems: 0,
      subtotal: 0,
      items: []
    };
  }

  const productIds = cartDoc.items.map((item) => item.productId);
  const products = await Product.find({
    _id: { $in: productIds },
    active: true
  })
    .select('name price stock images')
    .lean();

  const productsById = new Map(products.map((product) => [String(product._id), product]));

  let subtotal = 0;
  let totalItems = 0;

  const items = cartDoc.items
    .map((item) => {
      const product = productsById.get(String(item.productId));
      if (!product) return null;

      const lineSubtotal = Number((product.price * item.quantity).toFixed(2));
      subtotal += lineSubtotal;
      totalItems += item.quantity;

      return {
        productId: String(item.productId),
        product: {
          name: product.name,
          price: product.price,
          images: Array.isArray(product.images) ? product.images : []
        },
        quantity: item.quantity,
        stockAvailable: product.stock,
        canCheckout: product.stock >= item.quantity,
        subtotal: lineSubtotal
      };
    })
    .filter(Boolean);

  return {
    count: items.length,
    totalItems,
    subtotal: Number(subtotal.toFixed(2)),
    items
  };
};

const getOrCreateCart = async (userId) =>
  Cart.findOneAndUpdate(
    { userId },
    { $setOnInsert: { userId, items: [] } },
    { upsert: true, new: true }
  );

exports.getCart = async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ userId: req.user.id }).lean();
    const payload = await buildCartResponse(cart);
    return res.json(payload);
  } catch (error) {
    return next(error);
  }
};

exports.addCartItem = async (req, res, next) => {
  try {
    const { productId, quantity } = req.body;

    if (!isValidObjectId(productId)) {
      return res.status(400).json({
        message: 'productId inválido',
        code: 'INVALID_PRODUCT_ID'
      });
    }

    const product = await fetchActiveProduct(productId);
    if (!product || product.stock <= 0) {
      return res.status(409).json({
        message: 'Producto no disponible',
        code: 'PRODUCT_NOT_AVAILABLE'
      });
    }

    const cart = await getOrCreateCart(req.user.id);

    const existingIndex = cart.items.findIndex(
      (item) => String(item.productId) === String(productId)
    );

    if (existingIndex === -1 && cart.items.length >= MAX_DISTINCT_ITEMS) {
      return res.status(400).json({
        message: 'Límite de productos en carrito alcanzado',
        code: 'CART_LIMIT_REACHED'
      });
    }

    if (existingIndex === -1) {
      if (quantity > product.stock) {
        return res.status(409).json({
          message: 'Stock insuficiente',
          code: 'INSUFFICIENT_STOCK'
        });
      }

      cart.items.push({ productId, quantity });
    } else {
      const nextQuantity = cart.items[existingIndex].quantity + quantity;
      if (nextQuantity > product.stock) {
        return res.status(409).json({
          message: 'Stock insuficiente',
          code: 'INSUFFICIENT_STOCK'
        });
      }

      cart.items[existingIndex].quantity = nextQuantity;
    }

    await cart.save();
    const payload = await buildCartResponse(cart.toObject());

    return res.status(200).json({
      message: 'Carrito actualizado',
      cart: payload
    });
  } catch (error) {
    return next(error);
  }
};

exports.updateCartItemQuantity = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { quantity } = req.body;

    if (!isValidObjectId(productId)) {
      return res.status(400).json({
        message: 'productId inválido',
        code: 'INVALID_PRODUCT_ID'
      });
    }

    const product = await fetchActiveProduct(productId);
    if (!product || product.stock <= 0) {
      return res.status(409).json({
        message: 'Producto no disponible',
        code: 'PRODUCT_NOT_AVAILABLE'
      });
    }

    if (quantity > product.stock) {
      return res.status(409).json({
        message: 'Stock insuficiente',
        code: 'INSUFFICIENT_STOCK'
      });
    }

    const cart = await Cart.findOne({ userId: req.user.id });
    if (!cart) {
      return res.status(404).json({
        message: 'Carrito no encontrado',
        code: 'CART_NOT_FOUND'
      });
    }

    const existingItem = cart.items.find((item) => String(item.productId) === String(productId));
    if (!existingItem) {
      return res.status(404).json({
        message: 'Item no encontrado en carrito',
        code: 'CART_ITEM_NOT_FOUND'
      });
    }

    existingItem.quantity = quantity;
    await cart.save();

    const payload = await buildCartResponse(cart.toObject());
    return res.json({
      message: 'Cantidad actualizada',
      cart: payload
    });
  } catch (error) {
    return next(error);
  }
};

exports.removeCartItem = async (req, res, next) => {
  try {
    const { productId } = req.params;

    if (!isValidObjectId(productId)) {
      return res.status(400).json({
        message: 'productId inválido',
        code: 'INVALID_PRODUCT_ID'
      });
    }

    const cart = await Cart.findOne({ userId: req.user.id });
    if (!cart) {
      return res.status(404).json({
        message: 'Carrito no encontrado',
        code: 'CART_NOT_FOUND'
      });
    }

    const previousLength = cart.items.length;
    cart.items = cart.items.filter((item) => String(item.productId) !== String(productId));

    if (cart.items.length === previousLength) {
      return res.status(404).json({
        message: 'Item no encontrado en carrito',
        code: 'CART_ITEM_NOT_FOUND'
      });
    }

    await cart.save();
    const payload = await buildCartResponse(cart.toObject());

    return res.json({
      message: 'Item eliminado del carrito',
      cart: payload
    });
  } catch (error) {
    return next(error);
  }
};

exports.clearCart = async (req, res, next) => {
  try {
    const cart = await getOrCreateCart(req.user.id);
    cart.items = [];
    await cart.save();

    return res.json({
      message: 'Carrito vaciado',
      cart: {
        count: 0,
        totalItems: 0,
        subtotal: 0,
        items: []
      }
    });
  } catch (error) {
    return next(error);
  }
};
