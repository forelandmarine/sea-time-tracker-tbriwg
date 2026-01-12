import { pgTable, text, timestamp, uuid, boolean, decimal, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const api_settings = pgTable('api_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  api_key: text('api_key').notNull(),
  api_url: text('api_url').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

export const vessels = pgTable('vessels', {
  id: uuid('id').primaryKey().defaultRandom(),
  mmsi: text('mmsi').notNull().unique(),
  vessel_name: text('vessel_name').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('mmsi_idx').on(table.mmsi),
]);

export const sea_time_entries = pgTable('sea_time_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  vessel_id: uuid('vessel_id').notNull().references(() => vessels.id, { onDelete: 'cascade' }),
  start_time: timestamp('start_time').notNull(),
  end_time: timestamp('end_time'),
  duration_hours: decimal('duration_hours', { precision: 10, scale: 2 }),
  status: text('status').notNull().default('pending'),
  notes: text('notes'),
  created_at: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('vessel_id_idx').on(table.vessel_id),
  index('status_idx').on(table.status),
]);

export const ais_checks = pgTable('ais_checks', {
  id: uuid('id').primaryKey().defaultRandom(),
  vessel_id: uuid('vessel_id').notNull().references(() => vessels.id, { onDelete: 'cascade' }),
  check_time: timestamp('check_time').notNull(),
  is_moving: boolean('is_moving').notNull(),
  speed_knots: decimal('speed_knots', { precision: 8, scale: 2 }),
  latitude: decimal('latitude', { precision: 9, scale: 6 }),
  longitude: decimal('longitude', { precision: 10, scale: 6 }),
  created_at: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('vessel_id_check_time_idx').on(table.vessel_id, table.check_time),
]);

export const vesselsRelations = relations(vessels, ({ many }) => ({
  sea_time_entries: many(sea_time_entries),
  ais_checks: many(ais_checks),
}));

export const sea_time_entriesRelations = relations(sea_time_entries, ({ one }) => ({
  vessel: one(vessels, {
    fields: [sea_time_entries.vessel_id],
    references: [vessels.id],
  }),
}));

export const ais_checksRelations = relations(ais_checks, ({ one }) => ({
  vessel: one(vessels, {
    fields: [ais_checks.vessel_id],
    references: [vessels.id],
  }),
}));
