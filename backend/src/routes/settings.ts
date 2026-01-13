import type { FastifyInstance } from "fastify";
import { desc, eq } from "drizzle-orm";
import * as schema from "../db/schema.js";
import type { App } from "../index.js";

export function register(app: App, fastify: FastifyInstance) {
  // GET /api/settings/api - Return current API configuration status
  fastify.get('/api/settings/api', {
    schema: {
      description: 'Get current API configuration status',
      tags: ['settings'],
      response: {
        200: {
          type: 'object',
          properties: {
            apiKeyConfigured: { type: 'boolean' },
            apiUrl: { type: 'string' },
            lastUpdated: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const settings = await app.db
      .select()
      .from(schema.api_settings)
      .orderBy(desc(schema.api_settings.updated_at))
      .limit(1);

    const apiKeyConfigured = settings.length > 0 && !!settings[0].api_key;
    const lastUpdated = settings.length > 0 ? settings[0].updated_at : new Date();

    return reply.code(200).send({
      apiKeyConfigured,
      apiUrl: 'https://api.myshiptracking.com/v1',
      lastUpdated,
    });
  });

  // POST /api/settings/api - Update API key configuration
  fastify.post<{ Body: { apiKey: string } }>('/api/settings/api', {
    schema: {
      description: 'Update MyShipTracking API key',
      tags: ['settings'],
      body: {
        type: 'object',
        required: ['apiKey'],
        properties: {
          apiKey: { type: 'string', description: 'MyShipTracking API key' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            lastUpdated: { type: 'string', format: 'date-time' },
          },
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request, reply) => {
    const { apiKey } = request.body;

    if (!apiKey) {
      return reply.code(400).send({ error: 'API key is required' });
    }

    const appWideUrl = 'https://api.myshiptracking.com/v1';

    // Get existing settings
    const existing = await app.db
      .select()
      .from(schema.api_settings)
      .orderBy(desc(schema.api_settings.updated_at))
      .limit(1);

    let result;
    const now = new Date();

    if (existing.length > 0) {
      // Update existing settings
      const [updated] = await app.db
        .update(schema.api_settings)
        .set({
          api_key: apiKey,
          api_url: appWideUrl,
          updated_at: now,
        })
        .where(eq(schema.api_settings.id, existing[0].id))
        .returning();

      result = updated;
    } else {
      // Create new settings
      const [created] = await app.db
        .insert(schema.api_settings)
        .values({
          api_key: apiKey,
          api_url: appWideUrl,
        })
        .returning();

      result = created;
    }

    app.logger.info('API key configuration updated');

    return reply.code(200).send({
      success: true,
      message: 'API key configured successfully',
      lastUpdated: result.updated_at,
    });
  });
}
