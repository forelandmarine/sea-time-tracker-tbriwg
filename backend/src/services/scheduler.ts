import { eq, and, lte, desc, isNotNull } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';
import { fetchVesselAISData } from '../routes/ais.js';

const SCHEDULER_CHECK_INTERVAL_MS = 60 * 1000; // Check every minute
const MOVING_SPEED_THRESHOLD = 2; // knots

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

  // Handle sea time entry lifecycle
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

      app.logger.info(
        { taskId, vesselId, mmsi, entryId: new_entry.id },
        `Created new sea time entry for vessel ${vessel_name}: started at ${check_time.toISOString()}`
      );
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
