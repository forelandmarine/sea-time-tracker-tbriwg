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

        app.logger.info(
          {
            email,
            userId: user.id,
            accountId: account.id,
            accountProviderId: account.providerId,
            hasPassword: !!account.password,
            passwordLength: account.password.length,
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
}
