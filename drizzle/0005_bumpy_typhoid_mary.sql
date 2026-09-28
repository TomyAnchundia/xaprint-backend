CREATE TABLE `historial_pedidos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`pedido_id` integer NOT NULL,
	`usuario_id` integer NOT NULL,
	`estado_anterior` text NOT NULL,
	`estado_nuevo` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`pedido_id`) REFERENCES `pedidos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
