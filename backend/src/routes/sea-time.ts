import type { FastifyInstance } from "fastify";
import { eq, and, isNull, desc } from "drizzle-orm";
import * as schema from "../db/schema.js";
import type { App } from "../index.js";

function calculateDurationHours(startTime: Date, endTime: Date): number {
  const diffMs = endTime.getTime() - startTime.getTime();
  return Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100; // Round to 2 decimal places
}

export function register(app: App, fastify: FastifyInstance) {
  // GET /api/sea-time - Return all sea time entries with vessel info
  fastify.get('/api/sea-time', {
    schema: {
      description: 'Get all sea time entries with vessel information',
      tags: ['sea-time'],
      response: {
        200: {
          type: 'array',
          items: { type: 'object' },
        },
      },
    },
  }, async (request, reply) => {
    app.logger.info('Retrieving all sea time entries');

    const entries = await app.db.query.sea_time_entries.findMany({
      with: {
        vessel: true,
      },
    });

    app.logger.info(`Retrieved ${entries.length} sea time entries`);
    return reply.code(200).send(entries);
  });

  // GET /api/vessels/:vesselId/sea-time - Return sea time entries for a specific vessel
  fastify.get<{ Params: { vesselId: string } }>('/api/vessels/:vesselId/sea-time', {
    schema: {
      description: 'Get all sea time entries for a specific vessel',
      tags: ['sea-time'],
      params: {
        type: 'object',
        required: ['vesselId'],
        properties: { vesselId: { type: 'string' } },
      },
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              vessel_id: { type: 'string' },
              start_time: { type: 'string', format: 'date-time' },
              end_time: { type: ['string', 'null'], format: 'date-time' },
              duration_hours: { type: ['string', 'null'] },
              status: { type: 'string' },
              notes: { type: ['string', 'null'] },
              created_at: { type: 'string', format: 'date-time' },
              vessel: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  mmsi: { type: 'string' },
                  vessel_name: { type: 'string' },
                  is_active: { type: 'boolean' },
                  created_at: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
        404: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request, reply) => {
    const { vesselId } = request.params;

    // Verify vessel exists
    const vessel = await app.db
      .select()
      .from(schema.vessels)
      .where(eq(schema.vessels.id, vesselId));

    if (vessel.length === 0) {
      return reply.code(404).send({ error: 'Vessel not found' });
    }

    // Get all sea time entries for the vessel, ordered by most recent first
    const entries = await app.db.query.sea_time_entries.findMany({
      where: eq(schema.sea_time_entries.vessel_id, vesselId),
      with: {
        vessel: true,
      },
      orderBy: desc(schema.sea_time_entries.start_time),
    });

    return reply.code(200).send(entries);
  });

  // GET /api/sea-time/pending - Return pending entries awaiting confirmation
  fastify.get('/api/sea-time/pending', {
    schema: {
      description: 'Get pending sea time entries awaiting confirmation',
      tags: ['sea-time'],
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              vessel_id: { type: 'string' },
              start_time: { type: 'string', format: 'date-time' },
              end_time: { type: ['string', 'null'], format: 'date-time' },
              duration_hours: { type: ['string', 'null'] },
              status: { type: 'string' },
              notes: { type: ['string', 'null'] },
              created_at: { type: 'string', format: 'date-time' },
              vessel: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  mmsi: { type: 'string' },
                  vessel_name: { type: 'string' },
                  is_active: { type: 'boolean' },
                  created_at: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    app.logger.info('Retrieving pending sea time entries');

    const entries = await app.db.query.sea_time_entries.findMany({
      where: eq(schema.sea_time_entries.status, 'pending'),
      with: {
        vessel: true,
      },
      orderBy: desc(schema.sea_time_entries.start_time),
    });

    app.logger.info(`Retrieved ${entries.length} pending sea time entries`);
    return reply.code(200).send(entries);
  });

  // PUT /api/sea-time/:id/confirm - Confirm pending entry with optional notes
  fastify.put<{ Params: { id: string }; Body: { notes?: string } }>('/api/sea-time/:id/confirm', {
    schema: {
      description: 'Confirm a pending sea time entry',
      tags: ['sea-time'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      body: {
        type: 'object',
        properties: { notes: { type: 'string' } },
      },
      response: {
        200: { type: 'object' },
        404: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const { notes } = request.body;

    app.logger.info({ entryId: id, notes }, `Confirming sea time entry: ${id}`);

    // Get the entry
    const entry = await app.db
      .select()
      .from(schema.sea_time_entries)
      .where(eq(schema.sea_time_entries.id, id));

    if (entry.length === 0) {
      app.logger.warn(`Sea time entry not found: ${id}`);
      return reply.code(404).send({ error: 'Sea time entry not found' });
    }

    const current_entry = entry[0];

    // Set end_time to now and calculate duration
    const end_time = new Date();
    const duration_hours = calculateDurationHours(current_entry.start_time, end_time);

    const [updated] = await app.db
      .update(schema.sea_time_entries)
      .set({
        end_time,
        duration_hours: String(duration_hours),
        status: 'confirmed',
        notes: notes || current_entry.notes,
      })
      .where(eq(schema.sea_time_entries.id, id))
      .returning();

    app.logger.info(
      {
        entryId: id,
        vesselId: current_entry.vessel_id,
        startTime: current_entry.start_time.toISOString(),
        endTime: end_time.toISOString(),
        durationHours: duration_hours,
        status: 'confirmed',
      },
      `Sea time entry confirmed: ${duration_hours} hours`
    );

    return reply.code(200).send(updated);
  });

  // PUT /api/sea-time/:id/reject - Reject pending entry with optional notes
  fastify.put<{ Params: { id: string }; Body: { notes?: string } }>('/api/sea-time/:id/reject', {
    schema: {
      description: 'Reject a pending sea time entry',
      tags: ['sea-time'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      body: {
        type: 'object',
        properties: { notes: { type: 'string' } },
      },
      response: {
        200: { type: 'object' },
        404: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const { notes } = request.body;

    app.logger.info({ entryId: id, notes }, `Rejecting sea time entry: ${id}`);

    // Get the entry
    const entry = await app.db
      .select()
      .from(schema.sea_time_entries)
      .where(eq(schema.sea_time_entries.id, id));

    if (entry.length === 0) {
      app.logger.warn(`Sea time entry not found: ${id}`);
      return reply.code(404).send({ error: 'Sea time entry not found' });
    }

    const [updated] = await app.db
      .update(schema.sea_time_entries)
      .set({
        status: 'rejected',
        notes: notes || entry[0].notes,
      })
      .where(eq(schema.sea_time_entries.id, id))
      .returning();

    app.logger.info(
      {
        entryId: id,
        vesselId: entry[0].vessel_id,
        status: 'rejected',
      },
      `Sea time entry rejected`
    );

    return reply.code(200).send(updated);
  });

  // DELETE /api/sea-time/:id - Delete entry
  fastify.delete<{ Params: { id: string } }>('/api/sea-time/:id', {
    schema: {
      description: 'Delete a sea time entry',
      tags: ['sea-time'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      response: {
        200: { type: 'object', properties: { id: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;

    app.logger.info(`Deleting sea time entry: ${id}`);

    const [deleted] = await app.db
      .delete(schema.sea_time_entries)
      .where(eq(schema.sea_time_entries.id, id))
      .returning();

    if (!deleted) {
      app.logger.warn(`Sea time entry not found: ${id}`);
      return reply.code(404).send({ error: 'Sea time entry not found' });
    }

    app.logger.info(
      { entryId: deleted.id, vesselId: deleted.vessel_id },
      `Sea time entry deleted`
    );

    return reply.code(200).send({ id: deleted.id });
  });
}
