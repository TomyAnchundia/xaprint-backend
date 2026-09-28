PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_pedidos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cliente_id` integer NOT NULL,
	`estado` text DEFAULT 'REVISION' NOT NULL,
	`prioridad` integer DEFAULT 0 NOT NULL,
	`servicio` text NOT NULL,
	`ancho` real NOT NULL,
	`largo` real,
	`precio_calculado` real,
	`precio_especial` real,
	`precio_especial_usuario_id` integer,
	`precio_especial_fecha` integer,
	`contraer` integer,
	`velocidad` integer,
	`obstruccion` integer,
	`observaciones` text,
	`fecha_entrega` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`cliente_id`) REFERENCES `clientes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`precio_especial_usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_pedidos`("id", "cliente_id", "estado", "prioridad", "servicio", "ancho", "largo", "precio_calculado", "precio_especial", "precio_especial_usuario_id", "precio_especial_fecha", "contraer", "velocidad", "obstruccion", "observaciones", "fecha_entrega", "created_at", "updated_at") SELECT "id", "cliente_id", "estado", "prioridad", "servicio", "ancho", "largo", "precio_calculado", "precio_especial", "precio_especial_usuario_id", "precio_especial_fecha", "contraer", "velocidad", "obstruccion", "observaciones", "fecha_entrega", "created_at", "updated_at" FROM `pedidos`;--> statement-breakpoint
DROP TABLE `pedidos`;--> statement-breakpoint
ALTER TABLE `__new_pedidos` RENAME TO `pedidos`;--> statement-breakpoint
PRAGMA foreign_keys=ON;