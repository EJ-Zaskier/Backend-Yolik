const mongoose = require('mongoose');
const Order = require('../models/Order.model');
const Product = require('../models/Product.model');

const buildOrderNumber = () =>
  `ORD-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;

const toMoneyCents = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100);
};

const fromMoneyCents = (value) => Number((value / 100).toFixed(2));

const calculateDiscountPercent = (originalPriceCents, unitPriceCents) => {
  if (originalPriceCents <= 0 || originalPriceCents <= unitPriceCents) return 0;
  return Math.round(((originalPriceCents - unitPriceCents) / originalPriceCents) * 100);
};

const normalizeItems = (items) => {
  const consolidated = new Map();

  for (const item of items) {
    if (!item || !item.productId) {
      const error = new Error('Cada item debe incluir productId');
      error.status = 400;
      error.code = 'INVALID_ORDER_ITEMS';
      throw error;
    }

    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      const error = new Error('Cantidad inválida');
      error.status = 400;
      error.code = 'INVALID_QUANTITY';
      throw error;
    }

    const productId = String(item.productId);
    const current = consolidated.get(productId) || 0;
    consolidated.set(productId, current + quantity);
  }

  return Array.from(consolidated.entries()).map(([productId, quantity]) => ({
    productId,
    quantity
  }));
};

exports.createOrder = async (req, res, next) => {
  const session = await mongoose.startSession();

  try {
    const { items, shippingAddress, notes, tax = 0, shippingCost = 0 } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        message: 'La orden debe incluir al menos un item',
        code: 'EMPTY_ORDER'
      });
    }

    const normalizedItems = normalizeItems(items);
    if (normalizedItems.length === 0) {
      return res.status(400).json({
        message: 'La orden debe incluir al menos un item válido',
        code: 'INVALID_ORDER_ITEMS'
      });
    }

    const safeTaxCents = toMoneyCents(tax);
    const safeShippingCostCents = toMoneyCents(shippingCost);

    if (safeTaxCents === null) {
      return res.status(400).json({
        message: 'Impuesto inválido',
        code: 'INVALID_TAX'
      });
    }

    if (safeShippingCostCents === null) {
      return res.status(400).json({
        message: 'Costo de envío inválido',
        code: 'INVALID_SHIPPING_COST'
      });
    }

    let createdOrder = null;

    await session.withTransaction(async () => {
      const orderItems = [];
      let subtotalCents = 0;

      for (const item of normalizedItems) {
        const updatedProduct = await Product.findOneAndUpdate(
          {
            _id: item.productId,
            active: true,
            stock: { $gte: item.quantity }
          },
          { $inc: { stock: -item.quantity } },
          { new: true, session }
        );

        if (!updatedProduct) {
          const existingProduct = await Product.findById(item.productId)
            .select('active stock')
            .session(session)
            .lean();

          const error =
            !existingProduct || existingProduct.active !== true
              ? new Error('Producto no disponible')
              : new Error('stock insuficiente');

          error.status = 409;
          error.code =
            !existingProduct || existingProduct.active !== true
              ? 'PRODUCT_NOT_AVAILABLE'
              : 'INSUFFICIENT_STOCK';
          throw error;
        }

        const unitPriceCents = toMoneyCents(updatedProduct.price);
        if (unitPriceCents === null) {
          const error = new Error('Precio de producto inválido');
          error.status = 409;
          error.code = 'INVALID_PRODUCT_PRICE';
          throw error;
        }

        const originalPriceRaw =
          updatedProduct.originalPrice !== undefined && updatedProduct.originalPrice !== null
            ? updatedProduct.originalPrice
            : updatedProduct.price;

        const originalPriceCentsCandidate = toMoneyCents(originalPriceRaw);
        const originalPriceCents =
          originalPriceCentsCandidate === null
            ? unitPriceCents
            : Math.max(originalPriceCentsCandidate, unitPriceCents);

        const discountPerUnitCents = Math.max(0, originalPriceCents - unitPriceCents);
        const itemSubtotalCents = unitPriceCents * item.quantity;
        subtotalCents += itemSubtotalCents;

        orderItems.push({
          productId: updatedProduct._id,
          name: updatedProduct.name,
          price: fromMoneyCents(unitPriceCents),
          originalPrice: fromMoneyCents(originalPriceCents),
          discountPerUnit: fromMoneyCents(discountPerUnitCents),
          discountPercent: calculateDiscountPercent(originalPriceCents, unitPriceCents),
          quantity: item.quantity,
          subtotal: fromMoneyCents(itemSubtotalCents)
        });
      }

      const totalCents = subtotalCents + safeTaxCents + safeShippingCostCents;
      const total = fromMoneyCents(totalCents);

      const [order] = await Order.create(
        [
          {
            orderNumber: buildOrderNumber(),
            userId: req.user.id,
            items: orderItems,
            tax: fromMoneyCents(safeTaxCents),
            shippingCost: fromMoneyCents(safeShippingCostCents),
            total,
            shippingAddress,
            notes
          }
        ],
        { session }
      );

      createdOrder = order;
    });

    return res.status(201).json({
      message: 'Orden creada exitosamente',
      order: createdOrder
    });
  } catch (error) {
    if (error.code === 'INSUFFICIENT_STOCK') {
      return res.status(409).json({
        message: 'stock insuficiente',
        code: 'INSUFFICIENT_STOCK'
      });
    }

    if (error.code === 'PRODUCT_NOT_AVAILABLE') {
      return res.status(409).json({
        message: 'Producto no disponible',
        code: 'PRODUCT_NOT_AVAILABLE'
      });
    }

    if (error.code === 'INVALID_PRODUCT_PRICE') {
      return res.status(409).json({
        message: 'Producto con precio inválido',
        code: 'INVALID_PRODUCT_PRICE'
      });
    }

    if (error.code === 'INVALID_ORDER_ITEMS' || error.code === 'INVALID_QUANTITY') {
      return res.status(error.status || 400).json({
        message: error.message,
        code: error.code
      });
    }

    return next(error);
  } finally {
    await session.endSession();
  }
};

exports.getMyOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ count: orders.length, orders });
  } catch (error) {
    next(error);
  }
};

exports.getOrderById = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id).lean();

    if (!order) {
      return res.status(404).json({
        message: 'Orden no encontrada',
        code: 'ORDER_NOT_FOUND'
      });
    }

    const isOwner = String(order.userId) === String(req.user.id);
    const permissions = Array.isArray(req.user.permissions) ? req.user.permissions : [];
    const scopes = Array.isArray(req.user.scopes) ? req.user.scopes : [];
    const isAdmin =
      req.user.role === 'admin' ||
      permissions.includes('read:orders:all') ||
      scopes.includes('read:orders:all');

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        message: 'Acceso denegado',
        code: 'ACCESS_DENIED'
      });
    }

    return res.json(order);
  } catch (error) {
    return next(error);
  }
};

// ✅ NUEVO: actualiza el status de una orden (solo admin)
exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ['Procesando', 'En camino', 'Entregado', 'Cancelado'];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        message: `Estado inválido. Valores permitidos: ${validStatuses.join(', ')}`,
        code: 'INVALID_STATUS'
      });
    }

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    ).lean();

    if (!order) {
      return res.status(404).json({
        message: 'Orden no encontrada',
        code: 'ORDER_NOT_FOUND'
      });
    }

    return res.json({ message: 'Estado actualizado', order });
  } catch (error) {
    return next(error);
  }
};