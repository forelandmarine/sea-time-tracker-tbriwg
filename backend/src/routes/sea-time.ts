import type { FastifyInstance } from "fastify";
import { eq, and, isNull, desc, lte, gte } from "drizzle-orm";
import * as schema from "../db/schema.js";
import * as authSchema from "../db/auth-schema.js";
import type { App } from "../index.js";

function calculateDurationHours(startTime: Date, endTime: Date): number {
  const diffMs = endTime.getTime() - startTime.getTime();
  return Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100; // Round to 2 decimal places
}

// Helper function to transform vessel object for API response
function transformVesselForResponse(vessel: any) {
  return {
    id: vessel.id,
    mmsi: vessel.mmsi,
    vessel_name: vessel.vessel_name,
    callsign: vessel.callsign,
    flag: vessel.flag,
    vessel_type: vessel.type, // Map 'type' database field to 'vessel_type' in API response
    is_active: vessel.is_active,
    created_at: vessel.created_at,
  };
}

// Helper function to transform sea time entry for API response
function transformSeaTimeEntryForResponse(entry: any) {
  return {
    id: entry.id,
    vessel_id: entry.vessel_id,
    start_time: entry.start_time.toISOString ? entry.start_time.toISOString() : entry.start_time,
    end_time: entry.end_time ? (entry.end_time.toISOString ? entry.end_time.toISOString() : entry.end_time) : null,
    duration_hours: entry.duration_hours,
    status: entry.status,
    notes: entry.notes,
    start_latitude: entry.start_latitude,
    start_longitude: entry.start_longitude,
    end_latitude: entry.end_latitude,
    end_longitude: entry.end_longitude,
    created_at: entry.created_at.toISOString ? entry.created_at.toISOString() : entry.created_at,
    vessel: entry.vessel ? transformVesselForResponse(entry.vessel) : null,
  };
}

export function register(app: App, fastify: FastifyInstance) {
  // GET /api/sea-time - Return all sea time entries with vessel info
  fastify.get('/api/sea-time', {
    schema: {
      description: 'Get all sea time entries with complete vessel information',
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
              status: { type: 'string', enum: ['pending', 'confirmed', 'rejected'] },
              notes: { type: ['string', 'null'] },
              start_latitude: { type: ['string', 'null'] },
              start_longitude: { type: ['string', 'null'] },
              end_latitude: { type: ['string', 'null'] },
              end_longitude: { type: ['string', 'null'] },
              created_at: { type: 'string', format: 'date-time' },
              vessel: {
                type: ['object', 'null'],
                properties: {
                  id: { type: 'string' },
                  mmsi: { type: 'string' },
                  vessel_name: { type: 'string' },
                  callsign: { type: ['string', 'null'] },
                  flag: { type: ['string', 'null'] },
                  vessel_type: { type: ['string', 'null'] },
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
    app.logger.info('Retrieving all sea time entries');

    const entries = await app.db.query.sea_time_entries.findMany({
      with: {
        vessel: true,
      },
      orderBy: desc(schema.sea_time_entries.start_time),
    });

    app.logger.info({ count: entries.length }, 'Sea time entries retrieved');
    return reply.code(200).send(entries.map(transformSeaTimeEntryForResponse));
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
                  callsign: { type: ['string', 'null'] },
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
              start_latitude: { type: ['string', 'null'] },
              start_longitude: { type: ['string', 'null'] },
              end_latitude: { type: ['string', 'null'] },
              end_longitude: { type: ['string', 'null'] },
              vessel: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  mmsi: { type: 'string' },
                  vessel_name: { type: 'string' },
                  callsign: { type: ['string', 'null'] },
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

    app.logger.info(
      { count: entries.length },
      `Retrieved ${entries.length} pending sea time entries`
    );
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

  // POST /api/sea-time/test-entry - Test endpoint to create a sea day entry from specific position data
  fastify.post('/api/sea-time/test-entry', {
    schema: {
      description: 'Test endpoint to create a sea day entry from specific position records',
      tags: ['sea-time'],
      response: {
        200: {
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
            start_latitude: { type: ['string', 'null'] },
            start_longitude: { type: ['string', 'null'] },
            end_latitude: { type: ['string', 'null'] },
            end_longitude: { type: ['string', 'null'] },
            vessel: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                mmsi: { type: 'string' },
                vessel_name: { type: 'string' },
                callsign: { type: ['string', 'null'] },
                is_active: { type: 'boolean' },
                created_at: { type: 'string', format: 'date-time' },
              },
            },
          },
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request, reply) => {
    app.logger.info('Test endpoint: Creating sea day entry from most recent position records');

    try {
      // Find the Norwegian vessel (case-insensitive)
      const vessels = await app.db
        .select()
        .from(schema.vessels)
        .where(eq(schema.vessels.vessel_name, 'Norwegian'));

      if (vessels.length === 0) {
        app.logger.warn('Test endpoint: Norwegian vessel not found');
        return reply.code(404).send({ error: "Vessel 'Norwegian' not found" });
      }

      const vessel = vessels[0];
      app.logger.debug({ vesselId: vessel.id, vesselName: vessel.vessel_name }, 'Found Norwegian vessel');

      // Get the two most recent position records for this vessel
      const positionRecords = await app.db
        .select()
        .from(schema.ais_checks)
        .where(eq(schema.ais_checks.vessel_id, vessel.id))
        .orderBy(desc(schema.ais_checks.check_time))
        .limit(2);

      if (positionRecords.length < 2) {
        app.logger.warn(
          { vesselId: vessel.id, recordsCount: positionRecords.length },
          'Test endpoint: Not enough position records'
        );
        return reply.code(404).send({
          error: `Not enough position records found for vessel ${vessel.vessel_name} (need at least 2)`,
        });
      }

      // Records are ordered newest first, so [0] is newest, [1] is older
      const newestRecord = positionRecords[0];
      const olderRecord = positionRecords[1];

      app.logger.debug(
        {
          olderRecordTime: olderRecord.check_time.toISOString(),
          newestRecordTime: newestRecord.check_time.toISOString(),
        },
        'Test endpoint: Selected two most recent position records'
      );

      // Validate that both records have position data
      if (
        !olderRecord.latitude ||
        !olderRecord.longitude ||
        !newestRecord.latitude ||
        !newestRecord.longitude
      ) {
        app.logger.error(
          { olderRecordId: olderRecord.id, newestRecordId: newestRecord.id },
          'Test endpoint: Position records missing latitude/longitude data'
        );
        return reply.code(500).send({ error: 'Position records missing latitude/longitude data' });
      }

      const startLat = parseFloat(String(olderRecord.latitude));
      const startLng = parseFloat(String(olderRecord.longitude));
      const endLat = parseFloat(String(newestRecord.latitude));
      const endLng = parseFloat(String(newestRecord.longitude));

      // Validate that start and end coordinates are different
      // Prevent creating entries when coordinates are identical despite different timestamps
      if (startLat === endLat && startLng === endLng) {
        app.logger.warn(
          {
            vesselId: vessel.id,
            vesselName: vessel.vessel_name,
            startTime: olderRecord.check_time.toISOString(),
            startLat,
            startLng,
            endTime: newestRecord.check_time.toISOString(),
            endLat,
            endLng,
          },
          `Test endpoint: Vessel ${vessel.vessel_name} has identical coordinates (${startLat}, ${startLng}) despite different timestamps - skipping sea time entry creation`
        );
        return reply.code(400).send({
          error: `Cannot create sea time entry: start and end coordinates are identical (${startLat}, ${startLng}) despite different timestamps`,
        });
      }

      // Calculate duration in hours
      const duration_ms = newestRecord.check_time.getTime() - olderRecord.check_time.getTime();
      const duration_hours = Math.round((duration_ms / (1000 * 60 * 60)) * 100) / 100;

      app.logger.info(
        {
          vesselId: vessel.id,
          vesselName: vessel.vessel_name,
          startTime: olderRecord.check_time.toISOString(),
          startLat,
          startLng,
          endTime: newestRecord.check_time.toISOString(),
          endLat,
          endLng,
          durationHours: duration_hours,
        },
        `Test endpoint: Creating sea day entry from two most recent positions`
      );

      // Create the sea time entry
      const [new_entry] = await app.db
        .insert(schema.sea_time_entries)
        .values({
          user_id: vessel[0].user_id,
          vessel_id: vessel.id,
          start_time: olderRecord.check_time,
          end_time: newestRecord.check_time,
          start_latitude: String(startLat),
          start_longitude: String(startLng),
          end_latitude: String(endLat),
          end_longitude: String(endLng),
          duration_hours: String(duration_hours),
          status: 'pending',
          notes: 'Test entry created from two most recent position records',
        })
        .returning();

      app.logger.info(
        { entryId: new_entry.id, vesselId: vessel.id, vesselName: vessel.vessel_name, durationHours: duration_hours },
        `Test endpoint: Sea day entry created successfully`
      );

      // Return the entry with vessel information
      const response = {
        ...new_entry,
        vessel,
      };

      return reply.code(200).send(response);
    } catch (error) {
      app.logger.error({ err: error }, 'Test endpoint: Error creating sea day entry');
      return reply.code(500).send({ error: 'Failed to create sea day entry' });
    }
  });

  // POST /api/sea-time/generate-samples - Generate sample sea time entries for testing
  fastify.post('/api/sea-time/generate-samples', {
    schema: {
      description: 'Generate sample sea time entries for testing (creates vessel if needed)',
      tags: ['sea-time'],
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            vessel: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                mmsi: { type: 'string' },
                vessel_name: { type: 'string' },
                callsign: { type: ['string', 'null'] },
                flag: { type: ['string', 'null'] },
                vessel_type: { type: ['string', 'null'] },
                is_active: { type: 'boolean' },
                created_at: { type: 'string', format: 'date-time' },
              },
            },
            entries: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  vessel_id: { type: 'string' },
                  start_time: { type: 'string', format: 'date-time' },
                  end_time: { type: 'string', format: 'date-time' },
                  duration_hours: { type: 'string' },
                  status: { type: 'string' },
                  notes: { type: 'string' },
                  start_latitude: { type: 'string' },
                  start_longitude: { type: 'string' },
                  end_latitude: { type: 'string' },
                  end_longitude: { type: 'string' },
                  created_at: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request, reply) => {
    app.logger.info({}, 'Generating sample sea time entries for testing');

    try {
      // Authenticate user
      const authHeader = request.headers.authorization;
      const token = authHeader?.replace('Bearer ', '');

      if (!token) {
        app.logger.warn({}, 'Generate samples request without authentication');
        return reply.code(401).send({ error: 'Authentication required' });
      }

      // Find user session
      const sessions = await app.db
        .select()
        .from(authSchema.session)
        .where(eq(authSchema.session.token, token));

      if (sessions.length === 0) {
        app.logger.warn({}, 'Invalid token for generate samples');
        return reply.code(401).send({ error: 'Invalid or expired token' });
      }

      const session = sessions[0];

      // Check if session is expired
      if (session.expiresAt < new Date()) {
        app.logger.warn({ sessionId: session.id }, 'Session expired for generate samples');
        return reply.code(401).send({ error: 'Session expired' });
      }

      const userId = session.userId;

      // Check if user has any vessels
      let vessels = await app.db.select().from(schema.vessels).where(eq(schema.vessels.user_id, userId));

      let selectedVessel;

      if (vessels.length === 0) {
        // Create sample vessel
        app.logger.info({}, 'No vessels found, creating sample vessel');

        const [newVessel] = await app.db
          .insert(schema.vessels)
          .values({
            user_id: userId,
            mmsi: '235012345',
            vessel_name: 'MV Sample Yacht',
            is_active: true,
            flag: 'United Kingdom',
            type: 'Yacht',
            length_metres: '24.5',
            gross_tonnes: '45',
          })
          .returning();

        selectedVessel = newVessel;
        app.logger.info({ vesselId: newVessel.id, vesselName: newVessel.vessel_name }, 'Sample vessel created');
      } else {
        selectedVessel = vessels[0];
        app.logger.info({ vesselId: selectedVessel.id, vesselName: selectedVessel.vessel_name }, 'Using existing vessel');
      }

      // Create three sample sea time entries
      const now = new Date();
      const entries = [];

      // Entry 1: 2 days ago, 08:00 - 18:30 (10.5 hours)
      const entry1Start = new Date(now);
      entry1Start.setDate(entry1Start.getDate() - 2);
      entry1Start.setHours(8, 0, 0, 0);

      const entry1End = new Date(now);
      entry1End.setDate(entry1End.getDate() - 2);
      entry1End.setHours(18, 30, 0, 0);

      const [sampleEntry1] = await app.db
        .insert(schema.sea_time_entries)
        .values({
          user_id: userId,
          vessel_id: selectedVessel.id,
          start_time: entry1Start,
          end_time: entry1End,
          duration_hours: '10.5',
          status: 'pending',
          notes: 'Coastal passage from Southampton to Portsmouth. Good weather conditions.',
          start_latitude: '50.9097',
          start_longitude: '-1.4044',
          end_latitude: '50.7964',
          end_longitude: '-1.1089',
        })
        .returning();

      entries.push(sampleEntry1);
      app.logger.info({ entryId: sampleEntry1.id }, 'Sample entry 1 created');

      // Entry 2: 7 days ago, 09:30 - 16:45 (7.25 hours)
      const entry2Start = new Date(now);
      entry2Start.setDate(entry2Start.getDate() - 7);
      entry2Start.setHours(9, 30, 0, 0);

      const entry2End = new Date(now);
      entry2End.setDate(entry2End.getDate() - 7);
      entry2End.setHours(16, 45, 0, 0);

      const [sampleEntry2] = await app.db
        .insert(schema.sea_time_entries)
        .values({
          user_id: userId,
          vessel_id: selectedVessel.id,
          start_time: entry2Start,
          end_time: entry2End,
          duration_hours: '7.25',
          status: 'pending',
          notes: 'Training voyage in the Solent. Practiced navigation and mooring.',
          start_latitude: '50.7964',
          start_longitude: '-1.1089',
          end_latitude: '50.8429',
          end_longitude: '-1.2981',
        })
        .returning();

      entries.push(sampleEntry2);
      app.logger.info({ entryId: sampleEntry2.id }, 'Sample entry 2 created');

      // Entry 3: 14 days ago, 07:00 - 19:15 (12.25 hours)
      const entry3Start = new Date(now);
      entry3Start.setDate(entry3Start.getDate() - 14);
      entry3Start.setHours(7, 0, 0, 0);

      const entry3End = new Date(now);
      entry3End.setDate(entry3End.getDate() - 14);
      entry3End.setHours(19, 15, 0, 0);

      const [sampleEntry3] = await app.db
        .insert(schema.sea_time_entries)
        .values({
          user_id: userId,
          vessel_id: selectedVessel.id,
          start_time: entry3Start,
          end_time: entry3End,
          duration_hours: '12.25',
          status: 'pending',
          notes: 'Extended passage to Isle of Wight. Overnight preparation and early departure.',
          start_latitude: '50.8429',
          start_longitude: '-1.2981',
          end_latitude: '50.6929',
          end_longitude: '-1.3047',
        })
        .returning();

      entries.push(sampleEntry3);
      app.logger.info({ entryId: sampleEntry3.id }, 'Sample entry 3 created');

      app.logger.info(
        { vesselId: selectedVessel.id, entryCount: entries.length },
        'Sample sea time entries generated successfully'
      );

      return reply.code(201).send({
        success: true,
        message: 'Sample sea time entries generated successfully',
        vessel: transformVesselForResponse(selectedVessel),
        entries: entries.map((entry) => ({
          id: entry.id,
          vessel_id: entry.vessel_id,
          start_time: entry.start_time.toISOString(),
          end_time: entry.end_time.toISOString(),
          duration_hours: entry.duration_hours,
          status: entry.status,
          notes: entry.notes,
          start_latitude: entry.start_latitude,
          start_longitude: entry.start_longitude,
          end_latitude: entry.end_latitude,
          end_longitude: entry.end_longitude,
          created_at: entry.created_at.toISOString(),
        })),
      });
    } catch (error) {
      app.logger.error({ err: error }, 'Failed to generate sample sea time entries');
      return reply.code(400).send({ error: 'Failed to generate sample sea time entries' });
    }
  });

  // GET /api/logbook - Get sea time entries in chronological order for logbook/calendar view
  fastify.get<{ Querystring: { startDate?: string; endDate?: string } }>('/api/logbook', {
    schema: {
      description: 'Get sea time entries in chronological order for logbook/calendar view with optional date range filtering',
      tags: ['logbook'],
      querystring: {
        type: 'object',
        properties: {
          startDate: { type: 'string', description: 'ISO 8601 date string' },
          endDate: { type: 'string', description: 'ISO 8601 date string' },
        },
      },
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              vessel_id: { type: 'string' },
              start_time: { type: 'string' },
              end_time: { type: ['string', 'null'] },
              duration_hours: { type: ['string', 'null'] },
              status: { type: 'string' },
              notes: { type: ['string', 'null'] },
              start_latitude: { type: ['string', 'null'] },
              start_longitude: { type: ['string', 'null'] },
              end_latitude: { type: ['string', 'null'] },
              end_longitude: { type: ['string', 'null'] },
              created_at: { type: 'string' },
              vessel: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  mmsi: { type: 'string' },
                  vessel_name: { type: 'string' },
                  callsign: { type: ['string', 'null'] },
                  flag: { type: ['string', 'null'] },
                  vessel_type: { type: ['string', 'null'] },
                  is_active: { type: 'boolean' },
                },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { startDate, endDate } = request.query;

    app.logger.info({ startDate, endDate }, 'Retrieving logbook entries');

    let query = app.db.query.sea_time_entries.findMany({
      with: {
        vessel: true,
      },
      orderBy: desc(schema.sea_time_entries.start_time),
    });

    let entries = await query;

    // Filter by date range if provided
    if (startDate || endDate) {
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;

      entries = entries.filter((entry) => {
        const entryDate = new Date(entry.start_time);
        if (start && entryDate < start) return false;
        if (end && entryDate > end) return false;
        return true;
      });
    }

    app.logger.info({ count: entries.length }, 'Logbook entries retrieved');
    return reply.code(200).send(entries);
  });

  // POST /api/logbook/manual-entry - Create manual sea time entry (authenticated)
  fastify.post<{
    Body: {
      vessel_id: string;
      start_time: string;
      end_time?: string;
      notes?: string;
      start_latitude?: number;
      start_longitude?: number;
      end_latitude?: number;
      end_longitude?: number;
    };
  }>('/api/logbook/manual-entry', {
    schema: {
      description: 'Create a manual sea time entry (requires authentication)',
      tags: ['logbook'],
      body: {
        type: 'object',
        required: ['vessel_id', 'start_time'],
        properties: {
          vessel_id: { type: 'string', description: 'UUID of the vessel' },
          start_time: { type: 'string', description: 'ISO 8601 start time' },
          end_time: { type: 'string', description: 'ISO 8601 end time (optional)' },
          notes: { type: 'string', description: 'Optional notes' },
          start_latitude: { type: 'number', description: 'Start position latitude' },
          start_longitude: { type: 'number', description: 'Start position longitude' },
          end_latitude: { type: 'number', description: 'End position latitude' },
          end_longitude: { type: 'number', description: 'End position longitude' },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            vessel_id: { type: 'string' },
            start_time: { type: 'string' },
            end_time: { type: ['string', 'null'] },
            duration_hours: { type: ['string', 'null'] },
            status: { type: 'string' },
            notes: { type: ['string', 'null'] },
            start_latitude: { type: ['string', 'null'] },
            start_longitude: { type: ['string', 'null'] },
            end_latitude: { type: ['string', 'null'] },
            end_longitude: { type: ['string', 'null'] },
            created_at: { type: 'string' },
            vessel: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                mmsi: { type: 'string' },
                vessel_name: { type: 'string' },
                callsign: { type: ['string', 'null'] },
                flag: { type: ['string', 'null'] },
                vessel_type: { type: ['string', 'null'] },
                is_active: { type: 'boolean' },
              },
            },
          },
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request, reply) => {
    const { vessel_id, start_time, end_time, notes, start_latitude, start_longitude, end_latitude, end_longitude } = request.body;

    app.logger.info(
      { vessel_id, start_time, end_time },
      'Manual sea time entry creation request'
    );

    // Authenticate user
    const authHeader = request.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      app.logger.warn({}, 'Manual entry creation without authentication');
      return reply.code(401).send({ error: 'Authentication required' });
    }

    // Find user session
    const sessions = await app.db
      .select()
      .from(authSchema.session)
      .where(eq(authSchema.session.token, token));

    if (sessions.length === 0) {
      app.logger.warn({}, 'Invalid token for manual entry creation');
      return reply.code(401).send({ error: 'Invalid or expired token' });
    }

    const session = sessions[0];

    // Check if session is expired
    if (session.expiresAt < new Date()) {
      app.logger.warn({ sessionId: session.id }, 'Session expired for manual entry creation');
      return reply.code(401).send({ error: 'Session expired' });
    }

    // Validate vessel exists
    const vessel = await app.db
      .select()
      .from(schema.vessels)
      .where(eq(schema.vessels.id, vessel_id));

    if (vessel.length === 0) {
      app.logger.warn({ vessel_id }, 'Vessel not found for manual entry');
      return reply.code(404).send({ error: 'Vessel not found' });
    }

    // Validate start_time
    let startDate: Date;
    try {
      startDate = new Date(start_time);
      if (isNaN(startDate.getTime())) {
        throw new Error('Invalid date');
      }
    } catch (error) {
      app.logger.warn({ start_time }, 'Invalid start_time format');
      return reply.code(400).send({ error: 'Invalid start_time format' });
    }

    // Validate and process end_time if provided
    let endDate: Date | null = null;
    let durationHours: string | null = null;

    if (end_time) {
      try {
        endDate = new Date(end_time);
        if (isNaN(endDate.getTime())) {
          throw new Error('Invalid date');
        }

        // Validate that end_time is after start_time
        if (endDate <= startDate) {
          app.logger.warn({ start_time, end_time }, 'End time is not after start time');
          return reply.code(400).send({ error: 'End time must be after start time' });
        }

        // Calculate duration
        const durationMs = endDate.getTime() - startDate.getTime();
        const hours = durationMs / (1000 * 60 * 60);
        durationHours = String(Math.round(hours * 100) / 100);

        app.logger.info({ vessel_id, durationHours }, 'Calculated sea time duration');
      } catch (error) {
        app.logger.warn({ end_time }, 'Invalid end_time format');
        return reply.code(400).send({ error: 'Invalid end_time format' });
      }
    }

    // Create the sea time entry (marked as confirmed for manually created entries)
    try {
      const [entry] = await app.db
        .insert(schema.sea_time_entries)
        .values({
          user_id: session.userId,
          vessel_id,
          start_time: startDate,
          end_time: endDate,
          duration_hours: durationHours,
          status: 'confirmed', // Manually created entries are confirmed
          notes,
          start_latitude: start_latitude ? String(start_latitude) : null,
          start_longitude: start_longitude ? String(start_longitude) : null,
          end_latitude: end_latitude ? String(end_latitude) : null,
          end_longitude: end_longitude ? String(end_longitude) : null,
        })
        .returning();

      app.logger.info(
        {
          entryId: entry.id,
          vessel_id,
          vesselName: vessel[0].vessel_name,
          start_time,
          end_time: endDate?.toISOString(),
          durationHours,
          status: 'confirmed',
        },
        'Manual sea time entry created successfully'
      );

      // Return entry with vessel details
      const response = {
        ...entry,
        vessel: vessel[0],
      };

      return reply.code(201).send(response);
    } catch (error) {
      app.logger.error({ err: error, vessel_id }, 'Failed to create manual sea time entry');
      return reply.code(400).send({ error: 'Failed to create sea time entry' });
    }
  });
}
