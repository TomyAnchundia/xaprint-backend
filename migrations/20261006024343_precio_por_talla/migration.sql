ALTER TABLE `variantes_producto_inventario`
ADD `precio` real NOT NULL DEFAULT 0;
--> statement-breakpoint
UPDATE `variantes_producto_inventario`
SET `precio` = (
  SELECT `productos_inventario`.`precio`
  FROM `productos_inventario`
  WHERE `productos_inventario`.`id` = `variantes_producto_inventario`.`producto_id`
);
