CREATE TABLE `clientes` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`nombre` text NOT NULL,
	`telefono` text NOT NULL UNIQUE
);
--> statement-breakpoint
CREATE TABLE `historial_pedidos` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`pedido_id` integer NOT NULL,
	`usuario_id` integer NOT NULL,
	`estado_anterior` text,
	`estado_nuevo` text,
	`estado_pago_anterior` text,
	`estado_pago_nuevo` text,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_historial_pedidos_pedido_id_pedidos_id_fk` FOREIGN KEY (`pedido_id`) REFERENCES `pedidos`(`id`),
	CONSTRAINT `fk_historial_pedidos_usuario_id_usuarios_id_fk` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`)
);
--> statement-breakpoint
CREATE TABLE `pagos` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`cliente_id` integer NOT NULL,
	`monto` real NOT NULL,
	`usuario_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_pagos_cliente_id_clientes_id_fk` FOREIGN KEY (`cliente_id`) REFERENCES `clientes`(`id`),
	CONSTRAINT `fk_pagos_usuario_id_usuarios_id_fk` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`)
);
--> statement-breakpoint
CREATE TABLE `pagos_pedidos` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`pago_id` integer NOT NULL,
	`pedido_id` integer NOT NULL,
	`monto` real NOT NULL,
	CONSTRAINT `fk_pagos_pedidos_pago_id_pagos_id_fk` FOREIGN KEY (`pago_id`) REFERENCES `pagos`(`id`),
	CONSTRAINT `fk_pagos_pedidos_pedido_id_pedidos_id_fk` FOREIGN KEY (`pedido_id`) REFERENCES `pedidos`(`id`)
);
--> statement-breakpoint
CREATE TABLE `pedidos` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
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
	`costo_diseno` real DEFAULT 0 NOT NULL,
	`precio_especial_usuario_id` integer,
	`precio_especial_fecha` integer,
	`contraer` integer,
	`velocidad` integer,
	`obturacion` integer,
	`observaciones` text,
	`fecha_entrega` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_pedidos_cliente_id_clientes_id_fk` FOREIGN KEY (`cliente_id`) REFERENCES `clientes`(`id`),
	CONSTRAINT `fk_pedidos_precio_especial_usuario_id_usuarios_id_fk` FOREIGN KEY (`precio_especial_usuario_id`) REFERENCES `usuarios`(`id`)
);
--> statement-breakpoint
CREATE TABLE `tarifas` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
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
CREATE TABLE `usuarios` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`username` text NOT NULL UNIQUE,
	`password` text NOT NULL,
	`rol` text DEFAULT 'EMPLEADO',
	`area` text DEFAULT 'TEXTIL31'
);
