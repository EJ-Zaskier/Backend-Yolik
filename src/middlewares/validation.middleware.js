const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePassword = (password) => {
  // Mínimo 8 caracteres, al menos una mayúscula, una minúscula y un número
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return passwordRegex.test(password);
};

const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;
  return str.trim().replace(/[<>]/g, ''); // Prevenir inyeccione
};

// Middleware para validar registro
const validateRegister = (req, res, next) => {
  const { email, password, name } = req.body;

  // Validar presencia de campos
  if (!email || !password || !name) {
    return res.status(400).json({ 
      message: 'Faltan campos requeridos',
      required: ['email', 'password', 'name']
    });
  }

  // Validar email
  if (!validateEmail(email)) {
    return res.status(400).json({ 
      message: 'Email inválido',
      code: 'INVALID_EMAIL'
    });
  }

  // Validar contraseña
  if (!validatePassword(password)) {
    return res.status(400).json({ 
      message: 'Contraseña debe tener: 8+ caracteres, mayúscula, minúscula, número y símbolo',
      code: 'WEAK_PASSWORD'
    });
  }

  // Sanitizar
  req.body.email = sanitizeString(email).toLowerCase();
  req.body.name = sanitizeString(name);

  next();
};

// Middleware para validar login
const validateLogin = (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ 
      message: 'Email y contraseña son requeridos'
    });
  }

  if (!validateEmail(email)) {
    return res.status(400).json({ 
      message: 'Email inválido'
    });
  }

  req.body.email = sanitizeString(email).toLowerCase();
  next();
};

// Middleware para validar producto
const validateProduct = (req, res, next) => {
  const { name, price, stock, category } = req.body;

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
  next();
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

  next();
};

const validateRefreshTokenRequest = (req, res, next) => {
  const refreshToken = req.body?.refreshToken;

  if (!refreshToken || typeof refreshToken !== 'string' || refreshToken.trim().length < 20) {
    return res.status(400).json({
      message: 'Refresh token requerido',
      code: 'REFRESH_TOKEN_REQUIRED'
    });
  }

  req.body.refreshToken = refreshToken.trim();
  next();
};

module.exports = {
  validateRegister,
  validateLogin,
  validateProduct,
  validateOrder,
  validateRefreshTokenRequest,
  validateEmail,
  validatePassword,
  sanitizeString
};
