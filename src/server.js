require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/database');

const requiredEnvVars = ['MONGO_URI', 'AUTH0_DOMAIN', 'AUTH0_API_AUDIENCE', 'PORT'];

const validateEnvironment = () => {
  const missing = requiredEnvVars.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Variables de entorno faltantes: ${missing.join(', ')}`);
  }

  const auth0Domain = String(process.env.AUTH0_DOMAIN || '').trim();
  const auth0Audience = String(process.env.AUTH0_API_AUDIENCE || '').trim();

  if (!auth0Domain.includes('.auth0.com')) {
    throw new Error('AUTH0_DOMAIN inválido');
  }

  if (auth0Audience.length < 8) {
    throw new Error('AUTH0_API_AUDIENCE inválido');
  }

  if (process.env.NODE_ENV === 'production') {
    if (!process.env.FRONTEND_URL) {
      throw new Error('FRONTEND_URL es obligatorio en producción');
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
