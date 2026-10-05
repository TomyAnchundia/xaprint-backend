CREATE TABLE `abonos_ventas_inventario` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`venta_id` integer NOT NULL,
	`cliente_id` integer NOT NULL,
	`usuario_id` integer NOT NULL,
	`monto` real NOT NULL,
	`metodo_pago` text NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_abonos_ventas_inventario_venta_id_ventas_inventario_id_fk` FOREIGN KEY (`venta_id`) REFERENCES `ventas_inventario`(`id`),
	CONSTRAINT `fk_abonos_ventas_inventario_cliente_id_clientes_id_fk` FOREIGN KEY (`cliente_id`) REFERENCES `clientes`(`id`),
	CONSTRAINT `fk_abonos_ventas_inventario_usuario_id_usuarios_inventario_id_fk` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios_inventario`(`id`)
);
--> statement-breakpoint
ALTER TABLE `items_venta_inventario` ADD `presentacion` text DEFAULT 'UNIDAD' NOT NULL;--> statement-breakpoint
ALTER TABLE `items_venta_inventario` ADD `unidades_por_presentacion` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `productos_inventario` ADD `unidades_por_caja` integer;--> statement-breakpoint
ALTER TABLE `productos_inventario` ADD `precio_caja` real;