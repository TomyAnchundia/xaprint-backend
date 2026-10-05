CREATE TABLE `tallas_inventario` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`nombre` text NOT NULL UNIQUE,
	`orden` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `variantes_producto_inventario` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`producto_id` integer NOT NULL,
	`talla_id` integer NOT NULL,
	`sku` text NOT NULL UNIQUE,
	`codigo_barras` text NOT NULL UNIQUE,
	`existencia` integer DEFAULT 0 NOT NULL,
	`stock_minimo` integer DEFAULT 0 NOT NULL,
	CONSTRAINT `fk_variantes_producto_inventario_producto_id_productos_inventario_id_fk` FOREIGN KEY (`producto_id`) REFERENCES `productos_inventario`(`id`),
	CONSTRAINT `fk_variantes_producto_inventario_talla_id_tallas_inventario_id_fk` FOREIGN KEY (`talla_id`) REFERENCES `tallas_inventario`(`id`)
);
--> statement-breakpoint
INSERT INTO `tallas_inventario` (`nombre`, `orden`, `created_at`)
VALUES ('Única', 0, CAST(strftime('%s', 'now') AS INTEGER) * 1000);
--> statement-breakpoint
INSERT INTO `variantes_producto_inventario`
	(`producto_id`, `talla_id`, `sku`, `codigo_barras`, `existencia`, `stock_minimo`)
SELECT
	`productos_inventario`.`id`,
	`tallas_inventario`.`id`,
	`productos_inventario`.`sku`,
	`productos_inventario`.`codigo_barras`,
	`productos_inventario`.`existencia`,
	`productos_inventario`.`stock_minimo`
FROM `productos_inventario`
CROSS JOIN `tallas_inventario`
WHERE `tallas_inventario`.`nombre` = 'Única';
--> statement-breakpoint
ALTER TABLE `items_venta_inventario` ADD `variante_id` integer REFERENCES variantes_producto_inventario(id);--> statement-breakpoint
ALTER TABLE `items_venta_inventario` ADD `talla_nombre` text DEFAULT 'Única' NOT NULL;--> statement-breakpoint
UPDATE `items_venta_inventario`
SET `variante_id` = (
	SELECT `variantes_producto_inventario`.`id`
	FROM `variantes_producto_inventario`
	WHERE `variantes_producto_inventario`.`producto_id` = `items_venta_inventario`.`producto_id`
	LIMIT 1
);
--> statement-breakpoint
ALTER TABLE `movimientos_inventario` ADD `variante_id` integer REFERENCES variantes_producto_inventario(id);--> statement-breakpoint
ALTER TABLE `movimientos_inventario` ADD `talla_nombre` text DEFAULT 'Única' NOT NULL;--> statement-breakpoint
UPDATE `movimientos_inventario`
SET `variante_id` = (
	SELECT `variantes_producto_inventario`.`id`
	FROM `variantes_producto_inventario`
	WHERE `variantes_producto_inventario`.`producto_id` = `movimientos_inventario`.`producto_id`
	LIMIT 1
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_variantes_producto_talla` ON `variantes_producto_inventario` (`producto_id`,`talla_id`);