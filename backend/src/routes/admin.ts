import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import * as authSchema from "../db/auth-schema.js";
import * as schema from "../db/schema.js";
import type { App } from "../index.js";

export function register(app: App, fastify: FastifyInstance) {
  // GET /api/admin/verify-sea-time - Check sea time entries for a specific user and vessel
  fastify.get<{ Querystring: { email: string; mmsi: string } }>(
    '/api/admin/verify-sea-time',
    {
      schema: {
        description: 'Admin endpoint to verify sea time entries for a user and vessel',
        tags: ['admin'],
        querystring: {
          type: 'object',
          required: ['email', 'mmsi'],
          properties: {
            email: { type: 'string', format: 'email', description: 'User email' },
            mmsi: { type: 'string', description: 'Vessel MMSI' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              user: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  email: { type: 'string' },
                  name: { type: 'string' },
                },
              },
              vessel: {
                type: ['object', 'null'],
                properties: {
                  id: { type: 'string' },
                  mmsi: { type: 'string' },
                  vessel_name: { type: 'string' },
                  is_active: { type: 'boolean' },
                },
              },
              seaTimeEntries: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    start_time: { type: 'string', format: 'date-time' },
                    end_time: { type: ['string', 'null'], format: 'date-time' },
                    sea_days: { type: ['number', 'null'] },
                    status: { type: 'string', enum: ['pending', 'confirmed', 'rejected'] },
                    notes: { type: ['string', 'null'] },
                    created_at: { type: 'string', format: 'date-time' },
                    start_latitude: { type: ['number', 'null'] },
                    start_longitude: { type: ['number', 'null'] },
                    end_latitude: { type: ['number', 'null'] },
                    end_longitude: { type: ['number', 'null'] },
                  },
                },
              },
              summary: {
                type: 'object',
                properties: {
                  totalEntries: { type: 'number' },
                  pendingEntries: { type: 'number' },
                  confirmedEntries: { type: 'number' },
                  rejectedEntries: { type: 'number' },
                  totalConfirmedSeaDays: { type: 'number' },
                },
              },
            },
          },
          404: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      const { email, mmsi } = request.query;

      app.logger.info({ email, mmsi }, 'Admin verify sea time request');

      try {
        // Step 1: Find user by email
        const users = await app.db
          .select()
          .from(authSchema.user)
          .where(eq(authSchema.user.email, email));

        if (users.length === 0) {
          app.logger.warn({ email }, 'User not found');
          return reply.code(404).send({
            error: `User with email ${email} not found`,
          });
        }

        const user = users[0];
        app.logger.debug({ userId: user.id, email }, 'User found');

        // Step 2: Find vessel by MMSI and user_id
        const vessels = await app.db
          .select()
          .from(schema.vessels)
          .where(eq(schema.vessels.mmsi, mmsi));

        let vessel: (typeof schema.vessels.$inferSelect) | null = null;

        // Filter vessels by user_id if provided
        const userVessels = vessels.filter(v => v.user_id === user.id);
        if (userVessels.length > 0) {
          vessel = userVessels[0];
          app.logger.debug({ userId: user.id, vesselId: vessel.id, mmsi }, 'Vessel found');
        } else {
          app.logger.debug({ userId: user.id, mmsi }, 'Vessel not found for user');
        }

        // Step 3: Get sea time entries for the vessel
        let seaTimeEntries: Array<typeof schema.sea_time_entries.$inferSelect> = [];
        if (vessel) {
          seaTimeEntries = await app.db
            .select()
            .from(schema.sea_time_entries)
            .where(eq(schema.sea_time_entries.vessel_id, vessel.id));

          app.logger.debug({ vesselId: vessel.id, entryCount: seaTimeEntries.length }, 'Sea time entries retrieved');
        }

        // Step 4: Calculate summary statistics
        const summary = {
          totalEntries: seaTimeEntries.length,
          pendingEntries: seaTimeEntries.filter(e => e.status === 'pending').length,
          confirmedEntries: seaTimeEntries.filter(e => e.status === 'confirmed').length,
          rejectedEntries: seaTimeEntries.filter(e => e.status === 'rejected').length,
          totalConfirmedSeaDays: seaTimeEntries
            .filter(e => e.status === 'confirmed' && e.sea_days)
            .reduce((sum, e) => sum + (e.sea_days || 0), 0),
        };

        app.logger.info(
          { userId: user.id, vesselId: vessel?.id, summary },
          'Sea time verification complete'
        );

        return reply.code(200).send({
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
          },
          vessel: vessel
            ? {
                id: vessel.id,
                mmsi: vessel.mmsi,
                vessel_name: vessel.vessel_name,
                is_active: vessel.is_active,
              }
            : null,
          seaTimeEntries: seaTimeEntries.map(e => ({
            id: e.id,
            start_time: e.start_time.toISOString(),
            end_time: e.end_time ? e.end_time.toISOString() : null,
            sea_days: e.sea_days,
            status: e.status,
            notes: e.notes,
            created_at: e.created_at.toISOString(),
            start_latitude: e.start_latitude ? parseFloat(e.start_latitude.toString()) : null,
            start_longitude: e.start_longitude ? parseFloat(e.start_longitude.toString()) : null,
            end_latitude: e.end_latitude ? parseFloat(e.end_latitude.toString()) : null,
            end_longitude: e.end_longitude ? parseFloat(e.end_longitude.toString()) : null,
          })),
          summary,
        });
      } catch (error) {
        app.logger.error({ err: error, email, mmsi }, 'Error verifying sea time');
        return reply.code(500).send({
          error: 'Failed to verify sea time entries',
        });
      }
    }
  );

  // POST /api/admin/verify-vessel-tasks - Verify and repair scheduled tasks for all active vessels
  fastify.post('/api/admin/verify-vessel-tasks', {
    schema: {
      description: 'Verify that all active vessels have scheduled tracking tasks. Creates missing tasks automatically.',
      tags: ['admin'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            summary: {
              type: 'object',
              properties: {
                total_active_vessels: { type: 'number' },
                tasks_created: { type: 'number' },
                tasks_reactivated: { type: 'number' },
                tasks_already_active: { type: 'number' },
              },
            },
            details: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  vessel_id: { type: 'string' },
                  vessel_name: { type: 'string' },
                  mmsi: { type: 'string' },
                  action: { type: 'string', enum: ['created', 'reactivated', 'already_active'] },
                  error: { type: ['string', 'null'] },
                },
              },
            },
          },
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
            summary: {
              type: 'object',
              properties: {
                total_active_vessels: { type: 'number' },
                tasks_created: { type: 'number' },
                tasks_reactivated: { type: 'number' },
                tasks_already_active: { type: 'number' },
              },
            },
            details: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  vessel_id: { type: 'string' },
                  vessel_name: { type: 'string' },
                  mmsi: { type: 'string' },
                  action: { type: 'string', enum: ['created', 'reactivated', 'already_active'] },
                  error: { type: ['string', 'null'] },
                },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    app.logger.info({}, 'Starting vessel tracking task verification and repair');

    const summary = {
      total_active_vessels: 0,
      tasks_created: 0,
      tasks_reactivated: 0,
      tasks_already_active: 0,
    };

    const details: Array<{
      vessel_id: string;
      vessel_name: string;
      mmsi: string;
      action: 'created' | 'reactivated' | 'already_active';
      error?: string;
    }> = [];

    try {
      // Get all active vessels
      const activeVessels = await app.db
        .select()
        .from(schema.vessels)
        .where(eq(schema.vessels.is_active, true));

      app.logger.info({ count: activeVessels.length }, 'Found active vessels to verify');

      summary.total_active_vessels = activeVessels.length;

      // Process each active vessel
      for (const vessel of activeVessels) {
        try {
          // Check if a scheduled task exists for this vessel
          const existingTasks = await app.db
            .select()
            .from(schema.scheduled_tasks)
            .where(eq(schema.scheduled_tasks.vessel_id, vessel.id));

          if (existingTasks.length === 0) {
            // No task exists - create one
            const now = new Date();
            const [newTask] = await app.db
              .insert(schema.scheduled_tasks)
              .values({
                user_id: vessel.user_id,
                task_type: 'vessel_tracking',
                vessel_id: vessel.id,
                interval_hours: '4',
                is_active: true,
                next_run: now,
                last_run: null,
              })
              .returning();

            app.logger.info(
              { vessel_id: vessel.id, vessel_name: vessel.vessel_name, mmsi: vessel.mmsi, task_id: newTask.id },
              'Created missing tracking task for vessel'
            );

            summary.tasks_created++;
            details.push({
              vessel_id: vessel.id,
              vessel_name: vessel.vessel_name,
              mmsi: vessel.mmsi,
              action: 'created',
            });
          } else {
            const existingTask = existingTasks[0];

            if (!existingTask.is_active) {
              // Task exists but is inactive - reactivate it
              await app.db
                .update(schema.scheduled_tasks)
                .set({ is_active: true })
                .where(eq(schema.scheduled_tasks.id, existingTask.id));

              app.logger.info(
                { vessel_id: vessel.id, vessel_name: vessel.vessel_name, mmsi: vessel.mmsi, task_id: existingTask.id },
                'Reactivated tracking task for vessel'
              );

              summary.tasks_reactivated++;
              details.push({
                vessel_id: vessel.id,
                vessel_name: vessel.vessel_name,
                mmsi: vessel.mmsi,
                action: 'reactivated',
              });
            } else {
              // Task exists and is active - no action needed
              app.logger.debug(
                { vessel_id: vessel.id, vessel_name: vessel.vessel_name, mmsi: vessel.mmsi, task_id: existingTask.id },
                'Tracking task already active for vessel'
              );

              summary.tasks_already_active++;
              details.push({
                vessel_id: vessel.id,
                vessel_name: vessel.vessel_name,
                mmsi: vessel.mmsi,
                action: 'already_active',
              });
            }
          }
        } catch (error) {
          app.logger.error(
            { err: error, vessel_id: vessel.id, vessel_name: vessel.vessel_name, mmsi: vessel.mmsi },
            'Failed to verify/repair task for vessel'
          );

          details.push({
            vessel_id: vessel.id,
            vessel_name: vessel.vessel_name,
            mmsi: vessel.mmsi,
            action: 'created',
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      app.logger.info(
        {
          total_active_vessels: summary.total_active_vessels,
          tasks_created: summary.tasks_created,
          tasks_reactivated: summary.tasks_reactivated,
          tasks_already_active: summary.tasks_already_active,
        },
        'Vessel tracking task verification and repair completed'
      );

      return reply.code(200).send({
        success: true,
        summary,
        details,
      });
    } catch (error) {
      app.logger.error({ err: error }, 'Error during vessel tracking task verification');
      return reply.code(500).send({
        success: false,
        error: 'Failed to verify vessel tracking tasks',
        summary,
        details,
      });
    }
  });

  // GET /api/admin/vessel-status/:mmsi - Diagnostic endpoint for vessel sea time detection status
  fastify.get<{ Params: { mmsi: string } }>('/api/admin/vessel-status/:mmsi', {
    schema: {
      description: 'Get detailed diagnostic information about a vessel\'s sea time detection status',
      tags: ['admin'],
      params: {
        type: 'object',
        required: ['mmsi'],
        properties: { mmsi: { type: 'string' } },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            vessel: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                mmsi: { type: 'string' },
                vessel_name: { type: 'string' },
                is_active: { type: 'boolean' },
                user_id: { type: ['string', 'null'] },
              },
            },
            scheduled_task: {
              type: ['object', 'null'],
              properties: {
                id: { type: 'string' },
                is_active: { type: 'boolean' },
                last_run: { type: ['string', 'null'], format: 'date-time' },
                next_run: { type: 'string', format: 'date-time' },
                interval_hours: { type: 'string' },
              },
            },
            ais_checks_last_24h: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  check_time: { type: 'string', format: 'date-time' },
                  is_moving: { type: 'boolean' },
                  speed_knots: { type: ['number', 'null'] },
                  latitude: { type: ['number', 'null'] },
                  longitude: { type: ['number', 'null'] },
                  time_since_previous_hours: { type: ['number', 'null'] },
                  position_change_degrees: { type: ['number', 'null'] },
                },
              },
            },
            movement_analysis: {
              type: 'object',
              properties: {
                total_checks: { type: 'number' },
                movement_windows: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      start_time: { type: 'string', format: 'date-time' },
                      end_time: { type: 'string', format: 'date-time' },
                      duration_hours: { type: 'number' },
                      position_change: { type: 'number' },
                      movement_detected: { type: 'boolean' },
                    },
                  },
                },
                total_underway_hours: { type: 'number' },
                meets_mca_threshold: { type: 'boolean' },
              },
            },
            sea_time_entries: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  start_time: { type: 'string', format: 'date-time' },
                  end_time: { type: ['string', 'null'], format: 'date-time' },
                  duration_hours: { type: ['number', 'null'] },
                  status: { type: 'string' },
                  mca_compliant: { type: ['boolean', 'null'] },
                  detection_window_hours: { type: ['number', 'null'] },
                },
              },
            },
            entry_creation_status: {
              type: 'object',
              properties: {
                should_create_entry: { type: 'boolean' },
                reason: { type: 'string' },
                calendar_day_check: {
                  type: 'object',
                  properties: {
                    today: { type: 'string' },
                    has_existing_entry: { type: 'boolean' },
                  },
                },
              },
            },
          },
        },
        404: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request, reply) => {
    const { mmsi } = request.params;

    app.logger.info({ mmsi }, 'Checking vessel status for diagnostic');

    try {
      // 1. Find vessel by MMSI
      const vessels = await app.db
        .select()
        .from(schema.vessels)
        .where(eq(schema.vessels.mmsi, mmsi));

      if (vessels.length === 0) {
        app.logger.warn({ mmsi }, 'Vessel not found');
        return reply.code(404).send({ error: `Vessel with MMSI ${mmsi} not found` });
      }

      const vessel = vessels[0];
      app.logger.debug({ vesselId: vessel.id, mmsi }, 'Vessel found');

      // 2. Find scheduled task for this vessel
      const scheduledTasks = await app.db
        .select()
        .from(schema.scheduled_tasks)
        .where(eq(schema.scheduled_tasks.vessel_id, vessel.id));

      const scheduledTask = scheduledTasks.length > 0 ? scheduledTasks[0] : null;

      // 3. Get all AIS checks in the last 24 hours
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const aisChecks = await app.db
        .select()
        .from(schema.ais_checks)
        .where(eq(schema.ais_checks.vessel_id, vessel.id))
        .then(checks => checks.filter(c => new Date(c.check_time) >= twentyFourHoursAgo))
        .then(checks => checks.sort((a, b) => new Date(a.check_time).getTime() - new Date(b.check_time).getTime()));

      // 4. Analyze AIS checks for movement patterns
      const aisChecksWithAnalysis = aisChecks.map((check, index) => {
        let timeSincePrevious: number | null = null;
        let positionChange: number | null = null;

        if (index > 0) {
          const prevCheck = aisChecks[index - 1];
          const timeDiff = new Date(check.check_time).getTime() - new Date(prevCheck.check_time).getTime();
          timeSincePrevious = Math.round((timeDiff / (1000 * 60 * 60)) * 100) / 100;

          // Calculate position change if both checks have coordinates
          if (
            prevCheck.latitude &&
            prevCheck.longitude &&
            check.latitude &&
            check.longitude
          ) {
            const lat1 = parseFloat(prevCheck.latitude.toString());
            const lon1 = parseFloat(prevCheck.longitude.toString());
            const lat2 = parseFloat(check.latitude.toString());
            const lon2 = parseFloat(check.longitude.toString());

            // Simple degree distance (not geodesic)
            positionChange = Math.sqrt(Math.pow(lat2 - lat1, 2) + Math.pow(lon2 - lon1, 2));
            positionChange = Math.round(positionChange * 10000) / 10000;
          }
        }

        return {
          check_time: check.check_time.toISOString(),
          is_moving: check.is_moving,
          speed_knots: check.speed_knots ? parseFloat(check.speed_knots.toString()) : null,
          latitude: check.latitude ? parseFloat(check.latitude.toString()) : null,
          longitude: check.longitude ? parseFloat(check.longitude.toString()) : null,
          time_since_previous_hours: timeSincePrevious,
          position_change_degrees: positionChange,
        };
      });

      // 5. Detect movement windows (consecutive checks with movement > 0.1 degrees)
      const movementWindows: Array<{
        start_time: string;
        end_time: string;
        duration_hours: number;
        position_change: number;
        movement_detected: boolean;
      }> = [];

      for (let i = 1; i < aisChecksWithAnalysis.length; i++) {
        const currentCheck = aisChecksWithAnalysis[i];
        if (currentCheck.position_change_degrees && currentCheck.position_change_degrees > 0.1) {
          const prevCheck = aisChecksWithAnalysis[i - 1];
          const startTime = new Date(prevCheck.check_time);
          const endTime = new Date(currentCheck.check_time);
          const durationMs = endTime.getTime() - startTime.getTime();
          const durationHours = Math.round((durationMs / (1000 * 60 * 60)) * 100) / 100;

          movementWindows.push({
            start_time: startTime.toISOString(),
            end_time: endTime.toISOString(),
            duration_hours: durationHours,
            position_change: currentCheck.position_change_degrees,
            movement_detected: true,
          });
        }
      }

      // 6. Calculate total underway hours from movement windows
      const totalUnderwayHours = movementWindows.length > 0
        ? movementWindows.reduce((sum, window) => sum + window.duration_hours, 0)
        : 0;

      const meetsMcaThreshold = totalUnderwayHours >= 4;

      // 7. Get sea time entries for this vessel
      const seaTimeEntries = await app.db
        .select()
        .from(schema.sea_time_entries)
        .where(eq(schema.sea_time_entries.vessel_id, vessel.id))
        .then(entries => entries.sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()));

      const seaTimeEntriesFormatted = seaTimeEntries.map(entry => {
        let durationHours = null;
        if (entry.start_time && entry.end_time) {
          const startTime = new Date(entry.start_time);
          const endTime = new Date(entry.end_time);
          const diffMs = endTime.getTime() - startTime.getTime();
          durationHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
        }

        return {
          id: entry.id,
          start_time: entry.start_time.toISOString(),
          end_time: entry.end_time ? entry.end_time.toISOString() : null,
          duration_hours: durationHours,
          status: entry.status,
          mca_compliant: entry.mca_compliant,
          detection_window_hours: entry.detection_window_hours ? parseFloat(entry.detection_window_hours.toString()) : null,
        };
      });

      // 8. Check if entry already exists for today
      const today = new Date().toISOString().split('T')[0];
      const todayEntries = seaTimeEntries.filter(entry => {
        const entryDay = new Date(entry.start_time).toISOString().split('T')[0];
        return entryDay === today;
      });

      const hasExistingEntryToday = todayEntries.length > 0;

      // 9. Determine entry creation status
      let shouldCreateEntry = false;
      let reason = '';

      if (!meetsMcaThreshold) {
        reason = `Insufficient underway hours: ${Math.round(totalUnderwayHours * 100) / 100}h detected (need 4h+ for MCA compliance)`;
      } else if (hasExistingEntryToday) {
        reason = `Entry already exists for today (${todayEntries.length} existing)`;
      } else {
        shouldCreateEntry = true;
        reason = 'Meets all criteria for automatic sea time entry creation';
      }

      app.logger.info(
        {
          vesselId: vessel.id,
          mmsi,
          totalUnderwayHours: Math.round(totalUnderwayHours * 100) / 100,
          meetsMcaThreshold,
          hasExistingEntryToday,
          shouldCreateEntry,
        },
        'Vessel diagnostic analysis complete'
      );

      return reply.code(200).send({
        vessel: {
          id: vessel.id,
          mmsi: vessel.mmsi,
          vessel_name: vessel.vessel_name,
          is_active: vessel.is_active,
          user_id: vessel.user_id,
        },
        scheduled_task: scheduledTask
          ? {
              id: scheduledTask.id,
              is_active: scheduledTask.is_active,
              last_run: scheduledTask.last_run ? scheduledTask.last_run.toISOString() : null,
              next_run: scheduledTask.next_run.toISOString(),
              interval_hours: scheduledTask.interval_hours,
            }
          : null,
        ais_checks_last_24h: aisChecksWithAnalysis,
        movement_analysis: {
          total_checks: aisChecksWithAnalysis.length,
          movement_windows: movementWindows,
          total_underway_hours: Math.round(totalUnderwayHours * 100) / 100,
          meets_mca_threshold: meetsMcaThreshold,
        },
        sea_time_entries: seaTimeEntriesFormatted,
        entry_creation_status: {
          should_create_entry: shouldCreateEntry,
          reason,
          calendar_day_check: {
            today,
            has_existing_entry: hasExistingEntryToday,
          },
        },
      });
    } catch (error) {
      app.logger.error({ err: error, mmsi }, 'Error checking vessel status');
      return reply.code(500).send({ error: 'Failed to retrieve vessel status' });
    }
  });
}
