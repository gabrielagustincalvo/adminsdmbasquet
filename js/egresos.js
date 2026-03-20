let egresosCargados = []; 
let egresosParaExportar = [];    

// SEGURIDAD DE VISTA: Bloqueamos a Cuerpo Técnico
if (sessionStorage.getItem('usuarioRol') === 'Cuerpo Tecnico') {
    alert('⛔ Acceso Denegado: La sección de Tesorería es exclusiva para el personal administrativo.');
    window.location.href = 'index.html';
} // <- ¡Acá faltaba una llave!

document.getElementById('e-fecha').valueAsDate = new Date();

// 1. OBTENER DATOS DE LA BASE DE DATOS
async function cargarHistorial() {
    const tabla = document.getElementById('tabla-historial');
    tabla.innerHTML = '<tr><td colspan="6" class="text-center py-4"><div class="spinner-border text-danger"></div></td></tr>';
    try {
        const respuesta = await fetch('/egresos');
        egresosCargados = await respuesta.json();
        renderizarTabla();
    } catch (error) {
        console.error('Error historial:', error);
        tabla.innerHTML = '<tr><td colspan="6" class="text-center text-danger py-4">Error de conexión con el servidor.</td></tr>';
    }
}

// 2. RENDERIZAR TABLA CON FILTROS Y TOTALES
function renderizarTabla() {
    const tabla = document.getElementById('tabla-historial');
    const filtroCat = document.getElementById('filtro-categoria').value;
    const filtroMes = document.getElementById('filtro-mes').value; 
    
    // Aplicar Filtros combinados (Categoría y/o Mes)
    let egresosFiltrados = egresosCargados;
    
    // Filtro por Categoría
    if (filtroCat !== "") {
        egresosFiltrados = egresosFiltrados.filter(e => e.categoria === filtroCat);
    } // <- ¡Acá faltaba una llave!
    
    // Filtro por Mes
    if (filtroMes !== "") {
        egresosFiltrados = egresosFiltrados.filter(e => {
            const fechaObj = new Date(e.fecha);
            // Ajustamos zona horaria para evitar desfases de un día
            fechaObj.setMinutes(fechaObj.getMinutes() + fechaObj.getTimezoneOffset()); 
            
            // .getMonth() devuelve de 0 (Enero) a 11 (Diciembre), le sumamos 1 para que coincida con el select
            const mesEgreso = (fechaObj.getMonth() + 1).toString();
            return mesEgreso === filtroMes;
        });
    }
    
    egresosParaExportar = egresosFiltrados;

    // Calcular Totales de lo que quedó filtrado
    const cantidadTotal = egresosFiltrados.length;
    const montoTotal = egresosFiltrados.reduce((suma, e) => suma + Number(e.monto), 0);
    
    document.getElementById('stat-cantidad').innerText = cantidadTotal;
    document.getElementById('stat-total').innerText = `$ ${montoTotal.toLocaleString('es-AR')}`;

    // Cambiar títulos si hay algún filtro activo
    if (filtroCat !== "" || filtroMes !== "") {
        document.getElementById('titulo-cantidad').innerText = 'Cantidad (Filtrado)';
        document.getElementById('titulo-total').innerText = 'Total Gastado (Filtrado)';
    } else {
        document.getElementById('titulo-cantidad').innerText = 'Cantidad de Gastos';
        document.getElementById('titulo-total').innerText = 'Total Gastado';
    } // <- ¡Acá faltaba una llave!
    
    // Dibujar la tabla
    if (egresosFiltrados.length === 0) {
        tabla.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4 fw-bold">No hay egresos registrados para este filtro.</td></tr>';
        return;
    } // <- ¡Acá faltaba una llave!
    
    tabla.innerHTML = '';
    egresosFiltrados.forEach(egreso => {
        const fechaObj = new Date(egreso.fecha);
        fechaObj.setMinutes(fechaObj.getMinutes() + fechaObj.getTimezoneOffset());
        const fechaFormat = fechaObj.toLocaleDateString('es-AR');
        const montoFormat = `$${Number(egreso.monto).toLocaleString('es-AR')}`;
        
        const fila = `
            <tr>
                <td class="ps-3 text-muted small fw-bold">${fechaFormat}</td>
                <td class="fw-bold text-dark">${egreso.concepto}</td>
                <td><span class="badge bg-dark">${egreso.categoria}</span></td>
                <td><span class="badge bg-secondary">${egreso.metodo}</span></td>
                <td class="fw-bold text-danger">${montoFormat}</td>
                <td class="text-center">
                    <button type="button" class="btn btn-outline-danger btn-sm" title="Anular Egreso" onclick="eliminarEgreso(${egreso.id})">
                        <i class="bi bi-trash3"></i>
                    </button>
                </td>
            </tr>
        `;
        tabla.innerHTML += fila;
    });
}

// 3. GUARDAR UN NUEVO EGRESO
document.getElementById('form-egreso').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nuevoEgreso = {
        concepto: document.getElementById('e-concepto').value,
        categoria: document.getElementById('e-categoria').value,
        fecha: document.getElementById('e-fecha').value,
        monto: document.getElementById('e-monto').value,
        metodo: document.getElementById('e-metodo').value,
        observaciones: document.getElementById('e-observaciones').value
    };
    
    try {
        const respuesta = await fetch('/egresos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(nuevoEgreso)
        });
        
        if (respuesta.ok) {
            alert(`✅ ¡Gasto registrado exitosamente!`);
            document.getElementById('e-concepto').value = '';
            document.getElementById('e-monto').value = '';
            document.getElementById('e-observaciones').value = '';
            cargarHistorial(); 
        } else {
            alert('❌ Error al guardar en la base de datos.');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('❌ No se pudo conectar con el servidor.');
    }
});

// 4. ELIMINAR/ANULAR UN EGRESO
async function eliminarEgreso(id) {
    const confirmacion = confirm('⚠️ ATENCIÓN: ¿Estás seguro de que querés borrar este gasto del registro?');
    if (!confirmacion) return;
    
    try {
        const respuesta = await fetch(`/egresos/${id}`, { method: 'DELETE' });
        if (respuesta.ok) {
            alert('🗑️ Egreso anulado correctamente.');
            cargarHistorial(); 
        } else {
            alert('❌ Hubo un error al intentar borrar el registro.');
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

// 5. EXPORTAR A EXCEL (XLSX)
function exportarAExcel() {
    if (egresosParaExportar.length === 0) {
        alert("⚠️ No hay datos para exportar.");
        return;
    }

    const datosExcel = egresosParaExportar.map(e => {
        const fechaObj = new Date(e.fecha);
        fechaObj.setMinutes(fechaObj.getMinutes() + fechaObj.getTimezoneOffset());
        
        return {
            "Fecha": fechaObj.toLocaleDateString('es-AR'),
            "Concepto": e.concepto,
            "Categoría": e.categoria,
            "Monto ($)": Number(e.monto), 
            "Método": e.metodo,
            "Observaciones": e.observaciones || ""
        };
    });

    const worksheet = XLSX.utils.json_to_sheet(datosExcel);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Egresos");

    XLSX.writeFile(workbook, "Historial_Egresos_SolDeMayo.xlsx");
}

// Iniciar página
cargarHistorial();