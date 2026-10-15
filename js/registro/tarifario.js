// js/registro/tarifario.js
// Caso 11 (EsSalud): tasa por certificado administrativo o carnet
// Función PURA: recibe datos y devuelve un número. Prueba en consola:
//   calcularMontoServicio({ tipo_asegurado: 'derechohabiente' })  ->  18
//   calcularMontoServicio({ tipo_asegurado: 'titular' })          ->  10

export function redondear(valor) {
  return Math.round(valor * 100) / 100;
}

export function formatearSoles(monto) {
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(monto);
}

// Utilidad: un checkbox marcado llega en FormData como 'on'; si no está marcado, NO llega
export const marcado = (valor) => valor === 'on';

// Regla: titular S/ 10.00, derechohabiente S/ 18.00
export function calcularMontoServicio(d) {
  return redondear(d.tipo_asegurado === 'derechohabiente' ? 18.00 : 10.00);
}
