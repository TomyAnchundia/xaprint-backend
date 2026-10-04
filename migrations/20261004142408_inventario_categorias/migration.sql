CREATE TABLE `categorias_inventario` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`nombre` text NOT NULL UNIQUE,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `categorias_inventario` (`nombre`, `created_at`)
SELECT DISTINCT `categoria`, CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM `productos_inventario`
WHERE trim(`categoria`) <> '';
--> statement-breakpoint
INSERT OR IGNORE INTO `categorias_inventario` (`nombre`, `created_at`)
SELECT 'Sin categoría', CAST(strftime('%s', 'now') AS INTEGER) * 1000
WHERE EXISTS (
	SELECT 1 FROM `productos_inventario` WHERE trim(`categoria`) = ''
);
--> statement-breakpoint
ALTER TABLE `productos_inventario` ADD `categoria_id` integer REFERENCES categorias_inventario(id);
--> statement-breakpoint
UPDATE `productos_inventario`
SET `categoria_id` = (
	SELECT `categorias_inventario`.`id`
	FROM `categorias_inventario`
	WHERE `categorias_inventario`.`nombre` = CASE
		WHEN trim(`productos_inventario`.`categoria`) = '' THEN 'Sin categoría'
		ELSE `productos_inventario`.`categoria`
	END
);