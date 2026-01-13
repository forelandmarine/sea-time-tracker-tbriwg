import type { FastifyInstance, FastifyRequest } from "fastify";
import { eq, desc, and, gte, isNotNull } from "drizzle-orm";
import * as schema from "../db/schema.js";
import type { App } from "../index.js";

const MOVING_SPEED_THRESHOLD = 2; // knots
const APP_WIDE_API_URL = 'https://api.myshiptracking.com/v1';

interface MyShipTrackingFeature {
  geometry?: {
    coordinates?: [number, number];
  };
  properties?: {
    SHIPNAME?: string;
    SPEED?: number | string;
    COURSE?: number | string;
    TIMESTAMP?: number | string;
    STATUS?: string;
    [key: string]: any;
  };
}

interface MyShipTrackingResponse {
  features?: MyShipTrackingFeature[];
  type?: string;
  [key: string]: any;
}

interface AISVesselData {
  name: string | null;
  speed_knots: number | null;
  latitude: number | null;
  longitude: number | null;
  course: number | null;
  timestamp: Date | null;
  status: string | null;
  is_moving: boolean;
  error: string | null;
}

async function fetchVesselAISData(
  mmsi: string,
  apiKey: string,
  logger: any
): Promise<AISVesselData> {
  try {
    const url = `${APP_WIDE_API_URL}/vessels/${mmsi}/position`;
    logger.info(`Fetching AIS data for MMSI ${mmsi}`);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.status === 401) {
      logger.error('MyShipTracking API authentication failed - Invalid API key');
      return {
        name: null,
        speed_knots: null,
        latitude: null,
        longitude: null,
        course: null,
        timestamp: null,
        status: null,
        is_moving: false,
        error: 'Invalid API key',
      };
    }

    if (response.status === 404) {
      logger.warn(`Vessel with MMSI ${mmsi} not found in AIS system`);
      return {
        name: null,
        speed_knots: null,
        latitude: null,
        longitude: null,
        course: null,
        timestamp: null,
        status: null,
        is_moving: false,
        error: 'Vessel not found in AIS system',
      };
    }

    if (!response.ok) {
      logger.error(`MyShipTracking API error: ${response.status} ${response.statusText}`);
      return {
        name: null,
        speed_knots: null,
        latitude: null,
        longitude: null,
        course: null,
        timestamp: null,
        status: null,
        is_moving: false,
        error: 'AIS service temporarily unavailable',
      };
    }

    const data: MyShipTrackingResponse = await response.json();
    logger.info(`Received AIS response for MMSI ${mmsi}: ${data.features?.length || 0} features`);

    if (!data.features || data.features.length === 0) {
      logger.warn(`No AIS features found for MMSI ${mmsi}`);
      return {
        name: null,
        speed_knots: null,
        latitude: null,
        longitude: null,
        course: null,
        timestamp: null,
        status: null,
        is_moving: false,
        error: 'Vessel not found in AIS system',
      };
    }

    const feature = data.features[0];
    const coords = feature.geometry?.coordinates || [];
    const props = feature.properties || {};

    const longitude = coords[0] ? parseFloat(String(coords[0])) : null;
    const latitude = coords[1] ? parseFloat(String(coords[1])) : null;
    const name = props.SHIPNAME ? String(props.SHIPNAME) : null;
    const speed = props.SPEED ? parseFloat(String(props.SPEED)) : null;
    const course = props.COURSE ? parseFloat(String(props.COURSE)) : null;
    const status = props.STATUS ? String(props.STATUS) : null;
    const timestamp = props.TIMESTAMP
      ? new Date(parseFloat(String(props.TIMESTAMP)) * 1000)
      : new Date();

    const is_moving = speed !== null && speed > MOVING_SPEED_THRESHOLD;

    logger.info(
      `Processed AIS data for MMSI ${mmsi}: name=${name}, speed=${speed}, is_moving=${is_moving}, lat=${latitude}, lon=${longitude}`
    );

    return {
      name,
      speed_knots: speed,
      latitude,
      longitude,
      course,
      timestamp,
      status,
      is_moving,
      error: null,
    };
  } catch (error) {
    logger.error(`Error fetching vessel AIS data for MMSI ${mmsi}:`, error);
    return {
      name: null,
      speed_knots: null,
      latitude: null,
      longitude: null,
      course: null,
      timestamp: null,
      status: null,
      is_moving: false,
      error: 'AIS service temporarily unavailable',
    };
  }
}

export function register(app: App, fastify: FastifyInstance) {
  // POST /api/ais/check/:vesselId - Check vessel AIS data and manage sea time entries
  fastify.post<{ Params: { vesselId: string } }>('/api/ais/check/:vesselId', {
    schema: {
      description: 'Fetch real-time AIS data and manage sea time entries',
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
            speed_knots: { type: ['number', 'null'] },
            latitude: { type: ['number', 'null'] },
            longitude: { type: ['number', 'null'] },
            sea_time_entry_created: { type: 'boolean' },
          },
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } },
        502: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request, reply) => {
    const { vesselId } = request.params;

    // Fetch app-wide API key from database
    const settings = await app.db
      .select()
      .from(schema.api_settings)
      .orderBy(desc(schema.api_settings.updated_at))
      .limit(1);

    if (settings.length === 0 || !settings[0].api_key) {
      app.logger.error('MyShipTracking API key not configured');
      return reply.code(500).send({ error: 'AIS API configuration missing' });
    }

    const apiKey = settings[0].api_key;

    // Fetch vessel from database
    const vessel = await app.db
      .select()
      .from(schema.vessels)
      .where(eq(schema.vessels.id, vesselId));

    if (vessel.length === 0) {
      app.logger.warn(`Vessel not found: ${vesselId}`);
      return reply.code(404).send({ error: 'Vessel not found' });
    }

    // Check if vessel is active
    if (!vessel[0].is_active) {
      app.logger.warn(`Cannot track inactive vessel: ${vesselId}`);
      return reply.code(400).send({ error: 'Vessel is not active. Please activate the vessel first.' });
    }

    const mmsi = vessel[0].mmsi;
    app.logger.info(`Processing AIS check for active vessel: ${vessel[0].vessel_name} (MMSI: ${mmsi})`);

    // Fetch real-time AIS data from MyShipTracking API using app-wide key
    const ais_data = await fetchVesselAISData(mmsi, apiKey, app.logger);

    // Check for API errors and return appropriate status codes
    if (ais_data.error) {
      if (ais_data.error === 'Invalid API key') {
        return reply.code(500).send({ error: ais_data.error });
      } else if (ais_data.error === 'Vessel not found in AIS system') {
        return reply.code(404).send({ error: ais_data.error });
      } else {
        // AIS service temporarily unavailable
        return reply.code(502).send({ error: ais_data.error });
      }
    }

    // Store the AIS check result
    const check_time = new Date();
    const [ais_check] = await app.db
      .insert(schema.ais_checks)
      .values({
        vessel_id: vesselId,
        check_time,
        is_moving: ais_data.is_moving,
        speed_knots: ais_data.speed_knots !== null ? String(ais_data.speed_knots) : null,
        latitude: ais_data.latitude !== null ? String(ais_data.latitude) : null,
        longitude: ais_data.longitude !== null ? String(ais_data.longitude) : null,
      })
      .returning();

    app.logger.info(
      `Stored AIS check: ${ais_check.id} for vessel ${vesselId} - is_moving: ${ais_data.is_moving}, speed: ${ais_data.speed_knots}`
    );

    let sea_time_entry_created = false;
    let sea_time_entry_ended = false;

    // Handle sea time entry lifecycle
    // Get any existing open sea time entries for this vessel
    const open_entry = await app.db
      .select()
      .from(schema.sea_time_entries)
      .where(
        and(
          eq(schema.sea_time_entries.vessel_id, vesselId),
          isNotNull(schema.sea_time_entries.start_time),
          eq(schema.sea_time_entries.status, 'pending')
        )
      )
      .orderBy(desc(schema.sea_time_entries.created_at))
      .limit(1);

    if (ais_data.is_moving) {
      // Vessel is moving
      if (open_entry.length === 0) {
        // Create a new pending sea time entry
        const [new_entry] = await app.db
          .insert(schema.sea_time_entries)
          .values({
            vessel_id: vesselId,
            start_time: check_time,
            status: 'pending',
          })
          .returning();

        sea_time_entry_created = true;
        app.logger.info(`Created new sea time entry: ${new_entry.id} for vessel ${vesselId}`);
      } else {
        // Entry already exists, keep it open
        app.logger.info(`Vessel is still moving, keeping open entry: ${open_entry[0].id}`);
      }
    } else {
      // Vessel is not moving
      if (open_entry.length > 0) {
        // End the sea time entry and calculate duration
        const start_time = open_entry[0].start_time;
        const duration_ms = check_time.getTime() - start_time.getTime();
        const duration_hours = Math.round((duration_ms / (1000 * 60 * 60)) * 100) / 100;

        const [ended_entry] = await app.db
          .update(schema.sea_time_entries)
          .set({
            end_time: check_time,
            duration_hours: String(duration_hours),
          })
          .where(eq(schema.sea_time_entries.id, open_entry[0].id))
          .returning();

        sea_time_entry_ended = true;
        app.logger.info(
          `Ended sea time entry: ${ended_entry.id} with duration: ${duration_hours} hours`
        );
      }
    }

    return reply.code(200).send({
      check_id: ais_check.id,
      is_moving: ais_data.is_moving,
      speed_knots: ais_data.speed_knots,
      latitude: ais_data.latitude,
      longitude: ais_data.longitude,
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
