CREATE TABLE `pedido_detalles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`pedido_id` integer NOT NULL,
	`servicio` text NOT NULL,
	`ancho` real NOT NULL,
	`largo` real,
	`contraer` integer,
	`velocidad` integer,
	`obstruccion` integer,
	FOREIGN KEY (`pedido_id`) REFERENCES `pedidos`(`id`) ON UPDATE no action ON DELETE no action
);
