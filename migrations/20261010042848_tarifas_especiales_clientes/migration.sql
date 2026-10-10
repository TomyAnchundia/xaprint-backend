CREATE TABLE `tarifas_clientes` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`cliente_id` integer NOT NULL,
	`servicio` text NOT NULL,
	`ancho` real NOT NULL,
	`desde` real NOT NULL,
	`hasta` real,
	`precio` real NOT NULL,
	`activo` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_tarifas_clientes_cliente_id_clientes_id_fk` FOREIGN KEY (`cliente_id`) REFERENCES `clientes`(`id`)
);
--> statement-breakpoint
ALTER TABLE `clientes` ADD `tarifa_especial` integer DEFAULT false NOT NULL;