// ==========================================
// LÓGICA DE FICHA DEL STAFF
// ==========================================

const urlParams = new URLSearchParams(window.location.search);
const idEmpleado = urlParams.get('id');
let empleadoActual = null;

async function cargarFicha() {
    try {
        const respuesta = await fetch(`/empleados/${idEmpleado}`);
        empleadoActual = await respuesta.json();

        if(respuesta.status === 404) {
            alert('Empleado no encontrado.');
            window.location.href = 'index.html';
            return;
        }

        document.getElementById('f-nombre-completo').innerText = `${empleadoActual.nombre} ${empleadoActual.apellido}`;
        document.getElementById('f-dni').innerText = empleadoActual.dni || '-';
        
        if(empleadoActual.fecha_nacimiento){
            const fecha = new Date(empleadoActual.fecha_nacimiento);
            fecha.setMinutes(fecha.getMinutes() + fecha.getTimezoneOffset()); 
            document.getElementById('f-fecha').innerText = fecha.toLocaleDateString('es-AR');
        } else {
            document.getElementById('f-fecha').innerText = '-';
        }
        
        document.getElementById('f-telefono').innerText = empleadoActual.telefono || '-';
        document.getElementById('f-emergencia-nombre').innerText = empleadoActual.contacto_emergencia_nombre || '-';
        document.getElementById('f-emergencia-tel').innerText = empleadoActual.contacto_emergencia_tel || '-';
        
        document.getElementById('f-grupo').innerText = empleadoActual.grupo_sanguineo || 'No espec.';
        document.getElementById('f-alergias').innerText = empleadoActual.alergias || 'Ninguna';
        document.getElementById('f-cirugias').innerText = empleadoActual.cirugias || 'Ninguna';
        
        // Mostrar el ROL en lugar de la Rama
        const rol = empleadoActual.rol || 'Empleado';
        const badgeRol = document.getElementById('f-rol');
        badgeRol.innerText = rol;
        
        if (rol === 'Admin Principal') {
            badgeRol.classList.replace('bg-warning', 'bg-dark');
            badgeRol.classList.replace('text-dark', 'text-white');
        } else if (rol === 'Administrativo') {
            badgeRol.classList.replace('bg-warning', 'bg-info');
        }

        // ==========================================
        // BARRERA VISUAL: EDITAR Y ELIMINAR
        // ==========================================
        const rolUsuario = sessionStorage.getItem('usuarioRol');
        const nombreLogueado = sessionStorage.getItem('usuarioLogueado');
        
        const btnEditar = document.querySelector('button[title="Editar Staff"]');
        const btnEliminar = document.querySelector('button[title="Eliminar Staff"]');

        // 1. Ocultar botón Eliminar si NO es el jefe
        if (rolUsuario !== 'Admin Principal' && btnEliminar) {
            btnEliminar.style.display = 'none';
        }

        // 2. Ocultar botón Editar si NO es el jefe Y NO es su propia ficha
        if (rolUsuario !== 'Admin Principal' && empleadoActual.nombre !== nombreLogueado && btnEditar) {
            btnEditar.style.display = 'none';
        }

    } catch (error) {
        console.error('Error:', error);
        alert('No se pudo cargar la ficha del staff.');
    }
}

// --- LÓGICA DE PDF Y WHATSAPP ---
function generarPDFyWhatsApp() {
    if(!empleadoActual) return;

    const titulosImpresion = document.querySelectorAll('.solo-impresion');
    titulosImpresion.forEach(el => el.style.display = 'block');

    const elemento = document.getElementById('area-pdf');
    
    const opciones = {
        margin:       0.5,
        filename:     `Ficha_Medica_Staff_${empleadoActual.apellido}_${empleadoActual.nombre}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true }, 
        jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opciones).from(elemento).save().then(() => {
        titulosImpresion.forEach(el => el.style.display = 'none');

        setTimeout(() => {
            alert('📄 ¡El PDF de la ficha médica se descargó!\n\nSe va a abrir WhatsApp para que lo compartas.');
            
            const texto = `Hola! Te envío la ficha médica y de contacto de ${empleadoActual.nombre} ${empleadoActual.apellido} (Staff del Club). Te la adjunto en formato PDF.`;
            const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`;
            window.open(url, '_blank');
        }, 500); 
    });
}

// --- LÓGICA DE CORREO ---
function compartirEmail() {
    if(!empleadoActual) return;
    const asunto = `Ficha Médica Staff - ${empleadoActual.nombre} ${empleadoActual.apellido}`;
    const cuerpo = `Hola,\n\nTe comparto la ficha médica oficial del integrante del staff ${empleadoActual.nombre} ${empleadoActual.apellido}.\n\nPor favor, responde este correo para coordinar el envío del archivo PDF adjunto.\n\nSaludos.`;
    const url = `mailto:?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
    window.location.href = url;
}

if (idEmpleado) {
    cargarFicha();
} else {
    alert('No se especificó un miembro del staff.');
    window.location.href = 'index.html';
}

// --- LÓGICA DE ELIMINAR STAFF ---
async function eliminarEmpleado() {
    // 1. Barrera de seguridad: Solo el Admin Principal puede borrar staff
    const rolUsuario = sessionStorage.getItem('usuarioRol');
    if (rolUsuario !== 'Admin Principal') {
        alert('⛔ Acceso Denegado: Solo el Administrador Principal puede eliminar a un miembro del staff.');
        return;
    }

    // 2. Confirmación
    const confirmacion = confirm(`⚠️ ATENCIÓN: ¿Estás seguro de que querés ELIMINAR definitivamente a ${empleadoActual.nombre} ${empleadoActual.apellido} del sistema?`);
    
    if (!confirmacion) return;

    try {
        const respuesta = await fetch(`/empleados/${idEmpleado}`, {
            method: 'DELETE'
        });

        if (respuesta.ok) {
            alert('Miembro del staff eliminado del sistema.');
            window.location.href = 'index.html'; 
        } else {
            const data = await respuesta.json();
            alert('Error: ' + (data.mensaje || 'No se pudo eliminar al empleado.'));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('No se pudo conectar con el servidor.');
    }
}