import { FastifyRequest, FastifyReply } from 'fastify';
import httpStatus from 'http-status';
import Joi from 'joi';
import ApiError from '../errors/ApiError';
import pick from '../utils/pick';

const validate =
  (schema: Record<string, any>) =>
  async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const validSchema = pick(schema, ['params', 'query', 'body']);
    const object = pick(request, Object.keys(validSchema));
    const { value, error } = Joi.compile(validSchema)
      .prefs({ errors: { label: 'key' } })
      .validate(object);

    if (error) {
      const errorMessage = error.details.map((details) => details.message).join(', ');
      throw new ApiError(httpStatus.BAD_REQUEST, errorMessage);
    }
    Object.assign(request, value);
  };

export default validate;
