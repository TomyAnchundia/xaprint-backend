CREATE TABLE `pagos_desarrollador` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`periodo` text NOT NULL,
	`monto` real NOT NULL,
	`usuario_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_pagos_desarrollador_usuario_id_usuarios_id_fk` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`)
);
