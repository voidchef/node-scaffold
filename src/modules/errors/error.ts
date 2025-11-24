import { FastifyRequest, FastifyReply, FastifyError } from 'fastify';
import httpStatus from 'http-status';
import mongoose from 'mongoose';
import config from '../../config/config';
import { logger } from '../logger';
import ApiError from './ApiError';

export const errorConverter = (err: any): ApiError => {
  let error = err;
  if (!(error instanceof ApiError)) {
    const statusCode =
      error.statusCode || error instanceof mongoose.Error ? httpStatus.BAD_REQUEST : httpStatus.INTERNAL_SERVER_ERROR;
    const message: string = error.message || `${httpStatus[statusCode]}`;
    error = new ApiError(statusCode, message, false, err.stack);
  }
  return error;
};

export const errorHandler = (error: FastifyError | ApiError, _request: FastifyRequest, reply: FastifyReply) => {
  let err = error as ApiError;

  // Convert error if needed
  if (!(error instanceof ApiError)) {
    err = errorConverter(error);
  }

  let { statusCode, message } = err;
  if (config.env === 'production' && !err.isOperational) {
    statusCode = httpStatus.INTERNAL_SERVER_ERROR;
    message = 'Internal Server Error';
  }

  const response = {
    code: statusCode,
    message,
    ...(config.env === 'development' && { stack: err.stack }),
  };

  if (config.env === 'development') {
    logger.error(err);
  }

  reply.code(statusCode).send(response);
};
