import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import * as schema from "../db/schema.js";
import * as authSchema from "../db/auth-schema.js";
import type { App } from "../index.js";
import PDFDocument from "pdfkit";
import { Readable } from "stream";
import { extractUserIdFromRequest } from "../middleware/auth.js";

export function register(app: App, fastify: FastifyInstance) {
  // GET /api/reports/csv - Generate CSV file of sea time entries with date filtering
  fastify.get<{ Querystring: { startDate?: string; endDate?: string } }>('/api/reports/csv', {
    schema: {
      description: 'Generate CSV file of sea time entries for MCA testimonials (requires authentication)',
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
        401: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request, reply) => {
    const userId = await extractUserIdFromRequest(request, app);
    if (!userId) {
      app.logger.warn({}, 'CSV report requested without authentication');
      return reply.code(401).send({ error: 'Authentication required' });
    }

    const { startDate, endDate } = request.query;

    app.logger.info({ userId, startDate, endDate }, 'Generating CSV report for user');

    let entries = await app.db.query.sea_time_entries.findMany({
      with: {
        vessel: true,
      },
      where: eq(schema.sea_time_entries.user_id, userId),
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
      'Service Type',
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
      entry.service_type || 'actual_sea_service',
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
      description: 'Get summary statistics of confirmed sea time entries with aggregations by vessel and month (requires authentication)',
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
            entries_by_service_type: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  service_type: { type: 'string' },
                  total_hours: { type: 'number' },
                },
              },
            },
          },
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request, reply) => {
    const userId = await extractUserIdFromRequest(request, app);
    if (!userId) {
      app.logger.warn({}, 'Summary report requested without authentication');
      return reply.code(401).send({ error: 'Authentication required' });
    }

    const { startDate, endDate } = request.query;

    app.logger.info({ userId, startDate, endDate }, 'Generating summary report for user');

    let entries = await app.db.query.sea_time_entries.findMany({
      with: {
        vessel: true,
      },
      where: eq(schema.sea_time_entries.user_id, userId),
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

    // Group by service type
    const serviceTypeMap: { [key: string]: number } = {};
    entries.forEach((entry) => {
      const service_type = entry.service_type || 'actual_sea_service';
      if (!serviceTypeMap[service_type]) {
        serviceTypeMap[service_type] = 0;
      }
      if (entry.duration_hours) {
        serviceTypeMap[service_type] += parseFloat(String(entry.duration_hours));
      }
    });

    const entries_by_service_type = Object.entries(serviceTypeMap)
      .map(([service_type, total_hours]) => ({
        service_type,
        total_hours: Math.round(total_hours * 100) / 100,
      }))
      .sort((a, b) => b.total_hours - a.total_hours); // Sort by hours descending

    app.logger.info(
      {
        total_hours: Math.round(total_hours * 100) / 100,
        total_days,
        vesselCount: entries_by_vessel.length,
        monthCount: entries_by_month.length,
        serviceTypeCount: entries_by_service_type.length
      },
      'Summary report generated'
    );

    return reply.code(200).send({
      total_hours: Math.round(total_hours * 100) / 100,
      total_days,
      entries_by_vessel,
      entries_by_month,
      entries_by_service_type,
    });
  });

  // GET /api/reports/pdf - Generate PDF report with date filtering
  fastify.get<{ Querystring: { startDate?: string; endDate?: string } }>('/api/reports/pdf', {
    schema: {
      description: 'Generate PDF report of sea time entries with optional date filtering (requires authentication)',
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
        401: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request, reply) => {
    const userId = await extractUserIdFromRequest(request, app);
    if (!userId) {
      app.logger.warn({}, 'PDF report requested without authentication');
      return reply.code(401).send({ error: 'Authentication required' });
    }

    const { startDate, endDate } = request.query;

    app.logger.info({ userId, startDate, endDate }, 'Generating PDF report for user');

    // Fetch sea time entries for authenticated user with vessel data
    let entries = await app.db.query.sea_time_entries.findMany({
      with: {
        vessel: true,
      },
      where: eq(schema.sea_time_entries.user_id, userId),
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

    // Get user's vessels only
    const allVessels = await app.db.select().from(schema.vessels).where(eq(schema.vessels.user_id, userId));

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

    // Helper function to format service type with proper labels
    const formatServiceType = (serviceType: string | null | undefined): string => {
      const serviceTypeMap: { [key: string]: string } = {
        'actual_sea_service': 'Actual Sea Service',
        'watchkeeping_service': 'Watchkeeping Service',
        'standby_service': 'Stand-by Service',
        'yard_service': 'Yard Service',
        'service_in_port': 'Service in Port',
      };
      return serviceTypeMap[serviceType || 'actual_sea_service'] || 'Actual Sea Service';
    };

    // Helper function to format coordinates
    const formatCoordinate = (coord: string | number | null | undefined) => {
      if (!coord) return '';
      const num = typeof coord === 'string' ? parseFloat(coord) : coord;
      return num.toFixed(4);
    };

    // Calculate summary statistics
    let totalHours = 0;
    confirmedEntries.forEach((entry) => {
      if (entry.duration_hours) {
        totalHours += parseFloat(String(entry.duration_hours));
      }
    });
    const totalDays = Math.round((totalHours / 24) * 100) / 100;

    // Group entries by vessel
    const entriesByVessel: { [vesselId: string]: typeof confirmedEntries } = {};
    confirmedEntries.forEach((entry) => {
      if (!entriesByVessel[entry.vessel_id]) {
        entriesByVessel[entry.vessel_id] = [];
      }
      entriesByVessel[entry.vessel_id].push(entry);
    });

    // Calculate service type totals
    const serviceTypeTotals: { [key: string]: number } = {};
    confirmedEntries.forEach((entry) => {
      const serviceType = entry.service_type || 'actual_sea_service';
      if (!serviceTypeTotals[serviceType]) {
        serviceTypeTotals[serviceType] = 0;
      }
      if (entry.duration_hours) {
        serviceTypeTotals[serviceType] += parseFloat(String(entry.duration_hours));
      }
    });

    // Create PDF document
    const doc = new PDFDocument({
      bufferPages: true,
      margin: 40,
    });

    const PRIMARY_COLOR = '#0077BE';
    const LIGHT_COLOR = '#E8F4F8';
    const TEXT_COLOR = '#333333';

    // HEADER SECTION
    doc.fillColor(PRIMARY_COLOR).fontSize(26).font('Helvetica-Bold').text('SeaTime Tracker', { align: 'center' });
    doc.fillColor(TEXT_COLOR).fontSize(10).font('Helvetica').text('Sea Time Report', { align: 'center' });
    doc.fontSize(9).fillColor('#666666').text(`Generated: ${formatDate(new Date())}`, { align: 'center' });

    if (startDate || endDate) {
      const dateRange = [startDate && formatDate(startDate), endDate && formatDate(endDate)]
        .filter(Boolean)
        .join(' to ');
      doc.text(`Period: ${dateRange}`, { align: 'center' });
    }

    doc.fillColor(TEXT_COLOR).moveDown(1.5);

    // VESSEL-BY-VESSEL BREAKDOWN SECTION
    if (Object.keys(entriesByVessel).length > 0) {
      doc.fontSize(14).font('Helvetica-Bold').fillColor(PRIMARY_COLOR).text('Vessel-by-Vessel Breakdown');
      doc.fillColor(TEXT_COLOR).moveDown(0.5);

      Object.entries(entriesByVessel).forEach(([vesselId, vesselEntries]) => {
        const vessel = allVessels.find((v) => v.id === vesselId);
        if (!vessel) return;

        // Check if we need a new page
        if (doc.y > doc.page.height - 200) {
          doc.addPage();
        }

        // Vessel header with background
        doc.fillColor(LIGHT_COLOR).rect(40, doc.y, 520, 22).fill();
        doc.fillColor(PRIMARY_COLOR).fontSize(12).font('Helvetica-Bold');
        doc.text(vessel.vessel_name, 45, doc.y + 4);
        doc.moveDown(1.2);

        // Vessel particulars
        doc.fillColor(TEXT_COLOR).fontSize(9).font('Helvetica');
        const particulars = [];
        if (vessel.mmsi) particulars.push(`MMSI: ${vessel.mmsi}`);
        if (vessel.callsign) particulars.push(`Callsign: ${vessel.callsign}`);
        if (vessel.flag) particulars.push(`Flag: ${vessel.flag}`);
        if (vessel.official_number) particulars.push(`Official Number: ${vessel.official_number}`);
        if (vessel.type) particulars.push(`Type: ${vessel.type}`);
        if (vessel.length_metres) particulars.push(`Length: ${vessel.length_metres}m`);
        if (vessel.gross_tonnes) particulars.push(`Gross Tonnes: ${vessel.gross_tonnes}`);

        // Output particulars in two columns
        for (let i = 0; i < particulars.length; i += 2) {
          const line1 = particulars[i];
          const line2 = particulars[i + 1];
          if (line2) {
            doc.text(line1, 50, doc.y, { width: 240, continued: true });
            doc.text(line2, 310, doc.y);
          } else {
            doc.text(line1, 50, doc.y);
          }
        }

        // Service type breakdown for this vessel
        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica-Bold').fillColor(PRIMARY_COLOR).text('Sea Service Definition Breakdown:');
        doc.fillColor(TEXT_COLOR).fontSize(9).font('Helvetica');

        // Group entries by service type for this vessel
        const vesselServiceTypes: { [key: string]: number } = {};
        vesselEntries.forEach((entry) => {
          const serviceType = entry.service_type || 'actual_sea_service';
          if (!vesselServiceTypes[serviceType]) {
            vesselServiceTypes[serviceType] = 0;
          }
          if (entry.duration_hours) {
            vesselServiceTypes[serviceType] += parseFloat(String(entry.duration_hours));
          }
        });

        Object.entries(vesselServiceTypes).forEach(([serviceType, hours]) => {
          const days = Math.round((hours / 24) * 100) / 100;
          const label = formatServiceType(serviceType);
          doc.text(`  • ${label}: ${Math.round(hours * 100) / 100} hours (${days} days)`);
        });

        // Vessel totals
        let vesselHours = 0;
        vesselEntries.forEach((entry) => {
          if (entry.duration_hours) {
            vesselHours += parseFloat(String(entry.duration_hours));
          }
        });
        const vesselDays = Math.round((vesselHours / 24) * 100) / 100;

        doc.moveDown(0.3);
        doc.fontSize(10).font('Helvetica-Bold').fillColor(PRIMARY_COLOR);
        doc.text(`Vessel Subtotal: ${Math.round(vesselHours * 100) / 100} hours (${vesselDays} days)`);
        doc.fillColor(TEXT_COLOR).moveDown(1);
      });

      doc.moveDown(0.5);
    }

    // GRAND TOTAL SUMMARY SECTION
    doc.fontSize(14).font('Helvetica-Bold').fillColor(PRIMARY_COLOR).text('Summary Totals');
    doc.fillColor(TEXT_COLOR).moveDown(0.5);

    // Summary box background
    doc.fillColor(LIGHT_COLOR).rect(40, doc.y, 520, 120).fill();
    doc.fillColor(TEXT_COLOR).fontSize(11).font('Helvetica');

    let summaryY = doc.y + 10;
    doc.text(`Total Hours Across All Vessels: ${Math.round(totalHours * 100) / 100}`, 50, summaryY);
    summaryY += 20;
    doc.text(`Total Days Across All Vessels: ${totalDays}`, 50, summaryY);
    summaryY += 20;

    doc.fontSize(10).font('Helvetica-Bold').fillColor(PRIMARY_COLOR).text('Breakdown by Service Type:', 50, summaryY);
    summaryY += 18;

    doc.fillColor(TEXT_COLOR).fontSize(9).font('Helvetica');
    Object.entries(serviceTypeTotals)
      .sort((a, b) => b[1] - a[1])
      .forEach(([serviceType, hours]) => {
        const days = Math.round((hours / 24) * 100) / 100;
        const label = formatServiceType(serviceType);
        doc.text(`  • ${label}: ${Math.round(hours * 100) / 100} hours (${days} days)`, 50, summaryY);
        summaryY += 16;
      });

    doc.moveDown(6);

    // FOOTER with page numbers and company details
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);

      // Company footer
      doc.fontSize(8).fillColor('#666666');
      doc.text(
        'Foreland Marine Consultancy Ltd, 7 Bell Yard, London WC2A 2JR United Kingdom',
        50,
        doc.page.height - 40,
        { align: 'center' }
      );

      // Page number
      doc.fontSize(7).fillColor('#999999');
      doc.text(
        `Page ${i + 1} of ${pageCount}`,
        50,
        doc.page.height - 25,
        { align: 'center' }
      );
    }

    doc.end();

    app.logger.info(
      { entryCount: confirmedEntries.length, vesselCount: Object.keys(entriesByVessel).length, pageCount },
      'PDF report generated successfully'
    );

    // Convert to buffer and send
    const stream = doc as unknown as Readable;
    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `attachment; filename="seatime_report_${new Date().toISOString().split('T')[0]}.pdf"`);
    return reply.send(stream);
  });
}
