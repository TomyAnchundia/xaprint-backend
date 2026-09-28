CREATE TABLE `pedidos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cliente_id` integer NOT NULL,
	`estado` text DEFAULT 'POR_REVISAR' NOT NULL,
	`prioridad` integer DEFAULT 0 NOT NULL,
	`observaciones` text,
	`fecha_entrega` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`cliente_id`) REFERENCES `clientes`(`id`) ON UPDATE no action ON DELETE no action
);
