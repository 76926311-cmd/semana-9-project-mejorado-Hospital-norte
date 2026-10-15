// js/consulta/consulta.js — registros propios + estado de pago
import { sql } from '../config/neon-config.js';
import { exigirRol, activarSalir } from '../auth/auth.js';
import { formatearSoles } from '../registro/tarifario.js';

const usuario = exigirRol('cliente');
if (!usuario) throw new Error('Acceso denegado');
activarSalir();

const cuerpo = document.getElementById('cuerpo-tabla');
const aviso = document.getElementById('sin-registros');

function celda(texto) {
  const td = document.createElement('td');
  td.textContent = texto ?? '—';
  return td;
}

function enlace(texto, href) {
  const a = document.createElement('a');
  a.className = 'btn-mini';
  a.href = href;
  a.textContent = texto;
  return a;
}

// Acción de pago según el estado
function accionDePago(td, r) {
  if (r.estado_pago === 'pendiente') {
    td.append(enlace('Pagar', `pago.html?id=${r.id}`));
  } else if (r.estado_pago === 'pagado') {
    td.append(enlace('Ver comprobante', `comprobante.html?op=${encodeURIComponent(r.codigo_operacion)}`));
  } else {
    td.textContent = 'Exonerado';
  }
}

try {
  const registros = await sql`
    SELECT r.id, r.codigo_seguimiento, r.numero_asegurado, r.nombre_paciente, r.sede, r.tipo_asegurado,
           r.estado, r.estado_pago, r.monto_calculado, p.codigo_operacion
    FROM citas_essalud r
    LEFT JOIN pagos p ON p.id_registro = r.id AND p.estado = 'aprobado'
    WHERE r.id_usuario = ${usuario.id}
    ORDER BY r.fecha_registro DESC;
  `;
  aviso.hidden = registros.length > 0;
  for (const r of registros) {
    const tr = document.createElement('tr');
    [r.codigo_seguimiento, r.nombre_paciente, r.sede, r.tipo_asegurado,
     formatearSoles(Number(r.monto_calculado)), r.estado,
     r.estado_pago === 'pagado' ? 'Pagado: recoge tu documento en tu cita' : r.estado_pago]
      .forEach(t => tr.append(celda(t)));

    const acciones = document.createElement('td');
    accionDePago(acciones, r);
    // Solo se edita si sigue "registrado" y aún no está pagado
    if (r.estado === 'registrado' && r.estado_pago !== 'pagado') {
      acciones.append(' ', enlace('Editar', 'actualizar.html?id=' + encodeURIComponent(r.id)));
    }
    tr.append(acciones);
    cuerpo.append(tr);
  }
} catch (error) {
  console.error(error);
  aviso.hidden = false;
  aviso.textContent = 'No se pudieron cargar tus registros.';
}
