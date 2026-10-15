import { registrarUsuario, iniciarSesion, rutaInicioSegunRol } from './auth.js';

// ---------- Pestañas ----------
const tabLogin = document.getElementById('tab-login');
const tabRegistro = document.getElementById('tab-registro');
const formLogin = document.getElementById('form-login');
const formRegistro = document.getElementById('form-registro');

function mostrarPestana(cual) {
  const esLogin = cual === 'login';

  tabLogin.classList.toggle('activa', esLogin);
  tabRegistro.classList.toggle('activa', !esLogin);
  tabLogin.setAttribute('aria-selected', esLogin);
  tabRegistro.setAttribute('aria-selected', !esLogin);

  formLogin.classList.toggle('visible', esLogin);
  formRegistro.classList.toggle('visible', !esLogin);
}

tabLogin.addEventListener('click', () => mostrarPestana('login'));
tabRegistro.addEventListener('click', () => mostrarPestana('registro'));

// ---------- Mensajes ----------
function mostrarMensaje(id, texto, tipo) {
  const el = document.getElementById(id);
  el.textContent = texto;
  el.className = 'mensaje ' + tipo;
}

// ---------- Crear cuenta ----------
formRegistro.addEventListener('submit', async (e) => {
  e.preventDefault();

  const nombre = document.getElementById('reg-nombre').value.trim();
  const correo = document.getElementById('reg-correo').value.trim();
  const contrasena = document.getElementById('reg-contrasena').value;
  const boton = formRegistro.querySelector('button[type="submit"]');

  boton.disabled = true;
  mostrarMensaje('msg-registro', 'Creando cuenta...', '');

  try {
    await registrarUsuario(nombre, correo, contrasena);
    formRegistro.reset();
    mostrarMensaje('msg-registro', 'Cuenta creada. Ahora inicia sesión.', 'ok');
    // Pasa a la pestaña de login con el correo ya escrito
    document.getElementById('login-correo').value = correo;
    mostrarPestana('login');
    mostrarMensaje('msg-login', 'Cuenta creada. Ingresa tu contraseña.', 'ok');
  } catch (error) {
    console.error(error);
    mostrarMensaje('msg-registro', 'No se pudo crear la cuenta. Revisa los datos o prueba con otro correo.', 'error');
  } finally {
    boton.disabled = false;
  }
});

// ---------- Iniciar sesión ----------
formLogin.addEventListener('submit', async (e) => {
  e.preventDefault();

  const correo = document.getElementById('login-correo').value.trim();
  const contrasena = document.getElementById('login-contrasena').value;
  const boton = formLogin.querySelector('button[type="submit"]');

  boton.disabled = true;
  mostrarMensaje('msg-login', 'Verificando...', '');

  try {
    const usuario = await iniciarSesion(correo, contrasena);

    if (usuario) {
      // Login correcto: el cliente va a su formulario; administrador/empleado al panel
      window.location.href = rutaInicioSegunRol(usuario.rol);
    } else {
      mostrarMensaje('msg-login', 'Correo o contraseña incorrectos.', 'error');
    }
  } catch (error) {
    console.error(error);
    mostrarMensaje('msg-login', 'No se pudo conectar con la base de datos.', 'error');
  } finally {
    boton.disabled = false;
  }
});
