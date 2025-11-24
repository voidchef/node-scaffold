import { FastifyRequest, FastifyReply } from 'fastify';
import httpStatus from 'http-status';
import mongoose from 'mongoose';
import ApiError from '../errors/ApiError';
import { IOptions } from '../paginate/paginate';
import catchAsync from '../utils/catchAsync';
import pick from '../utils/pick';
import { NewCreatedUser, UpdateUserBody } from './user.interfaces';
import * as userService from './user.service';

export const createUser = catchAsync(async (request: FastifyRequest, reply: FastifyReply) => {
  const user = await userService.createUser(request.body as NewCreatedUser);
  reply.code(httpStatus.CREATED).send(user);
});

interface UserQueryParams {
  name?: string;
  role?: string;
  sortBy?: string;
  limit?: string;
  page?: string;
  projectBy?: string;
}

export const getUsers = catchAsync(async (request: FastifyRequest, reply: FastifyReply) => {
  const query = request.query as UserQueryParams;
  const filter = pick(query, ['name', 'role']);
  const options: IOptions = pick(query, ['sortBy', 'limit', 'page', 'projectBy']);
  const result = await userService.queryUsers(filter, options);
  reply.send(result);
});

interface UserParams {
  userId: string;
}

export const getUser = catchAsync(async (request: FastifyRequest, reply: FastifyReply) => {
  const params = request.params as UserParams;
  const user = await userService.getUserById(new mongoose.Types.ObjectId(params.userId));
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  reply.send(user);
});

export const updateUser = catchAsync(async (request: FastifyRequest, reply: FastifyReply) => {
  const params = request.params as UserParams;
  const user = await userService.updateUserById(new mongoose.Types.ObjectId(params.userId), request.body as UpdateUserBody);
  reply.send(user);
});

export const deleteUser = catchAsync(async (request: FastifyRequest, reply: FastifyReply) => {
  const params = request.params as UserParams;
  await userService.deleteUserById(new mongoose.Types.ObjectId(params.userId));
  reply.code(httpStatus.NO_CONTENT).send();
});
