import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { eq, desc, and, gte } from "drizzle-orm";
import * as schema from "../db/schema.js";
import type { App } from "../index.js";

const AIS_API_KEY = process.env.MYSHIPTRACKING_API_KEY || '';

interface AISResponse {
  features?: Array<{
    geometry?: {
      coordinates?: [number, number];
    };
    properties?: {
      SPEED?: number;
      STATUS?: string;
    };
  }>;
}

interface AISCheckResult {
  is_moving: boolean;
  speed_knots: number | null;
  latitude: number | null;
  longitude: number | null;
}

async function checkVesselMovement(mmsi: string, logger: any): Promise<AISCheckResult> {
  try {
    const url = `https://www.myshiptracking.com/requests/vesselsonmap-api-key/${AIS_API_KEY}/mmsi/${mmsi}`;
    const response = await fetch(url);

    if (!response.ok) {
      return { is_moving: false, speed_knots: null, latitude: null, longitude: null };
    }

    const data: AISResponse = await response.json();

    if (!data.features || data.features.length === 0) {
      return { is_moving: false, speed_knots: null, latitude: null, longitude: null };
    }

    const feature = data.features[0];
    const coords = feature.geometry?.coordinates || [];
    const props = feature.properties || {};

    const longitude = coords[0] || null;
    const latitude = coords[1] || null;
    const speed = props.SPEED ? parseFloat(String(props.SPEED)) : null;
    const is_moving = speed !== null && speed > 0.5; // Vessels with speed > 0.5 knots are considered moving

    return {
      is_moving,
      speed_knots: speed,
      latitude,
      longitude,
    };
  } catch (error) {
    logger.error(`Error checking vessel ${mmsi}:`, error);
    return { is_moving: false, speed_knots: null, latitude: null, longitude: null };
  }
}

export function register(app: App, fastify: FastifyInstance) {
  // POST /api/ais/check/:vesselId - Check vessel movement and create sea_time_entry if moving 4+ hours
  fastify.post<{ Params: { vesselId: string } }>('/api/ais/check/:vesselId', {
    schema: {
      description: 'Check vessel movement via AIS API and create sea_time_entry if needed',
      tags: ['ais'],
      params: {
        type: 'object',
        required: ['vesselId'],
        properties: { vesselId: { type: 'string' } },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            check_id: { type: 'string' },
            is_moving: { type: 'boolean' },
            speed_knots: { type: 'number' },
            latitude: { type: 'number' },
            longitude: { type: 'number' },
            sea_time_entry_created: { type: 'boolean' },
          },
        },
        404: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request, reply) => {
    const { vesselId } = request.params;

    // Get vessel
    const vessel = await app.db
      .select()
      .from(schema.vessels)
      .where(eq(schema.vessels.id, vesselId));

    if (vessel.length === 0) {
      return reply.code(404).send({ error: 'Vessel not found' });
    }

    const mmsi = vessel[0].mmsi;

    // Check movement via AIS API
    const ais_result = await checkVesselMovement(mmsi, app.logger);

    // Store the check result
    const check_time = new Date();
    const [ais_check] = await app.db
      .insert(schema.ais_checks)
      .values({
        vessel_id: vesselId,
        check_time,
        is_moving: ais_result.is_moving,
        speed_knots: ais_result.speed_knots ? String(ais_result.speed_knots) : null,
        latitude: ais_result.latitude ? String(ais_result.latitude) : null,
        longitude: ais_result.longitude ? String(ais_result.longitude) : null,
      })
      .returning();

    let sea_time_entry_created = false;

    // If vessel is moving, check if there's a continuous 4+ hour movement
    if (ais_result.is_moving) {
      // Look back 4 hours for movement data
      const four_hours_ago = new Date(check_time.getTime() - 4 * 60 * 60 * 1000);

      const recent_checks = await app.db
        .select()
        .from(schema.ais_checks)
        .where(
          and(
            eq(schema.ais_checks.vessel_id, vesselId),
            gte(schema.ais_checks.check_time, four_hours_ago)
          )
        )
        .orderBy(desc(schema.ais_checks.check_time));

      // Check if all recent checks show movement (continuous movement)
      if (recent_checks.length >= 2) {
        const all_moving = recent_checks.every((check) => check.is_moving);

        if (all_moving) {
          // Find the earliest check in this continuous period
          const earliest_check = recent_checks[recent_checks.length - 1];

          // Check if a sea_time_entry already exists for this period
          const existing_entry = await app.db
            .select()
            .from(schema.sea_time_entries)
            .where(
              and(
                eq(schema.sea_time_entries.vessel_id, vesselId),
                eq(schema.sea_time_entries.status, 'pending')
              )
            );

          if (existing_entry.length === 0) {
            // Create a pending sea_time_entry
            await app.db.insert(schema.sea_time_entries).values({
              vessel_id: vesselId,
              start_time: earliest_check.check_time,
              status: 'pending',
            });

            sea_time_entry_created = true;
          }
        }
      }
    }

    return reply.code(200).send({
      check_id: ais_check.id,
      is_moving: ais_result.is_moving,
      speed_knots: ais_result.speed_knots,
      latitude: ais_result.latitude,
      longitude: ais_result.longitude,
      sea_time_entry_created,
    });
  });

  // GET /api/ais/status/:vesselId - Return current movement status and recent checks
  fastify.get<{ Params: { vesselId: string } }>('/api/ais/status/:vesselId', {
    schema: {
      description: 'Get current movement status and recent AIS checks',
      tags: ['ais'],
      params: {
        type: 'object',
        required: ['vesselId'],
        properties: { vesselId: { type: 'string' } },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            is_moving: { type: 'boolean' },
            current_check: { type: 'object' },
            recent_checks: {
              type: 'array',
              items: { type: 'object' },
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

    // Get latest check
    const latest_check = await app.db
      .select()
      .from(schema.ais_checks)
      .where(eq(schema.ais_checks.vessel_id, vesselId))
      .orderBy(desc(schema.ais_checks.check_time))
      .limit(1);

    // Get recent checks (last 24 hours, max 50)
    const twenty_four_hours_ago = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recent_checks = await app.db
      .select()
      .from(schema.ais_checks)
      .where(
        and(
          eq(schema.ais_checks.vessel_id, vesselId),
          gte(schema.ais_checks.check_time, twenty_four_hours_ago)
        )
      )
      .orderBy(desc(schema.ais_checks.check_time))
      .limit(50);

    return reply.code(200).send({
      is_moving: latest_check.length > 0 ? latest_check[0].is_moving : false,
      current_check: latest_check.length > 0 ? latest_check[0] : null,
      recent_checks,
    });
  });
}
