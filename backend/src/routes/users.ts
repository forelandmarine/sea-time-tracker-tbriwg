import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import * as authSchema from "../db/auth-schema.js";
import type { App } from "../index.js";

/**
 * Calls the internal Better Auth sign-up endpoint to create a user with proper password hashing.
 * This ensures the password is hashed using Better Auth's algorithm, making sign-in work correctly.
 */
async function createUserViaAuth(
  email: string,
  password: string,
  name: string,
  baseUrl: string,
  logger: any
): Promise<{ user: any; error?: string }> {
  try {
    // Use the provided base URL, ensuring it includes the protocol
    let authUrl = baseUrl;
    if (!authUrl.startsWith('http')) {
      authUrl = `http://${authUrl}`;
    }

    // Remove trailing slash if present
    authUrl = authUrl.replace(/\/$/, '');

    const signupUrl = `${authUrl}/api/auth/sign-up/email`;

    logger.info(
      { email, signupUrl },
      'Calling Better Auth sign-up endpoint'
    );

    const response = await fetch(signupUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
        name,
      }),
    });

    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      data = { message: responseText };
    }

    if (!response.ok) {
      logger.warn(
        { email, status: response.status, error: data },
        'Better Auth sign-up failed'
      );
      return { user: null, error: data.message || 'Sign-up failed' };
    }

    logger.info({ email, userId: data.user?.id }, 'User created via Better Auth');
    return { user: data.user };
  } catch (error) {
    logger.error(
      { err: error, email },
      'Error calling Better Auth sign-up endpoint'
    );
    return { user: null, error: 'Failed to contact auth service' };
  }
}

export function register(app: App, fastify: FastifyInstance) {
  // POST /api/users/test - Create a test user account
  fastify.post<{ Body: { email: string; name: string; password: string } }>(
    '/api/users/test',
    {
      schema: {
        description: 'Create a test user account for development and testing',
        tags: ['users'],
        body: {
          type: 'object',
          required: ['email', 'name', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            name: { type: 'string' },
            password: { type: 'string', minLength: 8 },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              email: { type: 'string' },
              name: { type: 'string' },
              message: { type: 'string' },
            },
          },
          400: {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
          409: {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { email, name, password } = request.body;

      app.logger.info({ email, name }, 'Creating test user account via Better Auth');

      try {
        // Check if user already exists first
        const existingUser = await app.db
          .select()
          .from(authSchema.user)
          .where(eq(authSchema.user.email, email));

        if (existingUser.length > 0) {
          app.logger.warn({ email }, 'User already exists');
          return reply.code(409).send({
            error: `User with email ${email} already exists`,
          });
        }

        // Get the Better Auth base URL - try multiple env vars and construct from request if needed
        let betterAuthUrl = process.env.BETTER_AUTH_URL ||
                            process.env.API_URL ||
                            process.env.BACKEND_URL;

        // If no URL is set, construct from the incoming request
        if (!betterAuthUrl) {
          const protocol = request.headers['x-forwarded-proto'] || 'http';
          const host = request.headers['x-forwarded-host'] || request.headers.host || 'localhost:3000';
          betterAuthUrl = `${protocol}://${host}`;
        }

        // Call Better Auth's sign-up endpoint to create user with proper password hashing
        const { user, error } = await createUserViaAuth(
          email,
          password,
          name,
          betterAuthUrl,
          app.logger
        );

        if (error || !user) {
          app.logger.error({ email, error }, 'Failed to create user via Better Auth');

          // Check if it's a duplicate email error
          if (error?.includes('email') || error?.includes('already')) {
            return reply.code(409).send({
              error: `User with email ${email} already exists`,
            });
          }

          return reply.code(400).send({
            error: error || 'Failed to create user account',
          });
        }

        app.logger.info(
          { userId: user.id, email, name },
          'Test user account created successfully'
        );

        return reply.code(201).send({
          id: user.id,
          email: user.email,
          name: user.name,
          message: 'User account created successfully',
        });
      } catch (error) {
        app.logger.error(
          { err: error, email, name },
          'Failed to create test user account'
        );

        return reply.code(400).send({
          error: 'Failed to create user account',
        });
      }
    }
  );

  // GET /api/users/session - Get current session with user data
  // This endpoint helps with session retrieval in Expo Go and preview environments
  fastify.get(
    '/api/users/session',
    {
      schema: {
        description: 'Get current session with user data (supports bearer token)',
        tags: ['users'],
        response: {
          200: {
            type: 'object',
            properties: {
              user: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  email: { type: 'string' },
                  name: { type: 'string' },
                  image: { type: ['string', 'null'] },
                  emailVerified: { type: 'boolean' },
                  createdAt: { type: 'string' },
                  updatedAt: { type: 'string' },
                },
              },
              session: {
                type: 'object',
                nullable: true,
              },
            },
          },
          401: {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      app.logger.info({ method: 'GET', path: '/api/users/session' }, 'Retrieving session');

      try {
        // Try to get bearer token from Authorization header
        const authHeader = request.headers.authorization;
        const token = authHeader?.replace('Bearer ', '');

        if (!token) {
          app.logger.warn('No authorization token provided');
          return reply.code(401).send({
            error: 'No authorization token provided',
          });
        }

        // Query the session from the database using the token
        const [sessionRecord] = await app.db
          .select()
          .from(authSchema.session)
          .where(eq(authSchema.session.token, token));

        if (!sessionRecord || !sessionRecord.expiresAt || new Date() > sessionRecord.expiresAt) {
          app.logger.warn({ token: token.substring(0, 10) }, 'Session not found or expired');
          return reply.code(401).send({
            error: 'Session not found or expired',
          });
        }

        // Fetch the user associated with the session
        const [user] = await app.db
          .select()
          .from(authSchema.user)
          .where(eq(authSchema.user.id, sessionRecord.userId));

        if (!user) {
          app.logger.warn({ userId: sessionRecord.userId }, 'User not found for session');
          return reply.code(401).send({
            error: 'User not found',
          });
        }

        app.logger.info(
          { userId: user.id, email: user.email },
          'Session retrieved successfully'
        );

        return reply.code(200).send({
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
            emailVerified: user.emailVerified,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
          },
          session: sessionRecord,
        });
      } catch (error) {
        app.logger.error(
          { err: error },
          'Failed to retrieve session'
        );

        return reply.code(401).send({
          error: 'Failed to retrieve session',
        });
      }
    }
  );

  // GET /api/users/debug - Debug endpoint to verify authentication setup
  fastify.get(
    '/api/users/debug',
    {
      schema: {
        description: 'Debug endpoint to verify authentication setup and user database state',
        tags: ['users'],
        response: {
          200: {
            type: 'object',
            properties: {
              authEnabled: { type: 'boolean' },
              userCount: { type: 'number' },
              sessionCount: { type: 'number' },
              accountCount: { type: 'number' },
              users: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    email: { type: 'string' },
                    name: { type: 'string' },
                  },
                },
              },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      app.logger.info({}, 'Debug: Checking authentication setup');

      try {
        // Get counts from database using count aggregation
        const userResult = await app.db
          .select()
          .from(authSchema.user);

        const sessionResult = await app.db
          .select()
          .from(authSchema.session);

        const accountResult = await app.db
          .select()
          .from(authSchema.account);

        const userCount = userResult.length;
        const sessionCount = sessionResult.length;
        const accountCount = accountResult.length;

        // Get all users
        const users = await app.db
          .select({
            id: authSchema.user.id,
            email: authSchema.user.email,
            name: authSchema.user.name,
          })
          .from(authSchema.user);

        app.logger.info(
          { userCount, sessionCount, accountCount, userEmails: users.map((u) => u.email) },
          'Debug info retrieved'
        );

        return reply.code(200).send({
          authEnabled: true,
          userCount: userCount || 0,
          sessionCount: sessionCount || 0,
          accountCount: accountCount || 0,
          users,
          message: 'Authentication is properly configured',
        });
      } catch (error) {
        app.logger.error({ err: error }, 'Failed to retrieve debug info');

        return reply.code(200).send({
          authEnabled: false,
          userCount: 0,
          sessionCount: 0,
          accountCount: 0,
          users: [],
          message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }
  );
}
