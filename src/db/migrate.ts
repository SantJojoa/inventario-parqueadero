import { pool } from "./pool";

const DDL = `
CREATE TABLE IF NOT EXISTS ingresos (
  id BIGINT NOT NULL,
  estado_consultado SMALLINT NOT NULL,
  fecha_ingreso DATE,
  placa TEXT,
  clase TEXT,
  tipo_ingreso TEXT,
  grua TEXT,
  estado TEXT,
  raw JSONB NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id, estado_consultado)
);
CREATE INDEX IF NOT EXISTS idx_ingresos_fecha ON ingresos (fecha_ingreso);
CREATE INDEX IF NOT EXISTS idx_ingresos_placa ON ingresos (placa);

CREATE TABLE IF NOT EXISTS salidas (
  id BIGINT PRIMARY KEY,
  fecha_ingreso DATE,
  fecha_salida TIMESTAMPTZ,
  placa TEXT,
  raw JSONB NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_salidas_fecha ON salidas (fecha_salida);
CREATE INDEX IF NOT EXISTS idx_salidas_placa ON salidas (placa);

CREATE TABLE IF NOT EXISTS sync_state (
  clave TEXT PRIMARY KEY,
  ultima_fecha DATE NOT NULL,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

export async function migrate(): Promise<void> {
  await pool.query(DDL);
}

if (require.main === module) {
  migrate()
    .then(() => {
      console.log("Migración aplicada.");
      return pool.end();
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
