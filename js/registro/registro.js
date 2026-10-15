// js/registro/registro.js — Semana 9: cotizador en vivo + INSERT con monto
import { sql } from '../config/neon-config.js';
import { exigirRol, activarSalir } from '../auth/auth.js';
import { calcularMontoServicio, formatearSoles } from './tarifario.js';

const usuario = exigirRol('cliente');
if (!usuario) throw new Error('Acceso denegado');
activarSalir();

const form = document.querySelector('#form-registro');
const salidaMonto = document.querySelector('#monto-estimado');

const leerFormulario = () => Object.fromEntries(new FormData(form));

function actualizarCotizacion() {
  salidaMonto.textContent = formatearSoles(calcularMontoServicio(leerFormulario()));
}

form.addEventListener('input', actualizarCotizacion);   // texto y números, en cada tecla
form.addEventListener('change', actualizarCotizacion);  // select, radio y checkbox
actualizarCotizacion();

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!form.checkValidity()) { form.reportValidity(); return; }

  const datos = leerFormulario();
  const monto = calcularMontoServicio(datos);            // se recalcula: no se confía en la pantalla
  const estadoPago = monto === 0 ? 'exonerado' : 'pendiente';
  const codigo = 'COD-' + Date.now().toString().slice(-8);
  const boton = form.querySelector('button[type="submit"]');
  boton.disabled = true;

  try {
    const filas = await sql`
      INSERT INTO citas_essalud (codigo_seguimiento, numero_asegurado, nombre_paciente, sede,
                                 tipo_asegurado, id_usuario, monto_calculado, estado_pago, estado)
      VALUES (${codigo}, ${datos.numero_asegurado.trim()}, ${datos.nombre_paciente.trim()}, ${datos.sede},
              ${datos.tipo_asegurado}, ${usuario.id}, ${monto}, ${estadoPago}, 'registrado')
      RETURNING id;
    `;
    if (estadoPago === 'pendiente') {
      window.location.href = `pago.html?id=${filas[0].id}`;
    } else {
      alert(`Solicitud ${codigo} registrada. Tu trámite está exonerado de pago.`);
      window.location.href = 'consulta.html';
    }
  } catch (error) {
    console.error(error);
    alert('No se pudo registrar la solicitud. Intenta nuevamente.');
    boton.disabled = false;
  }
});
