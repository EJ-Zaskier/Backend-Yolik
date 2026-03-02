const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'El nombre del producto es requerido'],
    trim: true,
    minlength: [3, 'El nombre debe tener al menos 3 caracteres'],
    maxlength: [200, 'El nombre no puede exceder 200 caracteres']
  },
  description: {
    type: String,
    required: [true, 'La descripción es requerida'],
    minlength: [10, 'La descripción debe tener al menos 10 caracteres'],
    maxlength: [5000, 'La descripción no puede exceder 5000 caracteres']
  },
  region: {
    type: String,
    required: [true, 'La región es requerida'],
    enum: ['Tehuacan', 'otro'],
    trim: true
  },
  category: {
    type: String,
    required: [true, 'La categoría es requerida'],
    enum: ['Vestidos', 'Blusas', 'Accesorios', 'Otro']
  },
  price: {
    type: Number,
    required: [true, 'El precio es requerido'],
    min: [0, 'El precio no puede ser negativo']
  },
  originalPrice: {
    type: Number,
    min: 0,
    validate: {
      validator: function(value) {
        if (value === undefined || value === null) return true;
        if (typeof this.price !== 'number') return true;
        return value >= this.price;
      },
      message: 'originalPrice no puede ser menor a price'
    }
  },
  stock: {
    type: Number,
    required: [true, 'El stock es requerido'],
    min: [0, 'El stock no puede ser negativo'],
    default: 0
  },
  images: [{
    type: String,
    validate: {
      validator: function(v) {
        return /^https?:\/\/.+/.test(v);
      },
      message: 'URL de imagen inválida'
    }
  }],
  sku: {
    type: String,
    unique: true,
    sparse: true,
    uppercase: true
  },
  active: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  ratings: {
    average: { type: Number, default: 0, min: 0, max: 5 },
    count: { type: Number, default: 0 }
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true }
});

// Índices
ProductSchema.index({ category: 1, active: 1 });
ProductSchema.index({ region: 1 });
ProductSchema.index({ name: 'text', description: 'text' }); // Búsqueda de texto

// Virtual para descuento
ProductSchema.virtual('discount').get(function() {
  if (this.originalPrice && this.originalPrice > this.price) {
    return Math.round(((this.originalPrice - this.price) / this.originalPrice) * 100);
  }
  return 0;
});

module.exports = mongoose.model('Product', ProductSchema);
