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

  const parsedPort = Number.parseInt(process.env.PORT, 10);
  if (!Number.isInteger(parsedPort) || parsedPort <= 0 || parsedPort > 65535) {
    throw new Error('PORT inválido');
  }

  if (process.env.NODE_ENV === 'production') {
    if (!process.env.FRONTEND_URL) {
      throw new Error('FRONTEND_URL es obligatorio en producción');
    }
  }

  if (process.env.ENABLE_PAYMENTS === 'true' && !process.env.STRIPE_WEBHOOK_SECRET) {
    throw new Error('STRIPE_WEBHOOK_SECRET es requerido cuando ENABLE_PAYMENTS=true');
  }
};

const startServer = async () => {
  try {
    validateEnvironment();
    await connectDB();

    const port = Number.parseInt(process.env.PORT, 10);
    const host = process.env.HOST || '0.0.0.0';
    const env = process.env.NODE_ENV || 'development';

    app.listen(port, host, () => {
      const publicHost = host === '0.0.0.0' ? 'localhost' : host;
      console.log(`Servidor activo en puerto ${port}`);
      console.log(`Entorno: ${env}`);
      console.log(`URL local: http://${publicHost}:${port}`);
    });
  } catch (error) {
    console.error('No se pudo iniciar el servidor:', error.message);
    process.exit(1);
  }
};

startServer();
