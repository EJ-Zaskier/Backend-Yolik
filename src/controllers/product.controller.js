const Product = require('../models/Product.model');

exports.getProducts = async (req, res, next) => {
  try {
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 100);
    const skip = (page - 1) * limit;

    const filter = { active: true };

    const stockVisibilityFilter = { stock: { $gt: 0 } };
    // const stockVisibilityFilter = {}; // Usa esta línea si quieres mostrar agotados y marcar "Sin existencias".
    Object.assign(filter, stockVisibilityFilter);

    if (req.query.category) {
      filter.category = req.query.category;
    }

    if (req.query.region) {
      filter.region = req.query.region;
    }

    if (req.query.search) {
      const search = String(req.query.search).trim().slice(0, 100);
      if (search) {
        filter.$text = { $search: search };
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
