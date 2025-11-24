/* eslint-disable jest/no-commented-out-tests */
import { faker } from '@faker-js/faker';
import bcrypt from 'bcryptjs';
import { FastifyInstance } from 'fastify';
import httpStatus from 'http-status';
import moment from 'moment';
import mongoose from 'mongoose';
import buildApp from '../../app';
import config from '../../config/config';
import setupTestDB from '../jest/setupTestDB';
import Token from '../token/token.model';
import * as tokenService from '../token/token.service';
import tokenTypes from '../token/token.types';
import { NewRegisteredUser } from '../user/user.interfaces';
import User from '../user/user.model';

let app: FastifyInstance;

setupTestDB();

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

const password = 'password1';
const salt = bcrypt.genSaltSync(8);
const hashedPassword = bcrypt.hashSync(password, salt);

const userOne = {
  _id: new mongoose.Types.ObjectId(),
  name: faker.person.fullName(),
  email: faker.internet.email().toLowerCase(),
  password,
  role: 'user',
  isEmailVerified: false,
};

const insertUsers = async (users: Record<string, any>[]) => {
  await User.insertMany(users.map((user) => ({ ...user, password: hashedPassword })));
};

describe('Auth routes', () => {
  describe('POST /v1/auth/register', () => {
    let newUser: NewRegisteredUser;
    beforeEach(() => {
      newUser = {
        name: faker.person.fullName(),
        email: faker.internet.email().toLowerCase(),
        password: 'password1',
      };
    });

    test('should return 201 and successfully register user if request data is ok', async () => {
      const res = await app.inject({ method: 'POST', url: '/v1/auth/register', payload: newUser });
      const body = JSON.parse(res.body);
      expect(res.statusCode).toBe(httpStatus.CREATED);

      expect(body.user).not.toHaveProperty('password');
      expect(body.user).toEqual({
        id: expect.anything(),
        name: newUser.name,
        email: newUser.email,
        role: 'user',
        isEmailVerified: false,
      });

      const dbUser = await User.findById(body.user.id);
      expect(dbUser).toBeDefined();
      expect(dbUser).toMatchObject({ name: newUser.name, email: newUser.email, role: 'user', isEmailVerified: false });

      expect(body.tokens).toEqual({
        access: { token: expect.anything(), expires: expect.anything() },
        refresh: { token: expect.anything(), expires: expect.anything() },
      });
    });

    test('should return 400 error if email is invalid', async () => {
      newUser.email = 'invalidEmail';

      const res = await app.inject({ method: 'POST', url: '/v1/auth/register', payload: newUser });
      expect(res.statusCode).toBe(httpStatus.BAD_REQUEST);
    });

    test('should return 400 error if email is already used', async () => {
      await insertUsers([userOne]);
      newUser.email = userOne.email;

      const res = await app.inject({ method: 'POST', url: '/v1/auth/register', payload: newUser });
      expect(res.statusCode).toBe(httpStatus.BAD_REQUEST);
    });

    test('should return 400 error if password length is less than 8 characters', async () => {
      newUser.password = 'passwo1';

      const res = await app.inject({ method: 'POST', url: '/v1/auth/register', payload: newUser });
      expect(res.statusCode).toBe(httpStatus.BAD_REQUEST);
    });

    test('should return 400 error if password does not contain both letters and numbers', async () => {
      newUser.password = 'password';

      let res = await app.inject({ method: 'POST', url: '/v1/auth/register', payload: newUser });
      expect(res.statusCode).toBe(httpStatus.BAD_REQUEST);

      newUser.password = '11111111';

      res = await app.inject({ method: 'POST', url: '/v1/auth/register', payload: newUser });
      expect(res.statusCode).toBe(httpStatus.BAD_REQUEST);
    });
  });

  describe('POST /v1/auth/login', () => {
    test('should return 200 and login user if email and password match', async () => {
      await insertUsers([userOne]);
      const loginCredentials = {
        email: userOne.email,
        password: userOne.password,
      };

      const res = await app.inject({ method: 'POST', url: '/v1/auth/login', payload: loginCredentials });
      const body = JSON.parse(res.body);
      expect(res.statusCode).toBe(httpStatus.OK);

      expect(body.user).toEqual({
        id: expect.anything(),
        name: userOne.name,
        email: userOne.email,
        role: userOne.role,
        isEmailVerified: userOne.isEmailVerified,
      });

      expect(body.tokens).toEqual({
        access: { token: expect.anything(), expires: expect.anything() },
        refresh: { token: expect.anything(), expires: expect.anything() },
      });
    });

    test('should return 401 error if there are no users with that email', async () => {
      const loginCredentials = {
        email: userOne.email,
        password: userOne.password,
      };

      const res = await app.inject({ method: 'POST', url: '/v1/auth/login', payload: loginCredentials });
      expect(res.statusCode).toBe(httpStatus.UNAUTHORIZED);
      const body = JSON.parse(res.body);

      expect(body).toEqual({ code: httpStatus.UNAUTHORIZED, message: 'Incorrect email or password' });
    });

    test('should return 401 error if password is wrong', async () => {
      await insertUsers([userOne]);
      const loginCredentials = {
        email: userOne.email,
        password: 'wrongPassword1',
      };

      const res = await app.inject({ method: 'POST', url: '/v1/auth/login', payload: loginCredentials });
      expect(res.statusCode).toBe(httpStatus.UNAUTHORIZED);
      const body = JSON.parse(res.body);

      expect(body).toEqual({ code: httpStatus.UNAUTHORIZED, message: 'Incorrect email or password' });
    });
  });

  describe('POST /v1/auth/logout', () => {
    test('should return 204 if refresh token is valid', async () => {
      await insertUsers([userOne]);
      const expires = moment().add(config.jwt.refreshExpirationDays, 'days');
      const refreshToken = tokenService.generateToken(userOne._id, expires, tokenTypes.REFRESH);
      await tokenService.saveToken(refreshToken, userOne._id, expires, tokenTypes.REFRESH);

      const res = await app.inject({ method: 'POST', url: '/v1/auth/logout', payload: { refreshToken } });
      expect(res.statusCode).toBe(httpStatus.NO_CONTENT);

      const dbRefreshTokenDoc = await Token.findOne({ token: refreshToken });
      expect(dbRefreshTokenDoc).toBe(null);
    });

    test('should return 400 error if refresh token is missing from request body', async () => {
      const res = await app.inject({ method: 'POST', url: '/v1/auth/logout' });
      expect(res.statusCode).toBe(httpStatus.BAD_REQUEST);
      const body = JSON.parse(res.body);
      expect(body).toHaveProperty('code');
      expect(body).toHaveProperty('message');
    });

    test('should return 404 error if refresh token is not found in the database', async () => {
      await insertUsers([userOne]);
      const expires = moment().add(config.jwt.refreshExpirationDays, 'days');
      const refreshToken = tokenService.generateToken(userOne._id, expires, tokenTypes.REFRESH);

      const res = await app.inject({ method: 'POST', url: '/v1/auth/logout', payload: { refreshToken } });
      expect(res.statusCode).toBe(httpStatus.NOT_FOUND);
    });

    test('should return 404 error if refresh token is blacklisted', async () => {
      await insertUsers([userOne]);
      const expires = moment().add(config.jwt.refreshExpirationDays, 'days');
      const refreshToken = tokenService.generateToken(userOne._id, expires, tokenTypes.REFRESH);
      await tokenService.saveToken(refreshToken, userOne._id, expires, tokenTypes.REFRESH, true);

      const res = await app.inject({ method: 'POST', url: '/v1/auth/logout', payload: { refreshToken } });
      expect(res.statusCode).toBe(httpStatus.NOT_FOUND);
    });
  });

  describe('POST /v1/auth/refresh-tokens', () => {
    test('should return 200 and new auth tokens if refresh token is valid', async () => {
      await insertUsers([userOne]);
      const expires = moment().add(config.jwt.refreshExpirationDays, 'days');
      const refreshToken = tokenService.generateToken(userOne._id, expires, tokenTypes.REFRESH);
      await tokenService.saveToken(refreshToken, userOne._id, expires, tokenTypes.REFRESH);

      const res = await app.inject({ method: 'POST', url: '/v1/auth/refresh-tokens', payload: { refreshToken } });
      const body = JSON.parse(res.body);
      expect(res.statusCode).toBe(httpStatus.OK);

      expect(body.user).toEqual({
        id: expect.anything(),
        name: userOne.name,
        email: userOne.email,
        role: userOne.role,
        isEmailVerified: userOne.isEmailVerified,
      });

      expect(body.tokens).toEqual({
        access: { token: expect.anything(), expires: expect.anything() },
        refresh: { token: expect.anything(), expires: expect.anything() },
      });

      const dbRefreshTokenDoc = await Token.findOne({ token: body.tokens.refresh.token });
      expect(dbRefreshTokenDoc).toBeDefined();
      expect(dbRefreshTokenDoc).not.toBeNull();
      if (dbRefreshTokenDoc) {
        expect(dbRefreshTokenDoc.type).toBe(tokenTypes.REFRESH);
        expect(dbRefreshTokenDoc.user.toString()).toBe(userOne._id.toHexString());
        expect(dbRefreshTokenDoc.blacklisted).toBe(false);
      }

      const dbRefreshTokenCount = await Token.countDocuments();
      expect(dbRefreshTokenCount).toBe(1);
    });

    test('should return 400 error if refresh token is missing from request body', async () => {
      const res = await app.inject({ method: 'POST', url: '/v1/auth/refresh-tokens' });
      expect(res.statusCode).toBe(httpStatus.BAD_REQUEST);
    });

    test('should return 401 error if refresh token is signed using an invalid secret', async () => {
      await insertUsers([userOne]);
      const expires = moment().add(config.jwt.refreshExpirationDays, 'days');
      const refreshToken = tokenService.generateToken(userOne._id, expires, tokenTypes.REFRESH, 'invalidSecret');
      await tokenService.saveToken(refreshToken, userOne._id, expires, tokenTypes.REFRESH);

      const res = await app.inject({ method: 'POST', url: '/v1/auth/refresh-tokens', payload: { refreshToken } });
      expect(res.statusCode).toBe(httpStatus.UNAUTHORIZED);
    });

    test('should return 401 error if refresh token is not found in the database', async () => {
      await insertUsers([userOne]);
      const expires = moment().add(config.jwt.refreshExpirationDays, 'days');
      const refreshToken = tokenService.generateToken(userOne._id, expires, tokenTypes.REFRESH);

      const res = await app.inject({ method: 'POST', url: '/v1/auth/refresh-tokens', payload: { refreshToken } });
      expect(res.statusCode).toBe(httpStatus.UNAUTHORIZED);
    });

    test('should return 401 error if refresh token is blacklisted', async () => {
      await insertUsers([userOne]);
      const expires = moment().add(config.jwt.refreshExpirationDays, 'days');
      const refreshToken = tokenService.generateToken(userOne._id, expires, tokenTypes.REFRESH);
      await tokenService.saveToken(refreshToken, userOne._id, expires, tokenTypes.REFRESH, true);

      const res = await app.inject({ method: 'POST', url: '/v1/auth/refresh-tokens', payload: { refreshToken } });
      expect(res.statusCode).toBe(httpStatus.UNAUTHORIZED);
    });

    test('should return 401 error if refresh token is expired', async () => {
      await insertUsers([userOne]);
      const expires = moment().subtract(1, 'minutes');
      const refreshToken = tokenService.generateToken(userOne._id, expires, tokenTypes.REFRESH);
      await tokenService.saveToken(refreshToken, userOne._id, expires, tokenTypes.REFRESH);

      const res = await app.inject({ method: 'POST', url: '/v1/auth/refresh-tokens', payload: { refreshToken } });
      expect(res.statusCode).toBe(httpStatus.UNAUTHORIZED);
    });

    test('should return 401 error if user is not found', async () => {
      const expires = moment().add(config.jwt.refreshExpirationDays, 'days');
      const refreshToken = tokenService.generateToken(userOne._id, expires, tokenTypes.REFRESH);
      await tokenService.saveToken(refreshToken, userOne._id, expires, tokenTypes.REFRESH);

      const res = await app.inject({ method: 'POST', url: '/v1/auth/refresh-tokens', payload: { refreshToken } });
      expect(res.statusCode).toBe(httpStatus.UNAUTHORIZED);
    });
  });

  describe('POST /v1/auth/reset-password', () => {
    test('should return 204 and reset the password', async () => {
      await insertUsers([userOne]);
      const expires = moment().add(config.jwt.resetPasswordExpirationMinutes, 'minutes');
      const resetPasswordToken = tokenService.generateToken(userOne._id, expires, tokenTypes.RESET_PASSWORD);
      await tokenService.saveToken(resetPasswordToken, userOne._id, expires, tokenTypes.RESET_PASSWORD);

      const res = await app.inject({
        method: 'POST',
        url: '/v1/auth/reset-password',
        query: { token: resetPasswordToken },
        payload: { password: 'password2' },
      });
      expect(res.statusCode).toBe(httpStatus.NO_CONTENT);

      const dbUser = await User.findById(userOne._id);
      if (dbUser) {
        const isPasswordMatch = await bcrypt.compare('password2', dbUser.password);
        // eslint-disable-next-line jest/no-conditional-expect
        expect(isPasswordMatch).toBe(true);
      }

      // const dbResetPasswordTokenCount = await Token.countDocuments({ user: userOne._id, type: tokenTypes.RESET_PASSWORD });
      // expect(dbResetPasswordTokenCount).toBe(0);
    });

    test('should return 400 if reset password token is missing', async () => {
      await insertUsers([userOne]);

      const res = await app.inject({ method: 'POST', url: '/v1/auth/reset-password', payload: { password: 'password2' } });
      expect(res.statusCode).toBe(httpStatus.BAD_REQUEST);
    });

    test('should return 401 if reset password token is blacklisted', async () => {
      await insertUsers([userOne]);
      const expires = moment().add(config.jwt.resetPasswordExpirationMinutes, 'minutes');
      const resetPasswordToken = tokenService.generateToken(userOne._id, expires, tokenTypes.RESET_PASSWORD);
      await tokenService.saveToken(resetPasswordToken, userOne._id, expires, tokenTypes.RESET_PASSWORD, true);

      const res = await app.inject({
        method: 'POST',
        url: '/v1/auth/reset-password',
        query: { token: resetPasswordToken },
        payload: { password: 'password2' },
      });
      expect(res.statusCode).toBe(httpStatus.UNAUTHORIZED);
    });

    test('should return 401 if reset password token is expired', async () => {
      await insertUsers([userOne]);
      const expires = moment().subtract(1, 'minutes');
      const resetPasswordToken = tokenService.generateToken(userOne._id, expires, tokenTypes.RESET_PASSWORD);
      await tokenService.saveToken(resetPasswordToken, userOne._id, expires, tokenTypes.RESET_PASSWORD);

      const res = await app.inject({
        method: 'POST',
        url: '/v1/auth/reset-password',
        query: { token: resetPasswordToken },
        payload: { password: 'password2' },
      });
      expect(res.statusCode).toBe(httpStatus.UNAUTHORIZED);
    });

    test('should return 401 if user is not found', async () => {
      const expires = moment().add(config.jwt.resetPasswordExpirationMinutes, 'minutes');
      const resetPasswordToken = tokenService.generateToken(userOne._id, expires, tokenTypes.RESET_PASSWORD);
      await tokenService.saveToken(resetPasswordToken, userOne._id, expires, tokenTypes.RESET_PASSWORD);

      const res = await app.inject({
        method: 'POST',
        url: '/v1/auth/reset-password',
        query: { token: resetPasswordToken },
        payload: { password: 'password2' },
      });
      expect(res.statusCode).toBe(httpStatus.UNAUTHORIZED);
    });

    test('should return 400 if password is missing or invalid', async () => {
      await insertUsers([userOne]);
      const expires = moment().add(config.jwt.resetPasswordExpirationMinutes, 'minutes');
      const resetPasswordToken = tokenService.generateToken(userOne._id, expires, tokenTypes.RESET_PASSWORD);
      await tokenService.saveToken(resetPasswordToken, userOne._id, expires, tokenTypes.RESET_PASSWORD);

      let res = await app.inject({ method: 'POST', url: '/v1/auth/reset-password', query: { token: resetPasswordToken } });
      expect(res.statusCode).toBe(httpStatus.BAD_REQUEST);

      res = await app.inject({
        method: 'POST',
        url: '/v1/auth/reset-password',
        query: { token: resetPasswordToken },
        payload: { password: 'short1' },
      });
      expect(res.statusCode).toBe(httpStatus.BAD_REQUEST);

      res = await app.inject({
        method: 'POST',
        url: '/v1/auth/reset-password',
        query: { token: resetPasswordToken },
        payload: { password: 'password' },
      });
      expect(res.statusCode).toBe(httpStatus.BAD_REQUEST);

      res = await app.inject({
        method: 'POST',
        url: '/v1/auth/reset-password',
        query: { token: resetPasswordToken },
        payload: { password: '11111111' },
      });
      expect(res.statusCode).toBe(httpStatus.BAD_REQUEST);
    });
  });

  describe('POST /v1/auth/verify-email', () => {
    test('should return 204 and verify the email', async () => {
      await insertUsers([userOne]);
      const expires = moment().add(config.jwt.verifyEmailExpirationMinutes, 'minutes');
      const verifyEmailToken = tokenService.generateToken(userOne._id, expires, tokenTypes.VERIFY_EMAIL);
      await tokenService.saveToken(verifyEmailToken, userOne._id, expires, tokenTypes.VERIFY_EMAIL);

      const res = await app.inject({ method: 'POST', url: '/v1/auth/verify-email', query: { token: verifyEmailToken } });
      expect(res.statusCode).toBe(httpStatus.NO_CONTENT);

      const dbUser = await User.findById(userOne._id);
      expect(dbUser).toBeDefined();
      expect(dbUser).toMatchObject({ name: userOne.name, email: userOne.email, role: userOne.role, isEmailVerified: true });
    });

    test('should return 400 if verify email token is missing', async () => {
      await insertUsers([userOne]);

      const res = await app.inject({ method: 'POST', url: '/v1/auth/verify-email' });
      expect(res.statusCode).toBe(httpStatus.BAD_REQUEST);
    });

    test('should return 401 if verify email token is blacklisted', async () => {
      await insertUsers([userOne]);
      const expires = moment().add(config.jwt.verifyEmailExpirationMinutes, 'minutes');
      const verifyEmailToken = tokenService.generateToken(userOne._id, expires, tokenTypes.VERIFY_EMAIL);
      await tokenService.saveToken(verifyEmailToken, userOne._id, expires, tokenTypes.VERIFY_EMAIL, true);

      const res = await app.inject({ method: 'POST', url: '/v1/auth/verify-email', query: { token: verifyEmailToken } });
      expect(res.statusCode).toBe(httpStatus.UNAUTHORIZED);
    });

    test('should return 401 if verify email token is expired', async () => {
      await insertUsers([userOne]);
      const expires = moment().subtract(1, 'minutes');
      const verifyEmailToken = tokenService.generateToken(userOne._id, expires, tokenTypes.VERIFY_EMAIL);
      await tokenService.saveToken(verifyEmailToken, userOne._id, expires, tokenTypes.VERIFY_EMAIL);

      const res = await app.inject({ method: 'POST', url: '/v1/auth/verify-email', query: { token: verifyEmailToken } });
      expect(res.statusCode).toBe(httpStatus.UNAUTHORIZED);
    });

    test('should return 401 if user is not found', async () => {
      const expires = moment().add(config.jwt.verifyEmailExpirationMinutes, 'minutes');
      const verifyEmailToken = tokenService.generateToken(userOne._id, expires, tokenTypes.VERIFY_EMAIL);
      await tokenService.saveToken(verifyEmailToken, userOne._id, expires, tokenTypes.VERIFY_EMAIL);

      const res = await app.inject({ method: 'POST', url: '/v1/auth/verify-email', query: { token: verifyEmailToken } });
      expect(res.statusCode).toBe(httpStatus.UNAUTHORIZED);
    });
  });
});

/*
// TODO: Update these tests for Fastify preHandler pattern
describe.skip('Auth middleware', () => {
  test('should call next with no errors if access token is valid', async () => {
    await insertUsers([userOne]);
    const req = httpMocks.createRequest({ headers: { Authorization: `Bearer ${userOneAccessToken}` } });
    const next = jest.fn();

    await authMiddleware()(req, httpMocks.createResponse(), next);

    expect(next).toHaveBeenCalledWith();
    expect(req.user._id).toEqual(userOne._id);
  });

  test('should call next with unauthorized error if access token is not found in header', async () => {
    await insertUsers([userOne]);
    const req = httpMocks.createRequest();
    const next = jest.fn();

    await authMiddleware()(req, httpMocks.createResponse(), next);

    expect(next).toHaveBeenCalledWith(expect.any(ApiError));
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: httpStatus.UNAUTHORIZED, message: 'Please authenticate' }),
    );
  });

  test('should call next with unauthorized error if access token is not a valid jwt token', async () => {
    await insertUsers([userOne]);
    const req = httpMocks.createRequest({ headers: { Authorization: 'Bearer randomToken' } });
    const next = jest.fn();

    await authMiddleware()(req, httpMocks.createResponse(), next);

    expect(next).toHaveBeenCalledWith(expect.any(ApiError));
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: httpStatus.UNAUTHORIZED, message: 'Please authenticate' }),
    );
  });

  test('should call next with unauthorized error if the token is not an access token', async () => {
    await insertUsers([userOne]);
    const expires = moment().add(config.jwt.accessExpirationMinutes, 'minutes');
    const refreshToken = tokenService.generateToken(userOne._id, expires, tokenTypes.REFRESH);
    const req = httpMocks.createRequest({ headers: { Authorization: `Bearer ${refreshToken}` } });
    const next = jest.fn();

    await authMiddleware()(req, httpMocks.createResponse(), next);

    expect(next).toHaveBeenCalledWith(expect.any(ApiError));
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: httpStatus.UNAUTHORIZED, message: 'Please authenticate' }),
    );
  });

  test('should call next with unauthorized error if access token is generated with an invalid secret', async () => {
    await insertUsers([userOne]);
    const expires = moment().add(config.jwt.accessExpirationMinutes, 'minutes');
    const accessToken = tokenService.generateToken(userOne._id, expires, tokenTypes.ACCESS, 'invalidSecret');
    const req = httpMocks.createRequest({ headers: { Authorization: `Bearer ${accessToken}` } });
    const next = jest.fn();

    await authMiddleware()(req, httpMocks.createResponse(), next);

    expect(next).toHaveBeenCalledWith(expect.any(ApiError));
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: httpStatus.UNAUTHORIZED, message: 'Please authenticate' }),
    );
  });

  test('should call next with unauthorized error if access token is expired', async () => {
    await insertUsers([userOne]);
    const expires = moment().subtract(1, 'minutes');
    const accessToken = tokenService.generateToken(userOne._id, expires, tokenTypes.ACCESS);
    const req = httpMocks.createRequest({ headers: { Authorization: `Bearer ${accessToken}` } });
    const next = jest.fn();

    await authMiddleware()(req, httpMocks.createResponse(), next);

    expect(next).toHaveBeenCalledWith(expect.any(ApiError));
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: httpStatus.UNAUTHORIZED, message: 'Please authenticate' }),
    );
  });

  test('should call next with unauthorized error if user is not found', async () => {
    const req = httpMocks.createRequest({ headers: { Authorization: `Bearer ${userOneAccessToken}` } });
    const next = jest.fn();

    await authMiddleware()(req, httpMocks.createResponse(), next);

    expect(next).toHaveBeenCalledWith(expect.any(ApiError));
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: httpStatus.UNAUTHORIZED, message: 'Please authenticate' }),
    );
  });

  test('should call next with forbidden error if user does not have required rights and userId is not in params', async () => {
    await insertUsers([userOne]);
    const req = httpMocks.createRequest({ headers: { Authorization: `Bearer ${userOneAccessToken}` } });
    const next = jest.fn();

    await authMiddleware('anyRight')(req, httpMocks.createResponse(), next);

    expect(next).toHaveBeenCalledWith(expect.any(ApiError));
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: httpStatus.FORBIDDEN, message: 'Forbidden' }));
  });

  test('should call next with no errors if user does not have required rights but userId is in params', async () => {
    await insertUsers([userOne]);
    const req = httpMocks.createRequest({
      headers: { Authorization: `Bearer ${userOneAccessToken}` },
      params: { userId: userOne._id.toHexString() },
    });
    const next = jest.fn();

    await authMiddleware('anyRight')(req, httpMocks.createResponse(), next);

    expect(next).toHaveBeenCalledWith();
  });
});
*/
