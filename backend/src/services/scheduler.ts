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
 * Handle sea time entry creation based on 2-hour movement windows
 *
 * Algorithm:
 * 1. Analyze all AIS checks in the last 24 hours
 * 2. For each 2-hour window, check if position changed >0.1 degrees
 * 3. Calculate total underway hours (sum of 2-hour windows with movement)
 * 4. Create pending entry only if:
 *    - Total underway time >= 4 hours
 *    - No entry already exists for this calendar day
 *    - Start and end coordinates are actually different
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
  // Get all AIS checks for this vessel in the last 24 hours
  const twentyFourHoursAgo = new Date(check_time.getTime() - 24 * 60 * 60 * 1000);
  const allChecks = await app.db
    .select()
    .from(schema.ais_checks)
    .where(and(
      eq(schema.ais_checks.vessel_id, vesselId),
    ))
    .orderBy(schema.ais_checks.check_time);

  // Filter to only checks in the last 24 hours
  const recentChecks = allChecks.filter(check => check.check_time >= twentyFourHoursAgo);

  app.logger.info(
    {
      vesselId,
      mmsi,
      totalChecks: allChecks.length,
      checksInLast24h: recentChecks.length,
      analysisWindow: `${twentyFourHoursAgo.toISOString()} to ${check_time.toISOString()}`,
    },
    `Analyzing 24-hour movement window for vessel ${vessel_name}`
  );

  // Need at least 2 checks to detect movement
  if (recentChecks.length < 2) {
    app.logger.debug(
      { vesselId, mmsi, checksCount: recentChecks.length },
      `Vessel ${vessel_name} has fewer than 2 AIS checks in last 24 hours, skipping analysis`
    );
    return;
  }

  // Analyze 2-hour sliding windows to detect movement periods
  const underwayPeriods: Array<{ startIdx: number; endIdx: number; duration_hours: number }> = [];
  const TWO_HOUR_MS = 2 * 60 * 60 * 1000;

  app.logger.debug(
    { vesselId, mmsi },
    `Analyzing ${recentChecks.length} AIS checks for 2-hour movement windows`
  );

  // For each pair of checks that span ~2 hours, check for movement
  for (let i = 0; i < recentChecks.length - 1; i++) {
    const startCheck = recentChecks[i];
    const endCheck = recentChecks[i + 1];

    // Skip if missing position data
    if (!startCheck.latitude || !startCheck.longitude || !endCheck.latitude || !endCheck.longitude) {
      continue;
    }

    const startLat = parseFloat(String(startCheck.latitude));
    const startLng = parseFloat(String(startCheck.longitude));
    const endLat = parseFloat(String(endCheck.latitude));
    const endLng = parseFloat(String(endCheck.longitude));

    const timeDiffMs = endCheck.check_time.getTime() - startCheck.check_time.getTime();
    const timeDiffHours = timeDiffMs / (1000 * 60 * 60);

    // Check if this window is approximately 2 hours (accept 1-3 hour windows)
    if (timeDiffHours >= 1 && timeDiffHours <= 3) {
      const latDiff = Math.abs(endLat - startLat);
      const lngDiff = Math.abs(endLng - startLng);
      const maxDiff = Math.max(latDiff, lngDiff);

      app.logger.debug(
        {
          vesselId,
          mmsi,
          windowIndex: `${i}-${i + 1}`,
          startTime: startCheck.check_time.toISOString(),
          endTime: endCheck.check_time.toISOString(),
          timeDiffHours: Math.round(timeDiffHours * 100) / 100,
          startLat,
          startLng,
          endLat,
          endLng,
          latDiff: Math.round(latDiff * 10000) / 10000,
          lngDiff: Math.round(lngDiff * 10000) / 10000,
          maxDiff: Math.round(maxDiff * 10000) / 10000,
          movementDetected: maxDiff > LOCATION_CHANGE_THRESHOLD,
        },
        `2-hour window ${i}-${i + 1}: movement=${maxDiff > LOCATION_CHANGE_THRESHOLD ? 'YES' : 'NO'}, Δ=${Math.round(maxDiff * 10000) / 10000}°, time=${Math.round(timeDiffHours * 100) / 100}h`
      );

      // If movement detected in this window, record it
      if (maxDiff > LOCATION_CHANGE_THRESHOLD) {
        underwayPeriods.push({
          startIdx: i,
          endIdx: i + 1,
          duration_hours: timeDiffHours,
        });

        app.logger.info(
          {
            vesselId,
            mmsi,
            windowIndex: `${i}-${i + 1}`,
            duration_hours: Math.round(timeDiffHours * 100) / 100,
            movementDelta: Math.round(maxDiff * 10000) / 10000,
          },
          `Movement detected in 2-hour window: ${Math.round(timeDiffHours * 100) / 100} hours, position change ${Math.round(maxDiff * 10000) / 10000}°`
        );
      }
    }
  }

  // Calculate total underway hours from all detected movement periods
  const totalUnderwayHours = underwayPeriods.reduce((sum, period) => sum + period.duration_hours, 0);
  const totalUnderwayHoursRounded = Math.round(totalUnderwayHours * 100) / 100;

  app.logger.info(
    {
      vesselId,
      mmsi,
      underwayPeriodsCount: underwayPeriods.length,
      totalUnderwayHours: totalUnderwayHoursRounded,
      meetsThreshold: totalUnderwayHours >= 4,
    },
    `24-hour analysis complete for vessel ${vessel_name}: ${underwayPeriods.length} movement periods detected, ${totalUnderwayHoursRounded} total underway hours`
  );

  // Only proceed if we have meaningful sea time (4+ hours)
  if (totalUnderwayHours < 4) {
    app.logger.info(
      { vesselId, mmsi, totalHours: totalUnderwayHoursRounded },
      `Vessel ${vessel_name} has only ${totalUnderwayHoursRounded} underway hours (need 4+), skipping entry creation`
    );
    return;
  }

  // Get the earliest start position and latest end position
  const firstMovementPeriod = underwayPeriods[0];
  const lastMovementPeriod = underwayPeriods[underwayPeriods.length - 1];

  const firstStartCheck = recentChecks[firstMovementPeriod.startIdx];
  const lastEndCheck = recentChecks[lastMovementPeriod.endIdx];

  const startLat = parseFloat(String(firstStartCheck.latitude!));
  const startLng = parseFloat(String(firstStartCheck.longitude!));
  const endLat = parseFloat(String(lastEndCheck.latitude!));
  const endLng = parseFloat(String(lastEndCheck.longitude!));

  // Validate that start and end coordinates are actually different
  if (startLat === endLat && startLng === endLng) {
    app.logger.warn(
      {
        vesselId,
        mmsi,
        startLat,
        startLng,
        endLat,
        endLng,
        startTime: firstStartCheck.check_time.toISOString(),
        endTime: lastEndCheck.check_time.toISOString(),
        totalUnderwayHours: totalUnderwayHoursRounded,
      },
      `Vessel ${vessel_name} GPS drift detected: identical coordinates (${startLat}, ${startLng}) despite ${totalUnderwayHoursRounded} hours of detected movement - skipping entry creation`
    );
    return;
  }

  // Check if another entry already exists for this calendar day
  const startDate = firstStartCheck.check_time;
  const year = startDate.getFullYear();
  const month = String(startDate.getMonth() + 1).padStart(2, '0');
  const day = String(startDate.getDate()).padStart(2, '0');
  const calendarDay = `${year}-${month}-${day}`;

  const existingEntries = await app.db.query.sea_time_entries.findMany({
    where: eq(schema.sea_time_entries.user_id, vessel.user_id),
  });

  const dayHasEntry = existingEntries.some((entry) => {
    if (!entry.start_time) return false;
    const entryDate = new Date(entry.start_time);
    const entryYear = entryDate.getFullYear();
    const entryMonth = String(entryDate.getMonth() + 1).padStart(2, '0');
    const entryDay = String(entryDate.getDate()).padStart(2, '0');
    const entryCalendarDay = `${entryYear}-${entryMonth}-${entryDay}`;
    return entryCalendarDay === calendarDay;
  });

  if (dayHasEntry) {
    app.logger.info(
      {
        taskId,
        vesselId,
        mmsi,
        calendarDay,
      },
      `AIS entry skipped: entry already exists for calendar day ${calendarDay}`
    );
    return;
  }

  // Create new sea time entry
  const sea_days = totalUnderwayHours >= 4 ? 1 : 0;

  const [new_entry] = await app.db
    .insert(schema.sea_time_entries)
    .values({
      user_id: vessel.user_id,
      vessel_id: vesselId,
      start_time: firstStartCheck.check_time,
      end_time: lastEndCheck.check_time,
      duration_hours: String(totalUnderwayHoursRounded),
      sea_days: sea_days,
      start_latitude: String(startLat),
      start_longitude: String(startLng),
      end_latitude: String(endLat),
      end_longitude: String(endLng),
      status: 'pending',
      service_type: 'actual_sea_service',
    })
    .returning();

  app.logger.info(
    {
      taskId,
      vesselId,
      mmsi,
      entryId: new_entry.id,
      startTime: firstStartCheck.check_time.toISOString(),
      startLat,
      startLng,
      endTime: lastEndCheck.check_time.toISOString(),
      endLat,
      endLng,
      movementPeriods: underwayPeriods.length,
      totalUnderwayHours: totalUnderwayHoursRounded,
      seaDays: sea_days,
    },
    `Created sea day entry for vessel ${vessel_name}: ${underwayPeriods.length} movement periods in 24h window, ${totalUnderwayHoursRounded} total underway hours, position change (${startLat}, ${startLng}) → (${endLat}, ${endLng})`
  );
}
