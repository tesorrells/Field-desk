// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import { sqliteTable, text, real, integer, index } from "drizzle-orm/sqlite-core";
export const studies = sqliteTable("studies", { id: text("id").primaryKey(), content: text("content").notNull(), updatedAt: text("updated_at").notNull() });
export const placeCache=sqliteTable("place_cache",{id:text("id").primaryKey(),content:text("content").notNull(),fetchedAt:text("fetched_at").notNull()});
export const areaSnapshots=sqliteTable("area_snapshots",{id:text("id").primaryKey(),kind:text("kind").notNull(),south:real("south").notNull(),west:real("west").notNull(),north:real("north").notNull(),east:real("east").notNull(),content:text("content").notNull(),fetchedAt:text("fetched_at").notNull(),complete:integer("complete").notNull()},t=>[index("area_snapshots_extent").on(t.kind,t.south,t.north,t.west,t.east)]);

export const briefings=sqliteTable("briefings",{id:text("id").primaryKey(),title:text("title").notNull(),createdAt:text("created_at").notNull(),scope:text("scope").notNull(),snapshot:text("snapshot").notNull()});
