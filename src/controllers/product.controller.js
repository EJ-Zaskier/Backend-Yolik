const Product = require('../models/Product.model');
const mongoose = require('mongoose');

const ALLOWED_CATEGORIES = new Set(['Vestidos', 'Blusas', 'Accesorios', 'Otro']);
const ALLOWED_REGIONS = new Set(['Tehuacan', 'otro']);
const MAX_IMAGE_URLS = 10;
const MAX_IMAGE_URL_LENGTH = 2000;

const readQueryString = (value, maxLength = 100) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
};

const asNumber = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
};

const asInteger = (value) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) return null;
  return parsed;
};

const asBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return null;
};

const sanitizeText = (value, maxLength) => {
  if (typeof value !== 'string') return null;
  const sanitized = value
    .replace(/[<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!sanitized) return null;
  return sanitized.slice(0, maxLength);
};

const isValidImageUrl = (url) => /^https?:\/\/.+/i.test(url);

const normalizeImages = (images) => {
  if (!Array.isArray(images)) return { value: null, error: 'images debe ser un arreglo' };
  if (images.length > MAX_IMAGE_URLS) {
    return { value: null, error: `images no puede exceder ${MAX_IMAGE_URLS} elementos` };
  }

  const normalized = [];
  for (const image of images) {
    if (typeof image !== 'string') {
      return { value: null, error: 'Cada imagen debe ser string' };
    }

    const safeUrl = image.trim().slice(0, MAX_IMAGE_URL_LENGTH);
    if (!isValidImageUrl(safeUrl)) {
      return { value: null, error: 'URL de imagen inválida' };
    }

    normalized.push(safeUrl);
  }

  return { value: normalized, error: null };
};

const buildDiscountSummary = (product) => {
  const unitPrice = asNumber(product.price) || 0;
  const originalPriceCandidate = asNumber(product.originalPrice);
  const originalPrice = originalPriceCandidate !== null ? Math.max(originalPriceCandidate, unitPrice) : unitPrice;
  const discountAmount = Number(Math.max(0, originalPrice - unitPrice).toFixed(2));
  const discountPercent =
    originalPrice > 0 ? Math.round((discountAmount / originalPrice) * 100) : 0;

  return {
    price: Number(unitPrice.toFixed(2)),
    originalPrice: Number(originalPrice.toFixed(2)),
    discountAmount,
    discountPercent
  };
};

const mapProductForResponse = (product) => ({
  ...product,
  stockStatus: product.stock > 0 ? 'Disponible' : 'Sin existencias',
  pricing: buildDiscountSummary(product)
});

const validateProductPayload = (payload, { partial }) => {
  const updates = {};
  const errors = [];

  const requireField = (fieldName) => !partial && payload[fieldName] === undefined;

  if (requireField('name')) {
    errors.push('name es requerido');
  } else if (payload.name !== undefined) {
    const safeName = sanitizeText(payload.name, 200);
    if (!safeName || safeName.length < 3) {
      errors.push('name inválido');
    } else {
      updates.name = safeName;
    }
  }

  if (requireField('description')) {
    errors.push('description es requerido');
  } else if (payload.description !== undefined) {
    const safeDescription = sanitizeText(payload.description, 5000);
    if (!safeDescription || safeDescription.length < 10) {
      errors.push('description inválido');
    } else {
      updates.description = safeDescription;
    }
  }

  if (requireField('region')) {
    errors.push('region es requerido');
  } else if (payload.region !== undefined) {
    const region = readQueryString(payload.region, 50);
    if (!region || !ALLOWED_REGIONS.has(region)) {
      errors.push('region inválida');
    } else {
      updates.region = region;
    }
  }

  if (requireField('category')) {
    errors.push('category es requerido');
  } else if (payload.category !== undefined) {
    const category = readQueryString(payload.category, 50);
    if (!category || !ALLOWED_CATEGORIES.has(category)) {
      errors.push('category inválida');
    } else {
      updates.category = category;
    }
  }

  if (requireField('price')) {
    errors.push('price es requerido');
  } else if (payload.price !== undefined) {
    const price = asNumber(payload.price);
    if (price === null || price < 0) {
      errors.push('price inválido');
    } else {
      updates.price = Number(price.toFixed(2));
    }
  }

  if (!partial && payload.originalPrice === undefined) {
    updates.originalPrice = updates.price;
  } else if (payload.originalPrice !== undefined && payload.originalPrice !== null) {
    const originalPrice = asNumber(payload.originalPrice);
    if (originalPrice === null || originalPrice < 0) {
      errors.push('originalPrice inválido');
    } else {
      updates.originalPrice = Number(originalPrice.toFixed(2));
    }
  } else if (payload.originalPrice === null) {
    updates.originalPrice = null;
  }

  if (requireField('stock')) {
    errors.push('stock es requerido');
  } else if (payload.stock !== undefined) {
    const stock = asInteger(payload.stock);
    if (stock === null || stock < 0) {
      errors.push('stock inválido');
    } else {
      updates.stock = stock;
    }
  }

  if (payload.images !== undefined) {
    const { value, error } = normalizeImages(payload.images);
    if (error) {
      errors.push(error);
    } else {
      updates.images = value;
    }
  } else if (!partial) {
    updates.images = [];
  }

  if (payload.sku !== undefined) {
    if (payload.sku === null || payload.sku === '') {
      updates.sku = undefined;
    } else {
      const sku = sanitizeText(payload.sku, 80);
      if (!sku) {
        errors.push('sku inválido');
      } else {
        updates.sku = sku.toUpperCase();
      }
    }
  }

  if (payload.active !== undefined) {
    const active = asBoolean(payload.active);
    if (active === null) {
      errors.push('active inválido');
    } else {
      updates.active = active;
    }
  }

  return {
    errors,
    updates
  };
};

exports.getProducts = async (req, res, next) => {
  try {
    const queryKeys = Object.keys(req.query || {});
    const hasOperatorLikeQueryKey = queryKeys.some(
      (key) => key.includes('$') || key.includes('.') || key.includes('[') || key.includes(']')
    );

    if (hasOperatorLikeQueryKey) {
      return res.status(400).json({
        message: 'Parámetros de consulta inválidos',
        code: 'INVALID_QUERY_PARAMS'
      });
    }

    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 100);
    const skip = (page - 1) * limit;

    const filter = { active: true };

    const stockVisibilityFilter = { stock: { $gt: 0 } };
    // const stockVisibilityFilter = {}; // Usa esta línea si quieres mostrar agotados y marcar "Sin existencias".
    Object.assign(filter, stockVisibilityFilter);

    if (req.query.category !== undefined) {
      const category = readQueryString(req.query.category, 50);
      if (!category || !ALLOWED_CATEGORIES.has(category)) {
        return res.status(400).json({
          message: 'Categoría inválida',
          code: 'INVALID_CATEGORY'
        });
      }
      filter.category = category;
    }

    if (req.query.region !== undefined) {
      const region = readQueryString(req.query.region, 50);
      if (!region || !ALLOWED_REGIONS.has(region)) {
        return res.status(400).json({
          message: 'Región inválida',
          code: 'INVALID_REGION'
        });
      }
      filter.region = region;
    }

    if (req.query.search !== undefined) {
      const search = readQueryString(req.query.search, 100);
      if (search) {
        filter.$text = { $search: search };
      } else {
        return res.status(400).json({
          message: 'Búsqueda inválida',
          code: 'INVALID_SEARCH_QUERY'
        });
      }
    }

    const [products, total] = await Promise.all([
      Product.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Product.countDocuments(filter)
    ]);

    const mappedProducts = products.map((product) => mapProductForResponse(product));

    res.json({
      count: mappedProducts.length,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      products: mappedProducts
    });
  } catch (error) {
    next(error);
  }
};

exports.getProductById = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        message: 'ID inválido',
        code: 'INVALID_ID'
      });
    }

    const filter = { _id: req.params.id, active: true, stock: { $gt: 0 } };
    // const filter = { _id: req.params.id, active: true }; // Usa esta línea si quieres mostrar agotados con "Sin existencias".

    const product = await Product.findOne(filter).lean();

    if (!product) {
      return res.status(404).json({
        message: 'Producto no disponible',
        code: 'PRODUCT_NOT_AVAILABLE'
      });
    }

    return res.json({
      ...mapProductForResponse(product)
    });
  } catch (error) {
    return next(error);
  }
};

exports.getDashboardProducts = async (req, res, next) => {
  try {
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 100);
    const skip = (page - 1) * limit;
    const filter = {};

    const active = asBoolean(req.query.active);
    if (active !== null) {
      filter.active = active;
    }

    const category = req.query.category !== undefined ? readQueryString(req.query.category, 50) : null;
    if (req.query.category !== undefined && (!category || !ALLOWED_CATEGORIES.has(category))) {
      return res.status(400).json({
        message: 'Categoría inválida',
        code: 'INVALID_CATEGORY'
      });
    }

    if (category) {
      filter.category = category;
    }

    const region = req.query.region !== undefined ? readQueryString(req.query.region, 50) : null;
    if (req.query.region !== undefined && (!region || !ALLOWED_REGIONS.has(region))) {
      return res.status(400).json({
        message: 'Región inválida',
        code: 'INVALID_REGION'
      });
    }

    if (region) {
      filter.region = region;
    }

    const lowStock = asBoolean(req.query.lowStock);
    if (lowStock === true) {
      const threshold = Math.max(Number.parseInt(req.query.threshold, 10) || 5, 0);
      filter.stock = { $lte: threshold };
    }

    if (req.query.search !== undefined) {
      const search = readQueryString(req.query.search, 100);
      if (!search) {
        return res.status(400).json({
          message: 'Búsqueda inválida',
          code: 'INVALID_SEARCH_QUERY'
        });
      }
      filter.$text = { $search: search };
    }

    const [products, total] = await Promise.all([
      Product.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Product.countDocuments(filter)
    ]);

    return res.json({
      count: products.length,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      products: products.map((product) => mapProductForResponse(product))
    });
  } catch (error) {
    return next(error);
  }
};

exports.createProduct = async (req, res, next) => {
  try {
    const { errors, updates } = validateProductPayload(req.body || {}, { partial: false });
    if (errors.length > 0) {
      return res.status(400).json({
        message: 'Datos de producto inválidos',
        code: 'INVALID_PRODUCT_PAYLOAD',
        details: errors
      });
    }

    if (updates.originalPrice !== null && updates.originalPrice < updates.price) {
      return res.status(400).json({
        message: 'originalPrice no puede ser menor a price',
        code: 'INVALID_PRICE_RELATION'
      });
    }

    updates.createdBy = req.user.id;

    const product = await Product.create(updates);
    return res.status(201).json({
      message: 'Producto creado exitosamente',
      product: mapProductForResponse(product.toObject())
    });
  } catch (error) {
    return next(error);
  }
};

exports.updateProduct = async (req, res, next) => {
  try {
    const productId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        message: 'ID inválido',
        code: 'INVALID_ID'
      });
    }

    const product = await Product.findById(productId).lean();
    if (!product) {
      return res.status(404).json({
        message: 'Producto no encontrado',
        code: 'PRODUCT_NOT_FOUND'
      });
    }

    const { errors, updates } = validateProductPayload(req.body || {}, { partial: true });
    if (errors.length > 0) {
      return res.status(400).json({
        message: 'Datos de producto inválidos',
        code: 'INVALID_PRODUCT_PAYLOAD',
        details: errors
      });
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        message: 'No hay cambios para actualizar',
        code: 'EMPTY_UPDATE'
      });
    }

    const nextPrice = updates.price !== undefined ? updates.price : product.price;
    const existingOriginalPrice = product.originalPrice !== undefined ? product.originalPrice : product.price;
    const nextOriginalPrice =
      updates.originalPrice !== undefined ? updates.originalPrice : existingOriginalPrice;

    if (nextOriginalPrice !== null && nextOriginalPrice < nextPrice) {
      return res.status(400).json({
        message: 'originalPrice no puede ser menor a price',
        code: 'INVALID_PRICE_RELATION'
      });
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      { $set: updates },
      { new: true, runValidators: true }
    ).lean();

    return res.json({
      message: 'Producto actualizado exitosamente',
      product: mapProductForResponse(updatedProduct)
    });
  } catch (error) {
    return next(error);
  }
};

exports.deleteProduct = async (req, res, next) => {
  try {
    const productId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        message: 'ID inválido',
        code: 'INVALID_ID'
      });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        message: 'Producto no encontrado',
        code: 'PRODUCT_NOT_FOUND'
      });
    }

    if (!product.active) {
      return res.json({
        message: 'Producto ya estaba inactivo',
        product: mapProductForResponse(product.toObject())
      });
    }

    product.active = false;
    await product.save();

    return res.json({
      message: 'Producto desactivado exitosamente',
      product: mapProductForResponse(product.toObject())
    });
  } catch (error) {
    return next(error);
  }
};

exports.restoreProduct = async (req, res, next) => {
  try {
    const productId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        message: 'ID inválido',
        code: 'INVALID_ID'
      });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        message: 'Producto no encontrado',
        code: 'PRODUCT_NOT_FOUND'
      });
    }

    if (product.active) {
      return res.json({
        message: 'Producto ya estaba activo',
        product: mapProductForResponse(product.toObject())
      });
    }

    product.active = true;
    await product.save();

    return res.json({
      message: 'Producto restaurado exitosamente',
      product: mapProductForResponse(product.toObject())
    });
  } catch (error) {
    return next(error);
  }
};
