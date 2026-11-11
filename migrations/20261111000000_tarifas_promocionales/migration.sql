ALTER TABLE `tarifas`
ADD `tipo` text DEFAULT 'NORMAL' NOT NULL;

ALTER TABLE `pedidos`
ADD `aplica_promocion` integer DEFAULT false NOT NULL;

CREATE TABLE `promociones_servicio` (
  `servicio` text PRIMARY KEY NOT NULL,
  `activo` integer DEFAULT false NOT NULL,
  `updated_at` integer NOT NULL
);
