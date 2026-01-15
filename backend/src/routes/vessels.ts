import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import * as schema from "../db/schema.js";
import * as authSchema from "../db/auth-schema.js";
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
              flag: { type: ['string', 'null'] },
              official_number: { type: ['string', 'null'] },
              type: { type: ['string', 'null'] },
              length_metres: { type: ['string', 'null'] },
              gross_tonnes: { type: ['string', 'null'] },
              is_active: { type: 'boolean' },
              created_at: { type: 'string' },
              updated_at: { type: 'string' },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    app.logger.info({}, 'Fetching all vessels');
    const vessels = await app.db.select().from(schema.vessels);
    app.logger.info({ count: vessels.length }, 'Vessels fetched');
    return vessels;
  });

  // POST /api/vessels - Create vessel with mmsi, vessel_name, and optional additional details
  fastify.post<{
    Body: {
      mmsi: string;
      vessel_name: string;
      flag?: string;
      official_number?: string;
      type?: string;
      length_metres?: number;
      gross_tonnes?: number;
      is_active?: boolean;
    }
  }>('/api/vessels', {
    schema: {
      description: 'Create a new vessel with complete vessel information. If is_active=true, deactivates all other vessels.',
      tags: ['vessels'],
      body: {
        type: 'object',
        required: ['mmsi', 'vessel_name'],
        properties: {
          mmsi: { type: 'string' },
          vessel_name: { type: 'string' },
          flag: { type: 'string' },
          official_number: { type: 'string' },
          type: { type: 'string', enum: ['Motor', 'Sail'] },
          length_metres: { type: 'number' },
          gross_tonnes: { type: 'number' },
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
            flag: { type: ['string', 'null'] },
            official_number: { type: ['string', 'null'] },
            type: { type: ['string', 'null'] },
            length_metres: { type: ['string', 'null'] },
            gross_tonnes: { type: ['string', 'null'] },
            is_active: { type: 'boolean' },
            created_at: { type: 'string' },
            updated_at: { type: 'string' },
          },
        },
        409: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request, reply) => {
    const {
      mmsi,
      vessel_name,
      flag,
      official_number,
      type,
      length_metres,
      gross_tonnes,
      is_active = false,
    } = request.body;

    app.logger.info(
      { mmsi, vessel_name, flag, official_number, type, length_metres, gross_tonnes },
      'Creating new vessel'
    );

    // Check if MMSI already exists
    const existing = await app.db
      .select()
      .from(schema.vessels)
      .where(eq(schema.vessels.mmsi, mmsi));

    if (existing.length > 0) {
      app.logger.warn({ mmsi }, 'MMSI already exists');
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
      .values({
        mmsi,
        vessel_name,
        flag,
        official_number,
        type,
        length_metres: length_metres ? String(length_metres) : null,
        gross_tonnes: gross_tonnes ? String(gross_tonnes) : null,
        is_active,
      })
      .returning();

    app.logger.info(
      { vesselId: vessel.id, mmsi, vessel_name, is_active },
      'Vessel created successfully'
    );

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
            flag: { type: ['string', 'null'] },
            official_number: { type: ['string', 'null'] },
            type: { type: ['string', 'null'] },
            length_metres: { type: ['string', 'null'] },
            gross_tonnes: { type: ['string', 'null'] },
            is_active: { type: 'boolean' },
            created_at: { type: 'string' },
            updated_at: { type: 'string' },
          },
        },
        404: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;

    app.logger.info({ vesselId: id }, 'Activating vessel');

    // Check if vessel exists
    const vessel = await app.db
      .select()
      .from(schema.vessels)
      .where(eq(schema.vessels.id, id));

    if (vessel.length === 0) {
      app.logger.warn({ vesselId: id }, 'Vessel not found for activation');
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

    app.logger.info(
      { vesselId: activated.id, vesselName: activated.vessel_name },
      'Vessel activated successfully'
    );

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

    app.logger.info({ vesselId: id }, 'Deleting vessel');

    const [deleted] = await app.db
      .delete(schema.vessels)
      .where(eq(schema.vessels.id, id))
      .returning();

    if (!deleted) {
      app.logger.warn({ vesselId: id }, 'Vessel not found for deletion');
      return reply.code(404).send({ error: 'Vessel not found' });
    }

    app.logger.info(
      { vesselId: deleted.id, vesselName: deleted.vessel_name },
      'Vessel deleted successfully'
    );

    return reply.code(200).send({ id: deleted.id });
  });

  // PUT /api/vessels/:id - Update vessel details
  fastify.put<{
    Params: { id: string };
    Body: {
      vessel_name?: string;
      flag?: string;
      official_number?: string;
      type?: string;
      length_metres?: number;
      gross_tonnes?: number;
    }
  }>('/api/vessels/:id', {
    schema: {
      description: 'Update vessel information',
      tags: ['vessels'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      body: {
        type: 'object',
        properties: {
          vessel_name: { type: 'string' },
          flag: { type: 'string' },
          official_number: { type: 'string' },
          type: { type: 'string', enum: ['Motor', 'Sail'] },
          length_metres: { type: 'number' },
          gross_tonnes: { type: 'number' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            mmsi: { type: 'string' },
            vessel_name: { type: 'string' },
            flag: { type: ['string', 'null'] },
            official_number: { type: ['string', 'null'] },
            type: { type: ['string', 'null'] },
            length_metres: { type: ['string', 'null'] },
            gross_tonnes: { type: ['string', 'null'] },
            is_active: { type: 'boolean' },
            created_at: { type: 'string' },
            updated_at: { type: 'string' },
          },
        },
        404: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const {
      vessel_name,
      flag,
      official_number,
      type,
      length_metres,
      gross_tonnes,
    } = request.body;

    app.logger.info({ vesselId: id }, 'Updating vessel');

    // Check if vessel exists
    const vessel = await app.db
      .select()
      .from(schema.vessels)
      .where(eq(schema.vessels.id, id));

    if (vessel.length === 0) {
      app.logger.warn({ vesselId: id }, 'Vessel not found for update');
      return reply.code(404).send({ error: 'Vessel not found' });
    }

    const updateData: Record<string, any> = { updated_at: new Date() };
    if (vessel_name !== undefined) updateData.vessel_name = vessel_name;
    if (flag !== undefined) updateData.flag = flag;
    if (official_number !== undefined) updateData.official_number = official_number;
    if (type !== undefined) updateData.type = type;
    if (length_metres !== undefined) updateData.length_metres = length_metres ? String(length_metres) : null;
    if (gross_tonnes !== undefined) updateData.gross_tonnes = gross_tonnes ? String(gross_tonnes) : null;

    const [updated] = await app.db
      .update(schema.vessels)
      .set(updateData)
      .where(eq(schema.vessels.id, id))
      .returning();

    app.logger.info(
      { vesselId: updated.id, vesselName: updated.vessel_name },
      'Vessel updated successfully'
    );

    return reply.code(200).send(updated);
  });

  // PUT /api/vessels/:id/particulars - Update vessel particulars (authenticated)
  fastify.put<{
    Params: { id: string };
    Body: {
      flag?: string;
      official_number?: string;
      type?: string;
      length_metres?: number;
      gross_tonnes?: number;
    };
  }>(
    '/api/vessels/:id/particulars',
    {
      schema: {
        description: 'Update vessel particulars (flag, official number, type, length, gross tonnes). Requires authentication.',
        tags: ['vessels'],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string' } },
        },
        body: {
          type: 'object',
          properties: {
            flag: { type: 'string' },
            official_number: { type: 'string' },
            type: { type: 'string', enum: ['Motor', 'Sail'] },
            length_metres: { type: 'number' },
            gross_tonnes: { type: 'number' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              mmsi: { type: 'string' },
              vessel_name: { type: 'string' },
              flag: { type: ['string', 'null'] },
              official_number: { type: ['string', 'null'] },
              type: { type: ['string', 'null'] },
              length_metres: { type: ['string', 'null'] },
              gross_tonnes: { type: ['string', 'null'] },
              is_active: { type: 'boolean' },
              created_at: { type: 'string' },
              updated_at: { type: 'string' },
            },
          },
          400: { type: 'object', properties: { error: { type: 'string' } } },
          401: { type: 'object', properties: { error: { type: 'string' } } },
          404: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { flag, official_number, type, length_metres, gross_tonnes } = request.body;

      app.logger.info({ vesselId: id }, 'Updating vessel particulars');

      // Get token from Authorization header
      const authHeader = request.headers.authorization;
      const token = authHeader?.replace('Bearer ', '');

      if (!token) {
        app.logger.warn({ vesselId: id }, 'Vessel particulars update without authentication');
        return reply.code(401).send({ error: 'Authentication required' });
      }

      // Find user session
      const sessions = await app.db
        .select()
        .from(authSchema.session)
        .where(eq(authSchema.session.token, token));

      if (sessions.length === 0) {
        app.logger.warn({ vesselId: id }, 'Invalid token for vessel particulars update');
        return reply.code(401).send({ error: 'Invalid or expired token' });
      }

      const session = sessions[0];

      // Check if session is expired
      if (session.expiresAt < new Date()) {
        app.logger.warn({ vesselId: id, sessionId: session.id }, 'Session expired for vessel particulars update');
        return reply.code(401).send({ error: 'Session expired' });
      }

      // Verify at least one field is provided for update
      if (flag === undefined && official_number === undefined && type === undefined &&
          length_metres === undefined && gross_tonnes === undefined) {
        app.logger.warn({ vesselId: id }, 'Vessel particulars update with no fields to update');
        return reply.code(400).send({ error: 'At least one field must be provided for update' });
      }

      // Check if vessel exists
      const vessel = await app.db
        .select()
        .from(schema.vessels)
        .where(eq(schema.vessels.id, id));

      if (vessel.length === 0) {
        app.logger.warn({ vesselId: id }, 'Vessel not found for particulars update');
        return reply.code(404).send({ error: 'Vessel not found' });
      }

      // Build update data with only provided fields
      const updateData: Record<string, any> = { updated_at: new Date() };
      if (flag !== undefined) updateData.flag = flag;
      if (official_number !== undefined) updateData.official_number = official_number;
      if (type !== undefined) updateData.type = type;
      if (length_metres !== undefined) updateData.length_metres = length_metres ? String(length_metres) : null;
      if (gross_tonnes !== undefined) updateData.gross_tonnes = gross_tonnes ? String(gross_tonnes) : null;

      // Update vessel
      const [updated] = await app.db
        .update(schema.vessels)
        .set(updateData)
        .where(eq(schema.vessels.id, id))
        .returning();

      app.logger.info(
        { vesselId: updated.id, vesselName: updated.vessel_name, updatedFields: Object.keys(updateData).filter(k => k !== 'updated_at') },
        'Vessel particulars updated successfully'
      );

      return reply.code(200).send(updated);
    }
  );
}
