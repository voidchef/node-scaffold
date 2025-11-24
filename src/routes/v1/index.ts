import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import authRoute from './auth.route';
import userRoute from './user.route';

const routes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Register default routes
  await fastify.register(authRoute, { prefix: '/auth' });
  await fastify.register(userRoute, { prefix: '/users' });
};

export default routes;
