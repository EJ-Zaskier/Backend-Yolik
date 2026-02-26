const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;
  return str.trim().replace(/[<>]/g, '');
};

const validateProduct = (req, res, next) => {
  const { name, price, stock } = req.body;

  if (!name || price === undefined || stock === undefined) {
    return res.status(400).json({
      message: 'Faltan campos requeridos',
      required: ['name', 'price', 'stock']
    });
  }

  if (typeof price !== 'number' || price < 0) {
    return res.status(400).json({
      message: 'Precio debe ser un número positivo'
    });
  }

  if (typeof stock !== 'number' || stock < 0) {
    return res.status(400).json({
      message: 'Stock debe ser un número no negativo'
    });
  }

  req.body.name = sanitizeString(name);
  return next();
};

const validateOrder = (req, res, next) => {
  const { items, tax, shippingCost, notes, shippingAddress } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      message: 'La orden debe incluir al menos un item',
      code: 'EMPTY_ORDER'
    });
  }

  for (const item of items) {
    if (!item?.productId) {
      return res.status(400).json({
        message: 'Cada item debe incluir productId',
        code: 'INVALID_ORDER_ITEMS'
      });
    }

    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return res.status(400).json({
        message: 'Cantidad inválida',
        code: 'INVALID_QUANTITY'
      });
    }
  }

  if (tax !== undefined && (typeof tax !== 'number' || tax < 0)) {
    return res.status(400).json({
      message: 'Impuesto inválido',
      code: 'INVALID_TAX'
    });
  }

  if (shippingCost !== undefined && (typeof shippingCost !== 'number' || shippingCost < 0)) {
    return res.status(400).json({
      message: 'Costo de envío inválido',
      code: 'INVALID_SHIPPING_COST'
    });
  }

  if (typeof notes === 'string') {
    req.body.notes = sanitizeString(notes);
  }

  if (shippingAddress && typeof shippingAddress === 'object') {
    req.body.shippingAddress = {
      ...shippingAddress,
      street: sanitizeString(shippingAddress.street),
      city: sanitizeString(shippingAddress.city),
      postalCode: sanitizeString(shippingAddress.postalCode),
      country: sanitizeString(shippingAddress.country),
      phone: sanitizeString(shippingAddress.phone)
    };
  }

  return next();
};

const validatePaymentIntent = (req, res, next) => {
  const { orderId, provider, currency } = req.body;

  if (!orderId || typeof orderId !== 'string') {
    return res.status(400).json({
      message: 'orderId es requerido',
      code: 'ORDER_ID_REQUIRED'
    });
  }

  if (provider !== undefined && typeof provider !== 'string') {
    return res.status(400).json({
      message: 'provider inválido',
      code: 'INVALID_PAYMENT_PROVIDER'
    });
  }

  if (currency !== undefined && (typeof currency !== 'string' || currency.trim().length < 3)) {
    return res.status(400).json({
      message: 'currency inválida',
      code: 'INVALID_CURRENCY'
    });
  }

  req.body.orderId = orderId.trim();
  if (typeof provider === 'string') {
    req.body.provider = provider.trim().toLowerCase();
  }
  if (typeof currency === 'string') {
    req.body.currency = currency.trim().toUpperCase();
  }

  return next();
};

module.exports = {
  sanitizeString,
  validateProduct,
  validateOrder,
  validatePaymentIntent
};
