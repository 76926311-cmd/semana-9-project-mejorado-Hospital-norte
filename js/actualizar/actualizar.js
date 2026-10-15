// js/actualizar/actualizar.js
import { sql } from '../config/neon-config.js';
import { exigirRol, activarSalir } from '../auth/auth.js';
import { calcularMontoServicio, formatearSoles } from '../registro/tarifario.js';

const usuario = exigirRol('cliente');
if (!usuario) throw new Error('Acceso denegado');
activarSalir();

const id = new URLSearchParams(window.location.search).get('id');
const form = document.getElementById('formActualizar');
const caja = document.getElementById('mensajeConfirmacion');
const aviso = document.getElementById('aviso');
const salidaMonto = document.getElementById('monto-estimado');
const campos = form.querySelectorAll('input, select, button');

// El AND id_usuario evita editar el registro de otro cliente.
// Solo se edita si estado = 'registrado' y aún no está pagado; el monto se recalcula.
export async function actualizarRegistro(id, datos) {
  const monto = calcularMontoServicio(datos);
  const filas = await sql`
    UPDATE citas_essalud
    SET numero_asegurado = ${datos.numeroAsegurado}, nombre_paciente = ${datos.nombrePaciente},
        sede = ${datos.sede}, tipo_asegurado = ${datos.tipoAsegurado},
        monto_calculado = ${monto},
        estado_pago = ${monto === 0 ? 'exonerado' : 'pendiente'}
    WHERE id = ${id} AND id_usuario = ${usuario.id}
      AND estado = 'registrado' AND estado_pago <> 'pagado'
    RETURNING id;
  `;
  return filas.length === 1;
}

function validar(d) {
  if (!/^[0-9]{4}$/.test(d.numeroAsegurado)) return 'El número de asegurado debe tener 4 dígitos.';
  if (!/^[A-Za-zÁÉÍÓÚáéíóúÑñ ]{3,100}$/.test(d.nombrePaciente)) return 'El nombre debe tener entre 3 y 100 letras.';
  if (d.sede === '') return 'Selecciona una sede.';
  return null;
}

function mostrar(texto, error) {
  caja.className = 'confirmacion-card';
  caja.style.display = 'block';
  caja.style.borderColor = error ? '#b3382c' : '';
  caja.style.background = error ? '#fbe7e4' : '';
  caja.replaceChildren();
  const el = document.createElement(error ? 'p' : 'h3');
  if (error) el.style.color = '#b3382c';
  el.textContent = texto;
  caja.append(el);
}

function soloLectura(texto) {
  campos.forEach(c => { c.disabled = true; });
  document.getElementById('btn-guardar').hidden = true;
  aviso.hidden = false;
  aviso.textContent = texto;
}

const leer = () => ({
  numeroAsegurado: document.getElementById('numeroAsegurado').value.trim(),
  nombrePaciente: document.getElementById('nombrePaciente').value.trim(),
  sede: document.getElementById('sedeHospital').value,
  tipoAsegurado: document.getElementById('tipoAsegurado').value
});

function cotizar() {
  salidaMonto.textContent = formatearSoles(calcularMontoServicio({ tipo_asegurado: leer().tipoAsegurado }));
}
form.addEventListener('change', cotizar);

try {
  const filas = await sql`SELECT * FROM citas_essalud WHERE id = ${id} AND id_usuario = ${usuario.id};`;
  if (filas.length === 0) {
    soloLectura('No se encontró la cita o no te pertenece.');
  } else {
    const c = filas[0];
    document.getElementById('numeroAsegurado').value = c.numero_asegurado;
    document.getElementById('nombrePaciente').value = c.nombre_paciente;
    document.getElementById('sedeHospital').value = c.sede;
    document.getElementById('tipoAsegurado').value = c.tipo_asegurado;
    cotizar();
    if (c.estado !== 'registrado') soloLectura('Esta cita ya fue atendida (estado: ' + c.estado + '). Solo lectura.');
    else if (c.estado_pago === 'pagado') soloLectura('Esta cita ya está pagada y no se puede editar.');
  }
} catch (error) {
  console.error(error);
  soloLectura('No se pudo cargar la cita.');
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const datos = leer();
  const error = validar(datos);
  if (error) { mostrar(error, true); return; }
  try {
    const ok = await actualizarRegistro(id, datos);
    if (ok) mostrar('Cita actualizada correctamente. Monto: ' + salidaMonto.textContent);
    else mostrar('No se pudo actualizar: la cita ya fue pagada o atendida.', true);
  } catch (err) {
    console.error(err);
    mostrar('No se pudo actualizar la cita.', true);
  }
});
