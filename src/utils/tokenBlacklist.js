const tokenBlacklist = new Map();

const DEFAULT_TTL_MS = 8 * 60 * 60 * 1000;

const cleanupExpiredTokens = () => {
  const now = Date.now();
  for (const [token, expiresAt] of tokenBlacklist.entries()) {
    if (expiresAt <= now) {
      tokenBlacklist.delete(token);
    }
  }
};

const addTokenToBlacklist = (token, expiresAt) => {
  if (!token) return;
  const expiry = Number.isFinite(expiresAt) ? expiresAt : Date.now() + DEFAULT_TTL_MS;
  tokenBlacklist.set(token, expiry);
};

const isTokenBlacklisted = (token) => {
  if (!token) return false;
  cleanupExpiredTokens();
  return tokenBlacklist.has(token);
};

module.exports = {
  addTokenToBlacklist,
  isTokenBlacklisted
};
