import fastifyCompress from '@fastify/compress';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyJwt from '@fastify/jwt';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import httpStatus from 'http-status';
import config from './config/config';
import { errorHandler } from './modules/errors';
import swaggerDefinition from './modules/swagger/swagger.definition';
import { authLimiter } from './modules/utils';
import routes from './routes/v1';

async function buildApp() {
  const app: FastifyInstance = Fastify({
    logger:
      config.env !== 'test'
        ? {
            level: 'info',
            transport: {
              target: 'pino-pretty',
              options: {
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname',
              },
            },
          }
        : false,
    trustProxy: true,
  });

  // Set custom error serializer to use our format
  app.setErrorHandler(errorHandler);

  // Register compression
  await app.register(fastifyCompress, {
    global: true,
    encodings: ['gzip', 'deflate'],
  });

  // Register helmet for security headers
  if (config.env === 'production') {
    await app.register(fastifyHelmet);
  } else {
    await app.register(fastifyHelmet, {
      contentSecurityPolicy: false,
    });
  }

  // Register CORS
  await app.register(fastifyCors, {
    origin: true,
    credentials: true,
  });

  // Register JWT
  await app.register(fastifyJwt, {
    secret: config.jwt.secret,
  });

  // Decorate request with authenticate method
  app.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.send(err);
    }
  });

  // Register rate limiter for auth routes
  if (config.env === 'production') {
    await app.register(authLimiter, {
      prefix: '/v1/auth',
    });
  }

  // Register Swagger for development
  if (config.env === 'development') {
    await app.register(fastifySwagger, {
      openapi: swaggerDefinition,
    });

    await app.register(fastifySwaggerUi, {
      routePrefix: '/v1/docs',
      uiConfig: {
        docExpansion: 'list',
        deepLinking: true,
      },
      staticCSP: true,
      transformStaticCSP: (header: string) => header,
    });
  }

  // Register routes
  await app.register(routes, { prefix: '/v1' });

  // Handle 404 errors
  app.setNotFoundHandler((_request: FastifyRequest, reply: FastifyReply) => {
    reply.code(httpStatus.NOT_FOUND).send({
      code: httpStatus.NOT_FOUND,
      message: 'Not found',
    });
  });

  return app;
}

export default buildApp;
