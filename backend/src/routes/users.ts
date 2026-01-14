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
}
