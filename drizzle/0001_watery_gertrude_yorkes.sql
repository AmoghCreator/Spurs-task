ALTER TABLE `chat_conversations` ADD `channel_origin` text DEFAULT 'web' NOT NULL;--> statement-breakpoint
ALTER TABLE `chat_conversations` ADD `metadata` text;