import { FastifyRequest, FastifyReply } from 'fastify';
import httpStatus from 'http-status';
import { emailService } from '../email';
import { tokenService } from '../token';
import { userService } from '../user';
import { NewRegisteredUser } from '../user/user.interfaces';
import catchAsync from '../utils/catchAsync';
import * as authService from './auth.service';

export const register = catchAsync(async (request: FastifyRequest, reply: FastifyReply) => {
  const user = await userService.registerUser(request.body as NewRegisteredUser);
  const tokens = await tokenService.generateAuthTokens(user);
  reply.code(httpStatus.CREATED).send({ user, tokens });
});

export const login = catchAsync(async (request: FastifyRequest, reply: FastifyReply) => {
  const { email, password } = request.body as { email: string; password: string };
  const user = await authService.loginUserWithEmailAndPassword(email, password);
  const tokens = await tokenService.generateAuthTokens(user);
  reply.send({ user, tokens });
});

export const logout = catchAsync(async (request: FastifyRequest, reply: FastifyReply) => {
  const { refreshToken } = request.body as { refreshToken: string };
  await authService.logout(refreshToken);
  reply.code(httpStatus.NO_CONTENT).send();
});

export const refreshTokens = catchAsync(async (request: FastifyRequest, reply: FastifyReply) => {
  const { refreshToken } = request.body as { refreshToken: string };
  const userWithTokens = await authService.refreshAuth(refreshToken);
  reply.send({ ...userWithTokens });
});

export const forgotPassword = catchAsync(async (request: FastifyRequest, reply: FastifyReply) => {
  const { email } = request.body as { email: string };
  const resetPasswordToken = await tokenService.generateResetPasswordToken(email);
  await emailService.sendResetPasswordEmail(email, resetPasswordToken);
  reply.code(httpStatus.NO_CONTENT).send();
});

export const resetPassword = catchAsync(async (request: FastifyRequest, reply: FastifyReply) => {
  const { token } = request.query as { token: string };
  const { password } = request.body as { password: string };
  await authService.resetPassword(token, password);
  reply.code(httpStatus.NO_CONTENT).send();
});

export const sendVerificationEmail = catchAsync(async (request: FastifyRequest, reply: FastifyReply) => {
  const verifyEmailToken = await tokenService.generateVerifyEmailToken(request.user);
  await emailService.sendVerificationEmail(request.user.email, verifyEmailToken, request.user.name);
  reply.code(httpStatus.NO_CONTENT).send();
});

export const verifyEmail = catchAsync(async (request: FastifyRequest, reply: FastifyReply) => {
  const { token } = request.query as { token: string };
  await authService.verifyEmail(token);
  reply.code(httpStatus.NO_CONTENT).send();
});
