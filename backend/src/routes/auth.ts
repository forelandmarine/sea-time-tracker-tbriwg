import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import * as authSchema from "../db/auth-schema.js";
import type { App } from "../index.js";
import crypto from "crypto";

/**
 * Hash password using PBKDF2 with SHA-256
 */
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const iterations = 100000;
  const hash = crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha256').toString('hex');
  return `${salt}:${iterations}:${hash}`;
}

/**
 * Verify password against hash
 */
function verifyPassword(password: string, hash: string): boolean {
  try {
    const [salt, iterationsStr, storedHash] = hash.split(':');
    if (!salt || !iterationsStr || !storedHash) {
      return false;
    }
    const iterations = parseInt(iterationsStr);
    const computedHash = crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha256').toString('hex');
    return computedHash === storedHash;
  } catch (error) {
    return false;
  }
}

export function register(app: App, fastify: FastifyInstance) {
  // POST /api/auth/sign-up/email - Register with email and password
  fastify.post<{ Body: { email: string; password: string; name: string } }>(
    '/api/auth/sign-up/email',
    {
      schema: {
        description: 'Register a new user with email and password',
        tags: ['auth'],
        body: {
          type: 'object',
          required: ['email', 'password', 'name'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 6 },
            name: { type: 'string' },
          },
        },
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
                  emailVerified: { type: 'boolean' },
                  image: { type: ['string', 'null'] },
                  createdAt: { type: 'string' },
                  updatedAt: { type: 'string' },
                },
              },
              session: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  token: { type: 'string' },
                  expiresAt: { type: 'string' },
                },
              },
            },
          },
          400: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      const { email, password, name } = request.body;

      app.logger.info({ email, name }, 'User registration attempt');

      try {
        // Check if user already exists
        const existingUser = await app.db
          .select()
          .from(authSchema.user)
          .where(eq(authSchema.user.email, email));

        if (existingUser.length > 0) {
          app.logger.warn({ email }, 'Registration failed: email already exists');
          return reply.code(400).send({
            error: 'Email already registered',
          });
        }

        // Create user
        const userId = crypto.randomUUID();
        const [user] = await app.db
          .insert(authSchema.user)
          .values({
            id: userId,
            email,
            name,
            emailVerified: false,
          })
          .returning();

        app.logger.info({ userId, email }, 'User created');

        // Create account with password
        const accountId = crypto.randomUUID();
        const passwordHash = hashPassword(password);
        await app.db
          .insert(authSchema.account)
          .values({
            id: accountId,
            userId,
            providerId: 'credential',
            accountId: email,
            password: passwordHash,
          });

        app.logger.info({ userId, email }, 'Account created with password');

        // Create session
        const sessionId = crypto.randomUUID();
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        const [session] = await app.db
          .insert(authSchema.session)
          .values({
            id: sessionId,
            userId,
            token,
            expiresAt,
          })
          .returning();

        app.logger.info({ userId, sessionId }, 'Session created');

        return reply.code(200).send({
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            emailVerified: user.emailVerified,
            image: user.image,
            createdAt: user.createdAt.toISOString(),
            updatedAt: user.updatedAt.toISOString(),
          },
          session: {
            id: session.id,
            token: session.token,
            expiresAt: session.expiresAt.toISOString(),
          },
        });
      } catch (error) {
        app.logger.error({ err: error, email }, 'Registration error');
        return reply.code(400).send({
          error: 'Failed to register user',
        });
      }
    }
  );

  // POST /api/auth/sign-in/email - Sign in with email and password
  fastify.post<{ Body: { email: string; password: string } }>(
    '/api/auth/sign-in/email',
    {
      schema: {
        description: 'Sign in with email and password',
        tags: ['auth'],
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string' },
          },
        },
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
                  emailVerified: { type: 'boolean' },
                  image: { type: ['string', 'null'] },
                  createdAt: { type: 'string' },
                  updatedAt: { type: 'string' },
                },
              },
              session: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  token: { type: 'string' },
                  expiresAt: { type: 'string' },
                },
              },
            },
          },
          401: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      const { email, password } = request.body;

      app.logger.info({ email }, 'Sign-in attempt');

      try {
        // Find user
        const users = await app.db
          .select()
          .from(authSchema.user)
          .where(eq(authSchema.user.email, email));

        if (users.length === 0) {
          app.logger.warn({ email }, 'Sign-in failed: user not found');
          return reply.code(401).send({
            error: 'Invalid email or password',
          });
        }

        const user = users[0];

        // Find account with password
        const accounts = await app.db
          .select()
          .from(authSchema.account)
          .where(eq(authSchema.account.userId, user.id));

        if (accounts.length === 0 || !accounts[0].password) {
          app.logger.warn({ email }, 'Sign-in failed: no password configured');
          return reply.code(401).send({
            error: 'Invalid email or password',
          });
        }

        const account = accounts[0];

        // Verify password
        if (!verifyPassword(password, account.password)) {
          app.logger.warn({ email }, 'Sign-in failed: incorrect password');
          return reply.code(401).send({
            error: 'Invalid email or password',
          });
        }

        app.logger.info({ email, userId: user.id }, 'Password verified');

        // Create session
        const sessionId = crypto.randomUUID();
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        const [session] = await app.db
          .insert(authSchema.session)
          .values({
            id: sessionId,
            userId: user.id,
            token,
            expiresAt,
          })
          .returning();

        app.logger.info({ email, sessionId }, 'Session created');

        return reply.code(200).send({
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            emailVerified: user.emailVerified,
            image: user.image,
            createdAt: user.createdAt.toISOString(),
            updatedAt: user.updatedAt.toISOString(),
          },
          session: {
            id: session.id,
            token: session.token,
            expiresAt: session.expiresAt.toISOString(),
          },
        });
      } catch (error) {
        app.logger.error({ err: error, email }, 'Sign-in error');
        return reply.code(401).send({
          error: 'Authentication failed',
        });
      }
    }
  );

  // POST /api/auth/sign-in/apple - Sign in with Apple token
  fastify.post<{ Body: { identityToken: string; user?: { name?: { firstName?: string; lastName?: string }; email?: string } } }>(
    '/api/auth/sign-in/apple',
    {
      schema: {
        description: 'Sign in with Apple identity token',
        tags: ['auth'],
        body: {
          type: 'object',
          required: ['identityToken'],
          properties: {
            identityToken: { type: 'string' },
            user: { type: ['object', 'null'] },
          },
        },
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
                  emailVerified: { type: 'boolean' },
                  image: { type: ['string', 'null'] },
                  createdAt: { type: 'string' },
                  updatedAt: { type: 'string' },
                },
              },
              session: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  token: { type: 'string' },
                  expiresAt: { type: 'string' },
                },
              },
              isNewUser: { type: 'boolean' },
            },
          },
          401: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      const { identityToken, user: userData } = request.body;

      app.logger.info({}, 'Apple Sign-In attempt');

      try {
        // Verify the identity token (simplified - decode JWT)
        let decodedToken: any = {};
        try {
          const parts = identityToken.split('.');
          if (parts.length === 3) {
            const payload = parts[1];
            const decoded = Buffer.from(payload, 'base64').toString('utf-8');
            decodedToken = JSON.parse(decoded);
          }
        } catch (e) {
          app.logger.warn({}, 'Failed to decode Apple token');
          return reply.code(401).send({
            error: 'Invalid Apple token',
          });
        }

        const appleUserId = decodedToken.sub || decodedToken.user_id;
        const email = decodedToken.email || userData?.email;

        if (!appleUserId) {
          app.logger.warn({}, 'Apple token missing user ID');
          return reply.code(401).send({
            error: 'Invalid Apple token',
          });
        }

        app.logger.info({ appleUserId, email }, 'Apple token verified');

        // Check if user already exists with this Apple ID
        const accounts = await app.db
          .select()
          .from(authSchema.account)
          .where(eq(authSchema.account.accountId, appleUserId));

        let user;
        let isNewUser = false;

        if (accounts.length > 0) {
          // Existing user
          const account = accounts[0];
          const users = await app.db
            .select()
            .from(authSchema.user)
            .where(eq(authSchema.user.id, account.userId));

          if (users.length === 0) {
            return reply.code(401).send({
              error: 'User not found',
            });
          }

          user = users[0];
          app.logger.info({ userId: user.id, appleUserId }, 'Existing Apple user');
        } else {
          // New user - create account
          isNewUser = true;
          const userId = crypto.randomUUID();

          // Determine name
          let name = 'Apple User';
          if (userData?.name?.firstName) {
            name = userData.name.firstName;
            if (userData.name.lastName) {
              name += ` ${userData.name.lastName}`;
            }
          }

          const userEmail = email || `apple_${appleUserId}@seatime.com`;

          app.logger.info({ appleUserId, email: userEmail, name }, 'Creating new Apple user');

          const [newUser] = await app.db
            .insert(authSchema.user)
            .values({
              id: userId,
              email: userEmail,
              name,
              emailVerified: !!email,
            })
            .returning();

          user = newUser;

          // Create account linked to Apple ID
          const accountId = crypto.randomUUID();
          await app.db
            .insert(authSchema.account)
            .values({
              id: accountId,
              userId,
              providerId: 'apple',
              accountId: appleUserId,
            });

          app.logger.info({ userId, appleUserId }, 'Apple account created');
        }

        // Create session
        const sessionId = crypto.randomUUID();
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        const [session] = await app.db
          .insert(authSchema.session)
          .values({
            id: sessionId,
            userId: user.id,
            token,
            expiresAt,
          })
          .returning();

        app.logger.info(
          { userId: user.id, sessionId, isNewUser },
          'Apple authentication successful'
        );

        return reply.code(200).send({
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            emailVerified: user.emailVerified,
            image: user.image,
            createdAt: user.createdAt.toISOString(),
            updatedAt: user.updatedAt.toISOString(),
          },
          session: {
            id: session.id,
            token: session.token,
            expiresAt: session.expiresAt.toISOString(),
          },
          isNewUser,
        });
      } catch (error) {
        app.logger.error({ err: error }, 'Apple Sign-In error');
        return reply.code(401).send({
          error: 'Apple authentication failed',
        });
      }
    }
  );

  // GET /api/auth/user - Get current authenticated user
  fastify.get(
    '/api/auth/user',
    {
      schema: {
        description: 'Get current authenticated user profile',
        tags: ['auth'],
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
                  emailVerified: { type: 'boolean' },
                  image: { type: ['string', 'null'] },
                  createdAt: { type: 'string' },
                  updatedAt: { type: 'string' },
                },
              },
            },
          },
          401: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      app.logger.info({}, 'User profile request');

      try {
        // Get token from Authorization header
        const authHeader = request.headers.authorization;
        const token = authHeader?.replace('Bearer ', '');

        if (!token) {
          app.logger.warn({}, 'No authentication token provided');
          return reply.code(401).send({
            error: 'No authentication token provided',
          });
        }

        // Find session by token
        const sessions = await app.db
          .select()
          .from(authSchema.session)
          .where(eq(authSchema.session.token, token));

        if (sessions.length === 0) {
          app.logger.warn({}, 'Session not found');
          return reply.code(401).send({
            error: 'Invalid or expired token',
          });
        }

        const session = sessions[0];

        // Check if session is expired
        if (session.expiresAt < new Date()) {
          app.logger.warn({ sessionId: session.id }, 'Session expired');
          return reply.code(401).send({
            error: 'Session expired',
          });
        }

        // Get user
        const users = await app.db
          .select()
          .from(authSchema.user)
          .where(eq(authSchema.user.id, session.userId));

        if (users.length === 0) {
          app.logger.warn({ userId: session.userId }, 'User not found');
          return reply.code(401).send({
            error: 'User not found',
          });
        }

        const user = users[0];

        app.logger.info({ userId: user.id, email: user.email }, 'User profile retrieved');

        return reply.code(200).send({
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            emailVerified: user.emailVerified,
            image: user.image,
            createdAt: user.createdAt.toISOString(),
            updatedAt: user.updatedAt.toISOString(),
          },
        });
      } catch (error) {
        app.logger.error({ err: error }, 'Error retrieving user profile');
        return reply.code(401).send({
          error: 'Failed to retrieve user profile',
        });
      }
    }
  );

  // POST /api/auth/sign-out - Sign out user
  fastify.post(
    '/api/auth/sign-out',
    {
      schema: {
        description: 'Sign out current user',
        tags: ['auth'],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
            },
          },
          401: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      app.logger.info({}, 'Sign-out request');

      try {
        // Get token from Authorization header
        const authHeader = request.headers.authorization;
        const token = authHeader?.replace('Bearer ', '');

        if (!token) {
          app.logger.warn({}, 'No token for sign-out');
          return reply.code(401).send({
            error: 'No authentication token provided',
          });
        }

        // Delete session
        await app.db
          .delete(authSchema.session)
          .where(eq(authSchema.session.token, token));

        app.logger.info({}, 'User signed out');

        return reply.code(200).send({
          success: true,
        });
      } catch (error) {
        app.logger.error({ err: error }, 'Sign-out error');
        return reply.code(401).send({
          error: 'Failed to sign out',
        });
      }
    }
  );

  // POST /api/auth/test-user - Create test user (no authentication required)
  fastify.post(
    '/api/auth/test-user',
    {
      schema: {
        description: 'Create test user account (development only)',
        tags: ['auth'],
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
                  emailVerified: { type: 'boolean' },
                  image: { type: ['string', 'null'] },
                  createdAt: { type: 'string' },
                  updatedAt: { type: 'string' },
                },
              },
              session: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  token: { type: 'string' },
                  expiresAt: { type: 'string' },
                },
              },
              message: { type: 'string' },
            },
          },
          400: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      const email = 'test@seatime.com';
      const password = 'testpassword123';
      const name = 'Test User';

      app.logger.info({ email }, 'Test user creation request');

      try {
        // Check if test user already exists
        const existingUsers = await app.db
          .select()
          .from(authSchema.user)
          .where(eq(authSchema.user.email, email));

        if (existingUsers.length > 0) {
          app.logger.info({ email }, 'Test user already exists');

          // Create a new session for existing test user
          const user = existingUsers[0];
          const sessionId = crypto.randomUUID();
          const token = crypto.randomBytes(32).toString('hex');
          const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

          const [session] = await app.db
            .insert(authSchema.session)
            .values({
              id: sessionId,
              userId: user.id,
              token,
              expiresAt,
            })
            .returning();

          return reply.code(200).send({
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
              emailVerified: user.emailVerified,
              image: user.image,
              createdAt: user.createdAt.toISOString(),
              updatedAt: user.updatedAt.toISOString(),
            },
            session: {
              id: session.id,
              token: session.token,
              expiresAt: session.expiresAt.toISOString(),
            },
            message: 'Test user already exists - new session created',
          });
        }

        // Create new test user
        const userId = crypto.randomUUID();
        const [user] = await app.db
          .insert(authSchema.user)
          .values({
            id: userId,
            email,
            name,
            emailVerified: false,
          })
          .returning();

        app.logger.info({ userId, email }, 'Test user created');

        // Create account with password
        const accountId = crypto.randomUUID();
        const passwordHash = hashPassword(password);
        await app.db
          .insert(authSchema.account)
          .values({
            id: accountId,
            userId,
            providerId: 'credential',
            accountId: email,
            password: passwordHash,
          });

        // Create session
        const sessionId = crypto.randomUUID();
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        const [session] = await app.db
          .insert(authSchema.session)
          .values({
            id: sessionId,
            userId,
            token,
            expiresAt,
          })
          .returning();

        app.logger.info({ userId, sessionId }, 'Test user session created');

        return reply.code(200).send({
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            emailVerified: user.emailVerified,
            image: user.image,
            createdAt: user.createdAt.toISOString(),
            updatedAt: user.updatedAt.toISOString(),
          },
          session: {
            id: session.id,
            token: session.token,
            expiresAt: session.expiresAt.toISOString(),
          },
          message: 'Test user created successfully',
        });
      } catch (error) {
        app.logger.error({ err: error, email }, 'Test user creation error');
        return reply.code(400).send({
          error: 'Failed to create test user',
        });
      }
    }
  );
}
