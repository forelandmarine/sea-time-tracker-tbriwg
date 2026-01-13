import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import * as schema from "../db/schema.js";
import type { App } from "../index.js";

export function register(app: App, fastify: FastifyInstance) {
  // GET /api/vessels - Return all vessels with is_active field
  fastify.get('/api/vessels', {
    schema: {
      description: 'Get all vessels',
      tags: ['vessels'],
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              mmsi: { type: 'string' },
              vessel_name: { type: 'string' },
              is_active: { type: 'boolean' },
              created_at: { type: 'string' },
            },
          },
        },
      },
    },
  }, async () => {
    return app.db.select().from(schema.vessels);
  });

  // POST /api/vessels - Create vessel with mmsi, vessel_name, and optional is_active
  fastify.post<{ Body: { mmsi: string; vessel_name: string; is_active?: boolean } }>('/api/vessels', {
    schema: {
      description: 'Create a new vessel. If is_active=true, deactivates all other vessels.',
      tags: ['vessels'],
      body: {
        type: 'object',
        required: ['mmsi', 'vessel_name'],
        properties: {
          mmsi: { type: 'string' },
          vessel_name: { type: 'string' },
          is_active: { type: 'boolean', default: false },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            mmsi: { type: 'string' },
            vessel_name: { type: 'string' },
            is_active: { type: 'boolean' },
            created_at: { type: 'string' },
          },
        },
        409: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request, reply) => {
    const { mmsi, vessel_name, is_active = false } = request.body;

    // Check if MMSI already exists
    const existing = await app.db
      .select()
      .from(schema.vessels)
      .where(eq(schema.vessels.mmsi, mmsi));

    if (existing.length > 0) {
      return reply.code(409).send({ error: 'MMSI already exists' });
    }

    // If creating as active, deactivate all others
    if (is_active) {
      await app.db
        .update(schema.vessels)
        .set({ is_active: false })
        .where(eq(schema.vessels.is_active, true));

      app.logger.info('Deactivated all other vessels for new active vessel');
    }

    const [vessel] = await app.db
      .insert(schema.vessels)
      .values({ mmsi, vessel_name, is_active })
      .returning();

    if (is_active) {
      app.logger.info(`Created and activated new vessel: ${vessel.id} (${vessel_name})`);
    }

    return reply.code(201).send(vessel);
  });

  // PUT /api/vessels/:id/activate - Activate specified vessel and deactivate all others
  fastify.put<{ Params: { id: string } }>('/api/vessels/:id/activate', {
    schema: {
      description: 'Activate a vessel and deactivate all others',
      tags: ['vessels'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            mmsi: { type: 'string' },
            vessel_name: { type: 'string' },
            is_active: { type: 'boolean' },
            created_at: { type: 'string' },
          },
        },
        404: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;

    // Check if vessel exists
    const vessel = await app.db
      .select()
      .from(schema.vessels)
      .where(eq(schema.vessels.id, id));

    if (vessel.length === 0) {
      return reply.code(404).send({ error: 'Vessel not found' });
    }

    // Deactivate all other vessels
    await app.db
      .update(schema.vessels)
      .set({ is_active: false })
      .where(eq(schema.vessels.is_active, true));

    // Activate the specified vessel
    const [activated] = await app.db
      .update(schema.vessels)
      .set({ is_active: true })
      .where(eq(schema.vessels.id, id))
      .returning();

    app.logger.info(`Activated vessel: ${activated.id} (${activated.vessel_name})`);

    return reply.code(200).send(activated);
  });

  // DELETE /api/vessels/:id - Delete vessel
  fastify.delete<{ Params: { id: string } }>('/api/vessels/:id', {
    schema: {
      description: 'Delete a vessel',
      tags: ['vessels'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      },
      response: {
        200: { type: 'object', properties: { id: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;

    const [deleted] = await app.db
      .delete(schema.vessels)
      .where(eq(schema.vessels.id, id))
      .returning();

    if (!deleted) {
      return reply.code(404).send({ error: 'Vessel not found' });
    }

    app.logger.info(`Deleted vessel: ${deleted.id}`);

    return reply.code(200).send({ id: deleted.id });
  });
}
