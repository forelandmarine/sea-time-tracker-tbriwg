import { eq, and, desc, isNotNull, lte } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';
import { fetchVesselAISData } from '../routes/ais.js';
import { processNotificationSchedules } from '../routes/notifications.js';

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

    // Process notification schedules
    try {
      await processNotificationSchedules(app);
    } catch (error) {
      app.logger.error({ err: error }, 'Error processing notification schedules');
    }

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
 * Handle sea time entry creation with simplified 4-hour window logic
 *
 * SIMPLIFIED ALGORITHM:
 * 1. Get current AIS position (from check_time)
 * 2. Get AIS position from 4 hours ago
 * 3. If position difference > 0.1 degrees (latitude or longitude):
 *    - Create a pending sea time entry with both positions and timestamps
 *    - User will review on the confirmations page
 * 4. If difference <= 0.1 degrees:
 *    - No entry created (vessel hasn't moved significantly)
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
  // Get AIS position from 4 hours ago
  const fourHoursAgo = new Date(check_time.getTime() - 4 * 60 * 60 * 1000);

  const allChecks = await app.db
    .select()
    .from(schema.ais_checks)
    .where(eq(schema.ais_checks.vessel_id, vesselId))
    .orderBy(schema.ais_checks.check_time);

  // Find the most recent check before 4 hours ago
  const oldCheck = allChecks
    .filter(check => check.check_time <= fourHoursAgo)
    .sort((a, b) => new Date(b.check_time).getTime() - new Date(a.check_time).getTime())[0];

  if (!oldCheck) {
    app.logger.debug(
      { vesselId, mmsi, fourHoursAgoTime: fourHoursAgo.toISOString() },
      `No AIS check found from 4 hours ago for vessel ${vessel_name}, skipping entry creation`
    );
    return;
  }

  // Get current check (most recent)
  const currentCheck = allChecks[allChecks.length - 1];

  if (!currentCheck || !oldCheck.latitude || !oldCheck.longitude || !currentCheck.latitude || !currentCheck.longitude) {
    app.logger.debug(
      { vesselId, mmsi },
      `Missing position data for vessel ${vessel_name}, skipping entry creation`
    );
    return;
  }

  // Calculate position difference
  const oldLat = parseFloat(String(oldCheck.latitude));
  const oldLng = parseFloat(String(oldCheck.longitude));
  const currentLat = parseFloat(String(currentCheck.latitude));
  const currentLng = parseFloat(String(currentCheck.longitude));

  const latDiff = Math.abs(currentLat - oldLat);
  const lngDiff = Math.abs(currentLng - oldLng);
  const maxDiff = Math.max(latDiff, lngDiff);

  app.logger.info(
    {
      vesselId,
      mmsi,
      oldCheckTime: oldCheck.check_time.toISOString(),
      oldLat,
      oldLng,
      currentCheckTime: currentCheck.check_time.toISOString(),
      currentLat,
      currentLng,
      latDiff: Math.round(latDiff * 10000) / 10000,
      lngDiff: Math.round(lngDiff * 10000) / 10000,
      maxDiff: Math.round(maxDiff * 10000) / 10000,
      movementDetected: maxDiff > LOCATION_CHANGE_THRESHOLD,
    },
    `4-hour window analysis for vessel ${vessel_name}: position change ${Math.round(maxDiff * 10000) / 10000}°`
  );

  // No movement detected
  if (maxDiff <= LOCATION_CHANGE_THRESHOLD) {
    app.logger.debug(
      { vesselId, mmsi, positionChange: Math.round(maxDiff * 10000) / 10000 },
      `Vessel ${vessel_name} has not moved significantly (${Math.round(maxDiff * 10000) / 10000}° <= ${LOCATION_CHANGE_THRESHOLD}°), skipping entry creation`
    );
    return;
  }

  // Calculate duration
  const durationMs = currentCheck.check_time.getTime() - oldCheck.check_time.getTime();
  const durationHours = Math.round((durationMs / (1000 * 60 * 60)) * 100) / 100;

  app.logger.info(
    {
      vesselId,
      mmsi,
      positionChange: Math.round(maxDiff * 10000) / 10000,
      durationHours,
    },
    `Movement detected for vessel ${vessel_name}: ${Math.round(maxDiff * 10000) / 10000}° over ${durationHours} hours`
  );

  // Create pending sea time entry
  const notes = `Movement detected: vessel moved ${Math.round(maxDiff * 10000) / 10000}° over ${durationHours} hours`;

  try {
    const [new_entry] = await app.db
      .insert(schema.sea_time_entries)
      .values({
        user_id: vessel.user_id,
        vessel_id: vesselId,
        start_time: oldCheck.check_time,
        end_time: currentCheck.check_time,
        duration_hours: String(durationHours),
        start_latitude: String(oldLat),
        start_longitude: String(oldLng),
        end_latitude: String(currentLat),
        end_longitude: String(currentLng),
        status: 'pending',
        service_type: 'actual_sea_service',
        notes: notes,
      })
      .returning();

    app.logger.info(
      {
        taskId,
        vesselId,
        mmsi,
        entryId: new_entry.id,
        startTime: oldCheck.check_time.toISOString(),
        endTime: currentCheck.check_time.toISOString(),
        durationHours,
        positionChange: Math.round(maxDiff * 10000) / 10000,
      },
      `Created pending sea time entry for vessel ${vessel_name}: ${Math.round(maxDiff * 10000) / 10000}° movement over ${durationHours} hours`
    );
  } catch (error) {
    app.logger.error(
      { err: error, vesselId, mmsi, taskId },
      `Failed to create sea time entry for vessel ${vessel_name}`
    );
  }
}
