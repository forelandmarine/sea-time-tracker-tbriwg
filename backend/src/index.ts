import { createApplication } from "@specific-dev/framework";
import * as schema from './db/schema.js';

// Import route registration functions
import * as vesselsRoutes from './routes/vessels.js';
import * as aisRoutes from './routes/ais.js';
import * as seaTimeRoutes from './routes/sea-time.js';
import * as reportsRoutes from './routes/reports.js';
import * as settingsRoutes from './routes/settings.js';

// Create application with schema for full database type support
export const app = await createApplication(schema);

// Export App type for use in route files
export type App = typeof app;

// Register routes - add your route modules here
// IMPORTANT: Always use registration functions to avoid circular dependency issues
settingsRoutes.register(app, app.fastify);
vesselsRoutes.register(app, app.fastify);
aisRoutes.register(app, app.fastify);
seaTimeRoutes.register(app, app.fastify);
reportsRoutes.register(app, app.fastify);

await app.run();
app.logger.info('Application running');
