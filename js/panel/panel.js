// js/panel/panel.js — Administrador / Empleado (CRUD completo + estado de pago)
import { sql } from '../config/neon-config.js';
import { exigirRol, activarSalir } from '../auth/auth.js';
import { calcularMontoServicio, formatearSoles } from '../registro/tarifario.js';

const usuario = exigirRol('administrador', 'empleado');
if (!usuario) throw new Error('Acceso denegado');
activarSalir();

// El empleado no tiene acceso a caja: se oculta el enlace
if (usuario.rol !== 'administrador') document.getElementById('enlace-caja')?.remove();

// Consultar: todos los registros
export async function listarTodos() {
  return await sql`SELECT * FROM citas_essalud ORDER BY fecha_registro DESC;`;
}

// Crear: id_usuario queda en NULL (atención presencial); el cliente paga luego en caja.html
export async function crearRegistro(datos) {
  const codigo = 'COD-' + Date.now().toString().slice(-8);
  const monto = calcularMontoServicio({ tipo_asegurado: datos.tipoAsegurado });
  await sql`
    INSERT INTO citas_essalud (codigo_seguimiento, numero_asegurado, nombre_paciente, sede, tipo_asegurado,
                               monto_calculado, estado_pago, estado)
    VALUES (${codigo}, ${datos.numeroAsegurado}, ${datos.nombrePaciente}, ${datos.sede}, ${datos.tipoAsegurado},
            ${monto}, ${monto === 0 ? 'exonerado' : 'pendiente'}, 'registrado');
  `;
  return codigo;
}

// Actualizar: cualquier registro. Si ya está pagado no se cambia el tipo (el monto cobrado no se altera).
export async function actualizarComoPanel(id, datos) {
  const monto = calcularMontoServicio({ tipo_asegurado: datos.tipoAsegurado });
  await sql`
    UPDATE citas_essalud
    SET numero_asegurado = ${datos.numeroAsegurado}, nombre_paciente = ${datos.nombrePaciente},
        sede = ${datos.sede}, estado = ${datos.estado},
        tipo_asegurado  = CASE WHEN estado_pago = 'pagado' THEN tipo_asegurado  ELSE ${datos.tipoAsegurado} END,
        monto_calculado = CASE WHEN estado_pago = 'pagado' THEN monto_calculado ELSE ${monto} END
    WHERE id = ${id};
  `;
}

// Eliminar: con confirmación en la interfaz. Si tiene pagos, la llave foránea lo impide.
export async function eliminarRegistro(id) {
  try {
    await sql`DELETE FROM citas_essalud WHERE id = ${id};`;
    return { ok: true };
  } catch (error) {
    if (error.code === '23503') {
      return { ok: false, mensaje: 'No se puede eliminar: tiene historial de pagos. Cambie su estado a "rechazado".' };
    }
    throw error;
  }
}

// ---------- Interfaz ----------
const form = document.getElementById('formPanel');
const caja = document.getElementById('mensajeConfirmacion');
const cuerpo = document.getElementById('cuerpo-tabla');
const grupoEstado = document.getElementById('grupo-estado');
const btnGuardar = document.getElementById('btn-guardar');
const btnCancelar = document.getElementById('btn-cancelar');
let editandoId = null;

function validar(d) {
  if (!/^[0-9]{4}$/.test(d.numeroAsegurado)) return 'El número de asegurado debe tener 4 dígitos.';
  if (!/^[A-Za-zÁÉÍÓÚáéíóúÑñ ]{3,100}$/.test(d.nombrePaciente)) return 'El nombre debe tener entre 3 y 100 letras.';
  if (d.sede === '') return 'Selecciona una sede.';
  return null;
}

function mostrar(texto, error, codigo) {
  caja.className = 'confirmacion-card';
  caja.style.display = 'block';
  caja.style.borderColor = error ? '#b3382c' : '';
  caja.style.background = error ? '#fbe7e4' : '';
  caja.replaceChildren();
  const el = document.createElement(error ? 'p' : 'h3');
  if (error) el.style.color = '#b3382c';
  el.textContent = texto;
  caja.append(el);
  if (codigo) {
    const s = document.createElement('span');
    s.className = 'codigo-destacado';
    s.textContent = codigo;
    caja.append(s);
  }
}

function celda(texto) {
  const td = document.createElement('td');
  td.textContent = texto ?? '—';
  return td;
}

function boton(texto, accion, peligro) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'btn-mini' + (peligro ? ' peligro' : '');
  b.textContent = texto;
  b.addEventListener('click', accion);
  return b;
}

function salirEdicion() {
  editandoId = null;
  form.reset();
  grupoEstado.hidden = true;
  btnCancelar.hidden = true;
  btnGuardar.textContent = 'Crear cita';
  document.getElementById('titulo-form').textContent = 'Registrar cita (atención presencial)';
}

function editar(f) {
  editandoId = f.id;
  document.getElementById('numeroAsegurado').value = f.numero_asegurado;
  document.getElementById('nombrePaciente').value = f.nombre_paciente;
  document.getElementById('sedeHospital').value = f.sede;
  document.getElementById('tipoAsegurado').value = f.tipo_asegurado;
  document.getElementById('estado').value = f.estado;
  grupoEstado.hidden = false;
  btnCancelar.hidden = false;
  btnGuardar.textContent = 'Guardar cambios';
  document.getElementById('titulo-form').textContent = 'Editar cita ' + f.codigo_seguimiento;
  form.scrollIntoView({ behavior: 'smooth' });
}

async function eliminar(f) {
  if (!confirm('¿Eliminar la cita ' + f.codigo_seguimiento + '? Esta acción no se puede deshacer.')) return;
  try {
    const r = await eliminarRegistro(f.id);
    if (r.ok) { mostrar('Cita eliminada correctamente'); await recargar(); }
    else mostrar(r.mensaje, true);
  } catch (error) {
    console.error(error);
    mostrar('No se pudo eliminar la cita.', true);
  }
}

async function recargar() {
  const filas = await listarTodos();
  cuerpo.replaceChildren();
  for (const f of filas) {
    const tr = document.createElement('tr');
    [f.codigo_seguimiento, f.nombre_paciente, f.sede, f.tipo_asegurado,
     formatearSoles(Number(f.monto_calculado)), f.estado, f.estado_pago, f.canal_pago, f.id_usuario ?? 'Sin cliente']
      .forEach(t => tr.append(celda(t)));
    const acciones = document.createElement('td');
    acciones.append(boton('Editar', () => editar(f)), ' ', boton('Eliminar', () => eliminar(f), true));
    tr.append(acciones);
    cuerpo.append(tr);
  }
}

btnCancelar.addEventListener('click', salirEdicion);

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const datos = {
    numeroAsegurado: document.getElementById('numeroAsegurado').value.trim(),
    nombrePaciente: document.getElementById('nombrePaciente').value.trim(),
    sede: document.getElementById('sedeHospital').value,
    tipoAsegurado: document.getElementById('tipoAsegurado').value,
    estado: document.getElementById('estado').value
  };
  const error = validar(datos);
  if (error) { mostrar(error, true); return; }
  try {
    if (editandoId === null) {
      const codigo = await crearRegistro(datos);
      mostrar('Cita creada correctamente', false, codigo);
    } else {
      await actualizarComoPanel(editandoId, datos);
      mostrar('Cita actualizada correctamente');
    }
    salirEdicion();
    await recargar();
  } catch (err) {
    console.error(err);
    mostrar('No se pudo guardar la cita.', true);
  }
});

try { await recargar(); } catch (error) { console.error(error); mostrar('No se pudieron cargar las citas.', true); }
