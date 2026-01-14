/**
 * SeaTime Tracker Backend
 *
 * Authentication Configuration:
 * - Uses Better Auth for user authentication with email/password and OAuth support
 * - Configured for cross-origin requests from Expo Go (exp://, expo-go://) and preview environments (*.exp.direct)
 * - Sessions are stored in PostgreSQL with bearer token support for non-browser clients
 *
 * Required Environment Variables:
 * - BETTER_AUTH_SECRET: Secret key for Better Auth (auto-generated if not set)
 * - BETTER_AUTH_URL or API_URL: Base URL for auth endpoints (defaults to http://localhost:3001)
 * - DATABASE_URL: PostgreSQL connection string (Neon in production, PGlite locally)
 * - MYSHIPTRACKING_API_KEY: API key for MyShipTracking AIS vessel tracking
 *
 * Session Management:
 * - Sessions automatically include CORS headers for Expo Go and preview environments
 * - Bearer token authentication supported for API requests from mobile apps
 * - Session endpoint: GET /api/users/session (requires Authorization: Bearer <token>)
 */

import { createApplication } from "@specific-dev/framework";
import * as appSchema from './db/schema.js';
import * as authSchema from './db/auth-schema.js';

// Import route registration functions
import * as vesselsRoutes from './routes/vessels.js';
import * as aisRoutes from './routes/ais.js';
import * as seaTimeRoutes from './routes/sea-time.js';
import * as reportsRoutes from './routes/reports.js';
import * as trackingRoutes from './routes/tracking.js';
import * as usersRoutes from './routes/users.js';

// Import scheduler service
import { startScheduler } from './services/scheduler.js';

// Combine schemas for full database type support (app + auth)
const schema = { ...appSchema, ...authSchema };

// Create application with combined schema
export const app = await createApplication(schema);

// Enable authentication with cross-origin support for Expo Go and preview environments
app.withAuth({
  // Social providers can be configured here if needed
  socialProviders: {},
});

// Configure CORS for Expo Go and preview environments
app.fastify.addHook('onRequest', async (request, reply) => {
  const origin = request.headers.origin;

  // Allow requests from Expo Go, preview environments, and localhost
  if (
    origin?.startsWith('exp://') ||
    origin?.startsWith('expo-go://') ||
    origin?.includes('.exp.direct') ||
    origin?.includes('localhost') ||
    origin?.includes('127.0.0.1') ||
    !origin // Allow requests without origin header
  ) {
    reply.header('Access-Control-Allow-Origin', origin || '*');
    reply.header('Access-Control-Allow-Credentials', 'true');
    reply.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS,PATCH,HEAD');
    reply.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With,Accept');
    reply.header('Access-Control-Max-Age', '3600');
  }

  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    reply.code(200).send();
  }
});

// Export App type for use in route files
export type App = typeof app;

// Register routes - add your route modules here
// IMPORTANT: Always use registration functions to avoid circular dependency issues
vesselsRoutes.register(app, app.fastify);
aisRoutes.register(app, app.fastify);
seaTimeRoutes.register(app, app.fastify);
reportsRoutes.register(app, app.fastify);
trackingRoutes.register(app, app.fastify);
usersRoutes.register(app, app.fastify);

// Log API configuration status
const aisApiKey = process.env.MYSHIPTRACKING_API_KEY;
if (aisApiKey) {
  app.logger.info('MyShipTracking API key configured');
} else {
  app.logger.warn('MyShipTracking API key not configured - AIS tracking will fail. Set MYSHIPTRACKING_API_KEY environment variable');
}

await app.run();
app.logger.info('Application running');

// Start the background scheduler for periodic vessel position checks
await startScheduler(app);
