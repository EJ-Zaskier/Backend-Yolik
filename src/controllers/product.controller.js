const Product = require('../models/Product.model');
const mongoose = require('mongoose');

const ALLOWED_CATEGORIES = new Set(['Vestidos', 'Blusas', 'Accesorios', 'Otro']);
const ALLOWED_REGIONS = new Set(['Tehuacan', 'otro']);

const readQueryString = (value, maxLength = 100) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
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

    const mappedProducts = products.map((product) => ({
      ...product,
      stockStatus: product.stock > 0 ? 'Disponible' : 'Sin existencias'
    }));

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
      ...product,
      stockStatus: product.stock > 0 ? 'Disponible' : 'Sin existencias'
    });
  } catch (error) {
    return next(error);
  }
};
