CREATE TABLE `notas_venta` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`clave_solicitud` text NOT NULL UNIQUE,
	`cliente_id` integer NOT NULL,
	`cliente_nombre` text NOT NULL,
	`pedidos_json` text NOT NULL,
	`total` real NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_notas_venta_cliente_id_clientes_id_fk` FOREIGN KEY (`cliente_id`) REFERENCES `clientes`(`id`)
);