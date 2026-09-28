ALTER TABLE `pedidos` ADD `precio_calculado` real;--> statement-breakpoint
ALTER TABLE `pedidos` ADD `precio_especial` real;--> statement-breakpoint
ALTER TABLE `pedidos` ADD `precio_especial_usuario_id` integer REFERENCES usuarios(id);--> statement-breakpoint
ALTER TABLE `pedidos` ADD `precio_especial_fecha` integer;--> statement-breakpoint
ALTER TABLE `clientes` DROP COLUMN `created_at`;