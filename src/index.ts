import { FastifyInstance } from 'fastify';
import mongoose from 'mongoose';
import buildApp from './app';
import config from './config/config';
import logger from './modules/logger/logger';

let server: FastifyInstance;

const start = async () => {
  try {
    server = await buildApp();

    await mongoose.connect(config.mongoose.url);
    logger.info('Connected to MongoDB');

    await server.listen({ port: config.port, host: '0.0.0.0' });
    logger.info(`Listening to port ${config.port}`);
  } catch (error) {
    logger.error(error);
    process.exit(1);
  }
};

const exitHandler = async () => {
  if (server) {
    await server.close();
    logger.info('Server closed');

    await mongoose.connection.close();
    logger.info('MongoDB connection closed');

    process.exit(1);
  } else {
    process.exit(1);
  }
};

const unexpectedErrorHandler = (error: Error) => {
  logger.error(error);
  exitHandler();
};

process.on('uncaughtException', unexpectedErrorHandler);
process.on('unhandledRejection', unexpectedErrorHandler);

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received');
  if (server) {
    await server.close();
    await mongoose.connection.close();
  }
});

start();
