const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    provider: {
      type: String,
      enum: ['stripe', 'mercadopago', 'paypal'],
      required: true,
      index: true
    },
    providerPaymentId: {
      type: String,
      default: null,
      sparse: true
    },
    idempotencyKey: {
      type: String,
      required: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    currency: {
      type: String,
      required: true,
      uppercase: true,
      minlength: 3,
      maxlength: 3,
      default: 'MXN'
    },
    status: {
      type: String,
      enum: ['pending', 'requires_action', 'authorized', 'paid', 'failed', 'cancelled', 'refunded'],
      default: 'pending',
      index: true
    },
    checkoutUrl: {
      type: String,
      default: null
    },
    failureReason: {
      type: String,
      default: null
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    finalizedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

PaymentSchema.index({ userId: 1, idempotencyKey: 1 }, { unique: true });
PaymentSchema.index({ orderId: 1, status: 1 });

module.exports = mongoose.model('Payment', PaymentSchema);
