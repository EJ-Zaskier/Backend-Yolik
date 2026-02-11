const mongoose = require('mongoose');

const RefreshTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true
    },
    tokenId: {
      type: String,
      required: true
    },
    familyId: {
      type: String,
      required: true,
      index: true
    },
    parentTokenHash: {
      type: String,
      default: null
    },
    replacedByTokenHash: {
      type: String,
      default: null
    },
    revokedAt: {
      type: Date,
      default: null,
      index: true
    },
    revokeReason: {
      type: String,
      enum: ['ROTATED', 'REVOKED', 'REUSE_DETECTED', 'LOGOUT', 'LOGOUT_ALL', null],
      default: null
    },
    expiresAt: {
      type: Date,
      required: true
    },
    createdByIp: {
      type: String,
      default: null
    },
    userAgent: {
      type: String,
      default: null
    },
    lastUsedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
RefreshTokenSchema.index({ userId: 1, tokenId: 1 }, { unique: true });

module.exports = mongoose.model('RefreshToken', RefreshTokenSchema);
