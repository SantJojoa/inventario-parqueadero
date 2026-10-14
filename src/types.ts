export interface IngresoApiRecord {
  id: number;
  fechaIngreso: string;
  movimientoPatio?: { id: number; nombre: string };
  tipoIngresoPatio?: { id: number; nombre: string };
  grua?: { id: number; placa: string; numeroGrua?: number };
  vehiculo?: {
    placa: string;
    tipoVehiculoId?: { id: number; nombre: string };
  };
}

export interface SalidaApiRecord {
  id: number;
  fechaIngreso: string;
  fechaSalida: string;
  patio?: { id: number; nombre: string };
  usuarioEntregaVehiculo?: string;
  vehiculo?: {
    placa: string;
    modelo?: number;
    marca?: string;
    colorId?: { id: number; nombre: string };
  };
}

export interface IngresoRow {
  fechaInicio: string;
  vehiculo: string;
  clase: string;
  tipoIngreso: string;
  grua: string;
  estado: string;
}

export const INGRESO_COLUMNS: { key: keyof IngresoRow; header: string }[] = [
  { key: "fechaInicio", header: "Fecha Inicio" },
  { key: "vehiculo", header: "Vehículo" },
  { key: "clase", header: "Clase" },
  { key: "tipoIngreso", header: "Tipo Ingreso" },
  { key: "grua", header: "Grua" },
  { key: "estado", header: "Estado" },
];

export interface SalidaRow {
  placa: string;
  modelo: string;
  color: string;
  marca: string;
  patio: string;
  fechaIngreso: string;
  fechaYHoraSalida: string;
  autorizadoEntrega: string;
}

export const SALIDA_COLUMNS: { key: keyof SalidaRow; header: string }[] = [
  { key: "placa", header: "Placa" },
  { key: "modelo", header: "Modelo" },
  { key: "color", header: "Color" },
  { key: "marca", header: "Marca" },
  { key: "patio", header: "Patio" },
  { key: "fechaIngreso", header: "Fecha Ingreso" },
  { key: "fechaYHoraSalida", header: "Fecha Y Hora Salida" },
  { key: "autorizadoEntrega", header: "Autorizado Entrega" },
];

// Inventario combinado: cruce entre el Excel de la empresa (hoja "General")
// y las placas vistas en el scraping de Moviliza dentro de un rango de fechas.
// Si la placa aparece en el scraping es un vehículo de Tránsito; si solo está
// en el Excel, es un vehículo retenido por Policía/Fiscalía.
export interface InventarioRow {
  placa: string;
  categoria: "Tránsito" | "Policía/Fiscalía";
  tipoVehiculo: string;
  ubicacion: string;
  estadoSalidaExcel: string;
  enExcel: string;
  enScraping: string;
  observaciones: string;
  // Nombres de archivo en img/ para esta placa (no es columna de tabla/export,
  // solo se usa para el botón "Ver fotos" en la UI).
  fotos: string[];
}

export const INVENTARIO_COLUMNS: { key: keyof InventarioRow; header: string }[] = [
  { key: "placa", header: "Placa" },
  { key: "categoria", header: "Categoría" },
  { key: "tipoVehiculo", header: "Tipo Vehículo" },
  { key: "ubicacion", header: "Ubicación" },
  { key: "estadoSalidaExcel", header: "Salida autorizada" },
  { key: "enExcel", header: "En Excel" },
  { key: "enScraping", header: "En Moviliza" },
  { key: "observaciones", header: "Observaciones" },
];
