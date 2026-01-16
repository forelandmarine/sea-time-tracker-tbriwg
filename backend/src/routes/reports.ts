import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import * as schema from "../db/schema.js";
import * as authSchema from "../db/auth-schema.js";
import type { App } from "../index.js";
import PDFDocument from "pdfkit";
import { Readable } from "stream";

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
      description: 'Get summary statistics of confirmed sea time entries with aggregations by vessel and month',
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
            entries_by_vessel: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  vessel_name: { type: 'string' },
                  total_hours: { type: 'number' },
                },
              },
            },
            entries_by_month: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  month: { type: 'string' },
                  total_hours: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { startDate, endDate } = request.query;

    app.logger.info({ startDate, endDate }, 'Generating summary report');

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

    app.logger.info({ count: entries.length }, 'Filtered confirmed entries for summary');

    // Calculate total hours
    let total_hours = 0;
    entries.forEach((entry) => {
      if (entry.duration_hours) {
        total_hours += parseFloat(String(entry.duration_hours));
      }
    });

    // Calculate total days (24-hour periods)
    const total_days = Math.round((total_hours / 24) * 100) / 100;

    // Group by vessel - return as array
    const vesselMap: { [key: string]: number } = {};
    entries.forEach((entry) => {
      const vessel_name = entry.vessel?.vessel_name || 'Unknown';
      if (!vesselMap[vessel_name]) {
        vesselMap[vessel_name] = 0;
      }
      if (entry.duration_hours) {
        vesselMap[vessel_name] += parseFloat(String(entry.duration_hours));
      }
    });

    const entries_by_vessel = Object.entries(vesselMap)
      .map(([vessel_name, total_hours]) => ({
        vessel_name,
        total_hours: Math.round(total_hours * 100) / 100,
      }))
      .sort((a, b) => b.total_hours - a.total_hours); // Sort by hours descending

    // Group by month - return as array
    const monthMap: { [key: string]: number } = {};
    entries.forEach((entry) => {
      const month = new Date(entry.start_time).toISOString().slice(0, 7); // YYYY-MM format
      if (!monthMap[month]) {
        monthMap[month] = 0;
      }
      if (entry.duration_hours) {
        monthMap[month] += parseFloat(String(entry.duration_hours));
      }
    });

    const entries_by_month = Object.entries(monthMap)
      .map(([month, total_hours]) => ({
        month,
        total_hours: Math.round(total_hours * 100) / 100,
      }))
      .sort((a, b) => a.month.localeCompare(b.month)); // Sort by month ascending

    app.logger.info(
      {
        total_hours: Math.round(total_hours * 100) / 100,
        total_days,
        vesselCount: entries_by_vessel.length,
        monthCount: entries_by_month.length
      },
      'Summary report generated'
    );

    return reply.code(200).send({
      total_hours: Math.round(total_hours * 100) / 100,
      total_days,
      entries_by_vessel,
      entries_by_month,
    });
  });

  // GET /api/reports/pdf - Generate PDF report with date filtering (public endpoint)
  fastify.get<{ Querystring: { startDate?: string; endDate?: string } }>('/api/reports/pdf', {
    schema: {
      description: 'Generate PDF report of sea time entries with optional date filtering (public)',
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

    app.logger.info({ startDate, endDate }, 'Generating PDF report');

    // Fetch all sea time entries with vessel data
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
    const confirmedEntries = entries.filter((entry) => entry.status === 'confirmed');

    // Get all vessels
    const allVessels = await app.db.select().from(schema.vessels);

    // Calculate summary statistics
    let totalHours = 0;
    confirmedEntries.forEach((entry) => {
      if (entry.duration_hours) {
        totalHours += parseFloat(String(entry.duration_hours));
      }
    });
    const totalDays = Math.round((totalHours / 24) * 100) / 100;

    // Count status types
    const pendingCount = entries.filter((e) => e.status === 'pending').length;
    const rejectedCount = entries.filter((e) => e.status === 'rejected').length;

    // Group entries by vessel
    const entriesByVessel: { [vesselId: string]: typeof entries } = {};
    confirmedEntries.forEach((entry) => {
      if (!entriesByVessel[entry.vessel_id]) {
        entriesByVessel[entry.vessel_id] = [];
      }
      entriesByVessel[entry.vessel_id].push(entry);
    });

    // Create PDF document
    const doc = new PDFDocument({
      bufferPages: true,
      margin: 40,
    });

    // Helper function to format date as DD/MM/YYYY
    const formatDate = (date: Date | string) => {
      const d = typeof date === 'string' ? new Date(date) : date;
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    };

    // Helper function to format time as HH:MM
    const formatTime = (date: Date | string) => {
      const d = typeof date === 'string' ? new Date(date) : date;
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${hours}:${minutes}`;
    };

    // Helper function to format coordinates
    const formatCoordinate = (coord: string | number | null | undefined) => {
      if (!coord) return '';
      const num = typeof coord === 'string' ? parseFloat(coord) : coord;
      return num.toFixed(4);
    };

    // HEADER SECTION
    doc.fontSize(24).font('Helvetica-Bold').text('Sea Time Report', { align: 'center' });
    doc.fontSize(12).font('Helvetica').text('By Foreland Marine', { align: 'center' });
    doc.fontSize(10).fillColor('#666666').text(`Generated: ${formatDate(new Date())}`, { align: 'center' });

    if (startDate || endDate) {
      const dateRange = [startDate && formatDate(startDate), endDate && formatDate(endDate)]
        .filter(Boolean)
        .join(' to ');
      doc.text(`Period: ${dateRange}`, { align: 'center' });
    }

    doc.fillColor('#000000').moveDown(1.5);

    // SUMMARY SECTION
    doc.fontSize(14).font('Helvetica-Bold').text('Summary');
    doc.fontSize(10).font('Helvetica');
    const summaryData = [
      ['Total Sea Time Hours:', String(Math.round(totalHours * 100) / 100)],
      ['Total Sea Time Days:', String(totalDays)],
      ['Vessels Tracked:', String(allVessels.length)],
      ['Confirmed Entries:', String(confirmedEntries.length)],
      ['Pending Entries:', String(pendingCount)],
    ];

    summaryData.forEach(([label, value]) => {
      doc.text(`${label} ${value}`);
    });

    doc.moveDown(1);

    // VESSEL DETAILS SECTION
    if (Object.keys(entriesByVessel).length > 0) {
      doc.fontSize(14).font('Helvetica-Bold').text('Vessel Details');
      doc.fontSize(10).font('Helvetica');

      Object.entries(entriesByVessel).forEach(([vesselId, vesselEntries]) => {
        const vessel = allVessels.find((v) => v.id === vesselId);
        if (!vessel) return;

        let vesselHours = 0;
        vesselEntries.forEach((entry) => {
          if (entry.duration_hours) {
            vesselHours += parseFloat(String(entry.duration_hours));
          }
        });
        const vesselDays = Math.round((vesselHours / 24) * 100) / 100;

        doc.fontSize(11).font('Helvetica-Bold').text(vessel.vessel_name, { underline: true });
        doc.fontSize(10).font('Helvetica');
        doc.text(`MMSI: ${vessel.mmsi}`);
        if (vessel.flag) doc.text(`Flag: ${vessel.flag}`);
        if (vessel.official_number) doc.text(`Official Number: ${vessel.official_number}`);
        if (vessel.type) doc.text(`Type: ${vessel.type}`);
        if (vessel.length_metres) doc.text(`Length: ${vessel.length_metres}m`);
        if (vessel.gross_tonnes) doc.text(`Gross Tonnes: ${vessel.gross_tonnes}`);
        doc.text(`Total Hours: ${Math.round(vesselHours * 100) / 100}`);
        doc.text(`Total Days: ${vesselDays}`);
        doc.moveDown(0.5);
      });

      doc.moveDown(0.5);
    }

    // SEA TIME HISTORY TABLE
    if (confirmedEntries.length > 0) {
      doc.fontSize(14).font('Helvetica-Bold').text('Sea Time History');
      doc.fontSize(9).font('Helvetica');

      // Sort entries by start_time descending
      const sortedEntries = confirmedEntries.sort(
        (a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
      );

      // Table headers
      const columns = {
        date: { x: 50, width: 70 },
        vessel: { x: 120, width: 80 },
        startTime: { x: 200, width: 60 },
        endTime: { x: 260, width: 60 },
        duration: { x: 320, width: 50 },
        status: { x: 370, width: 50 },
        startPos: { x: 420, width: 70 },
        endPos: { x: 490, width: 70 },
      };

      const tableTop = doc.y;
      doc.fillColor('#CCCCCC');
      doc.rect(50, tableTop, 500, 20).fill();

      doc.fillColor('#000000').fontSize(8).font('Helvetica-Bold');
      doc.text('Date', columns.date.x, tableTop + 4);
      doc.text('Vessel', columns.vessel.x, tableTop + 4);
      doc.text('Start', columns.startTime.x, tableTop + 4);
      doc.text('End', columns.endTime.x, tableTop + 4);
      doc.text('Dur(h)', columns.duration.x, tableTop + 4);
      doc.text('Status', columns.status.x, tableTop + 4);
      doc.text('Start Pos', columns.startPos.x, tableTop + 4);
      doc.text('End Pos', columns.endPos.x, tableTop + 4);

      doc.fontSize(7).font('Helvetica');
      let currentY = tableTop + 20;

      sortedEntries.forEach((entry) => {
        // Check if we need a new page
        if (currentY > doc.page.height - 80) {
          doc.addPage();
          currentY = 50;
        }

        const statusColor =
          entry.status === 'confirmed'
            ? '#00AA00'
            : entry.status === 'pending'
              ? '#FFAA00'
              : '#AA0000';

        // Alternate row colors
        if (Math.floor((currentY - 70) / 18) % 2 === 0) {
          doc.fillColor('#EEEEEE');
          doc.rect(50, currentY, 500, 18).fill();
        }

        doc.fillColor(statusColor);
        const date = formatDate(entry.start_time);
        const startTime = formatTime(entry.start_time);
        const endTime = entry.end_time ? formatTime(entry.end_time) : '';
        const duration = entry.duration_hours ? String(Math.round(parseFloat(String(entry.duration_hours)) * 100) / 100) : '';
        const vesselName = entry.vessel?.vessel_name || '';
        const startLat = formatCoordinate(entry.start_latitude);
        const startLon = formatCoordinate(entry.start_longitude);
        const endLat = formatCoordinate(entry.end_latitude);
        const endLon = formatCoordinate(entry.end_longitude);

        doc.text(date, columns.date.x, currentY + 4);
        doc.text(vesselName.substring(0, 10), columns.vessel.x, currentY + 4);
        doc.text(startTime, columns.startTime.x, currentY + 4);
        doc.text(endTime, columns.endTime.x, currentY + 4);
        doc.text(duration, columns.duration.x, currentY + 4);
        doc.text(entry.status, columns.status.x, currentY + 4);
        doc.text(`${startLat},${startLon}`, columns.startPos.x, currentY + 4, { width: 60 });
        doc.text(`${endLat},${endLon}`, columns.endPos.x, currentY + 4, { width: 60 });

        currentY += 18;
      });

      doc.moveDown(2);
    }

    // FOOTER with page numbers
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      doc.fontSize(8).fillColor('#999999');
      doc.text(
        `Generated by SeaTime Tracker | By Foreland Marine | Page ${i + 1} of ${pageCount}`,
        50,
        doc.page.height - 30,
        { align: 'center' }
      );
    }

    doc.end();

    app.logger.info(
      { entryCount: confirmedEntries.length, pageCount },
      'PDF report generated successfully'
    );

    // Convert to buffer and send
    const stream = doc as unknown as Readable;
    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `attachment; filename="seatime_report_${new Date().toISOString().split('T')[0]}.pdf"`);
    return reply.send(stream);
  });
}
