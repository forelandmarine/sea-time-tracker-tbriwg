import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import * as schema from "../db/schema.js";
import * as authSchema from "../db/auth-schema.js";
import type { App } from "../index.js";
import { extractUserIdFromRequest, verifyVesselOwnership } from "../middleware/auth.js";

// Helper function to ensure a scheduled task exists for a vessel
async function ensureScheduledTask(app: App, vesselId: string, userId: string): Promise<void> {
  try {
    // Check if a scheduled task already exists for this vessel
    const existingTask = await app.db
      .select()
      .from(schema.scheduled_tasks)
      .where(eq(schema.scheduled_tasks.vessel_id, vesselId));

    if (existingTask.length > 0) {
      app.logger.debug({ vesselId }, 'Scheduled task already exists for vessel');
      return;
    }

    // Create a new scheduled task for the vessel
    const now = new Date();
    const [newTask] = await app.db
      .insert(schema.scheduled_tasks)
      .values({
        user_id: userId,
        task_type: 'ais_check',
        vessel_id: vesselId,
        interval_hours: '4',
        is_active: true,
        next_run: now,
        last_run: null,
      })
      .returning();

    app.logger.info(
      { vesselId, taskId: newTask.id, interval: '4 hours' },
      'Created scheduled task for vessel'
    );
  } catch (error) {
    app.logger.error(
      { err: error, vesselId },
      'Failed to create scheduled task for vessel'
    );
  }
}

// Helper function to transform vessel object for API response
function transformVesselForResponse(vessel: any) {
  return {
    id: vessel.id,
    mmsi: vessel.mmsi,
    vessel_name: vessel.vessel_name,
    callsign: vessel.callsign,
    flag: vessel.flag,
    official_number: vessel.official_number,
    vessel_type: vessel.type, // Map 'type' database field to 'vessel_type' in API response
    length_metres: vessel.length_metres,
    gross_tonnes: vessel.gross_tonnes,
    is_active: vessel.is_active,
    created_at: vessel.created_at,
    updated_at: vessel.updated_at,
  };
}

export function register(app: App, fastify: FastifyInstance) {
  // GET /api/vessels - Return all vessels for authenticated user
  fastify.get('/api/vessels', {
    schema: {
      description: 'Get all vessels (requires authentication)',
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
              callsign: { type: ['string', 'null'] },
              flag: { type: ['string', 'null'] },
              official_number: { type: ['string', 'null'] },
              vessel_type: { type: ['string', 'null'] },
              length_metres: { type: ['string', 'null'] },
              gross_tonnes: { type: ['string', 'null'] },
              is_active: { type: 'boolean' },
              created_at: { type: 'string' },
              updated_at: { type: 'string' },
            },
          },
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request, reply) => {
    const userId = await extractUserIdFromRequest(request, app);
    if (!userId) {
      app.logger.warn({}, 'Vessel list requested without authentication');
      return reply.code(401).send({ error: 'Authentication required' });
    }

    app.logger.info({ userId }, 'Fetching vessels for user');
    const vessels = await app.db
      .select()
      .from(schema.vessels)
      .where(eq(schema.vessels.user_id, userId));
    app.logger.info({ userId, count: vessels.length }, 'Vessels fetched');
    return vessels.map(transformVesselForResponse);
  });

  // POST /api/vessels - Create vessel with mmsi, vessel_name, and optional additional details
  fastify.post<{
    Body: {
      mmsi: string;
      vessel_name: string;
      callsign?: string;
      flag?: string;
      official_number?: string;
      type?: string;
      length_metres?: number;
      gross_tonnes?: number;
      is_active?: boolean;
    }
  }>('/api/vessels', {
    schema: {
      description: 'Create a new vessel with complete vessel information. If is_active=true, deactivates all other vessels. (Requires authentication)',
      tags: ['vessels'],
      body: {
        type: 'object',
        required: ['mmsi', 'vessel_name'],
        properties: {
          mmsi: { type: 'string' },
          vessel_name: { type: 'string' },
          callsign: { type: 'string' },
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
            callsign: { type: ['string', 'null'] },
            flag: { type: ['string', 'null'] },
            official_number: { type: ['string', 'null'] },
            vessel_type: { type: ['string', 'null'] },
            length_metres: { type: ['string', 'null'] },
            gross_tonnes: { type: ['string', 'null'] },
            is_active: { type: 'boolean' },
            created_at: { type: 'string' },
            updated_at: { type: 'string' },
          },
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        409: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request, reply) => {
    const userId = await extractUserIdFromRequest(request, app);
    if (!userId) {
      app.logger.warn({}, 'Vessel creation requested without authentication');
      return reply.code(401).send({ error: 'Authentication required' });
    }

    const {
      mmsi,
      vessel_name,
      callsign,
      flag,
      official_number,
      type,
      length_metres,
      gross_tonnes,
      is_active = false,
    } = request.body;

    app.logger.info(
      { userId, mmsi, vessel_name, flag, official_number, type, length_metres, gross_tonnes },
      'Creating new vessel'
    );

    // Check if MMSI already exists for this user
    const existing = await app.db
      .select()
      .from(schema.vessels)
      .where(eq(schema.vessels.mmsi, mmsi));

    if (existing.length > 0) {
      app.logger.warn({ mmsi }, 'MMSI already exists');
      return reply.code(409).send({ error: 'MMSI already exists' });
    }

    // If creating as active, deactivate all others for this user
    if (is_active) {
      await app.db
        .update(schema.vessels)
        .set({ is_active: false })
        .where(eq(schema.vessels.user_id, userId));

      app.logger.info({ userId }, 'Deactivated all other vessels for new active vessel');
    }

    const [vessel] = await app.db
      .insert(schema.vessels)
      .values({
        user_id: userId,
        mmsi,
        vessel_name,
        callsign,
        flag,
        official_number,
        type,
        length_metres: length_metres ? String(length_metres) : null,
        gross_tonnes: gross_tonnes ? String(gross_tonnes) : null,
        is_active,
      })
      .returning();

    app.logger.info(
      { vesselId: vessel.id, userId, mmsi, vessel_name, callsign, is_active },
      'Vessel created successfully'
    );

    // Create scheduled task if vessel is active
    if (is_active) {
      await ensureScheduledTask(app, vessel.id, userId);
    }

    return reply.code(201).send(transformVesselForResponse(vessel));
  });

  // PUT /api/vessels/:id/activate - Activate specified vessel and deactivate all others
  fastify.put<{ Params: { id: string } }>('/api/vessels/:id/activate', {
    schema: {
      description: 'Activate a vessel and deactivate all others (requires authentication)',
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
            callsign: { type: ['string', 'null'] },
            flag: { type: ['string', 'null'] },
            official_number: { type: ['string', 'null'] },
            vessel_type: { type: ['string', 'null'] },
            length_metres: { type: ['string', 'null'] },
            gross_tonnes: { type: ['string', 'null'] },
            is_active: { type: 'boolean' },
            created_at: { type: 'string' },
            updated_at: { type: 'string' },
          },
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        403: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request, reply) => {
    const userId = await extractUserIdFromRequest(request, app);
    if (!userId) {
      app.logger.warn({}, 'Vessel activation requested without authentication');
      return reply.code(401).send({ error: 'Authentication required' });
    }

    const { id } = request.params;

    app.logger.info({ userId, vesselId: id }, 'Activating vessel');

    // Check if vessel exists and belongs to user
    const vessel = await app.db
      .select()
      .from(schema.vessels)
      .where(eq(schema.vessels.id, id));

    if (vessel.length === 0) {
      app.logger.warn({ userId, vesselId: id }, 'Vessel not found for activation');
      return reply.code(404).send({ error: 'Vessel not found' });
    }

    // Verify ownership
    if (vessel[0].user_id !== userId) {
      app.logger.warn({ userId, vesselId: id }, 'Unauthorized vessel activation attempt');
      return reply.code(403).send({ error: 'Not authorized to activate this vessel' });
    }

    // Deactivate all other vessels for this user
    await app.db
      .update(schema.vessels)
      .set({ is_active: false })
      .where(eq(schema.vessels.user_id, userId));

    // Activate the specified vessel
    const [activated] = await app.db
      .update(schema.vessels)
      .set({ is_active: true })
      .where(eq(schema.vessels.id, id))
      .returning();

    app.logger.info(
      { userId, vesselId: activated.id, vesselName: activated.vessel_name },
      'Vessel activated successfully'
    );

    // Create scheduled task for activated vessel
    await ensureScheduledTask(app, activated.id, userId);

    return reply.code(200).send(transformVesselForResponse(activated));
  });

  // DELETE /api/vessels/:id - Delete vessel (requires authentication and ownership)
  fastify.delete<{ Params: { id: string } }>('/api/vessels/:id', {
    schema: {
      description: 'Delete a vessel (requires authentication)',
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
        401: { type: 'object', properties: { error: { type: 'string' } } },
        403: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request, reply) => {
    const userId = await extractUserIdFromRequest(request, app);
    if (!userId) {
      app.logger.warn({}, 'Vessel deletion requested without authentication');
      return reply.code(401).send({ error: 'Authentication required' });
    }

    const { id } = request.params;

    app.logger.info({ userId, vesselId: id }, 'Deleting vessel');

    // Check ownership first
    const isOwner = await verifyVesselOwnership(app, id, userId);
    if (!isOwner) {
      app.logger.warn({ userId, vesselId: id }, 'Unauthorized vessel deletion attempt');
      return reply.code(403).send({ error: 'Not authorized to delete this vessel' });
    }

    const [deleted] = await app.db
      .delete(schema.vessels)
      .where(eq(schema.vessels.id, id))
      .returning();

    if (!deleted) {
      app.logger.warn({ vesselId: id }, 'Vessel not found for deletion');
      return reply.code(404).send({ error: 'Vessel not found' });
    }

    app.logger.info(
      { userId, vesselId: deleted.id, vesselName: deleted.vessel_name },
      'Vessel deleted successfully'
    );

    return reply.code(200).send({ id: deleted.id });
  });

  // PUT /api/vessels/:id - Update vessel details
  fastify.put<{
    Params: { id: string };
    Body: {
      vessel_name?: string;
      callsign?: string;
      flag?: string;
      official_number?: string;
      type?: string;
      length_metres?: number;
      gross_tonnes?: number;
    }
  }>('/api/vessels/:id', {
    schema: {
      description: 'Update vessel information (requires authentication)',
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
          callsign: { type: 'string' },
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
            callsign: { type: ['string', 'null'] },
            flag: { type: ['string', 'null'] },
            official_number: { type: ['string', 'null'] },
            vessel_type: { type: ['string', 'null'] },
            length_metres: { type: ['string', 'null'] },
            gross_tonnes: { type: ['string', 'null'] },
            is_active: { type: 'boolean' },
            created_at: { type: 'string' },
            updated_at: { type: 'string' },
          },
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        403: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request, reply) => {
    const userId = await extractUserIdFromRequest(request, app);
    if (!userId) {
      app.logger.warn({}, 'Vessel update requested without authentication');
      return reply.code(401).send({ error: 'Authentication required' });
    }

    const { id } = request.params;
    const {
      vessel_name,
      callsign,
      flag,
      official_number,
      type,
      length_metres,
      gross_tonnes,
    } = request.body;

    app.logger.info({ userId, vesselId: id }, 'Updating vessel');

    // Check if vessel exists and belongs to user
    const vessel = await app.db
      .select()
      .from(schema.vessels)
      .where(eq(schema.vessels.id, id));

    if (vessel.length === 0) {
      app.logger.warn({ userId, vesselId: id }, 'Vessel not found for update');
      return reply.code(404).send({ error: 'Vessel not found' });
    }

    // Verify ownership
    if (vessel[0].user_id !== userId) {
      app.logger.warn({ userId, vesselId: id }, 'Unauthorized vessel update attempt');
      return reply.code(403).send({ error: 'Not authorized to update this vessel' });
    }

    const updateData: Record<string, any> = { updated_at: new Date() };
    if (vessel_name !== undefined) updateData.vessel_name = vessel_name;
    if (callsign !== undefined) updateData.callsign = callsign;
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
      { userId, vesselId: updated.id, vesselName: updated.vessel_name },
      'Vessel updated successfully'
    );

    return reply.code(200).send(transformVesselForResponse(updated));
  });

  // PUT /api/vessels/:id/particulars - Update vessel particulars (authenticated)
  fastify.put<{
    Params: { id: string };
    Body: {
      vessel_name?: string;
      callsign?: string;
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
        description: 'Update vessel particulars (vessel_name, callsign, flag, official number, type, length, gross tonnes). Requires authentication.',
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
            callsign: { type: 'string' },
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
              callsign: { type: ['string', 'null'] },
              flag: { type: ['string', 'null'] },
              official_number: { type: ['string', 'null'] },
              vessel_type: { type: ['string', 'null'] },
              length_metres: { type: ['string', 'null'] },
              gross_tonnes: { type: ['string', 'null'] },
              is_active: { type: 'boolean' },
              created_at: { type: 'string' },
              updated_at: { type: 'string' },
            },
          },
          400: { type: 'object', properties: { error: { type: 'string' } } },
          401: { type: 'object', properties: { error: { type: 'string' } } },
          403: { type: 'object', properties: { error: { type: 'string' } } },
          404: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { vessel_name, callsign, flag, official_number, type, length_metres, gross_tonnes } = request.body;

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
      if (vessel_name === undefined && callsign === undefined && flag === undefined && official_number === undefined && type === undefined &&
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

      // Verify ownership
      if (vessel[0].user_id !== session.userId) {
        app.logger.warn({ userId: session.userId, vesselId: id }, 'Unauthorized vessel particulars update attempt');
        return reply.code(403).send({ error: 'Not authorized to update this vessel' });
      }

      // Build update data with only provided fields
      const updateData: Record<string, any> = { updated_at: new Date() };
      if (vessel_name !== undefined) updateData.vessel_name = vessel_name;
      if (callsign !== undefined) updateData.callsign = callsign;
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

      return reply.code(200).send(transformVesselForResponse(updated));
    }
  );
}
