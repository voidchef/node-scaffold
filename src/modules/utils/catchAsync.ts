import { FastifyRequest, FastifyReply } from 'fastify';

const catchAsync =
  (fn: (request: FastifyRequest, reply: FastifyReply) => Promise<any>) =>
  (request: FastifyRequest, reply: FastifyReply): Promise<any> => {
    return fn(request, reply);
  };

export default catchAsync;
