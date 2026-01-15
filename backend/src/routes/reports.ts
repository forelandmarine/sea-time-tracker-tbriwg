import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import * as schema from "../db/schema.js";
import type { App } from "../index.js";

export function register(app: App, fastify: FastifyInstance) {
  // GET /api/reports/csv - Generate CSV file of sea time entries with date filtering
  fastify.get<{ Querystring: { startDate?: string; endDate?: string } }>('/api/reports/csv', {
    schema: {
      description: 'Generate CSV file of sea time entries for MCA testimonials',
      tags: ['reports'],
      querystring: {
        type: 'object',
        properties: {
          startDate: { type: 'string', description: 'ISO 8601 date string' },
          endDate: { type: 'string', description: 'ISO 8601 date string' },
        },
      },
      response: {
        200: { type: 'string' },
      },
    },
  }, async (request, reply) => {
    const { startDate, endDate } = request.query;

    app.logger.info({ startDate, endDate }, 'Generating CSV report');

    let entries = await app.db.query.sea_time_entries.findMany({
      with: {
        vessel: true,
      },
    });

    // Filter by date if provided
    if (startDate || endDate) {
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;

      entries = entries.filter((entry) => {
        const entryDate = new Date(entry.start_time);
        if (start && entryDate < start) return false;
        if (end && entryDate > end) return false;
        return true;
      });
    }

    // Only include confirmed entries
    entries = entries.filter((entry) => entry.status === 'confirmed');

    app.logger.info({ count: entries.length }, 'Filtered entries for CSV report');

    // Build CSV with vessel particulars
    const headers = [
      'Date',
      'Vessel Name',
      'MMSI',
      'Flag',
      'Official Number',
      'Vessel Type',
      'Length (metres)',
      'Gross Tonnes',
      'Start Time',
      'End Time',
      'Duration Hours',
      'Status',
      'Notes',
    ];
    const rows = entries.map((entry) => [
      new Date(entry.start_time).toISOString().split('T')[0],
      entry.vessel?.vessel_name || '',
      entry.vessel?.mmsi || '',
      entry.vessel?.flag || '',
      entry.vessel?.official_number || '',
      entry.vessel?.type || '',
      entry.vessel?.length_metres || '',
      entry.vessel?.gross_tonnes || '',
      new Date(entry.start_time).toISOString(),
      entry.end_time ? new Date(entry.end_time).toISOString() : '',
      entry.duration_hours || '',
      entry.status,
      entry.notes || '',
    ]);

    const csv = [
      headers.map((h) => `"${h}"`).join(','),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n');

    app.logger.info({ headerCount: headers.length, rowCount: rows.length }, 'CSV report generated');

    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', 'attachment; filename="sea-time-entries.csv"');
    return csv;
  });

  // GET /api/reports/summary - Return summary statistics with date filtering
  fastify.get<{ Querystring: { startDate?: string; endDate?: string } }>('/api/reports/summary', {
    schema: {
      description: 'Get summary statistics of sea time entries',
      tags: ['reports'],
      querystring: {
        type: 'object',
        properties: {
          startDate: { type: 'string', description: 'ISO 8601 date string' },
          endDate: { type: 'string', description: 'ISO 8601 date string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            total_hours: { type: 'number' },
            total_days: { type: 'number' },
            entries_by_vessel: { type: 'object' },
            entries_by_month: { type: 'object' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { startDate, endDate } = request.query;

    let entries = await app.db.query.sea_time_entries.findMany({
      with: {
        vessel: true,
      },
    });

    // Filter by date if provided
    if (startDate || endDate) {
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;

      entries = entries.filter((entry) => {
        const entryDate = new Date(entry.start_time);
        if (start && entryDate < start) return false;
        if (end && entryDate > end) return false;
        return true;
      });
    }

    // Only include confirmed entries
    entries = entries.filter((entry) => entry.status === 'confirmed');

    // Calculate total hours
    let total_hours = 0;
    entries.forEach((entry) => {
      if (entry.duration_hours) {
        total_hours += parseFloat(String(entry.duration_hours));
      }
    });

    // Calculate total days (24-hour periods)
    const total_days = Math.round((total_hours / 24) * 100) / 100;

    // Group by vessel
    const entries_by_vessel: { [key: string]: { count: number; hours: number } } = {};
    entries.forEach((entry) => {
      const vessel_name = entry.vessel?.vessel_name || 'Unknown';
      if (!entries_by_vessel[vessel_name]) {
        entries_by_vessel[vessel_name] = { count: 0, hours: 0 };
      }
      entries_by_vessel[vessel_name].count += 1;
      if (entry.duration_hours) {
        entries_by_vessel[vessel_name].hours += parseFloat(String(entry.duration_hours));
      }
    });

    // Group by month
    const entries_by_month: { [key: string]: { count: number; hours: number } } = {};
    entries.forEach((entry) => {
      const month = new Date(entry.start_time).toISOString().slice(0, 7); // YYYY-MM format
      if (!entries_by_month[month]) {
        entries_by_month[month] = { count: 0, hours: 0 };
      }
      entries_by_month[month].count += 1;
      if (entry.duration_hours) {
        entries_by_month[month].hours += parseFloat(String(entry.duration_hours));
      }
    });

    return reply.code(200).send({
      total_hours: Math.round(total_hours * 100) / 100,
      total_days,
      entries_by_vessel,
      entries_by_month,
    });
  });
}
