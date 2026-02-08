require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/database');

connectDB();

app.listen(process.env.PORT, () =>
  console.log(`Servidor activo en puerto ${process.env.PORT}`)
);
