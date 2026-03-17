// ==========================================
// MÓDULO DE SEGURIDAD GLOBAL
// ==========================================

// 1. Verificación estricta de sesión activa
const usuarioLogueado = sessionStorage.getItem('usuarioLogueado');
const rolUsuario = sessionStorage.getItem('usuarioRol');

if (!usuarioLogueado) {
    // Si no hay sesión, lo pateamos al login inmediatamente
    window.location.href = 'login.html';
}

// 2. Mostrar el nombre en el NavBar (si la página tiene el elemento)
document.addEventListener('DOMContentLoaded', () => {
    const spanNombre = document.getElementById('usuario-nombre');
    if (spanNombre) {
        spanNombre.innerText = usuarioLogueado;
    }
});

// 3. Función global para cerrar sesión (disponible para cualquier pantalla)
function cerrarSesion() {
    sessionStorage.removeItem('usuarioLogueado');
    sessionStorage.removeItem('usuarioRol');
    window.location.href = 'login.html';
}