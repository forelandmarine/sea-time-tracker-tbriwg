import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { eq } from "drizzle-orm";
import * as schema from "../db/schema.js";
import type { App } from "../index.js";

export function register(app: App, fastify: FastifyInstance) {
  // GET /api/vessels - Return all vessels
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
              created_at: { type: 'string' },
            },
          },
        },
      },
    },
  }, async () => {
    return app.db.select().from(schema.vessels);
  });

  // POST /api/vessels - Create vessel with mmsi and vessel_name
  fastify.post<{ Body: { mmsi: string; vessel_name: string } }>('/api/vessels', {
    schema: {
      description: 'Create a new vessel',
      tags: ['vessels'],
      body: {
        type: 'object',
        required: ['mmsi', 'vessel_name'],
        properties: {
          mmsi: { type: 'string' },
          vessel_name: { type: 'string' },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            mmsi: { type: 'string' },
            vessel_name: { type: 'string' },
            created_at: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { mmsi, vessel_name } = request.body;

    // Check if MMSI already exists
    const existing = await app.db
      .select()
      .from(schema.vessels)
      .where(eq(schema.vessels.mmsi, mmsi));

    if (existing.length > 0) {
      return reply.code(409).send({ error: 'MMSI already exists' });
    }

    const [vessel] = await app.db
      .insert(schema.vessels)
      .values({ mmsi, vessel_name })
      .returning();

    return reply.code(201).send(vessel);
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

    return reply.code(200).send({ id: deleted.id });
  });
}
