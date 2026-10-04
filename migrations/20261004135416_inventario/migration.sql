CREATE TABLE `items_venta_inventario` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`venta_id` integer NOT NULL,
	`producto_id` integer NOT NULL,
	`producto_nombre` text NOT NULL,
	`cantidad` integer NOT NULL,
	`precio` real NOT NULL,
	`total` real NOT NULL,
	CONSTRAINT `fk_items_venta_inventario_venta_id_ventas_inventario_id_fk` FOREIGN KEY (`venta_id`) REFERENCES `ventas_inventario`(`id`),
	CONSTRAINT `fk_items_venta_inventario_producto_id_productos_inventario_id_fk` FOREIGN KEY (`producto_id`) REFERENCES `productos_inventario`(`id`)
);
--> statement-breakpoint
CREATE TABLE `movimientos_inventario` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`producto_id` integer NOT NULL,
	`producto_nombre` text NOT NULL,
	`usuario_id` integer NOT NULL,
	`tipo` text NOT NULL,
	`cantidad` integer NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_movimientos_inventario_producto_id_productos_inventario_id_fk` FOREIGN KEY (`producto_id`) REFERENCES `productos_inventario`(`id`),
	CONSTRAINT `fk_movimientos_inventario_usuario_id_usuarios_inventario_id_fk` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios_inventario`(`id`)
);
--> statement-breakpoint
CREATE TABLE `productos_inventario` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`nombre` text NOT NULL,
	`sku` text NOT NULL UNIQUE,
	`codigo_barras` text NOT NULL UNIQUE,
	`categoria` text NOT NULL,
	`precio` real NOT NULL,
	`existencia` integer DEFAULT 0 NOT NULL,
	`stock_minimo` integer DEFAULT 0 NOT NULL,
	`activo` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `usuarios_inventario` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`username` text NOT NULL UNIQUE,
	`password` text NOT NULL,
	`rol` text DEFAULT 'NORMAL' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ventas_inventario` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`cliente_id` integer NOT NULL,
	`usuario_id` integer NOT NULL,
	`metodo_pago` text NOT NULL,
	`total` real NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_ventas_inventario_cliente_id_clientes_id_fk` FOREIGN KEY (`cliente_id`) REFERENCES `clientes`(`id`),
	CONSTRAINT `fk_ventas_inventario_usuario_id_usuarios_inventario_id_fk` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios_inventario`(`id`)
);
--> statement-breakpoint
ALTER TABLE `clientes` ADD `cedula` text;--> statement-breakpoint
ALTER TABLE `clientes` ADD `direccion` text;