import { FastifyRequest, FastifyReply } from 'fastify';
import httpStatus from 'http-status';
import Joi from 'joi';
import ApiError from '../errors/ApiError';
import pick from '../utils/pick';

const validate =
  (schema: Record<string, any>) =>
  async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const validSchema = pick(schema, ['params', 'query', 'body']);
    const object: Record<string, any> = pick(request, Object.keys(validSchema)) as Record<string, any>;
    // Ensure body is included in validation even if undefined
    if ('body' in validSchema && !('body' in object)) {
      object['body'] = undefined;
    }
    const { value, error } = Joi.compile(validSchema)
      .prefs({ errors: { label: 'key' } })
      .validate(object);

    if (error) {
      const errorMessage = error.details.map((details) => details.message).join(', ');
      const apiError = new ApiError(httpStatus.BAD_REQUEST, errorMessage);
      return reply.code(apiError.statusCode).send({ code: apiError.statusCode, message: apiError.message });
    }
    Object.assign(request, value);
  };

export default validate;
