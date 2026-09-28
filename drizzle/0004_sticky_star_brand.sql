DROP TABLE `pedido_detalles`;--> statement-breakpoint
ALTER TABLE `pedidos` ADD `servicio` text NOT NULL;--> statement-breakpoint
ALTER TABLE `pedidos` ADD `ancho` real NOT NULL;--> statement-breakpoint
ALTER TABLE `pedidos` ADD `largo` real;--> statement-breakpoint
ALTER TABLE `pedidos` ADD `contraer` integer;--> statement-breakpoint
ALTER TABLE `pedidos` ADD `velocidad` integer;--> statement-breakpoint
ALTER TABLE `pedidos` ADD `obstruccion` integer;