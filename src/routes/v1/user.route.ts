import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { auth } from '../../modules/auth';
import { userController, userValidation } from '../../modules/user';
import { validate } from '../../modules/validate';

const userRoute: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.post(
    '/',
    {
      preHandler: [auth('manageUsers'), validate(userValidation.createUser)],
      schema: {
        tags: ['Users'],
        summary: 'Create a user',
        description: 'Only admins can create other users',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['name', 'email', 'password', 'role'],
          properties: {
            name: { type: 'string' },
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 8 },
            role: { type: 'string', enum: ['user', 'admin'] },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              email: { type: 'string' },
              role: { type: 'string' },
            },
          },
        },
      },
    },
    userController.createUser
  );

  fastify.get(
    '/',
    {
      preHandler: [auth('getUsers'), validate(userValidation.getUsers)],
      schema: {
        tags: ['Users'],
        summary: 'Get all users',
        description: 'Only admins can retrieve all users',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            role: { type: 'string' },
            sortBy: { type: 'string' },
            limit: { type: 'integer', minimum: 1 },
            page: { type: 'integer', minimum: 1 },
          },
        },
      },
    },
    userController.getUsers
  );

  fastify.get(
    '/:userId',
    {
      preHandler: [auth('getUsers'), validate(userValidation.getUser)],
      schema: {
        tags: ['Users'],
        summary: 'Get a user',
        description: 'Logged in users can fetch only their own user information. Only admins can fetch other users.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['userId'],
          properties: {
            userId: { type: 'string' },
          },
        },
      },
    },
    userController.getUser
  );

  fastify.patch(
    '/:userId',
    {
      preHandler: [auth('manageUsers'), validate(userValidation.updateUser)],
      schema: {
        tags: ['Users'],
        summary: 'Update a user',
        description: 'Logged in users can only update their own information. Only admins can update other users.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['userId'],
          properties: {
            userId: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 8 },
          },
        },
      },
    },
    userController.updateUser
  );

  fastify.delete(
    '/:userId',
    {
      preHandler: [auth('manageUsers'), validate(userValidation.deleteUser)],
      schema: {
        tags: ['Users'],
        summary: 'Delete a user',
        description: 'Logged in users can delete only themselves. Only admins can delete other users.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['userId'],
          properties: {
            userId: { type: 'string' },
          },
        },
      },
    },
    userController.deleteUser
  );
};

export default userRoute;
