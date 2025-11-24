import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { authValidation, authController, auth } from '../../modules/auth';
import { validate } from '../../modules/validate';

const authRoute: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.post(
    '/register',
    {
      preHandler: [validate(authValidation.register)],
      schema: {
        tags: ['Auth'],
        summary: 'Register as user',
        body: {
          type: 'object',
          required: ['name', 'email', 'password'],
          properties: {
            name: { type: 'string' },
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 8 },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              user: { type: 'object' },
              tokens: { type: 'object' },
            },
          },
        },
      },
    },
    authController.register
  );

  fastify.post(
    '/login',
    {
      preHandler: [validate(authValidation.login)],
      schema: {
        tags: ['Auth'],
        summary: 'Login',
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              user: { type: 'object' },
              tokens: { type: 'object' },
            },
          },
        },
      },
    },
    authController.login
  );

  fastify.post(
    '/logout',
    {
      preHandler: [validate(authValidation.logout)],
      schema: {
        tags: ['Auth'],
        summary: 'Logout',
        body: {
          type: 'object',
          required: ['refreshToken'],
          properties: {
            refreshToken: { type: 'string' },
          },
        },
      },
    },
    authController.logout
  );

  fastify.post(
    '/refresh-tokens',
    {
      preHandler: [validate(authValidation.refreshTokens)],
      schema: {
        tags: ['Auth'],
        summary: 'Refresh auth tokens',
        body: {
          type: 'object',
          required: ['refreshToken'],
          properties: {
            refreshToken: { type: 'string' },
          },
        },
      },
    },
    authController.refreshTokens
  );

  fastify.post(
    '/forgot-password',
    {
      preHandler: [validate(authValidation.forgotPassword)],
      schema: {
        tags: ['Auth'],
        summary: 'Forgot password',
        body: {
          type: 'object',
          required: ['email'],
          properties: {
            email: { type: 'string', format: 'email' },
          },
        },
      },
    },
    authController.forgotPassword
  );

  fastify.post(
    '/reset-password',
    {
      preHandler: [validate(authValidation.resetPassword)],
      schema: {
        tags: ['Auth'],
        summary: 'Reset password',
        body: {
          type: 'object',
          required: ['token', 'password'],
          properties: {
            token: { type: 'string' },
            password: { type: 'string', minLength: 8 },
          },
        },
      },
    },
    authController.resetPassword
  );

  fastify.post(
    '/send-verification-email',
    {
      preHandler: [auth()],
      schema: {
        tags: ['Auth'],
        summary: 'Send verification email',
        security: [{ bearerAuth: [] }],
      },
    },
    authController.sendVerificationEmail
  );

  fastify.post(
    '/verify-email',
    {
      preHandler: [validate(authValidation.verifyEmail)],
      schema: {
        tags: ['Auth'],
        summary: 'Verify email',
        body: {
          type: 'object',
          required: ['token'],
          properties: {
            token: { type: 'string' },
          },
        },
      },
    },
    authController.verifyEmail
  );
};

export default authRoute;
