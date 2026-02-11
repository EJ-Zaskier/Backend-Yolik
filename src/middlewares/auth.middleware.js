const jwt = require('jsonwebtoken');
const { isTokenBlacklisted } = require('../utils/tokenBlacklist');

module.exports = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        message: 'No autorizado - Token no proporcionado',
        code: 'NO_TOKEN' 
      });
    }

    const token = authHeader.split(' ')[1];

    if (isTokenBlacklisted(token)) {
      return res.status(401).json({
        message: 'Token revocado',
        code: 'TOKEN_REVOKED'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Validar que los datos requeridos están presentes
    if (!decoded.id || !decoded.role) {
      return res.status(401).json({ message: 'Token inválido' });
    }

    if (decoded.typ && decoded.typ !== 'access') {
      return res.status(401).json({
        message: 'Tipo de token inválido',
        code: 'INVALID_TOKEN_TYPE'
      });
    }

    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role
    };
    
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        message: 'Token expirado',
        code: 'TOKEN_EXPIRED' 
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        message: 'Token inválido',
        code: 'INVALID_TOKEN' 
      });
    }

    res.status(500).json({ message: 'Error en verificación de token' });
  }
};
