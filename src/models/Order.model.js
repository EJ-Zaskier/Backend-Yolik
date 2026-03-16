const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  productId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  name:         { type: String, required: true },
  image:        { type: String, default: '' },
  category:     { type: String, default: '' },
  price:        { type: Number, required: true },   // precio al momento de compra
  quantity:     { type: Number, required: true, min: 1 },
});

const shippingAddressSchema = new mongoose.Schema({
  nombre:        { type: String, required: true },
  telefono:      { type: String, required: true },
  calle:         { type: String, required: true },
  colonia:       { type: String, required: true },
  ciudad:        { type: String, required: true },
  codigoPostal:  { type: String, required: true },
  estado:        { type: String, required: true },
  referencias:   { type: String, default: '' },
});

const orderSchema = new mongoose.Schema(
  {
    // Quién compró — sub de Auth0 (ej: "auth0|abc123")
    userId:          { type: String, required: true, index: true },
    userEmail:       { type: String, default: '' },

    items:           { type: [orderItemSchema], required: true },
    shippingAddress: { type: shippingAddressSchema, required: true },

    subtotal:        { type: Number, required: true },
    shippingCost:    { type: Number, required: true, default: 0 },
    discount:        { type: Number, required: true, default: 0 },
    total:           { type: Number, required: true },

    // Stripe
    stripePaymentIntentId: { type: String, required: true, unique: true },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending',
    },

    // Estado del pedido
    status: {
      type: String,
      enum: ['Procesando', 'En camino', 'Entregado', 'Cancelado'],
      default: 'Procesando',
    },
  },
  { timestamps: true }  // agrega createdAt y updatedAt automáticamente
);

module.exports = mongoose.model('Order', orderSchema);