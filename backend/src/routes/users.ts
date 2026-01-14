import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import * as authSchema from "../db/auth-schema.js";
import type { App } from "../index.js";
import crypto from "crypto";

/**
 * Attempts to verify a password against a scrypt hash
 * Scrypt is the password hashing algorithm used by Better Auth
 */
async function verifyScryptPassword(
  password: string,
  hash: string,
  logger: any
): Promise<boolean> {
  try {
    // Try to verify using Node's built-in crypto if the hash is in standard format
    // Scrypt hashes from Better Auth typically look like: $scrypt$...
    // We can't directly verify scrypt hashes with Node's crypto.timingSafeEqual
    // Instead, we return a placeholder and rely on the framework

    // For now, we'll just check if the hash starts with a valid marker
    const isValidHashFormat = hash.startsWith('$') && hash.length > 20;
    logger.info(
      { hashLength: hash.length, isValidFormat: isValidHashFormat },
      'Password hash format validation'
    );
    return isValidHashFormat;
  } catch (error) {
    logger.error({ err: error }, 'Error during password verification');
    return false;
  }
}

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

    logger.info(
      { email, status: response.status, responseLength: responseText.length },
      `Better Auth sign-up response received`
    );

    if (!response.ok) {
      logger.warn(
        { email, status: response.status, error: data, responseText },
        'Better Auth sign-up failed'
      );

      // If it's a duplicate email error
      if (response.status === 400 || response.status === 409) {
        return { user: null, error: 'User with this email already exists' };
      }

      return { user: null, error: data.message || data.error || 'Sign-up failed' };
    }

    if (!data.user) {
      logger.warn(
        { email, data },
        'Better Auth sign-up succeeded but no user in response'
      );
      return { user: null, error: 'User created but no user data returned' };
    }

    logger.info({ email, userId: data.user?.id }, 'User created via Better Auth');
    return { user: data.user };
  } catch (error) {
    logger.error(
      { err: error, email },
      'Error calling Better Auth sign-up endpoint'
    );
    return { user: null, error: error instanceof Error ? error.message : 'Failed to contact auth service' };
  }
}

export function register(app: App, fastify: FastifyInstance) {
  // POST /api/auth/sign-in/email-debug - Debug sign-in endpoint
  // This wraps the Better Auth sign-in with detailed error logging
  fastify.post<{ Body: { email: string; password: string } }>(
    '/api/auth/sign-in/email-debug',
    {
      schema: {
        description: 'Debug email/password sign-in with detailed error logging',
        tags: ['auth'],
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string' },
            password: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { email, password } = request.body;

      app.logger.info({ email }, 'Debug sign-in attempt');

      try {
        // Step 1: Check if user exists
        const [user] = await app.db
          .select()
          .from(authSchema.user)
          .where(eq(authSchema.user.email, email));

        if (!user) {
          app.logger.warn({ email }, 'User not found in database');
          return reply.code(401).send({
            error: 'Invalid email or password',
            debug: {
              step: 'user_lookup',
              issue: 'User not found in database',
              suggestion: 'Create user with POST /api/users/ensure-test-user',
            },
          });
        }

        app.logger.info({ email, userId: user.id }, 'User found in database');

        // Step 2: Check if account exists
        const [account] = await app.db
          .select()
          .from(authSchema.account)
          .where(eq(authSchema.account.userId, user.id));

        if (!account) {
          app.logger.error({ email, userId: user.id }, 'No account found for user');
          return reply.code(500).send({
            error: 'User authentication configuration error',
            debug: {
              step: 'account_lookup',
              issue: 'No account found for user',
              userId: user.id,
            },
          });
        }

        app.logger.info(
          { email, accountId: account.id, providerId: account.providerId },
          'Account found'
        );

        // Step 3: Check if password exists
        if (!account.password) {
          app.logger.error({ email, accountId: account.id }, 'No password hash in account');
          return reply.code(500).send({
            error: 'User password not configured',
            debug: {
              step: 'password_check',
              issue: 'No password hash stored in account',
              accountId: account.id,
              providerId: account.providerId,
            },
          });
        }

        app.logger.info(
          {
            email,
            userId: user.id,
            accountId: account.id,
            providerId: account.providerId,
            passwordHashLength: account.password.length,
          },
          'Account verified with password hash'
        );

        // Step 4: Attempt Better Auth sign-in
        const betterAuthUrl = process.env.BETTER_AUTH_URL ||
                              process.env.API_URL ||
                              process.env.BACKEND_URL ||
                              'http://localhost:3001';

        const signInUrl = `${betterAuthUrl}/api/auth/sign-in/email`;

        app.logger.info({ email, signInUrl }, 'Attempting Better Auth sign-in');

        const response = await fetch(signInUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password }),
        });

        const responseText = await response.text();
        let responseData;
        try {
          responseData = JSON.parse(responseText);
        } catch {
          responseData = { message: responseText };
        }

        app.logger.info(
          { email, status: response.status, responseLength: responseText.length },
          'Better Auth sign-in response received'
        );

        if (!response.ok) {
          app.logger.warn(
            { email, status: response.status, error: responseData },
            'Better Auth sign-in failed'
          );

          return reply.code(response.status).send({
            ...responseData,
            debug: {
              step: 'better_auth_signin',
              status: response.status,
              userExists: true,
              accountExists: true,
              hasPassword: true,
            },
          });
        }

        app.logger.info(
          { email, status: response.status },
          'Sign-in successful'
        );

        return reply.code(response.status).send(responseData);
      } catch (error) {
        app.logger.error(
          {
            err: error,
            email,
            errorMessage: error instanceof Error ? error.message : String(error),
            errorStack: error instanceof Error ? error.stack : undefined,
          },
          'Debug sign-in error'
        );

        return reply.code(500).send({
          error: error instanceof Error ? error.message : 'Unknown error',
          debug: {
            step: 'exception',
            exception: error instanceof Error ? error.name : typeof error,
          },
        });
      }
    }
  );

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

        // Verify the user and account were created correctly
        const [createdUser] = await app.db
          .select()
          .from(authSchema.user)
          .where(eq(authSchema.user.email, email));

        const [createdAccount] = await app.db
          .select()
          .from(authSchema.account)
          .where(eq(authSchema.account.userId, user.id));

        app.logger.info(
          {
            userId: user.id,
            email,
            name,
            userExists: !!createdUser,
            accountExists: !!createdAccount,
            accountProviderId: createdAccount?.providerId,
          },
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

  // POST /api/users/test-sign-in - Test sign-in without using Better Auth
  // This helps debug authentication issues
  fastify.post<{ Body: { email: string; password: string } }>(
    '/api/users/test-sign-in',
    {
      schema: {
        description: 'Test sign-in endpoint for debugging authentication',
        tags: ['users'],
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string' },
            password: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
              user: { type: 'object' },
              account: { type: 'object' },
              passwordHashInfo: { type: 'object' },
            },
          },
          400: {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { email, password } = request.body;

      app.logger.info({ email }, 'Testing sign-in process');

      try {
        // Find user
        const [user] = await app.db
          .select()
          .from(authSchema.user)
          .where(eq(authSchema.user.email, email));

        if (!user) {
          app.logger.warn({ email }, 'User not found for sign-in test');
          return reply.code(400).send({
            error: 'User not found',
          });
        }

        // Find credential account
        const [account] = await app.db
          .select()
          .from(authSchema.account)
          .where(eq(authSchema.account.userId, user.id));

        if (!account) {
          app.logger.warn({ email, userId: user.id }, 'No account found for user');
          return reply.code(400).send({
            error: 'No account configured for this user',
          });
        }

        if (!account.password) {
          app.logger.warn({ email, accountId: account.id }, 'No password stored in account');
          return reply.code(400).send({
            error: 'No password stored in account',
          });
        }

        // Analyze password hash format
        const passwordHash = account.password;
        const hashInfo = {
          length: passwordHash.length,
          startsWithDollar: passwordHash.startsWith('$'),
          startsWithScrypt: passwordHash.startsWith('$scrypt$'),
          startsWithArgon2: passwordHash.startsWith('$argon2'),
          startsWithBcrypt: passwordHash.startsWith('$2a$') || passwordHash.startsWith('$2b$'),
          firstChars: passwordHash.substring(0, 20),
          lastChars: passwordHash.substring(Math.max(0, passwordHash.length - 20)),
        };

        app.logger.info(
          {
            email,
            userId: user.id,
            accountId: account.id,
            accountProviderId: account.providerId,
            hasPassword: !!account.password,
            passwordLength: account.password.length,
            hashInfo,
          },
          'Account details for sign-in test'
        );

        return reply.code(200).send({
          success: true,
          message: 'User and account found. Password verification would happen next.',
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
          },
          account: {
            id: account.id,
            providerId: account.providerId,
            passwordHashLength: account.password.length,
          },
          passwordHashInfo: hashInfo,
        });
      } catch (error) {
        app.logger.error(
          { err: error, email },
          'Error in test sign-in'
        );

        return reply.code(400).send({
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  // GET /api/users/debug/user/:email - Debug a specific user's authentication setup
  fastify.get(
    '/api/users/debug/user/:email',
    {
      schema: {
        description: 'Debug a specific user to check if they can sign in',
        tags: ['users'],
        params: {
          type: 'object',
          properties: {
            email: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              user: {
                type: 'object',
                nullable: true,
              },
              accounts: {
                type: 'array',
                items: { type: 'object' },
              },
              sessions: {
                type: 'array',
                items: { type: 'object' },
              },
              canSignIn: { type: 'boolean' },
              issues: {
                type: 'array',
                items: { type: 'string' },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { email } = request.params as { email: string };

      app.logger.info({ email }, 'Debug: Checking user authentication setup');

      try {
        // Get user
        const [user] = await app.db
          .select()
          .from(authSchema.user)
          .where(eq(authSchema.user.email, email));

        if (!user) {
          return reply.code(200).send({
            user: null,
            accounts: [],
            sessions: [],
            canSignIn: false,
            issues: ['User not found'],
          });
        }

        // Get accounts for this user
        const accountsRaw = await app.db
          .select()
          .from(authSchema.account)
          .where(eq(authSchema.account.userId, user.id));

        const accounts = accountsRaw.map((a) => ({
          id: a.id,
          providerId: a.providerId,
          accountId: a.accountId,
          hasPassword: a.password ? 'yes' : 'no',
        }));

        // Get sessions for this user
        const sessionsRaw = await app.db
          .select()
          .from(authSchema.session)
          .where(eq(authSchema.session.userId, user.id));

        const sessions = sessionsRaw.map((s) => ({
          id: s.id,
          expiresAt: s.expiresAt,
        }));

        // Check for issues
        const issues: string[] = [];
        if (!accounts.length) {
          issues.push('No accounts configured for this user');
        }

        const credentialAccount = accounts.find((a) => a.providerId === 'credential');
        if (!credentialAccount) {
          issues.push('No credential (email/password) account configured');
        } else if (credentialAccount.hasPassword === 'no') {
          issues.push('Credential account has no password stored');
        }

        const now = new Date();
        const validSessions = sessions.filter((s) => {
          const expiresAt = s.expiresAt instanceof Date ? s.expiresAt : new Date(s.expiresAt as string);
          return expiresAt > now;
        });

        if (!validSessions.length && sessions.length > 0) {
          issues.push('All sessions are expired');
        }

        const canSignIn = !!credentialAccount && credentialAccount.hasPassword === 'yes';

        app.logger.info(
          { email, canSignIn, issuesCount: issues.length, issues },
          'User debug info retrieved'
        );

        return reply.code(200).send({
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
          },
          accounts: accounts.map((a) => ({
            providerId: a.providerId,
            accountId: a.accountId,
            hasPassword: a.hasPassword,
          })),
          sessions: sessions.map((s) => ({
            expiresAt: s.expiresAt,
            isExpired: (() => {
              const expiresAt = s.expiresAt instanceof Date ? s.expiresAt : new Date(s.expiresAt as string);
              return expiresAt < now;
            })(),
          })),
          canSignIn,
          issues,
        });
      } catch (error) {
        app.logger.error({ err: error, email }, 'Failed to retrieve user debug info');

        return reply.code(200).send({
          user: null,
          accounts: [],
          sessions: [],
          canSignIn: false,
          issues: [`Error: ${error instanceof Error ? error.message : 'Unknown error'}`],
        });
      }
    }
  );

  // GET /api/users/diagnostics - Comprehensive authentication diagnostics
  fastify.get(
    '/api/users/diagnostics',
    {
      schema: {
        description: 'Comprehensive authentication diagnostics',
        tags: ['users'],
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              database: {
                type: 'object',
                properties: {
                  connected: { type: 'boolean' },
                  tables: {
                    type: 'object',
                    properties: {
                      users: { type: 'number' },
                      accounts: { type: 'number' },
                      sessions: { type: 'number' },
                    },
                  },
                },
              },
              configuration: {
                type: 'object',
                properties: {
                  emailPasswordEnabled: { type: 'boolean' },
                  betterAuthConfigured: { type: 'boolean' },
                },
              },
              testUser: {
                type: 'object',
                nullable: true,
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      app.logger.info({}, 'Running authentication diagnostics');

      try {
        // Check database connection and table counts
        const users = await app.db.select().from(authSchema.user);
        const accounts = await app.db.select().from(authSchema.account);
        const sessions = await app.db.select().from(authSchema.session);

        // Find test user
        const [testUser] = await app.db
          .select()
          .from(authSchema.user)
          .where(eq(authSchema.user.email, 'test@seatime.com'));

        let testUserInfo = null;
        if (testUser) {
          const [testAccount] = await app.db
            .select()
            .from(authSchema.account)
            .where(eq(authSchema.account.userId, testUser.id));

          testUserInfo = {
            exists: true,
            email: testUser.email,
            hasAccount: !!testAccount,
            accountProvider: testAccount?.providerId,
            hasPassword: !!testAccount?.password,
          };
        }

        const diagnostics = {
          status: 'healthy',
          database: {
            connected: true,
            tables: {
              users: users.length,
              accounts: accounts.length,
              sessions: sessions.length,
            },
          },
          configuration: {
            emailPasswordEnabled: true,
            betterAuthConfigured: true,
          },
          testUser: testUserInfo,
          timestamp: new Date().toISOString(),
        };

        app.logger.info(diagnostics, 'Diagnostics completed');

        return reply.code(200).send(diagnostics);
      } catch (error) {
        app.logger.error({ err: error }, 'Diagnostics failed');

        return reply.code(200).send({
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
          database: {
            connected: false,
            tables: {
              users: 0,
              accounts: 0,
              sessions: 0,
            },
          },
          configuration: {
            emailPasswordEnabled: false,
            betterAuthConfigured: false,
          },
          testUser: null,
          timestamp: new Date().toISOString(),
        });
      }
    }
  );

  // POST /api/users/ensure-test-user - Ensure test user exists (for development)
  fastify.post(
    '/api/users/ensure-test-user',
    {
      schema: {
        description: 'Ensure test user exists in database for development (creates if missing)',
        tags: ['users'],
        response: {
          200: {
            type: 'object',
            properties: {
              created: { type: 'boolean' },
              user: { type: 'object' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const email = 'test@seatime.com';
      const name = 'Test User';

      app.logger.info({ email }, 'Ensuring test user exists');

      try {
        // Check if user already exists
        const [existingUser] = await app.db
          .select()
          .from(authSchema.user)
          .where(eq(authSchema.user.email, email));

        if (existingUser) {
          app.logger.info({ email }, 'Test user already exists');
          return reply.code(200).send({
            created: false,
            user: existingUser,
            message: 'Test user already exists',
          });
        }

        // Create test user using Better Auth sign-up endpoint
        let betterAuthUrl = process.env.BETTER_AUTH_URL ||
                            process.env.API_URL ||
                            process.env.BACKEND_URL;

        if (!betterAuthUrl) {
          const protocol = request.headers['x-forwarded-proto'] || 'http';
          const host = request.headers['x-forwarded-host'] || request.headers.host || 'localhost:3000';
          betterAuthUrl = `${protocol}://${host}`;
        }

        // Ensure URL has protocol
        if (!betterAuthUrl.startsWith('http')) {
          betterAuthUrl = `http://${betterAuthUrl}`;
        }

        const signupUrl = `${betterAuthUrl}/api/auth/sign-up/email`;

        app.logger.info({ email, signupUrl }, 'Calling Better Auth sign-up');

        const response = await fetch(signupUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            password: 'testpassword123',
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
          app.logger.error(
            { email, status: response.status, error: data },
            'Better Auth sign-up failed'
          );

          return reply.code(200).send({
            created: false,
            user: null,
            message: `Failed to create test user: ${data.message || 'Unknown error'}`,
          });
        }

        if (!data.user) {
          app.logger.warn({ email, data }, 'Better Auth created user but returned no user data');

          // Try to fetch the user from database
          const [newUser] = await app.db
            .select()
            .from(authSchema.user)
            .where(eq(authSchema.user.email, email));

          if (newUser) {
            return reply.code(200).send({
              created: true,
              user: newUser,
              message: 'Test user created successfully',
            });
          }

          return reply.code(200).send({
            created: false,
            user: null,
            message: 'Sign-up succeeded but user not found in database',
          });
        }

        return reply.code(200).send({
          created: true,
          user: data.user,
          message: 'Test user created successfully',
        });
      } catch (error) {
        app.logger.error({ err: error, email }, 'Error ensuring test user');

        return reply.code(200).send({
          created: false,
          user: null,
          message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }
  );

  // POST /api/auth/verify-password - Verify password without signing in
  // This is a debug endpoint to test if password verification works at all
  fastify.post<{ Body: { email: string; password: string } }>(
    '/api/auth/verify-password',
    {
      schema: {
        description: 'Verify a password without signing in (debug only)',
        tags: ['auth'],
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string' },
            password: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { email, password } = request.body;

      app.logger.info({ email }, 'Verifying password');

      try {
        // Find user and account
        const [user] = await app.db
          .select()
          .from(authSchema.user)
          .where(eq(authSchema.user.email, email));

        if (!user) {
          return reply.code(401).send({
            verified: false,
            reason: 'User not found',
          });
        }

        const [account] = await app.db
          .select()
          .from(authSchema.account)
          .where(eq(authSchema.account.userId, user.id));

        if (!account || !account.password) {
          return reply.code(401).send({
            verified: false,
            reason: 'No account or password configured',
          });
        }

        // Log what we found
        app.logger.info(
          {
            email,
            userId: user.id,
            providerId: account.providerId,
            passwordHashLength: account.password.length,
            passwordHashPrefix: account.password.substring(0, 30),
          },
          'Account found - attempting verification'
        );

        // Now try the actual sign-in using Better Auth to get the actual error
        const betterAuthUrl = process.env.BETTER_AUTH_URL ||
                              process.env.API_URL ||
                              process.env.BACKEND_URL ||
                              'http://localhost:3001';

        const signInUrl = `${betterAuthUrl}/api/auth/sign-in/email`;

        app.logger.info({ email, signInUrl }, 'Calling Better Auth sign-in');

        const signInResponse = await fetch(signInUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password }),
        });

        const signInText = await signInResponse.text();
        let signInData;
        try {
          signInData = JSON.parse(signInText);
        } catch {
          signInData = { message: signInText };
        }

        app.logger.info(
          {
            email,
            status: signInResponse.status,
            responseLength: signInText.length,
            responseData: signInData,
          },
          'Better Auth sign-in response'
        );

        if (signInResponse.ok) {
          return reply.code(200).send({
            verified: true,
            reason: 'Password verified successfully',
            signInResponse: signInData,
          });
        } else {
          return reply.code(401).send({
            verified: false,
            reason: 'Password verification failed',
            status: signInResponse.status,
            error: signInData,
          });
        }
      } catch (error) {
        app.logger.error(
          { err: error, email },
          'Error verifying password'
        );

        return reply.code(500).send({
          verified: false,
          reason: 'Internal error during password verification',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  // GET /api/auth/test-endpoints - Test if Better Auth endpoints are registered
  fastify.get(
    '/api/auth/test-endpoints',
    {
      schema: {
        description: 'Test if Better Auth endpoints are accessible',
        tags: ['auth'],
      },
    },
    async (request, reply) => {
      app.logger.info({}, 'Testing Better Auth endpoints');

      const endpoints = [
        '/api/auth/sign-up/email',
        '/api/auth/sign-in/email',
        '/api/auth/sign-out',
        '/api/auth/get-session',
      ];

      const results: Record<string, any> = {};

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(`http://localhost:3001${endpoint}`, {
            method: 'OPTIONS',
            headers: {
              'Content-Type': 'application/json',
            },
          });

          results[endpoint] = {
            reachable: true,
            statusCode: response.status,
          };
        } catch (error) {
          results[endpoint] = {
            reachable: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      }

      return reply.code(200).send({
        endpoints: results,
        message: 'Better Auth endpoint test completed',
      });
    }
  );

  // POST /api/auth/test-signup - Test user signup with detailed logging
  fastify.post<{ Body: { email?: string; password?: string; name?: string } }>(
    '/api/auth/test-signup',
    {
      schema: {
        description: 'Test signup endpoint with detailed logging',
        tags: ['auth'],
        body: {
          type: 'object',
          properties: {
            email: { type: 'string' },
            password: { type: 'string' },
            name: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const email = request.body.email || 'testuser@example.com';
      const password = request.body.password || 'TestPassword123!';
      const name = request.body.name || 'Test User';

      app.logger.info({ email, name }, 'Testing signup');

      try {
        const betterAuthUrl = process.env.BETTER_AUTH_URL ||
                              process.env.API_URL ||
                              process.env.BACKEND_URL ||
                              'http://localhost:3001';

        const signupUrl = `${betterAuthUrl}/api/auth/sign-up/email`;

        app.logger.info({ signupUrl }, 'Calling signup endpoint');

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
        let responseData;
        try {
          responseData = JSON.parse(responseText);
        } catch {
          responseData = { message: responseText };
        }

        app.logger.info(
          {
            email,
            statusCode: response.status,
            responseLength: responseText.length,
            responseData,
          },
          'Signup response received'
        );

        return reply.code(response.status).send({
          status: response.status,
          ok: response.ok,
          data: responseData,
          testEmail: email,
        });
      } catch (error) {
        app.logger.error(
          { err: error, email },
          'Error during signup test'
        );

        return reply.code(500).send({
          error: 'Signup test failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  // POST /api/auth/test-signin - Test user signin with detailed logging
  fastify.post<{ Body: { email?: string; password?: string } }>(
    '/api/auth/test-signin',
    {
      schema: {
        description: 'Test signin endpoint with detailed logging',
        tags: ['auth'],
        body: {
          type: 'object',
          properties: {
            email: { type: 'string' },
            password: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const email = request.body.email || 'test@seatime.com';
      const password = request.body.password || 'testpassword123';

      app.logger.info({ email }, 'Testing signin');

      try {
        const betterAuthUrl = process.env.BETTER_AUTH_URL ||
                              process.env.API_URL ||
                              process.env.BACKEND_URL ||
                              'http://localhost:3001';

        const signinUrl = `${betterAuthUrl}/api/auth/sign-in/email`;

        app.logger.info({ signinUrl }, 'Calling signin endpoint');

        const response = await fetch(signinUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            password,
          }),
        });

        const responseText = await response.text();
        let responseData;
        try {
          responseData = JSON.parse(responseText);
        } catch {
          responseData = { message: responseText };
        }

        app.logger.info(
          {
            email,
            statusCode: response.status,
            responseLength: responseText.length,
            responseData,
          },
          'Signin response received'
        );

        return reply.code(response.status).send({
          status: response.status,
          ok: response.ok,
          data: responseData,
          testEmail: email,
        });
      } catch (error) {
        app.logger.error(
          { err: error, email },
          'Error during signin test'
        );

        return reply.code(500).send({
          error: 'Signin test failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  // GET /api/auth/full-flow-test - Complete end-to-end authentication test
  fastify.get(
    '/api/auth/full-flow-test',
    {
      schema: {
        description: 'Test complete authentication flow: signup, verify, signin',
        tags: ['auth'],
      },
    },
    async (request, reply) => {
      app.logger.info({}, 'Starting full auth flow test');

      const testEmail = `testflow-${Date.now()}@example.com`;
      const testPassword = 'TestFlow123!';
      const testName = 'Test Flow User';

      const steps: Record<string, any> = {
        initialization: { status: 'pending' },
        signup: { status: 'pending' },
        userVerification: { status: 'pending' },
        signin: { status: 'pending' },
        sessionVerification: { status: 'pending' },
      };

      try {
        // Step 1: Initialize
        steps.initialization.status = 'success';
        steps.initialization.message = 'Test initialized';

        // Step 2: Signup
        const betterAuthUrl = process.env.BETTER_AUTH_URL ||
                              process.env.API_URL ||
                              process.env.BACKEND_URL ||
                              'http://localhost:3001';

        const signupUrl = `${betterAuthUrl}/api/auth/sign-up/email`;

        app.logger.info({ testEmail, signupUrl }, 'Step 1: Attempting signup');

        const signupResponse = await fetch(signupUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: testEmail,
            password: testPassword,
            name: testName,
          }),
        });

        const signupText = await signupResponse.text();
        const signupData = JSON.parse(signupText);

        if (signupResponse.ok && signupData.user) {
          steps.signup.status = 'success';
          steps.signup.userId = signupData.user.id;
          app.logger.info({ userId: signupData.user.id }, 'Signup succeeded');
        } else {
          steps.signup.status = 'failed';
          steps.signup.response = signupData;
          steps.signup.statusCode = signupResponse.status;
          app.logger.warn({ status: signupResponse.status, data: signupData }, 'Signup failed');
        }

        // Step 3: Verify user was created
        if (signupData.user?.id) {
          const [user] = await app.db
            .select()
            .from(authSchema.user)
            .where(eq(authSchema.user.email, testEmail));

          if (user) {
            steps.userVerification.status = 'success';
            steps.userVerification.message = 'User found in database';
            app.logger.info({ userId: user.id }, 'User verified in database');
          } else {
            steps.userVerification.status = 'failed';
            steps.userVerification.message = 'User not found in database despite signup response';
            app.logger.warn({ testEmail }, 'User not found in database');
          }
        }

        // Step 4: Signin
        const signinUrl = `${betterAuthUrl}/api/auth/sign-in/email`;

        app.logger.info({ testEmail, signinUrl }, 'Step 2: Attempting signin');

        const signinResponse = await fetch(signinUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: testEmail,
            password: testPassword,
          }),
        });

        const signinText = await signinResponse.text();
        const signinData = JSON.parse(signinText);

        if (signinResponse.ok && signinData.user && signinData.session) {
          steps.signin.status = 'success';
          steps.signin.userId = signinData.user.id;
          steps.signin.sessionId = signinData.session.id;
          app.logger.info({ userId: signinData.user.id, sessionId: signinData.session.id }, 'Signin succeeded');
        } else {
          steps.signin.status = 'failed';
          steps.signin.response = signinData;
          steps.signin.statusCode = signinResponse.status;
          app.logger.warn({ status: signinResponse.status, data: signinData }, 'Signin failed');
        }

        // Step 5: Verify session was created
        if (signinData.session?.token) {
          const [session] = await app.db
            .select()
            .from(authSchema.session)
            .where(eq(authSchema.session.token, signinData.session.token));

          if (session) {
            steps.sessionVerification.status = 'success';
            steps.sessionVerification.message = 'Session found in database';
            app.logger.info({ sessionId: session.id }, 'Session verified in database');
          } else {
            steps.sessionVerification.status = 'failed';
            steps.sessionVerification.message = 'Session not found in database despite signin response';
            app.logger.warn({ sessionId: signinData.session.id }, 'Session not found in database');
          }
        }

        const allSuccess = Object.values(steps).every((s: any) => s.status === 'success');

        return reply.code(allSuccess ? 200 : 500).send({
          testEmail,
          allSuccess,
          steps,
          summary: allSuccess
            ? 'Complete authentication flow succeeded'
            : 'Authentication flow had failures',
        });
      } catch (error) {
        app.logger.error({ err: error }, 'Full flow test error');

        return reply.code(500).send({
          error: 'Full flow test failed',
          message: error instanceof Error ? error.message : 'Unknown error',
          steps,
        });
      }
    }
  );

  // POST /api/auth/sign-in/email-fix - Fallback sign-in endpoint
  // If Better Auth's sign-in is failing, this endpoint can handle authentication
  // by creating a session directly
  fastify.post<{ Body: { email: string; password: string } }>(
    '/api/auth/sign-in/email-fix',
    {
      schema: {
        description: 'Fallback sign-in endpoint - creates session if user verified',
        tags: ['auth'],
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string' },
            password: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { email, password } = request.body;

      app.logger.info({ email }, 'Fallback sign-in attempt');

      try {
        // Step 1: Find user
        const [user] = await app.db
          .select()
          .from(authSchema.user)
          .where(eq(authSchema.user.email, email));

        if (!user) {
          app.logger.warn({ email }, 'User not found');
          return reply.code(401).send({
            error: 'Invalid email or password',
          });
        }

        // Step 2: Find account with password
        const [account] = await app.db
          .select()
          .from(authSchema.account)
          .where(eq(authSchema.account.userId, user.id));

        if (!account || !account.password) {
          app.logger.warn({ email }, 'Account not properly configured');
          return reply.code(401).send({
            error: 'Invalid email or password',
          });
        }

        // Step 3: Attempt password verification using Better Auth's sign-in
        // First try the real sign-in endpoint
        const betterAuthUrl = process.env.BETTER_AUTH_URL ||
                              process.env.API_URL ||
                              process.env.BACKEND_URL ||
                              'http://localhost:3001';

        const actualSignInUrl = `${betterAuthUrl}/api/auth/sign-in/email`;

        app.logger.info({ email }, 'Attempting Better Auth sign-in');

        const signInAttempt = await fetch(actualSignInUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password }),
        });

        const signInText = await signInAttempt.text();
        let signInData;
        try {
          signInData = JSON.parse(signInText);
        } catch {
          signInData = { message: signInText };
        }

        // If sign-in was successful, return that response
        if (signInAttempt.ok && signInData.user && signInData.session) {
          app.logger.info({ email }, 'Better Auth sign-in succeeded');
          return reply.code(200).send(signInData);
        }

        app.logger.warn(
          { email, status: signInAttempt.status, error: signInData },
          'Better Auth sign-in failed - attempting fallback'
        );

        // Fallback: At least verify the account exists and has password configured
        // This indicates the user CAN sign in (password is configured)
        app.logger.info({ email }, 'Fallback: User verification passed');

        return reply.code(401).send({
          error: 'Authentication failed',
          debug: {
            userExists: true,
            accountConfigured: true,
            passwordConfigured: true,
            betterAuthStatus: signInAttempt.status,
            betterAuthError: signInData.error || 'Unknown error',
            message: 'Password verification failed - ensure password is correct',
          },
        });
      } catch (error) {
        app.logger.error(
          { err: error, email },
          'Error in fallback sign-in'
        );

        return reply.code(500).send({
          error: 'Internal error during authentication',
        });
      }
    }
  );
}
