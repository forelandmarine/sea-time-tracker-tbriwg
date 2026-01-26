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
    app.logger.debug(`Scheduler iteration at ${now.toISOString()}`);

    // Process notification schedules
    try {
      await processNotificationSchedules(app);
    } catch (error) {
      app.logger.error({ err: error }, 'Error processing notification schedules');
    }

    // Find all due scheduled tasks that are active AND for active vessels only
    app.logger.debug(
      { currentTime: now.toISOString() },
      'Querying for due AIS check tasks where: task_type=ais_check AND task.is_active=true AND vessel.is_active=true AND next_run <= now'
    );

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
          eq(schema.vessels.is_active, true),
          lte(schema.scheduled_tasks.next_run, now)
        )
      );

    app.logger.debug(
      {
        queriedTime: now.toISOString(),
        foundDueTasks: dueTasks.length,
        tasks: dueTasks.map(({ task, vessel }) => ({
          taskId: task.id,
          vesselId: vessel.id,
          vesselName: vessel.vessel_name,
          mmsi: vessel.mmsi,
          nextRun: task.next_run.toISOString(),
          isDue: task.next_run <= now,
        })),
      },
      `Query result: found ${dueTasks.length} due AIS check task(s) for active vessels`
    );

    if (dueTasks.length === 0) {
      app.logger.debug('No due AIS check tasks found for active vessels');
      return;
    }

    app.logger.info(
      { taskCount: dueTasks.length, timestamp: now.toISOString() },
      `Found ${dueTasks.length} due AIS check task(s) for active vessels - checking vessel positions every 2 hours`
    );

    // Process each due task and track results
    let processedSuccessfully = 0;
    let processedWithErrors = 0;

    // Process each due task
    for (const { task, vessel } of dueTasks) {
      try {
        app.logger.info(
          {
            taskId: task.id,
            vesselId: vessel.id,
            vesselName: vessel.vessel_name,
            mmsi: vessel.mmsi,
            userId: vessel.user_id,
            interval: task.interval_hours,
          },
          `Executing AIS check task for vessel ${vessel.vessel_name} (MMSI: ${vessel.mmsi}) with ${task.interval_hours}-hour interval`
        );

        await processScheduledTask(app, task, vessel);
        processedSuccessfully++;
      } catch (error) {
        processedWithErrors++;
        app.logger.error(
          { err: error, taskId: task.id, vesselId: vessel.id, mmsi: vessel.mmsi },
          `Error processing scheduled task for vessel ${vessel.vessel_name} (MMSI: ${vessel.mmsi})`
        );
      }
    }

    // Log summary of scheduler iteration
    app.logger.info(
      {
        totalTasksFound: dueTasks.length,
        processedSuccessfully,
        processedWithErrors,
        completionRate: dueTasks.length > 0 ? `${Math.round((processedSuccessfully / dueTasks.length) * 100)}%` : 'N/A',
        iterationTime: now.toISOString(),
      },
      `Scheduler iteration complete: ${dueTasks.length} tasks found, ${processedSuccessfully} processed successfully, ${processedWithErrors} failed`
    );
  } catch (error) {
    app.logger.error({ err: error }, 'Error in scheduler iteration');
  } finally {
    isSchedulerRunning = false;
  }
}

/**
 * Update the scheduled task's next_run time
 */
async function updateScheduledTaskNextRun(
  app: App,
  taskId: string,
  intervalHours: string
): Promise<void> {
  try {
    const checkTime = new Date();
    const intervalHoursNum = parseInt(intervalHours);
    const nextRunTime = new Date(checkTime.getTime() + intervalHoursNum * 60 * 60 * 1000);

    await app.db
      .update(schema.scheduled_tasks)
      .set({
        last_run: checkTime,
        next_run: nextRunTime,
      })
      .where(eq(schema.scheduled_tasks.id, taskId));

    app.logger.debug(
      { taskId, lastRun: checkTime.toISOString(), nextRun: nextRunTime.toISOString() },
      `Updated scheduled task next_run time`
    );
  } catch (error) {
    app.logger.error(
      { err: error, taskId },
      `Failed to update scheduled task next_run time`
    );
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
  const { vessel_name, mmsi, id, is_active, user_id } = vessel;

  app.logger.info(
    {
      taskId,
      vesselId,
      vesselName: vessel_name,
      mmsi,
      userId: user_id,
      isActive: is_active,
      scheduledFor: next_run.toISOString(),
    },
    `Processing scheduled AIS check for active vessel ${vessel_name} (MMSI: ${mmsi}) for user ${user_id}: checking 2-hour position window`
  );

  const apiKey = process.env.MYSHIPTRACKING_API_KEY;
  if (!apiKey) {
    app.logger.warn('MyShipTracking API key not configured, skipping task execution');
    return;
  }

  // Fetch current vessel AIS data with userId for proper logging
  const ais_data = await fetchVesselAISData(mmsi, apiKey, app.logger, vesselId, app, true, user_id);

  if (ais_data.error) {
    app.logger.warn(
      { error: ais_data.error, taskId, vesselId, mmsi },
      `Failed to fetch AIS data for scheduled task: ${taskId}, vessel=${vessel_name} (MMSI: ${mmsi})`
    );
    // Still update the task's next_run time even on fetch error
    await updateScheduledTaskNextRun(app, taskId, interval_hours);
    return;
  }

  // Store the AIS check result
  const check_time = new Date();

  app.logger.debug(
    {
      taskId,
      vesselId,
      mmsi,
      userId: user_id,
      checkTime: check_time.toISOString(),
      isMoving: ais_data.is_moving,
      speed: ais_data.speed_knots,
      latitude: ais_data.latitude,
      longitude: ais_data.longitude,
    },
    `[2-HOUR OBSERVATION] About to insert AIS check with location data for vessel ${vessel_name} (MMSI: ${mmsi}): lat=${ais_data.latitude}, lng=${ais_data.longitude}, speed=${ais_data.speed_knots}kts, moving=${ais_data.is_moving}`
  );

  let ais_check: typeof schema.ais_checks.$inferSelect | null = null;
  let insertError: Error | null = null;

  try {
    const insertResult = await app.db
      .insert(schema.ais_checks)
      .values({
        user_id: user_id,
        vessel_id: vesselId,
        check_time,
        is_moving: ais_data.is_moving,
        speed_knots: ais_data.speed_knots !== null ? String(ais_data.speed_knots) : null,
        latitude: ais_data.latitude !== null ? String(ais_data.latitude) : null,
        longitude: ais_data.longitude !== null ? String(ais_data.longitude) : null,
      })
      .returning();

    if (!insertResult || insertResult.length === 0) {
      app.logger.error(
        { taskId, vesselId, mmsi },
        `AIS check insert returned no results for vessel ${vessel_name} (MMSI: ${mmsi})`
      );
      insertError = new Error('Insert returned no results');
    } else {
      ais_check = insertResult[0];

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
          checkTime: ais_check.check_time.toISOString(),
        },
        `AIS check inserted successfully for vessel ${vessel_name} (MMSI: ${mmsi}): checkId=${ais_check.id}, is_moving=${ais_data.is_moving}, speed=${ais_data.speed_knots} knots, lat=${ais_data.latitude}, lng=${ais_data.longitude}, time=${ais_check.check_time.toISOString()}`
      );
    }
  } catch (err) {
    insertError = err instanceof Error ? err : new Error(String(err));
    app.logger.error(
      {
        err: insertError,
        taskId,
        vesselId,
        mmsi,
        userId: user_id,
        checkTime: check_time.toISOString(),
      },
      `Failed to insert AIS check for vessel ${vessel_name} (MMSI: ${mmsi})`
    );
  }

  // Handle sea time entry lifecycle based on movement analysis (only if AIS check was successful)
  if (ais_check) {
    await handleSeaTimeEntries(app, vessel, vesselId, vessel_name, mmsi, ais_data.is_moving, check_time, taskId);
  }

  // Always update the scheduled task with new run times
  const intervalHours = parseInt(interval_hours);
  const nextRunTime = new Date(check_time.getTime() + intervalHours * 60 * 60 * 1000);

  app.logger.debug(
    {
      taskId,
      vesselId,
      mmsi,
      currentTime: check_time.toISOString(),
      intervalHours,
      nextRunTime: nextRunTime.toISOString(),
    },
    `Updating scheduled task: last_run=${check_time.toISOString()}, next_run=${nextRunTime.toISOString()}`
  );

  let taskUpdateSuccess = false;
  try {
    const updateResult = await app.db
      .update(schema.scheduled_tasks)
      .set({
        last_run: check_time,
        next_run: nextRunTime,
      })
      .where(eq(schema.scheduled_tasks.id, taskId))
      .returning();

    if (!updateResult || updateResult.length === 0) {
      app.logger.warn(
        { taskId, vesselId, mmsi },
        `Task update returned no results but may have succeeded`
      );
    } else {
      taskUpdateSuccess = true;
      app.logger.debug(
        { taskId, vesselId, mmsi, nextRun: nextRunTime.toISOString() },
        `Scheduled task updated successfully`
      );
    }
  } catch (updateError) {
    app.logger.error(
      {
        err: updateError,
        taskId,
        vesselId,
        mmsi,
      },
      `Failed to update scheduled task for vessel ${vessel_name} (MMSI: ${mmsi})`
    );
  }

  const successStatus = ais_check ? 'with AIS check' : 'without AIS check (insert failed)';
  app.logger.info(
    {
      taskId,
      vesselId,
      mmsi,
      vesselName: vessel_name,
      userId: user_id,
      lastRun: check_time.toISOString(),
      nextRun: nextRunTime.toISOString(),
      interval: intervalHours,
      aisCheckInserted: ais_check ? ais_check.id : 'failed',
      taskUpdateSuccess,
    },
    `Scheduled task complete for vessel ${vessel_name} (MMSI: ${mmsi}) ${successStatus}: next 2-hour position check at ${nextRunTime.toISOString()}`
  );
}

/**
 * Calculate great circle distance between two coordinates using Haversine formula
 * Returns distance in Nautical Miles
 *
 * Formula: distance = 2 * R * asin(sqrt(sin²(Δlat/2) + cos(lat1) * cos(lat2) * sin²(Δlon/2)))
 * R = 3440.065 nautical miles (Earth's radius)
 */
function calculateDistanceNauticalMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const EARTH_RADIUS_NM = 3440.065; // Nautical miles

  // Convert degrees to radians
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const lat1Rad = lat1 * (Math.PI / 180);
  const lat2Rad = lat2 * (Math.PI / 180);

  // Haversine formula
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.asin(Math.sqrt(a));
  const distance = EARTH_RADIUS_NM * c;

  // Round to 2 decimal places
  return Math.round(distance * 100) / 100;
}

/**
 * Helper function to extract calendar day (YYYY-MM-DD) from a date
 */
function getCalendarDay(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Handle sea time entry creation with simplified 2-hour window logic and compounding for same calendar day
 *
 * ALGORITHM:
 * 1. Get current AIS position (from check_time)
 * 2. Get AIS position from 2 hours ago
 * 3. If position difference > 0.1 degrees (latitude or longitude):
 *    a. Check if there's an existing PENDING sea time entry for the same vessel on the same calendar day
 *    b. If YES: EXTEND the existing entry by updating its end_time and end position
 *    c. If NO: CREATE a new pending sea time entry
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
  // Using 2-hour position check interval
  const twoHoursAgo = new Date(check_time.getTime() - 2 * 60 * 60 * 1000);

  const allChecks = await app.db
    .select()
    .from(schema.ais_checks)
    .where(eq(schema.ais_checks.vessel_id, vesselId))
    .orderBy(schema.ais_checks.check_time);

  app.logger.debug(
    { vesselId, mmsi, checkTime: check_time.toISOString(), twoHoursAgoTime: twoHoursAgo.toISOString() },
    `Using 2-hour position check interval for vessel ${vessel_name}`
  );

  // Find the most recent check before 2 hours ago
  const oldCheck = allChecks
    .filter(check => check.check_time <= twoHoursAgo)
    .sort((a, b) => new Date(b.check_time).getTime() - new Date(a.check_time).getTime())[0];

  if (!oldCheck) {
    app.logger.debug(
      { vesselId, mmsi, twoHoursAgoTime: twoHoursAgo.toISOString() },
      `No AIS check found from 2 hours ago for vessel ${vessel_name}, skipping entry creation`
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
    `2-hour window analysis for vessel ${vessel_name}: position change ${Math.round(maxDiff * 10000) / 10000}° (threshold: ${LOCATION_CHANGE_THRESHOLD}°)`
  );

  // No movement detected
  if (maxDiff <= LOCATION_CHANGE_THRESHOLD) {
    app.logger.debug(
      { vesselId, mmsi, positionChange: Math.round(maxDiff * 10000) / 10000 },
      `Vessel ${vessel_name} has not moved significantly (${Math.round(maxDiff * 10000) / 10000}° <= ${LOCATION_CHANGE_THRESHOLD}°), skipping entry creation`
    );
    return;
  }

  // Calculate duration of this 2-hour window
  const durationMs = currentCheck.check_time.getTime() - oldCheck.check_time.getTime();
  const durationHours = Math.round((durationMs / (1000 * 60 * 60)) * 100) / 100;

  // Calculate distance in Nautical Miles using Haversine formula
  const distanceNm = calculateDistanceNauticalMiles(oldLat, oldLng, currentLat, currentLng);

  app.logger.info(
    {
      vesselId,
      mmsi,
      positionChangeDegrees: Math.round(maxDiff * 10000) / 10000,
      distanceNauticalMiles: distanceNm,
      durationHours,
    },
    `Movement detected for vessel ${vessel_name}: ${distanceNm} nm (${Math.round(maxDiff * 10000) / 10000}°) over ${durationHours} hours`
  );

  // Get calendar day for the old check (start of this observation window)
  const calendarDay = getCalendarDay(oldCheck.check_time);

  app.logger.debug(
    { vesselId, mmsi, calendarDay },
    `Checking for existing pending entry on calendar day ${calendarDay}`
  );

  // Check if there's an existing PENDING sea time entry for this vessel on the same calendar day
  const existingEntries = await app.db
    .select()
    .from(schema.sea_time_entries)
    .where(
      and(
        eq(schema.sea_time_entries.vessel_id, vesselId),
        eq(schema.sea_time_entries.status, 'pending')
      )
    );

  // Filter for entries on the same calendar day
  const existingEntryForDay = existingEntries.find(entry => {
    const entryDay = getCalendarDay(entry.start_time);
    return entryDay === calendarDay;
  });

  if (existingEntryForDay) {
    // EXTEND the existing entry
    try {
      // Calculate total duration from original start_time to current check_time
      const totalDurationMs = currentCheck.check_time.getTime() - existingEntryForDay.start_time.getTime();
      const totalDurationHours = Math.round((totalDurationMs / (1000 * 60 * 60)) * 100) / 100;

      // Update the existing entry with the new end position and time
      const updatedNotes = `Movement detected: vessel moved ${distanceNm} nm (${Math.round(maxDiff * 10000) / 10000}°) over ${durationHours} hours (now ${totalDurationHours} hours total for the day)`;

      const [updated_entry] = await app.db
        .update(schema.sea_time_entries)
        .set({
          end_time: currentCheck.check_time,
          end_latitude: String(currentLat),
          end_longitude: String(currentLng),
          duration_hours: String(totalDurationHours),
          notes: updatedNotes,
        })
        .where(eq(schema.sea_time_entries.id, existingEntryForDay.id))
        .returning();

      app.logger.info(
        {
          taskId,
          vesselId,
          mmsi,
          entryId: existingEntryForDay.id,
          originalStartTime: existingEntryForDay.start_time.toISOString(),
          newEndTime: currentCheck.check_time.toISOString(),
          previousDurationHours: existingEntryForDay.duration_hours ? parseFloat(String(existingEntryForDay.duration_hours)) : 0,
          newTotalDurationHours: totalDurationHours,
          distanceNauticalMiles: distanceNm,
          positionChangeDegrees: Math.round(maxDiff * 10000) / 10000,
        },
        `Extended existing sea time entry [${existingEntryForDay.id}] for vessel ${vessel_name}: now ${totalDurationHours} hours total (added ${durationHours} hours from ${distanceNm} nm movement of ${Math.round(maxDiff * 10000) / 10000}°)`
      );
    } catch (error) {
      app.logger.error(
        { err: error, vesselId, mmsi, taskId, entryId: existingEntryForDay.id },
        `Failed to extend sea time entry for vessel ${vessel_name}`
      );
    }
  } else {
    // CREATE a new pending sea time entry
    const notes = `Movement detected: vessel moved ${distanceNm} nm (${Math.round(maxDiff * 10000) / 10000}°) over ${durationHours} hours`;

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
          distanceNauticalMiles: distanceNm,
          positionChangeDegrees: Math.round(maxDiff * 10000) / 10000,
          calendarDay,
        },
        `Created new pending sea time entry for vessel ${vessel_name}: ${distanceNm} nm (${Math.round(maxDiff * 10000) / 10000}°) over ${durationHours} hours`
      );
    } catch (error) {
      app.logger.error(
        { err: error, vesselId, mmsi, taskId },
        `Failed to create sea time entry for vessel ${vessel_name}`
      );
    }
  }
}
