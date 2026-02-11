const errorHandler = (err, req, res, next) => {
  // Log con contexto completo
  console.error({
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    status: err.status || 500,
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });

  // Errores de validación de Mongoose
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      message: 'Error de validación',
      code: 'VALIDATION_ERROR',
      details: Object.values(err.errors).map(e => e.message)
    });
  }

  // Errores de duplicado (email único)
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return res.status(409).json({
      message: `${field} ya existe`,
      code: 'DUPLICATE_ERROR',
      field
    });
  }

  // JWT Errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      message: 'Token inválido',
      code: 'INVALID_TOKEN'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      message: 'Token expirado',
      code: 'TOKEN_EXPIRED'
    });
  }

  // Errores de casting de MongoDB
  if (err.name === 'CastError') {
    return res.status(400).json({
      message: 'ID inválido',
      code: 'INVALID_ID'
    });
  }

  if (err.message === 'Origen no permitido por CORS') {
    return res.status(403).json({
      message: 'Origen no permitido',
      code: 'CORS_FORBIDDEN'
    });
  }

  if (err.message === 'CORS_ORIGIN_NOT_CONFIGURED') {
    return res.status(500).json({
      message: 'Configuración CORS incompleta',
      code: 'CORS_MISCONFIGURATION'
    });
  }

  // Error por defecto
  res.status(err.status || 500).json({
    message: process.env.NODE_ENV === 'production' 
      ? 'Error interno del servidor' 
      : err.message,
    code: err.code || 'INTERNAL_ERROR',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

module.exports = errorHandler;
