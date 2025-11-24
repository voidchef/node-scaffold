import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import swaggerDefinition from '../../modules/swagger/swagger.definition';

const docsRoute: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  await fastify.register(fastifySwagger, {
    swagger: swaggerDefinition,
  });

  await fastify.register(fastifySwaggerUi, {
    routePrefix: '/',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
    staticCSP: true,
    transformStaticCSP: (header: string) => header,
  });
};

export default docsRoute;
