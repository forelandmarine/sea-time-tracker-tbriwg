import { createApplication } from "@specific-dev/framework";
import * as schema from './db/schema.js';

// Import route registration functions
import * as vesselsRoutes from './routes/vessels.js';
import * as aisRoutes from './routes/ais.js';
import * as seaTimeRoutes from './routes/sea-time.js';
import * as reportsRoutes from './routes/reports.js';

// Create application with schema for full database type support
export const app = await createApplication(schema);

// Export App type for use in route files
export type App = typeof app;

// Register routes - add your route modules here
// IMPORTANT: Always use registration functions to avoid circular dependency issues
vesselsRoutes.register(app, app.fastify);
aisRoutes.register(app, app.fastify);
seaTimeRoutes.register(app, app.fastify);
reportsRoutes.register(app, app.fastify);

// Log API configuration status
const aisApiKey = process.env.MYSHIPTRACKING_API_KEY;
if (aisApiKey) {
  app.logger.info('MyShipTracking API key configured');
} else {
  app.logger.warn('MyShipTracking API key not configured - AIS tracking will fail. Set MYSHIPTRACKING_API_KEY environment variable');
}

await app.run();
app.logger.info('Application running');
