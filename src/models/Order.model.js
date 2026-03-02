const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    unique: true,
    default: () => `ORD-${Date.now()}-${Math.floor(Math.random() * 1000000)}`
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'El usuario es requerido']
  },
  items: [{
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    name: String,
    price: {
      type: Number,
      required: true,
      min: 0
    },
    originalPrice: {
      type: Number,
      min: 0
    },
    discountPerUnit: {
      type: Number,
      min: 0,
      default: 0
    },
    discountPercent: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    subtotal: {
      type: Number,
      required: true
    }
  }],
  total: {
    type: Number,
    required: true,
    min: 0
  },
  tax: {
    type: Number,
    default: 0,
    min: 0
  },
  shippingCost: {
    type: Number,
    default: 0,
    min: 0
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'],
    default: 'pending'
  },
  paymentStatus: {
    type: String,
    enum: ['unpaid', 'paid', 'refunded'],
    default: 'unpaid'
  },
  shippingAddress: {
    street: String,
    city: String,
    postalCode: String,
    country: String,
    phone: String
  },
  notes: String,
  trackingNumber: String
}, { 
  timestamps: true
});

// Índices
OrderSchema.index({ userId: 1, createdAt: -1 });
OrderSchema.index({ status: 1 });
OrderSchema.index({ createdAt: -1 });
OrderSchema.index({ paymentStatus: 1, createdAt: -1 });

// Middleware para validar items
OrderSchema.pre('save', function() {
  if (this.items.length === 0) {
    throw new Error('Una orden debe tener al menos un item');
  }
});

module.exports = mongoose.model('Order', OrderSchema);
