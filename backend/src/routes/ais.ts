import type { FastifyInstance, FastifyRequest } from "fastify";
import { eq, desc, and, gte, isNotNull, lt } from "drizzle-orm";
import * as schema from "../db/schema.js";
import type { App } from "../index.js";

const MOVING_SPEED_THRESHOLD = 2; // knots
const MYSHIPTRACKING_API_URL = 'https://api.myshiptracking.com/api/v2/vessel';
const MYSHIPTRACKING_API_KEY = process.env.MYSHIPTRACKING_API_KEY || '';

// Helper to mask API key for logging
function maskAPIKey(key: string): string {
  if (!key || key.length < 10) return '***';
  return key.substring(0, 10) + '***';
}

// Helper function to log API calls to debug log table
async function logAPICall(
  app: App,
  vesselId: string,
  mmsi: string,
  url: string,
  requestTime: Date,
  responseStatus: string,
  responseBody: string | null,
  authStatus: string,
  errorMessage: string | null
) {
  try {
    await app.db
      .insert(schema.ais_debug_logs)
      .values({
        vessel_id: vesselId,
        mmsi,
        api_url: url,
        request_time: requestTime,
        response_status: responseStatus,
        response_body: responseBody,
        authentication_status: authStatus,
        error_message: errorMessage,
      })
      .execute();
  } catch (logError) {
    app.logger.error(`Failed to log API call for MMSI ${mmsi}: ${logError}`);
  }
}

interface MyShipTrackingVesselResponse {
  mmsi?: number | string;
  imo?: number | string;
  name?: string;
  callsign?: string;
  ship_type?: string;
  status?: string;
  flag?: string;
  built?: number;
  length?: number;
  width?: number;
  latitude?: number;
  longitude?: number;
  speed?: number;
  course?: number;
  heading?: number;
  destination?: string;
  eta?: string;
  timestamp?: number;
  [key: string]: any;
}

interface AISVesselData {
  name: string | null;
  mmsi: string | null;
  imo: string | null;
  speed_knots: number | null;
  latitude: number | null;
  longitude: number | null;
  course: number | null;
  heading: number | null;
  timestamp: Date | null;
  status: string | null;
  destination: string | null;
  eta: string | null;
  callsign: string | null;
  ship_type: string | null;
  flag: string | null;
  is_moving: boolean;
  error: string | null;
}

async function fetchVesselAISData(
  mmsi: string,
  apiKey: string,
  logger: any,
  vesselId?: string,
  app?: App,
  extended: boolean = false
): Promise<AISVesselData> {
  try {
    // Build request URL with MMSI parameter and optional extended response
    const urlObj = new URL(MYSHIPTRACKING_API_URL);
    urlObj.searchParams.append('mmsi', mmsi);
    if (extended) {
      urlObj.searchParams.append('response', 'extended');
    }
    const url = urlObj.toString();
    const requestTime = new Date();

    // Log request details (mask API key for security)
    const maskedKey = maskAPIKey(apiKey);
    logger.info(`Calling MyShipTracking API - URL: ${url}, API Key: ${maskedKey}`);
    logger.debug(`Request headers - Authorization: Bearer ${maskedKey}, Content-Type: application/json`);

    let response;
    let authStatus = 'success';
    let errorMessage: string | null = null;

    try {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });
    } catch (fetchError) {
      authStatus = 'connection_error';
      errorMessage = String(fetchError);
      logger.error(`Connection error calling MyShipTracking API for MMSI ${mmsi}: ${fetchError}`);
      if (vesselId && app) {
        await logAPICall(app, vesselId, mmsi, url, requestTime, 'connection_error', null, authStatus, errorMessage);
      }
      return {
        name: null,
        mmsi: null,
        imo: null,
        speed_knots: null,
        latitude: null,
        longitude: null,
        course: null,
        heading: null,
        timestamp: null,
        status: null,
        destination: null,
        eta: null,
        callsign: null,
        ship_type: null,
        flag: null,
        is_moving: false,
        error: 'AIS service temporarily unavailable',
      };
    }

    logger.info(`MyShipTracking API response status: ${response.status} ${response.statusText}`);

    // Extract API credits info from headers
    const creditsRemaining = response.headers.get('X-Credits-Remaining');
    if (creditsRemaining) {
      logger.info(`API credits remaining: ${creditsRemaining}`);
    }

    if (response.status === 401) {
      authStatus = 'authentication_failed';
      errorMessage = 'Invalid API key';
      logger.error(`MyShipTracking API authentication failed (401) for MMSI ${mmsi} - invalid API key`);
      if (vesselId && app) {
        const responseBody = await response.text();
        await logAPICall(app, vesselId, mmsi, url, requestTime, '401', responseBody, authStatus, errorMessage);
      }
      return {
        name: null,
        mmsi: null,
        imo: null,
        speed_knots: null,
        latitude: null,
        longitude: null,
        course: null,
        heading: null,
        timestamp: null,
        status: null,
        destination: null,
        eta: null,
        callsign: null,
        ship_type: null,
        flag: null,
        is_moving: false,
        error: 'Invalid API key',
      };
    }

    if (response.status === 429) {
      authStatus = 'rate_limited';
      errorMessage = 'Rate limit exceeded';
      logger.warn(`MyShipTracking API rate limit exceeded (429) for MMSI ${mmsi}`);
      if (vesselId && app) {
        const responseBody = await response.text();
        await logAPICall(app, vesselId, mmsi, url, requestTime, '429', responseBody, authStatus, errorMessage);
      }
      return {
        name: null,
        mmsi: null,
        imo: null,
        speed_knots: null,
        latitude: null,
        longitude: null,
        course: null,
        heading: null,
        timestamp: null,
        status: null,
        destination: null,
        eta: null,
        callsign: null,
        ship_type: null,
        flag: null,
        is_moving: false,
        error: 'Rate limit exceeded',
      };
    }

    if (response.status === 404) {
      authStatus = 'success';
      errorMessage = 'Vessel not found in AIS system';
      logger.warn(`MyShipTracking API returned 404 - vessel with MMSI ${mmsi} not found in AIS system`);
      if (vesselId && app) {
        const responseBody = await response.text();
        await logAPICall(app, vesselId, mmsi, url, requestTime, '404', responseBody, authStatus, errorMessage);
      }
      return {
        name: null,
        mmsi: null,
        imo: null,
        speed_knots: null,
        latitude: null,
        longitude: null,
        course: null,
        heading: null,
        timestamp: null,
        status: null,
        destination: null,
        eta: null,
        callsign: null,
        ship_type: null,
        flag: null,
        is_moving: false,
        error: 'Vessel not found in AIS system',
      };
    }

    if (!response.ok) {
      authStatus = 'success';
      errorMessage = `HTTP ${response.status} ${response.statusText}`;
      logger.error(`MyShipTracking API error for MMSI ${mmsi}: ${response.status} ${response.statusText}`);
      if (vesselId && app) {
        const responseBody = await response.text();
        await logAPICall(app, vesselId, mmsi, url, requestTime, String(response.status), responseBody, authStatus, errorMessage);
      }
      return {
        name: null,
        mmsi: null,
        imo: null,
        speed_knots: null,
        latitude: null,
        longitude: null,
        course: null,
        heading: null,
        timestamp: null,
        status: null,
        destination: null,
        eta: null,
        callsign: null,
        ship_type: null,
        flag: null,
        is_moving: false,
        error: 'AIS service temporarily unavailable',
      };
    }

    const data: MyShipTrackingVesselResponse = await response.json();
    logger.info(`Received AIS response for MMSI ${mmsi}`);

    // Log complete raw response for diagnostics
    const fullResponseJSON = JSON.stringify(data, null, 2);
    logger.info(`Raw API Response (Full Object):\n${fullResponseJSON}`);

    // Log individual response fields for clarity
    logger.info(`AIS Response Fields - MMSI: ${data.mmsi}, IMO: ${data.imo}, Name: ${data.name}`);
    logger.info(`AIS Response Fields - Position: [${data.latitude}, ${data.longitude}], Speed: ${data.speed} knots, Course: ${data.course}°`);
    logger.info(`AIS Response Fields - Status: ${data.status}, Heading: ${data.heading}°, Destination: ${data.destination}`);
    logger.info(`AIS Response Fields - ETA: ${data.eta}, Ship Type: ${data.ship_type}, Flag: ${data.flag}`);
    logger.info(`AIS Response Fields - Callsign: ${data.callsign}, Built: ${data.built}, Timestamp: ${data.timestamp}`);

    if (vesselId && app) {
      const responseBody = JSON.stringify(data).substring(0, 1000);
      await logAPICall(app, vesselId, mmsi, url, requestTime, '200', responseBody, authStatus, null);
    }

    // Extract vessel data from response
    const vesselMmsi = data.mmsi ? String(data.mmsi) : null;
    const imo = data.imo ? String(data.imo) : null;
    const latitude = data.latitude ? parseFloat(String(data.latitude)) : null;
    const longitude = data.longitude ? parseFloat(String(data.longitude)) : null;
    const name = data.name ? String(data.name) : null;
    const speed = data.speed ? parseFloat(String(data.speed)) : null;
    const course = data.course ? parseFloat(String(data.course)) : null;
    const heading = data.heading ? parseFloat(String(data.heading)) : null;
    const status = data.status ? String(data.status) : null;
    const destination = data.destination ? String(data.destination) : null;
    const eta = data.eta ? String(data.eta) : null;
    const callsign = data.callsign ? String(data.callsign) : null;
    const ship_type = data.ship_type ? String(data.ship_type) : null;
    const flag = data.flag ? String(data.flag) : null;
    const timestamp = data.timestamp
      ? new Date(parseFloat(String(data.timestamp)) * 1000)
      : new Date();

    const is_moving = speed !== null && speed > MOVING_SPEED_THRESHOLD;

    // Log extracted and processed values
    logger.info(
      `Processed AIS data for MMSI ${mmsi}: name=${name}, speed=${speed} knots, is_moving=${is_moving}, lat=${latitude}, lon=${longitude}, destination=${destination}, eta=${eta}`
    );

    // Log null/missing field warnings for diagnostics
    if (latitude === null || longitude === null) {
      logger.warn(`Missing position data for MMSI ${mmsi}: latitude=${latitude}, longitude=${longitude}`);
    }
    if (speed === null) {
      logger.warn(`Missing speed data for MMSI ${mmsi}: speed=null`);
    }
    if (name === null) {
      logger.warn(`Missing vessel name for MMSI ${mmsi}: name=null`);
    }
    if (status === null) {
      logger.warn(`Missing status data for MMSI ${mmsi}: status=null`);
    }
    if (destination === null) {
      logger.debug(`Missing destination data for MMSI ${mmsi}: destination=null`);
    }
    if (eta === null) {
      logger.debug(`Missing ETA data for MMSI ${mmsi}: eta=null`);
    }

    return {
      name,
      mmsi: vesselMmsi,
      imo,
      speed_knots: speed,
      latitude,
      longitude,
      course,
      heading,
      timestamp,
      status,
      destination,
      eta,
      callsign,
      ship_type,
      flag,
      is_moving,
      error: null,
    };
  } catch (error) {
    logger.error(`Error fetching vessel AIS data for MMSI ${mmsi}: ${error}`);
    return {
      name: null,
      mmsi: null,
      imo: null,
      speed_knots: null,
      latitude: null,
      longitude: null,
      course: null,
      heading: null,
      timestamp: null,
      status: null,
      destination: null,
      eta: null,
      callsign: null,
      ship_type: null,
      flag: null,
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
        502: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request, reply) => {
    const { vesselId } = request.params;

    // Check if API key is configured
    if (!MYSHIPTRACKING_API_KEY) {
      app.logger.error('MyShipTracking API key is not configured in environment');
      return reply.code(500).send({ error: 'AIS service not configured - API key missing' });
    }

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

    // Fetch real-time AIS data from MyShipTracking API with extended response
    const ais_data = await fetchVesselAISData(mmsi, MYSHIPTRACKING_API_KEY, app.logger, vesselId, app, true);

    // Check for API errors and return appropriate status codes
    if (ais_data.error) {
      if (ais_data.error === 'Invalid API key') {
        app.logger.error(`Invalid MyShipTracking API key - authentication failed for MMSI ${mmsi}`);
        return reply.code(500).send({ error: 'Invalid API key - AIS service authentication failed' });
      } else if (ais_data.error === 'Vessel not found in AIS system') {
        app.logger.warn(`Vessel with MMSI ${mmsi} not found in AIS system`);
        return reply.code(404).send({ error: `Vessel with MMSI ${mmsi} not found in AIS system` });
      } else {
        // AIS service temporarily unavailable
        app.logger.error(`AIS service error for MMSI ${mmsi}: ${ais_data.error}`);
        return reply.code(502).send({ error: 'AIS service temporarily unavailable' });
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

  // GET /api/ais/check/:vesselId - Manual AIS check (retrieve current location data)
  fastify.get<{ Params: { vesselId: string }; Querystring: { extended?: string } }>('/api/ais/check/:vesselId', {
    schema: {
      description: 'Get current vessel location data from AIS',
      tags: ['ais'],
      params: {
        type: 'object',
        required: ['vesselId'],
        properties: { vesselId: { type: 'string' } },
      },
      querystring: {
        type: 'object',
        properties: { extended: { type: 'string' } },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            mmsi: { type: 'string' },
            imo: { type: ['string', 'null'] },
            name: { type: ['string', 'null'] },
            latitude: { type: ['number', 'null'] },
            longitude: { type: ['number', 'null'] },
            speed: { type: ['number', 'null'] },
            course: { type: ['number', 'null'] },
            heading: { type: ['number', 'null'] },
            timestamp: { type: ['string', 'null'] },
            status: { type: ['string', 'null'] },
            destination: { type: ['string', 'null'] },
            eta: { type: ['string', 'null'] },
            callsign: { type: ['string', 'null'] },
            vessel_type: { type: ['string', 'null'] },
            flag: { type: ['string', 'null'] },
          },
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
        502: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request, reply) => {
    const { vesselId } = request.params;
    const extended = request.query.extended === 'true';

    app.logger.info(`Manual AIS check requested for vessel: ${vesselId}`);

    // Validate API key
    if (!MYSHIPTRACKING_API_KEY) {
      app.logger.error('MyShipTracking API key not configured');
      return reply.code(500).send({ error: 'AIS service not configured - API key missing' });
    }

    // Fetch vessel from database
    const vessel = await app.db
      .select()
      .from(schema.vessels)
      .where(eq(schema.vessels.id, vesselId));

    if (vessel.length === 0) {
      app.logger.warn(`Vessel not found: ${vesselId}`);
      return reply.code(404).send({ error: 'Vessel not found' });
    }

    const mmsi = vessel[0].mmsi;
    const ais_data = await fetchVesselAISData(mmsi, MYSHIPTRACKING_API_KEY, app.logger, vesselId, app, extended);

    if (ais_data.error) {
      if (ais_data.error === 'Invalid API key') {
        app.logger.error(`Authentication failed for MMSI ${mmsi}`);
        return reply.code(401).send({ error: 'Invalid API key' });
      } else if (ais_data.error === 'Vessel not found in AIS system') {
        app.logger.warn(`Vessel ${mmsi} not found in AIS system`);
        return reply.code(404).send({ error: 'Vessel not found in AIS system' });
      } else {
        app.logger.error(`AIS service error: ${ais_data.error}`);
        return reply.code(502).send({ error: 'AIS service temporarily unavailable' });
      }
    }

    const response = {
      mmsi: ais_data.mmsi || mmsi,
      imo: ais_data.imo,
      name: ais_data.name,
      latitude: ais_data.latitude,
      longitude: ais_data.longitude,
      speed: ais_data.speed_knots,
      course: ais_data.course,
      heading: ais_data.heading,
      timestamp: ais_data.timestamp?.toISOString() || null,
      status: ais_data.status,
      destination: ais_data.destination,
      eta: ais_data.eta,
      callsign: extended ? ais_data.callsign : undefined,
      vessel_type: extended ? ais_data.ship_type : undefined,
      flag: extended ? ais_data.flag : undefined,
    };

    app.logger.info(`Returned manual AIS check for MMSI ${mmsi} with extended=${extended} - fields: name=${response.name}, speed=${response.speed}, lat=${response.latitude}, lon=${response.longitude}, destination=${response.destination}, eta=${response.eta}`);
    return reply.code(200).send(response);
  });

  // POST /api/ais/schedule-check - Schedule automatic AIS checks
  fastify.post<{ Body: { vessel_id: string; interval_hours: number } }>('/api/ais/schedule-check', {
    schema: {
      description: 'Schedule automatic AIS checks for a vessel',
      tags: ['ais'],
      body: {
        type: 'object',
        required: ['vessel_id', 'interval_hours'],
        properties: {
          vessel_id: { type: 'string' },
          interval_hours: { type: 'number' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            task_id: { type: 'string' },
            vessel_id: { type: 'string' },
            interval_hours: { type: 'number' },
            next_run: { type: 'string' },
            is_active: { type: 'boolean' },
          },
        },
        404: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request, reply) => {
    const { vessel_id, interval_hours } = request.body;

    app.logger.info(`Scheduling AIS check for vessel ${vessel_id} with interval ${interval_hours} hours`);

    // Verify vessel exists
    const vessel = await app.db
      .select()
      .from(schema.vessels)
      .where(eq(schema.vessels.id, vessel_id));

    if (vessel.length === 0) {
      app.logger.warn(`Vessel not found: ${vessel_id}`);
      return reply.code(404).send({ error: 'Vessel not found' });
    }

    // Delete any existing scheduled tasks for this vessel
    await app.db
      .delete(schema.scheduled_tasks)
      .where(
        and(
          eq(schema.scheduled_tasks.vessel_id, vessel_id),
          eq(schema.scheduled_tasks.task_type, 'ais_check')
        )
      )
      .execute();

    // Create new scheduled task
    const now = new Date();
    const nextRun = new Date(now.getTime() + interval_hours * 60 * 60 * 1000);

    const [task] = await app.db
      .insert(schema.scheduled_tasks)
      .values({
        task_type: 'ais_check',
        vessel_id,
        interval_hours: String(interval_hours),
        next_run: nextRun,
        is_active: true,
      })
      .returning();

    app.logger.info(`Created scheduled task ${task.id} for vessel ${vessel_id}, next run: ${nextRun}`);

    return reply.code(200).send({
      task_id: task.id,
      vessel_id: task.vessel_id,
      interval_hours: parseInt(task.interval_hours),
      next_run: nextRun.toISOString(),
      is_active: task.is_active,
    });
  });

  // GET /api/ais/debug/:vesselId - Get debug logs for vessel API calls
  fastify.get<{ Params: { vesselId: string }; Querystring: { limit?: string } }>('/api/ais/debug/:vesselId', {
    schema: {
      description: 'Get debug logs for vessel AIS API calls',
      tags: ['ais'],
      params: {
        type: 'object',
        required: ['vesselId'],
        properties: { vesselId: { type: 'string' } },
      },
      querystring: {
        type: 'object',
        properties: { limit: { type: 'string' } },
      },
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              mmsi: { type: 'string' },
              api_url: { type: 'string' },
              request_time: { type: 'string' },
              response_status: { type: 'string' },
              response_body: { type: ['string', 'null'] },
              authentication_status: { type: 'string' },
              error_message: { type: ['string', 'null'] },
              created_at: { type: 'string' },
            },
          },
        },
        404: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request, reply) => {
    const { vesselId } = request.params;
    const limit = request.query.limit ? parseInt(request.query.limit) : 10;

    app.logger.info(`Retrieving debug logs for vessel ${vesselId}, limit: ${limit}`);

    // Verify vessel exists
    const vessel = await app.db
      .select()
      .from(schema.vessels)
      .where(eq(schema.vessels.id, vesselId));

    if (vessel.length === 0) {
      app.logger.warn(`Vessel not found: ${vesselId}`);
      return reply.code(404).send({ error: 'Vessel not found' });
    }

    // Fetch debug logs
    const logs = await app.db
      .select()
      .from(schema.ais_debug_logs)
      .where(eq(schema.ais_debug_logs.vessel_id, vesselId))
      .orderBy(desc(schema.ais_debug_logs.request_time))
      .limit(Math.min(limit, 100));

    app.logger.info(`Retrieved ${logs.length} debug logs for vessel ${vesselId}`);

    return reply.code(200).send(logs);
  });
}
