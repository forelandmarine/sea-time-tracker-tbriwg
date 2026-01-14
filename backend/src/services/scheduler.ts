import { eq, and, lte, desc, isNotNull, gte } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';
import { fetchVesselAISData } from '../routes/ais.js';

const SCHEDULER_CHECK_INTERVAL_MS = 60 * 1000; // Check every minute
const MOVING_SPEED_THRESHOLD = 2; // knots
const MIN_SEA_TIME_HOURS = 2; // Minimum cumulative moving time to create a sea time entry
const MOVEMENT_ANALYSIS_WINDOW_HOURS = 24; // Analyze last 24 hours of movement data

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
  await handleSeaTimeEntries(app, vesselId, vessel_name, mmsi, ais_data.is_moving, check_time, taskId);

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
 * Handle sea time entry lifecycle based on vessel movement patterns
 * Analyzes last 24 hours of movement, creates entries for >= 2 hours of cumulative moving time
 */
async function handleSeaTimeEntries(
  app: App,
  vesselId: string,
  vessel_name: string,
  mmsi: string,
  is_moving: boolean,
  check_time: Date,
  taskId: string
): Promise<void> {
  // Get open pending sea time entry
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

  if (is_moving) {
    // Vessel is currently moving
    if (open_entry.length === 0) {
      // Analyze last 24 hours of AIS checks to calculate cumulative moving time
      const analysisStart = new Date(check_time.getTime() - MOVEMENT_ANALYSIS_WINDOW_HOURS * 60 * 60 * 1000);

      const aisChecks = await app.db
        .select()
        .from(schema.ais_checks)
        .where(
          and(
            eq(schema.ais_checks.vessel_id, vesselId),
            gte(schema.ais_checks.check_time, analysisStart),
            lte(schema.ais_checks.check_time, check_time)
          )
        )
        .orderBy(desc(schema.ais_checks.check_time));

      app.logger.debug(
        { vesselId, mmsi, checksCount: aisChecks.length },
        `Analyzing ${aisChecks.length} AIS checks from last 24 hours for vessel ${vessel_name}`
      );

      // Calculate movement periods and cumulative moving time
      const movementPeriods = identifyMovementPeriods(aisChecks);

      app.logger.debug(
        { vesselId, mmsi, periodsCount: movementPeriods.length },
        `Identified ${movementPeriods.length} movement period(s) for vessel ${vessel_name}`
      );

      // Check if cumulative moving time >= MIN_SEA_TIME_HOURS
      let totalMovingHours = 0;
      let oldestMovingCheckTime: Date | null = null;

      for (const period of movementPeriods) {
        const periodDurationHours = (period.endTime.getTime() - period.startTime.getTime()) / (1000 * 60 * 60);
        totalMovingHours += periodDurationHours;

        if (!oldestMovingCheckTime || period.startTime < oldestMovingCheckTime) {
          oldestMovingCheckTime = period.startTime;
        }
      }

      app.logger.info(
        { vesselId, mmsi, totalMovingHours: Math.round(totalMovingHours * 100) / 100, periodsCount: movementPeriods.length },
        `Vessel ${vessel_name} cumulative moving time: ${Math.round(totalMovingHours * 100) / 100} hours across ${movementPeriods.length} period(s)`
      );

      // Create a sea time entry if cumulative moving time >= MIN_SEA_TIME_HOURS
      if (totalMovingHours >= MIN_SEA_TIME_HOURS && oldestMovingCheckTime) {
        const [new_entry] = await app.db
          .insert(schema.sea_time_entries)
          .values({
            vessel_id: vesselId,
            start_time: oldestMovingCheckTime,
            status: 'pending',
          })
          .returning();

        app.logger.info(
          {
            taskId,
            vesselId,
            mmsi,
            entryId: new_entry.id,
            totalMovingHours: Math.round(totalMovingHours * 100) / 100,
            startTime: oldestMovingCheckTime.toISOString(),
          },
          `Auto-created sea time entry for vessel ${vessel_name}: ${Math.round(totalMovingHours * 100) / 100} hours of cumulative movement`
        );
      } else if (totalMovingHours > 0) {
        app.logger.debug(
          { vesselId, mmsi, totalMovingHours: Math.round(totalMovingHours * 100) / 100, threshold: MIN_SEA_TIME_HOURS },
          `Vessel ${vessel_name} has ${Math.round(totalMovingHours * 100) / 100} hours of movement (below ${MIN_SEA_TIME_HOURS} hour threshold)`
        );
      }
    } else {
      app.logger.debug(
        { taskId, vesselId, mmsi, entryId: open_entry[0].id },
        `Vessel ${vessel_name} still moving, keeping open sea time entry`
      );
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

      app.logger.info(
        {
          taskId,
          vesselId,
          mmsi,
          entryId: ended_entry.id,
          durationHours: duration_hours,
          startTime: start_time.toISOString(),
          endTime: check_time.toISOString(),
        },
        `Ended sea time entry for vessel ${vessel_name}: duration=${duration_hours} hours`
      );
    } else {
      app.logger.debug(
        { taskId, vesselId, mmsi },
        `Vessel ${vessel_name} not moving, no open sea time entry to close`
      );
    }
  }
}

/**
 * Identify consecutive movement periods from AIS check data
 * A movement period is a sequence of consecutive is_moving=true checks
 * Returns array of { startTime, endTime } for each continuous movement period
 */
function identifyMovementPeriods(
  aisChecks: Array<typeof schema.ais_checks.$inferSelect>
): Array<{ startTime: Date; endTime: Date }> {
  if (aisChecks.length === 0) {
    return [];
  }

  // Sort by check_time ascending (oldest first)
  const sortedChecks = aisChecks.sort((a, b) => a.check_time.getTime() - b.check_time.getTime());

  const periods: Array<{ startTime: Date; endTime: Date }> = [];
  let currentPeriodStart: Date | null = null;

  for (const check of sortedChecks) {
    if (check.is_moving) {
      // Vessel is moving
      if (currentPeriodStart === null) {
        // Start a new movement period
        currentPeriodStart = check.check_time;
      }
      // Update end time to current check time (will be overwritten if more moving checks follow)
    } else {
      // Vessel is not moving
      if (currentPeriodStart !== null) {
        // End the current movement period
        const previousCheck = sortedChecks[sortedChecks.indexOf(check) - 1];
        const periodEndTime = previousCheck ? previousCheck.check_time : currentPeriodStart;

        periods.push({
          startTime: currentPeriodStart,
          endTime: periodEndTime,
        });

        currentPeriodStart = null;
      }
    }
  }

  // If there's an ongoing movement period, add it with check_time as end time
  if (currentPeriodStart !== null) {
    const lastCheck = sortedChecks[sortedChecks.length - 1];
    periods.push({
      startTime: currentPeriodStart,
      endTime: lastCheck.check_time,
    });
  }

  return periods;
}
