import { eq, and, desc, isNotNull, lte } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';
import { fetchVesselAISData } from '../routes/ais.js';

const SCHEDULER_CHECK_INTERVAL_MS = 60 * 1000; // Check every minute
const LOCATION_CHANGE_THRESHOLD = 0.1; // degrees (latitude/longitude)

let schedulerInterval: NodeJS.Timeout | null = null;
let isSchedulerRunning = false;

/**
 * Start the background scheduler for periodic vessel position checks
 */
export async function startScheduler(app: App): Promise<void> {
  if (schedulerInterval) {
    app.logger.warn('Scheduler is already running');
    return;
  }

  app.logger.info('Starting automatic vessel position scheduler');

  // Run the scheduler immediately on startup
  await runSchedulerIteration(app);

  // Then schedule it to run every minute
  schedulerInterval = setInterval(async () => {
    await runSchedulerIteration(app);
  }, SCHEDULER_CHECK_INTERVAL_MS);

  app.logger.info('Scheduler started - will check for due tasks every minute');
}

/**
 * Stop the background scheduler
 */
export function stopScheduler(app: App): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    app.logger.info('Scheduler stopped');
  }
}

/**
 * Run a single scheduler iteration - check for due tasks
 */
async function runSchedulerIteration(app: App): Promise<void> {
  if (isSchedulerRunning) {
    app.logger.debug('Scheduler iteration already in progress, skipping');
    return;
  }

  isSchedulerRunning = true;

  try {
    const now = new Date();
    app.logger.debug(`Scheduler check at ${now.toISOString()}`);

    // Find all due scheduled tasks that are active
    const dueTasks = await app.db
      .select({
        task: schema.scheduled_tasks,
        vessel: schema.vessels,
      })
      .from(schema.scheduled_tasks)
      .innerJoin(schema.vessels, eq(schema.vessels.id, schema.scheduled_tasks.vessel_id))
      .where(
        and(
          eq(schema.scheduled_tasks.task_type, 'ais_check'),
          eq(schema.scheduled_tasks.is_active, true),
          lte(schema.scheduled_tasks.next_run, now)
        )
      );

    if (dueTasks.length === 0) {
      app.logger.debug('No due tasks found');
      return;
    }

    app.logger.info(`Found ${dueTasks.length} due scheduled task(s)`);

    // Process each due task
    for (const { task, vessel } of dueTasks) {
      try {
        await processScheduledTask(app, task, vessel);
      } catch (error) {
        app.logger.error(
          { err: error, taskId: task.id, vesselId: vessel.id, mmsi: vessel.mmsi },
          `Error processing scheduled task for vessel ${vessel.vessel_name} (MMSI: ${vessel.mmsi})`
        );
      }
    }
  } catch (error) {
    app.logger.error({ err: error }, 'Error in scheduler iteration');
  } finally {
    isSchedulerRunning = false;
  }
}

/**
 * Process a single scheduled task
 */
async function processScheduledTask(
  app: App,
  task: typeof schema.scheduled_tasks.$inferSelect,
  vessel: typeof schema.vessels.$inferSelect
): Promise<void> {
  const { id: taskId, vessel_id: vesselId, interval_hours, next_run } = task;
  const { vessel_name, mmsi, id } = vessel;

  app.logger.info(
    `Processing scheduled AIS check: task=${taskId}, vessel=${vessel_name} (MMSI: ${mmsi}), scheduled_for=${next_run.toISOString()}`
  );

  const apiKey = process.env.MYSHIPTRACKING_API_KEY;
  if (!apiKey) {
    app.logger.warn('MyShipTracking API key not configured, skipping task execution');
    return;
  }

  // Fetch current vessel AIS data
  const ais_data = await fetchVesselAISData(mmsi, apiKey, app.logger, vesselId, app, true);

  if (ais_data.error) {
    app.logger.warn(
      { error: ais_data.error },
      `Failed to fetch AIS data for scheduled task: ${taskId}, vessel=${vessel_name} (MMSI: ${mmsi})`
    );
    return;
  }

  // Store the AIS check result
  const check_time = new Date();
  const [ais_check] = await app.db
    .insert(schema.ais_checks)
    .values({
      user_id: vessel.user_id,
      vessel_id: vesselId,
      check_time,
      is_moving: ais_data.is_moving,
      speed_knots: ais_data.speed_knots !== null ? String(ais_data.speed_knots) : null,
      latitude: ais_data.latitude !== null ? String(ais_data.latitude) : null,
      longitude: ais_data.longitude !== null ? String(ais_data.longitude) : null,
    })
    .returning();

  app.logger.info(
    {
      taskId,
      vesselId,
      mmsi,
      checkId: ais_check.id,
      isMoving: ais_data.is_moving,
      speed: ais_data.speed_knots,
      latitude: ais_data.latitude,
      longitude: ais_data.longitude,
    },
    `AIS check completed for vessel ${vessel_name}: is_moving=${ais_data.is_moving}, speed=${ais_data.speed_knots} knots`
  );

  // Handle sea time entry lifecycle based on movement analysis
  await handleSeaTimeEntries(app, vessel, vesselId, vessel_name, mmsi, ais_data.is_moving, check_time, taskId);

  // Update the scheduled task with new run times
  const intervalHours = parseInt(interval_hours);
  const nextRunTime = new Date(check_time.getTime() + intervalHours * 60 * 60 * 1000);

  const [updatedTask] = await app.db
    .update(schema.scheduled_tasks)
    .set({
      last_run: check_time,
      next_run: nextRunTime,
    })
    .where(eq(schema.scheduled_tasks.id, taskId))
    .returning();

  app.logger.info(
    {
      taskId,
      vesselId,
      mmsi,
      lastRun: check_time.toISOString(),
      nextRun: nextRunTime.toISOString(),
    },
    `Updated scheduled task for vessel ${vessel_name}: next check at ${nextRunTime.toISOString()}`
  );
}

/**
 * Handle sea time entry creation based on location changes
 * First AIS location: log it, don't create entry
 * Second location with >0.1 degree change: create pending sea day entry
 */
async function handleSeaTimeEntries(
  app: App,
  vessel: typeof schema.vessels.$inferSelect,
  vesselId: string,
  vessel_name: string,
  mmsi: string,
  is_moving: boolean,
  check_time: Date,
  taskId: string
): Promise<void> {
  // Get the two most recent AIS checks for this vessel
  const recentChecks = await app.db
    .select()
    .from(schema.ais_checks)
    .where(eq(schema.ais_checks.vessel_id, vesselId))
    .orderBy(desc(schema.ais_checks.check_time))
    .limit(2);

  app.logger.debug(
    { vesselId, mmsi, recentChecksCount: recentChecks.length },
    `Found ${recentChecks.length} recent AIS check(s) for vessel ${vessel_name}`
  );

  // Need at least 2 checks to determine movement
  if (recentChecks.length < 2) {
    app.logger.debug(
      { vesselId, mmsi },
      `Vessel ${vessel_name} has fewer than 2 AIS checks, logging current position only`
    );
    return;
  }

  // Checks are ordered newest first, so [0] is current, [1] is previous
  const currentCheck = recentChecks[0];
  const previousCheck = recentChecks[1];

  // Both checks need valid position data
  if (!currentCheck.latitude || !currentCheck.longitude || !previousCheck.latitude || !previousCheck.longitude) {
    app.logger.debug(
      { vesselId, mmsi },
      `Vessel ${vessel_name} missing position data in recent checks`
    );
    return;
  }

  const currentLat = parseFloat(String(currentCheck.latitude));
  const currentLng = parseFloat(String(currentCheck.longitude));
  const previousLat = parseFloat(String(previousCheck.latitude));
  const previousLng = parseFloat(String(previousCheck.longitude));

  // Calculate coordinate difference
  const latDiff = Math.abs(currentLat - previousLat);
  const lngDiff = Math.abs(currentLng - previousLng);
  const maxDiff = Math.max(latDiff, lngDiff);

  app.logger.debug(
    {
      vesselId,
      mmsi,
      previousLat,
      previousLng,
      currentLat,
      currentLng,
      latDiff: Math.round(latDiff * 10000) / 10000,
      lngDiff: Math.round(lngDiff * 10000) / 10000,
      maxDiff: Math.round(maxDiff * 10000) / 10000,
    },
    `Vessel ${vessel_name} location change: lat Δ=${Math.round(latDiff * 10000) / 10000}°, lng Δ=${Math.round(lngDiff * 10000) / 10000}°`
  );

  // Check if location has changed significantly (more than threshold)
  if (maxDiff > LOCATION_CHANGE_THRESHOLD) {
    // Validate that start and end coordinates are different
    // Prevent creating entries when coordinates are identical despite different timestamps
    const coordinatesAreIdentical = previousLat === currentLat && previousLng === currentLng;

    if (coordinatesAreIdentical) {
      app.logger.warn(
        {
          vesselId,
          mmsi,
          startLat: previousLat,
          startLng: previousLng,
          endLat: currentLat,
          endLng: currentLng,
          startTime: previousCheck.check_time.toISOString(),
          endTime: currentCheck.check_time.toISOString(),
          maxDiff: Math.round(maxDiff * 10000) / 10000,
        },
        `Vessel ${vessel_name} has identical coordinates (${previousLat}, ${previousLng}) despite different timestamps - skipping sea time entry creation`
      );
      return;
    }

    // Check if there's already an open pending sea time entry
    const openEntry = await app.db
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

    if (openEntry.length === 0) {
      // Calculate duration and sea_days
      const duration_ms = currentCheck.check_time.getTime() - previousCheck.check_time.getTime();
      const duration_hours = Math.round((duration_ms / (1000 * 60 * 60)) * 100) / 100;
      const sea_days = duration_hours >= 4 ? 1 : 0; // Calculate sea_days: 1 if >= 4 hours, else 0

      // Create new sea time entry with coordinates from both checks
      const [new_entry] = await app.db
        .insert(schema.sea_time_entries)
        .values({
          user_id: vessel.user_id,
          vessel_id: vesselId,
          start_time: previousCheck.check_time,
          end_time: currentCheck.check_time,
          duration_hours: String(duration_hours),
          sea_days: sea_days,
          start_latitude: String(previousLat),
          start_longitude: String(previousLng),
          end_latitude: String(currentLat),
          end_longitude: String(currentLng),
          status: 'pending',
        })
        .returning();

      app.logger.info(
        {
          taskId,
          vesselId,
          mmsi,
          entryId: new_entry.id,
          startTime: previousCheck.check_time.toISOString(),
          startLat: previousLat,
          startLng: previousLng,
          endTime: currentCheck.check_time.toISOString(),
          endLat: currentLat,
          endLng: currentLng,
          locationDelta: Math.round(maxDiff * 10000) / 10000,
          durationHours: duration_hours,
          seaDays: sea_days,
        },
        `Created sea day entry for vessel ${vessel_name}: location changed ${Math.round(maxDiff * 10000) / 10000}° (threshold: ${LOCATION_CHANGE_THRESHOLD}°), duration: ${duration_hours} hours, sea days: ${sea_days}`
      );
    } else {
      app.logger.debug(
        { vesselId, mmsi, entryId: openEntry[0].id },
        `Vessel ${vessel_name} location has changed but pending entry already exists, skipping creation`
      );
    }
  } else {
    app.logger.debug(
      { vesselId, mmsi, maxDiff: Math.round(maxDiff * 10000) / 10000, threshold: LOCATION_CHANGE_THRESHOLD },
      `Vessel ${vessel_name} location change of ${Math.round(maxDiff * 10000) / 10000}° is below threshold of ${LOCATION_CHANGE_THRESHOLD}°`
    );
  }
}
