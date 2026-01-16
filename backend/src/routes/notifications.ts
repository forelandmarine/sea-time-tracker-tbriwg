import type { FastifyInstance } from "fastify";
import type { App } from "../index.js";

// Notifications module - currently disabled (notifications table not implemented)
// This file is kept as a stub to prevent import errors

export function register(app: App, fastify: FastifyInstance) {
  // Notifications endpoints are not currently implemented
  // This would require a notifications table in the database schema
}

// Helper function to create a notification for sea time entry (stub)
export async function createSeaTimeEntryNotification(
  app: App,
  userId: string,
  seaTimeEntryId: string,
  vesselName: string,
  durationHours: string | null
): Promise<void> {
  // Notifications are currently disabled
  // This function does nothing but exists for backwards compatibility
  app.logger.debug(
    { userId, seaTimeEntryId, vesselName, durationHours },
    'Notification would have been created (notifications module disabled)'
  );
}
