CREATE TABLE `colores_inventario` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`nombre` text NOT NULL UNIQUE,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `variantes_producto_inventario` ADD `color_id` integer REFERENCES colores_inventario(id);--> statement-breakpoint
ALTER TABLE `ventas_inventario` ADD `subtotal` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `ventas_inventario` ADD `descuento_porcentaje` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `ventas_inventario` ADD `descuento_monto` real DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `ventas_inventario` SET `subtotal` = `total`;--> statement-breakpoint
DROP INDEX IF EXISTS `uq_variantes_producto_talla`;--> statement-breakpoint
CREATE UNIQUE INDEX `uq_variantes_producto_talla_sin_color` ON `variantes_producto_inventario` (`producto_id`,`talla_id`) WHERE "variantes_producto_inventario"."color_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `uq_variantes_producto_talla_color` ON `variantes_producto_inventario` (`producto_id`,`talla_id`,`color_id`) WHERE "variantes_producto_inventario"."color_id" IS NOT NULL;