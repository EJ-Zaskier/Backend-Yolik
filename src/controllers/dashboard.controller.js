const Order = require('../models/Order.model');
const Product = require('../models/Product.model');

const clampInteger = (value, { min, max, fallback }) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
};

const buildSinceDate = (days) => {
  const safeDays = clampInteger(days, { min: 1, max: 365, fallback: 30 });
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - (safeDays - 1));
  return { since, days: safeDays };
};

exports.getSummary = async (req, res, next) => {
  try {
    const { since, days } = buildSinceDate(req.query.days);
    const lowStockThreshold = clampInteger(req.query.lowStockThreshold, {
      min: 0,
      max: 1000,
      fallback: 5
    });

    const baseMatch = { createdAt: { $gte: since } };

    const [overviewAggregation, statusAggregation, topProducts, lowStockCount, recentOrders] =
      await Promise.all([
        Order.aggregate([
          { $match: baseMatch },
          {
            $group: {
              _id: null,
              orders: { $sum: 1 },
              grossRevenue: {
                $sum: {
                  $cond: [{ $ne: ['$status', 'cancelled'] }, '$total', 0]
                }
              },
              paidRevenue: {
                $sum: {
                  $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$total', 0]
                }
              },
              cancelledOrders: {
                $sum: {
                  $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0]
                }
              }
            }
          }
        ]),
        Order.aggregate([
          { $match: baseMatch },
          { $group: { _id: '$status', count: { $sum: 1 } } },
          { $project: { _id: 0, status: '$_id', count: 1 } }
        ]),
        Order.aggregate([
          { $match: { ...baseMatch, status: { $ne: 'cancelled' } } },
          { $unwind: '$items' },
          {
            $group: {
              _id: '$items.productId',
              productName: { $first: '$items.name' },
              unitsSold: { $sum: '$items.quantity' },
              revenue: { $sum: '$items.subtotal' }
            }
          },
          { $sort: { revenue: -1 } },
          { $limit: 5 },
          {
            $project: {
              _id: 0,
              productId: '$_id',
              productName: 1,
              unitsSold: 1,
              revenue: { $round: ['$revenue', 2] }
            }
          }
        ]),
        Product.countDocuments({
          active: true,
          stock: { $lte: lowStockThreshold }
        }),
        Order.find(baseMatch)
          .sort({ createdAt: -1 })
          .limit(5)
          .select('orderNumber total status paymentStatus createdAt userId')
          .lean()
      ]);

    const overview = overviewAggregation[0] || {
      orders: 0,
      grossRevenue: 0,
      paidRevenue: 0,
      cancelledOrders: 0
    };

    const averageTicket = overview.orders > 0 ? overview.grossRevenue / overview.orders : 0;

    return res.json({
      period: {
        days,
        since
      },
      metrics: {
        orders: overview.orders,
        grossRevenue: Number(overview.grossRevenue.toFixed(2)),
        paidRevenue: Number(overview.paidRevenue.toFixed(2)),
        averageTicket: Number(averageTicket.toFixed(2)),
        cancelledOrders: overview.cancelledOrders,
        lowStockCount
      },
      orderStatus: statusAggregation,
      topProducts,
      recentOrders
    });
  } catch (error) {
    return next(error);
  }
};

exports.getSalesTrend = async (req, res, next) => {
  try {
    const { since, days } = buildSinceDate(req.query.days);
    const timezone = process.env.DASHBOARD_TIMEZONE || 'UTC';

    const trend = await Order.aggregate([
      { $match: { createdAt: { $gte: since }, status: { $ne: 'cancelled' } } },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt',
              timezone
            }
          },
          revenue: { $sum: '$total' },
          orders: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          date: '$_id',
          revenue: { $round: ['$revenue', 2] },
          orders: 1
        }
      }
    ]);

    return res.json({
      period: {
        days,
        since
      },
      timezone,
      trend
    });
  } catch (error) {
    return next(error);
  }
};

exports.getTopProducts = async (req, res, next) => {
  try {
    const { since, days } = buildSinceDate(req.query.days);
    const limit = clampInteger(req.query.limit, { min: 1, max: 50, fallback: 10 });

    const products = await Order.aggregate([
      { $match: { createdAt: { $gte: since }, status: { $ne: 'cancelled' } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.productId',
          productName: { $first: '$items.name' },
          unitsSold: { $sum: '$items.quantity' },
          revenue: { $sum: '$items.subtotal' },
          orderCount: { $sum: 1 }
        }
      },
      { $sort: { revenue: -1 } },
      { $limit: limit },
      {
        $project: {
          _id: 0,
          productId: '$_id',
          productName: 1,
          unitsSold: 1,
          revenue: { $round: ['$revenue', 2] },
          orderCount: 1
        }
      }
    ]);

    return res.json({
      period: {
        days,
        since
      },
      count: products.length,
      products
    });
  } catch (error) {
    return next(error);
  }
};

exports.getInventoryAlerts = async (req, res, next) => {
  try {
    const threshold = clampInteger(req.query.threshold, { min: 0, max: 1000, fallback: 5 });
    const limit = clampInteger(req.query.limit, { min: 1, max: 200, fallback: 50 });

    const products = await Product.find({
      active: true,
      stock: { $lte: threshold }
    })
      .sort({ stock: 1, updatedAt: -1 })
      .limit(limit)
      .select('name category region stock price updatedAt')
      .lean();

    return res.json({
      threshold,
      count: products.length,
      products
    });
  } catch (error) {
    return next(error);
  }
};
