const mongoose = require('mongoose');
mongoose.set('strictQuery', true);

const connectDB = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI no está configurado');
  }

  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      minPoolSize: 5
    });

    console.log(`MongoDB conectado: ${conn.connection.host}`);
    
    // Eventos de conexión
    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB desconectado');
    });

    mongoose.connection.on('error', (err) => {
      console.error('Error de MongoDB:', err.message);
    });

    return conn;
  } catch (error) {
    console.error('Error al conectar MongoDB:', error.message);
    throw error;
  }
};

module.exports = connectDB;
