import { FastifyRequest, FastifyReply } from 'fastify';
import '@fastify/jwt';
import { IUserDoc } from '../modules/user/user.interfaces';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    user: IUserDoc;
  }
}
