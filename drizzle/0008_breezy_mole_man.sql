CREATE TABLE `pagos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cliente_id` integer NOT NULL,
	`monto` real NOT NULL,
	`usuario_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`cliente_id`) REFERENCES `clientes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `pagos_pedidos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`pago_id` integer NOT NULL,
	`pedido_id` integer NOT NULL,
	`monto` real NOT NULL,
	FOREIGN KEY (`pago_id`) REFERENCES `pagos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`pedido_id`) REFERENCES `pedidos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tarifas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`servicio` text NOT NULL,
	`ancho` real NOT NULL,
	`desde` real NOT NULL,
	`hasta` real,
	`precio` real NOT NULL,
	`activo` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `__new_pedidos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cliente_id` integer NOT NULL,
	`estado` text DEFAULT 'REVISION' NOT NULL,
	`estado_pago` text DEFAULT 'NO_PAGADO' NOT NULL,
	`prioridad` integer DEFAULT 0 NOT NULL,
	`servicio` text NOT NULL,
	`ancho` real NOT NULL,
	`largo` real NOT NULL,
	`precio_calculado` real,
	`precio_especial` real,
	`aporte_desarrollador` real DEFAULT 0,
	`valor_cobrar` real,
	`precio_especial_usuario_id` integer,
	`precio_especial_fecha` integer,
	`contraer` integer,
	`velocidad` integer,
	`obturacion` integer,
	`observaciones` text,
	`fecha_entrega` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`cliente_id`) REFERENCES `clientes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`precio_especial_usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_pedidos` (
	`id`,
	`cliente_id`,
	`estado`,
	`estado_pago`,
	`prioridad`,
	`servicio`,
	`ancho`,
	`largo`,
	`precio_calculado`,
	`precio_especial`,
	`aporte_desarrollador`,
	`valor_cobrar`,
	`precio_especial_usuario_id`,
	`precio_especial_fecha`,
	`contraer`,
	`velocidad`,
	`obturacion`,
	`observaciones`,
	`fecha_entrega`,
	`created_at`,
	`updated_at`
)
SELECT
	`id`,
	`cliente_id`,
	`estado`,
	'NO_PAGADO',
	`prioridad`,
	`servicio`,
	`ancho`,
	`largo`,
	`precio_calculado`,
	`precio_especial`,
	0,
	CASE
		WHEN `precio_especial` IS NOT NULL
			THEN `precio_especial`
		ELSE `precio_calculado`
	END,
	`precio_especial_usuario_id`,
	`precio_especial_fecha`,
	`contraer`,
	`velocidad`,
	`obstruccion`,
	`observaciones`,
	`fecha_entrega`,
	`created_at`,
	`updated_at`
FROM `pedidos`;
--> statement-breakpoint
DROP TABLE `pedidos`;
--> statement-breakpoint
ALTER TABLE `__new_pedidos` RENAME TO `pedidos`;
--> statement-breakpoint
-- PRAGMA foreign_keys=ON;
--> statement-breakpoint
CREATE TABLE `__new_clientes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nombre` text NOT NULL,
	`telefono` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_clientes` (
	`id`,
	`nombre`,
	`telefono`
)
SELECT
	`id`,
	`nombre`,
	`telefono`
FROM `clientes`;
--> statement-breakpoint
DROP TABLE `clientes`;
--> statement-breakpoint
ALTER TABLE `__new_clientes` RENAME TO `clientes`;
--> statement-breakpoint
CREATE UNIQUE INDEX `clientes_telefono_unique` ON `clientes` (`telefono`);
--> statement-breakpoint
CREATE TABLE `__new_historial_pedidos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`pedido_id` integer NOT NULL,
	`usuario_id` integer NOT NULL,
	`estado_anterior` text,
	`estado_nuevo` text,
	`estado_pago_anterior` text,
	`estado_pago_nuevo` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`pedido_id`) REFERENCES `pedidos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_historial_pedidos` (
	`id`,
	`pedido_id`,
	`usuario_id`,
	`estado_anterior`,
	`estado_nuevo`,
	`estado_pago_anterior`,
	`estado_pago_nuevo`,
	`created_at`
)
SELECT
	`id`,
	`pedido_id`,
	`usuario_id`,
	`estado_anterior`,
	`estado_nuevo`,
	NULL,
	NULL,
	`created_at`
FROM `historial_pedidos`;
--> statement-breakpoint
DROP TABLE `historial_pedidos`;
--> statement-breakpoint
ALTER TABLE `__new_historial_pedidos` RENAME TO `historial_pedidos`;
--> statement-breakpoint
ALTER TABLE `usuarios` ADD `rol` text DEFAULT 'EMPLEADO';
--> statement-breakpoint
ALTER TABLE `usuarios` ADD `area` text DEFAULT 'TEXTIL31';
PRAGMA foreign_keys=ON;