CREATE TABLE `area_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`south` real NOT NULL,
	`west` real NOT NULL,
	`north` real NOT NULL,
	`east` real NOT NULL,
	`content` text NOT NULL,
	`fetched_at` text NOT NULL,
	`complete` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `area_snapshots_extent` ON `area_snapshots` (`kind`,`south`,`north`,`west`,`east`);
