import { FastifyRequest, FastifyReply } from 'fastify';
import httpStatus from 'http-status';
import { roleRights } from '../../config/roles';
import ApiError from '../errors/ApiError';
import tokenTypes from '../token/token.types';
import User from '../user/user.model';

interface RequestParams {
  userId?: string;
}

const authMiddleware =
  (...requiredRights: string[]) =>
  async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    try {
      await request.jwtVerify();

      const payload = request.user as any;

      if (payload.type !== tokenTypes.ACCESS) {
        throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid token type');
      }

      if (!payload.sub) {
        throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid authentication payload');
      }

      const user = await User.findById(payload.sub);

      if (!user) {
        throw new ApiError(httpStatus.UNAUTHORIZED, 'Please authenticate');
      }

      request.user = user;

      if (!requiredRights.length) {
        return;
      }

      const userRights = roleRights.get(user.role);

      if (!userRights) {
        throw new ApiError(httpStatus.FORBIDDEN, 'Forbidden');
      }

      const hasRequiredRights = requiredRights.every((requiredRight) => userRights.includes(requiredRight));

      const params = request.params as RequestParams;

      const isAccessingOwnResource = typeof params?.userId === 'string' && params.userId === user._id.toString();

      // Allow access if user has required rights OR if accessing their own resource
      if (!hasRequiredRights && !isAccessingOwnResource) {
        throw new ApiError(httpStatus.FORBIDDEN, 'Forbidden');
      }
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError(httpStatus.UNAUTHORIZED, 'Please authenticate');
    }
  };

export default authMiddleware;
