import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import config from '../../config/config';
import authRoute from './auth.route';
import docsRoute from './swagger.route';
import userRoute from './user.route';

const routes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Register default routes
  await fastify.register(authRoute, { prefix: '/auth' });
  await fastify.register(userRoute, { prefix: '/users' });

  // Register development-only routes
  if (config.env === 'development') {
    await fastify.register(docsRoute, { prefix: '/docs' });
  }
};

export default routes;
