CREATE TABLE IF NOT EXISTS `cotizaciones_inventario` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`usuario_id` integer NOT NULL,
	`cliente_id` integer,
	`contacto_nombre` text NOT NULL,
	`contacto_telefono` text NOT NULL,
	`estado` text DEFAULT 'PENDIENTE' NOT NULL,
	`items_json` text NOT NULL,
	`subtotal` real NOT NULL,
	`descuento_porcentaje` real DEFAULT 0 NOT NULL,
	`descuento_monto` real DEFAULT 0 NOT NULL,
	`total` real NOT NULL,
	`venta_id` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_cotizaciones_inventario_usuario_id_usuarios_inventario_id_fk` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios_inventario`(`id`),
	CONSTRAINT `fk_cotizaciones_inventario_cliente_id_clientes_id_fk` FOREIGN KEY (`cliente_id`) REFERENCES `clientes`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_cotizaciones_inventario_venta_id_ventas_inventario_id_fk` FOREIGN KEY (`venta_id`) REFERENCES `ventas_inventario`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `uq_cotizaciones_inventario_venta` ON `cotizaciones_inventario` (`venta_id`);