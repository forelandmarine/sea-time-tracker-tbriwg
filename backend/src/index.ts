/**
 * SeaTime Tracker Backend
 *
 * Public API without authentication
 *
 * Required Environment Variables:
 * - DATABASE_URL: PostgreSQL connection string (Neon in production, PGlite locally)
 * - MYSHIPTRACKING_API_KEY: API key for MyShipTracking AIS vessel tracking
 *
 * Core Endpoints:
 * - Vessel Management: GET/POST /api/vessels, GET/PUT /api/vessels/:id
 * - AIS Tracking: POST /api/ais/check/:vesselId, GET /api/ais/:vesselId/history
 * - Sea Time Entries: GET/POST /api/sea-time, PUT /api/sea-time/:id/confirm
 * - Reports: GET /api/reports/sea-time-summary
 * - Tracking: GET /api/tracking/vessel/:vesselId
 */

import { createApplication } from "@specific-dev/framework";
import * as appSchema from './db/schema.js';

// Import route registration functions
import * as vesselsRoutes from './routes/vessels.js';
import * as aisRoutes from './routes/ais.js';
import * as seaTimeRoutes from './routes/sea-time.js';
import * as reportsRoutes from './routes/reports.js';
import * as trackingRoutes from './routes/tracking.js';

// Import scheduler service
import { startScheduler } from './services/scheduler.js';

// Create application with app schema only (no auth)
export const app = await createApplication(appSchema);

// Configure CORS for all origins (public API)
app.fastify.addHook('onRequest', async (request, reply) => {
  const origin = request.headers.origin;

  // Allow all origins for public API
  reply.header('Access-Control-Allow-Origin', origin || '*');
  reply.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS,PATCH,HEAD');
  reply.header('Access-Control-Allow-Headers', 'Content-Type,X-Requested-With,Accept');
  reply.header('Access-Control-Max-Age', '3600');

  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    reply.code(200).send();
  }
});

// Log all API requests
app.fastify.addHook('onRequest', async (request) => {
  app.logger.info({
    method: request.method,
    path: request.url,
  }, 'API request');
});

// Verify database connection on startup
app.fastify.addHook('onReady', async () => {
  app.logger.info('Application ready - verifying database connection');

  try {
    // Test database connection by querying vessels table
    const vessels = await app.db.select().from(appSchema.vessels);
    app.logger.info({ vesselCount: vessels.length }, 'Database connection verified');
  } catch (error) {
    app.logger.warn({ err: error }, 'Database connection test failed - will attempt to connect on first query');
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
