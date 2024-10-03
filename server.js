const dotenv = require('dotenv');
dotenv.config({ path: './config.env' });

process.on('uncaughtException', err => {
  console.log('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.log(err.name, err.message);
  process.exit(1);
});

const app = require('./app');
const mongoose = require('mongoose');

const port = process.env.port || 3000; //process is internal in node
const DB = process.env.DATABASE;

mongoose
  .connect(DB)
  .then(() => {
    console.log('Database Connected Successfully');
  })
  .catch((err) => {
    console.error('Database Connection Error:', err);
  });

app.listen(port, () => {
  console.log(`your app listen at ${port} port`);
});

process.on('unhandledRejection', err => {
  console.log('UNHANDLED REJECTION! 💥 Shutting down...');
  console.log(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});
