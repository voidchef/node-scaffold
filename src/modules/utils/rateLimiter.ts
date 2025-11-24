import fastifyRateLimit from '@fastify/rate-limit';
import { FastifyInstance } from 'fastify';

const authLimiter = async (fastify: FastifyInstance) => {
  await fastify.register(fastifyRateLimit, {
    max: 20,
    timeWindow: '15 minutes',
  });
};

export default authLimiter;
