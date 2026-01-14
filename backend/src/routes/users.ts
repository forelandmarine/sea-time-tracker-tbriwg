import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import * as crypto from "crypto";
import { promisify } from "util";
import * as authSchema from "../db/auth-schema.js";
import type { App } from "../index.js";

const scrypt = promisify(crypto.scrypt);

// Hash password using scrypt (same algorithm Better Auth uses)
async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = (await scrypt(password, salt, 32)) as Buffer;
  return `${derivedKey.toString('hex')}.${salt}`;
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

      app.logger.info({ email, name }, 'Creating test user account');

      try {
        // Check if user already exists
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

        // Hash the password using scrypt
        const hashedPassword = await hashPassword(password);

        // Create user in Better Auth user table
        const userId = crypto.randomUUID();
        const now = new Date();

        const [newUser] = await app.db
          .insert(authSchema.user)
          .values({
            id: userId,
            name,
            email,
            emailVerified: false,
            createdAt: now,
            updatedAt: now,
          })
          .returning();

        // Create account record with hashed password for credential provider
        await app.db
          .insert(authSchema.account)
          .values({
            id: crypto.randomUUID(),
            accountId: email,
            providerId: 'credential',
            userId: userId,
            password: hashedPassword,
            createdAt: now,
            updatedAt: now,
          });

        app.logger.info(
          { userId: newUser.id, email, name },
          'Test user account created successfully'
        );

        return reply.code(201).send({
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          message: 'User account created successfully',
        });
      } catch (error) {
        app.logger.error(
          { err: error, email, name },
          'Failed to create test user account'
        );

        // Check if it's a duplicate email error
        if (error instanceof Error && error.message.includes('unique')) {
          return reply.code(409).send({
            error: `User with email ${email} already exists`,
          });
        }

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
}
