require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/database');

const requiredEnvVars = ['MONGO_URI', 'JWT_SECRET', 'REFRESH_TOKEN_SECRET', 'PORT'];

const validateEnvironment = () => {
  const missing = requiredEnvVars.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Variables de entorno faltantes: ${missing.join(', ')}`);
  }

  const jwtSecret = process.env.JWT_SECRET || '';
  const refreshSecret = process.env.REFRESH_TOKEN_SECRET || '';

  if (process.env.NODE_ENV === 'production') {
    if (!process.env.FRONTEND_URL) {
      throw new Error('FRONTEND_URL es obligatorio en producción');
    }

    if (jwtSecret.length < 32 || refreshSecret.length < 32) {
      throw new Error('JWT_SECRET y REFRESH_TOKEN_SECRET deben tener al menos 32 caracteres en producción');
    }

    const hasDefaultSecrets =
      jwtSecret.includes('cambiar_en_produccion') ||
      jwtSecret.includes('super_secret') ||
      refreshSecret.includes('cambiar_en_produccion') ||
      refreshSecret.includes('otro_secret');

    if (hasDefaultSecrets) {
      throw new Error('No uses secrets por defecto en producción');
    }
  }
};

const startServer = async () => {
  try {
    validateEnvironment();
    await connectDB();

    app.listen(process.env.PORT, () =>
      console.log(`Servidor activo en puerto ${process.env.PORT}`)
    );
  } catch (error) {
    console.error('No se pudo iniciar el servidor:', error.message);
    process.exit(1);
  }
};

startServer();
