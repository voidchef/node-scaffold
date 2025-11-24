import { jest } from '@jest/globals';
import httpStatus from 'http-status';
import mongoose from 'mongoose';
import httpMocks from 'node-mocks-http';
import winston from 'winston';
import config from '../../config/config';
import logger from '../logger/logger';
import ApiError from './ApiError';
import { errorConverter, errorHandler } from './error';

describe('Error middlewares', () => {
  describe('Error converter', () => {
    test('should return the same ApiError object it was called with', () => {
      const error = new ApiError(httpStatus.BAD_REQUEST, 'Any error');

      const result = errorConverter(error);

      expect(result).toBe(error);
    });

    test('should convert an Error to ApiError and preserve its status and message', () => {
      const error = new Error('Any error') as ApiError;
      error.statusCode = httpStatus.BAD_REQUEST;

      const result = errorConverter(error);

      expect(result).toBeInstanceOf(ApiError);
      expect(result).toMatchObject({
        statusCode: error.statusCode,
        message: error.message,
        isOperational: false,
      });
    });

    test('should convert an Error without status to ApiError with status 500', () => {
      const error = new Error('Any error');

      const result = errorConverter(error);

      expect(result).toBeInstanceOf(ApiError);
      expect(result).toMatchObject({
        statusCode: httpStatus.INTERNAL_SERVER_ERROR,
        message: error.message,
        isOperational: false,
      });
    });

    test('should convert an Error without message to ApiError with default message of that http status', () => {
      const error = new Error() as ApiError;
      error.statusCode = httpStatus.BAD_REQUEST;

      const result = errorConverter(error);

      expect(result).toBeInstanceOf(ApiError);
      expect(result).toMatchObject({
        statusCode: error.statusCode,
        message: (httpStatus as any)[error.statusCode],
        isOperational: false,
      });
    });

    test('should convert a Mongoose error to ApiError with status 400 and preserve its message', () => {
      const error = new mongoose.Error('Any mongoose error');

      const result = errorConverter(error);

      expect(result).toBeInstanceOf(ApiError);
      expect(result).toMatchObject({
        statusCode: httpStatus.BAD_REQUEST,
        message: error.message,
        isOperational: false,
      });
    });

    test('should convert any other object to ApiError with status 500 and its message', () => {
      const error = {};

      const result = errorConverter(error);

      expect(result).toBeInstanceOf(ApiError);
      expect(result).toMatchObject({
        statusCode: httpStatus.INTERNAL_SERVER_ERROR,
        message: httpStatus[httpStatus.INTERNAL_SERVER_ERROR],
        isOperational: false,
      });
    });
  });

  describe('Error handler', () => {
    beforeEach(() => {
      jest.spyOn(logger, 'error').mockImplementation(() => winston.createLogger({}));
    });

    test('should send proper error response', () => {
      const error = new ApiError(httpStatus.BAD_REQUEST, 'Any error');
      const reply = {
        code: jest.fn().mockReturnThis(),
        send: jest.fn(),
      } as any;

      errorHandler(error, httpMocks.createRequest(), reply);

      expect(reply.code).toHaveBeenCalledWith(error.statusCode);
      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({ code: error.statusCode, message: error.message }));
    });

    test('should put the error stack in the response if in development mode', () => {
      config.env = 'development';
      const error = new ApiError(httpStatus.BAD_REQUEST, 'Any error');
      const reply = {
        code: jest.fn().mockReturnThis(),
        send: jest.fn(),
      } as any;

      errorHandler(error, httpMocks.createRequest(), reply);

      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({ code: error.statusCode, message: error.message, stack: error.stack })
      );
      config.env = process.env['NODE_ENV'] as typeof config.env;
    });

    test('should send internal server error status and message if in production mode and error is not operational', () => {
      config.env = 'production';
      const error = new ApiError(httpStatus.BAD_REQUEST, 'Any error', false);
      const reply = {
        code: jest.fn().mockReturnThis(),
        send: jest.fn(),
      } as any;

      errorHandler(error, httpMocks.createRequest(), reply);

      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          code: httpStatus.INTERNAL_SERVER_ERROR,
          message: httpStatus[httpStatus.INTERNAL_SERVER_ERROR],
        })
      );
      config.env = process.env['NODE_ENV'] as typeof config.env;
    });

    test('should preserve original error status and message if in production mode and error is operational', () => {
      config.env = 'production';
      const error = new ApiError(httpStatus.BAD_REQUEST, 'Any error');
      const reply = {
        code: jest.fn().mockReturnThis(),
        send: jest.fn(),
      } as any;

      errorHandler(error, httpMocks.createRequest(), reply);

      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          code: error.statusCode,
          message: error.message,
        })
      );
      config.env = process.env['NODE_ENV'] as typeof config.env;
    });
  });
});
