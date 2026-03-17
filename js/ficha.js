        const urlParams = new URLSearchParams(window.location.search);
        const idJugador = urlParams.get('id');
        let jugadorActual = null;
        let historialAsistencia = [];
        let historialKine = []; 

        // --- 2. CARGAR FICHA Y DOCUMENTOS ---
        function renderDoc(campoBD, nombreArchivoGuardado, idHtmlInput) {
            
            // Evaluamos si el usuario tiene permiso para cargar documentos
            const puedeCargar = (rolUsuario === 'Administrativo' || rolUsuario === 'Admin Principal');

            if (nombreArchivoGuardado) {
                // Si el archivo ya existe, TODOS pueden ver el botón verde de "Ver Archivo"
                let html = `
                    <a href="/uploads/${nombreArchivoGuardado}" target="_blank" class="btn btn-sm btn-success w-100 mb-2 shadow-sm">
                        <i class="bi bi-eye"></i> Ver Archivo
                    </a>
                `;
                
                // Pero SOLO los administrativos ven el botón de "Reemplazar"
                if (puedeCargar) {
                    html += `
                    <label class="btn btn-outline-secondary btn-sm w-100 mb-0">
                        <i class="bi bi-arrow-repeat"></i> Reemplazar
                        <input type="file" id="${idHtmlInput}" class="d-none" accept=".pdf,.jpg,.jpeg,.png" onchange="subirDocumento('${campoBD}', this)">
                    </label>
                    `;
                }
                return html;
            } else {
                // Si NO hay archivo guardado y NO puede cargar (Kine, Medico, Cuerpo Tecnico)...
                if (!puedeCargar) {
                    return `<span class="d-block small text-danger mt-1 fw-bold"><i class="bi bi-x-circle"></i> Documento Faltante</span>`;
                }
                
                // Si NO hay archivo y SÍ puede cargar (Administrativo)...
                return `
                    <label class="btn btn-outline-primary btn-sm w-100 mb-2 shadow-sm">
                        <i class="bi bi-upload"></i> Subir Archivo
                        <input type="file" id="${idHtmlInput}" class="d-none" accept=".pdf,.jpg,.jpeg,.png" onchange="subirDocumento('${campoBD}', this)">
                    </label>
                    <span class="d-block small text-danger mt-1"><i class="bi bi-x-circle"></i> Faltante</span>
                `;
            }
        }

        async function subirDocumento(campoBD, inputElement) {
            const file = inputElement.files[0];
            if (!file) return;

            const formData = new FormData();
            formData.append(campoBD, file);

            try {
                const labelElement = inputElement.parentElement;
                const originalHtml = labelElement.innerHTML;
                labelElement.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Subiendo...';
                labelElement.classList.add('disabled');

                const res = await fetch(`/jugadores/${idJugador}/documentos`, {
                    method: 'POST', body: formData 
                });

                if (res.ok) cargarFicha();
                else {
                    alert('❌ Error al subir el documento');
                    labelElement.innerHTML = originalHtml;
                    labelElement.classList.remove('disabled');
                }
            } catch (error) { alert('Error de conexión con el servidor'); }
        }

        function formatearFecha(fechaIso) {
            const d = new Date(fechaIso);
            d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
            return d.toLocaleDateString('es-AR');
        }

        async function cargarFicha() {
            try {
                const respuesta = await fetch(`/jugadores/${idJugador}`);
                jugadorActual = await respuesta.json();

                let tituloNombre = `${jugadorActual.nombre} ${jugadorActual.apellido}`;
                
                const contenedorBotones = document.getElementById('contenedor-estado-jugador');
                const tarjetaPrincipal = document.getElementById('tarjeta-principal-ficha');
                const headerFicha = document.getElementById('header-ficha');

                if (jugadorActual.fecha_baja) {
                    tituloNombre += ' <span class="badge bg-danger ms-2 fs-6">BAJA</span>';
                    tarjetaPrincipal.classList.add('baja-style');
                    headerFicha.classList.replace('bg-primary', 'bg-danger');

                    // RESTRICCIÓN: Solo personal administrativo puede reactivar
                    if (rolUsuario === 'Administrativo' || rolUsuario === 'Admin Principal') {
                        contenedorBotones.innerHTML = `
                            <button onclick="reactivarJugador()" class="btn btn-success btn-sm rounded-circle shadow-sm" title="Reactivar Jugador en el Club">
                                <i class="bi bi-person-check-fill"></i>
                            </button>
                        `;
                    }
                } else {
                    tarjetaPrincipal.classList.remove('baja-style');
                    headerFicha.classList.replace('bg-danger', 'bg-primary');

                    // RESTRICCIÓN: Solo personal administrativo puede dar de baja
                    if (rolUsuario === 'Administrativo' || rolUsuario === 'Admin Principal') {
                        contenedorBotones.innerHTML = `
                            <button onclick="eliminarJugador()" class="btn btn-outline-warning btn-sm rounded-circle shadow-sm" title="Dar de Baja">
                                <i class="bi bi-person-x-fill text-dark"></i>
                            </button>
                        `;
                    }
                }

                document.getElementById('f-nombre-completo').innerHTML = tituloNombre;
                document.getElementById('f-dni').innerText = jugadorActual.dni;
                
                if(jugadorActual.fecha_nacimiento){
                    document.getElementById('f-fecha').innerText = formatearFecha(jugadorActual.fecha_nacimiento);
                }
                
                document.getElementById('f-telefono').innerText = jugadorActual.telefono || '-';
                document.getElementById('f-emergencia-nombre').innerText = jugadorActual.contacto_emergencia_nombre || '-';
                document.getElementById('f-emergencia-tel').innerText = jugadorActual.contacto_emergencia_tel || '-';
                
                document.getElementById('f-grupo').innerText = jugadorActual.grupo_sanguineo || 'No espec.';
                document.getElementById('f-alergias').innerText = jugadorActual.alergias || 'Ninguna';
                document.getElementById('f-lesiones').innerText = jugadorActual.lesiones || 'Ninguna';
                document.getElementById('f-cirugias').innerText = jugadorActual.cirugias || 'Ninguna';
                
                const rama = jugadorActual.rama || 'Masculino';
                const badgeRama = document.getElementById('f-rama');
                badgeRama.innerText = rama;
                if (rama === 'Femenino') badgeRama.classList.replace('text-primary', 'text-danger');

                let htmlFechasClub = `
                    <div class="col-6 col-md-4">
                        <div class="p-2 border rounded text-center" style="background-color: #e9ecef;">
                            <small class="text-muted d-block text-uppercase fw-bold" style="font-size: 0.75rem;"><i class="bi bi-calendar-plus"></i> Ingreso Original</small>
                            <strong class="fs-6">${jugadorActual.fecha_alta ? formatearFecha(jugadorActual.fecha_alta) : 'No registrada'}</strong>
                        </div>
                    </div>
                `;

                if (jugadorActual.fecha_reingreso) {
                    htmlFechasClub += `
                        <div class="col-6 col-md-4">
                            <div class="p-2 bg-success bg-opacity-10 border-success rounded border text-center">
                                <small class="text-success d-block text-uppercase fw-bold" style="font-size: 0.75rem;"><i class="bi bi-arrow-repeat"></i> Reincorporación</small>
                                <strong class="fs-6 text-success">${formatearFecha(jugadorActual.fecha_reingreso)}</strong>
                            </div>
                        </div>
                    `;
                }

                document.getElementById('fechas-club-container').innerHTML = htmlFechasClub;

                document.getElementById('doc-apto-box').innerHTML = renderDoc('apto_medico', jugadorActual.apto_medico, 'file-apto');
                document.getElementById('doc-dni-frente-box').innerHTML = renderDoc('dni_frente', jugadorActual.dni_frente, 'file-dni-f');
                document.getElementById('doc-dni-dorso-box').innerHTML = renderDoc('dni_dorso', jugadorActual.dni_dorso, 'file-dni-d');

                try {
                    const resAsis = await fetch(`/asistencia/jugador/${idJugador}`);
                    historialAsistencia = await resAsis.json();
                    generarReporteAsistencia(); 
                } catch (e) {
                    document.getElementById('f-reporte-texto').innerText = 'No se pudo cargar el reporte estadístico.';
                }
                
            } catch (error) {
                alert('No se pudo cargar la ficha del jugador.');
            }
        }

        if (idJugador) {
            cargarFicha();
            cargarKinesiologia(); 
        } else {
            alert('No se especificó un jugador.');
            window.location.href = 'index.html';
        }

        // --- 3. FUNCIONES DE ESTADO (BAJA Y REACTIVAR) ---
        function eliminarJugador() {
            document.getElementById('input-fecha-baja').valueAsDate = new Date();
            const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('modalBaja'));
            modal.show();
        }

        async function confirmarBaja() {
            const fechaBaja = document.getElementById('input-fecha-baja').value;
            if (!fechaBaja) return alert('Por favor, seleccioná una fecha.');

            try {
                const respuesta = await fetch(`/jugadores/${idJugador}`, { 
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fecha_baja: fechaBaja }) 
                });
                
                if (respuesta.ok) {
                    alert('✅ Jugador dado de baja correctamente en la fecha indicada.');
                    bootstrap.Modal.getInstance(document.getElementById('modalBaja')).hide();
                    cargarFicha(); 
                } else alert('❌ Error al dar de baja.');
            } catch (error) { alert('❌ No se pudo conectar con el servidor.'); }
        }

        function reactivarJugador() {
            document.getElementById('input-fecha-reingreso').valueAsDate = new Date();
            const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('modalReactivar'));
            modal.show();
        }

        async function confirmarReactivacion() {
            const fechaReingreso = document.getElementById('input-fecha-reingreso').value;
            if (!fechaReingreso) return alert('Por favor, seleccioná una fecha.');

            try {
                const respuesta = await fetch(`/jugadores/${idJugador}/reactivar`, { 
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fecha_reingreso: fechaReingreso }) 
                });
                
                if (respuesta.ok) {
                    alert('✅ ¡Jugador reactivado exitosamente!');
                    bootstrap.Modal.getInstance(document.getElementById('modalReactivar')).hide();
                    cargarFicha(); 
                } else alert('❌ Error al reactivar.');
            } catch (error) { alert('❌ No se pudo conectar con el servidor.'); }
        }

        // --- 4. EXPORTAR PDF Y EMAIL (MÉTODO CENTRADO PERFECTO) ---
        function generarPDFyWhatsApp() {
            if(!jugadorActual) return;
            
            // Subimos arriba y a la izquierda de todo para evitar recortes
            window.scrollTo(0, 0); 
            
            // Le ponemos el "traje de PDF" a toda la página
            document.body.classList.add('modo-pdf');

            const elemento = document.getElementById('area-pdf');
            
            const opciones = {
                // [Arriba, Derecha, Abajo, Izquierda] -> Laterales en 0 porque el CSS hace el centrado
                margin: [0.3, 0, 0.3, 0], 
                filename: `Ficha_Medica_${jugadorActual.apellido}_${jugadorActual.nombre}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                // Agregamos scrollX: 0 para que la "cámara" empiece desde el borde absoluto
                html2canvas: { scale: 2, useCORS: true, scrollY: 0, scrollX: 0, letterRendering: true }, 
                jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
            };

            // Damos 150 milisegundos para asegurar que el body se expanda a 800px antes de la foto
            setTimeout(() => {
                html2pdf().set(opciones).from(elemento).save().then(() => {
                    
                    // Le quitamos el traje y vuelve a la normalidad
                    document.body.classList.remove('modo-pdf');
                    
                    setTimeout(() => {
                        alert('📄 ¡Ficha generada, centrada y en una sola hoja!\nSe va a abrir WhatsApp.');
                        const texto = `Hola! Te envío la ficha médica de ${jugadorActual.nombre} ${jugadorActual.apellido}.`;
                        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`, '_blank');
                    }, 500); 
                    
                }).catch(err => {
                    console.error("Error:", err);
                    document.body.classList.remove('modo-pdf');
                });
            }, 150); 
        }

        // --- 5. PERMISOS ---
        
        // 1. DATOS PERSONALES: Solo Administrativos y Admin Principal pueden editar.
        // Se lo bloqueamos al Cuerpo Técnico, Kinesiólogo y Médico.
        if (rolUsuario === 'Cuerpo Tecnico' || rolUsuario === 'Kinesiologo' || rolUsuario === 'Medico') {
            const btnEditar = document.getElementById('btn-editar-jugador');
            if (btnEditar) btnEditar.style.display = 'none';
        }

        // 2. KINESIOLOGÍA: Solo Médicos y Kinesiólogos pueden agregar nuevas sesiones.
        if (rolUsuario !== 'Medico' && rolUsuario !== 'Kinesiologo') {
            const btnAgregarKine = document.getElementById('btn-agregar-kine');
            if (btnAgregarKine) btnAgregarKine.style.display = 'none';
        }

        // --- 6. ASISTENCIA ---
        function generarReporteAsistencia() {
            if (historialAsistencia.length === 0) {
                document.getElementById('f-reporte-texto').innerHTML = 'El jugador no tiene registros de asistencia.';
                return;
            }
            let tb=0, pb=0, tf=0, pf=0;
            historialAsistencia.forEach(a => {
                if (a.tipo_entrenamiento === 'Basquet') { tb++; if (a.estado === 'Presente') pb++; }
                else if (a.tipo_entrenamiento === 'Fisico') { tf++; if (a.estado === 'Presente') pf++; }
            });
            const pBasquet = tb > 0 ? Math.round((pb/tb)*100) : 0;
            const pFisico = tf > 0 ? Math.round((pf/tf)*100) : 0;
            document.getElementById('f-reporte-texto').innerHTML = `Básquet: ${pb}/${tb} (${pBasquet}%). Físico: ${pf}/${tf} (${pFisico}%).`;
        }

        function buscarAsistenciaPorDia() {
            const fechaBuscada = document.getElementById('buscador-fecha-asis').value;
            const cont = document.getElementById('resultado-busqueda-dia');
            if (!fechaBuscada) return cont.innerHTML = '<span class="text-danger small">Elegí una fecha.</span>';
            const registrosDelDia = historialAsistencia.filter(a => a.fecha.split('T')[0] === fechaBuscada);
            
            if (registrosDelDia.length === 0) return cont.innerHTML = '<span class="text-muted small">Sin registros.</span>';
            
            let htmlRes = '';
            registrosDelDia.forEach(reg => {
                let badgeClass = reg.estado === 'Presente' ? 'bg-success' : (reg.estado === 'Justificado' ? 'bg-warning text-dark' : 'bg-danger');
                const icono = reg.tipo_entrenamiento === 'Basquet' ? '🏀' : '🏋️';
                htmlRes += `<div class="mb-1 fw-bold">${icono}: <span class="badge ${badgeClass} ms-2 px-3">${reg.estado}</span></div>`;
            });
            cont.innerHTML = htmlRes;
        }

        // --- 7. KINESIOLOGÍA ---
        document.getElementById('k-fecha').valueAsDate = new Date(); 

        async function cargarKinesiologia() {
            const tabla = document.getElementById('tabla-kinesiologia');
            try {
                const respuesta = await fetch(`/kinesiologia/${idJugador}`);
                historialKine = await respuesta.json(); 

                tabla.innerHTML = '';
                if (historialKine.length === 0) {
                    tabla.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-3">Sin historial kinesiológico.</td></tr>';
                    return;
                }

                historialKine.forEach(reg => {
                    const fechaStr = formatearFecha(reg.fecha);
                    const obsHtml = reg.observaciones ? `<br><small class="text-muted fst-italic">Obs: ${reg.observaciones}</small>` : '';

                    let botonesAccion = `<td></td>`;
                    
                    // Solo Médicos y Kinesiólogos ven los botones de Editar y Eliminar en cada fila
                    if (rolUsuario === 'Medico' || rolUsuario === 'Kinesiologo') {
                        botonesAccion = `
                            <td class="text-center">
                                <div class="btn-group shadow-sm">
                                    <button type="button" class="btn btn-outline-primary btn-sm" title="Editar Sesión" onclick="abrirEdicionKine(${reg.id})">
                                        <i class="bi bi-pencil"></i>
                                    </button>
                                    <button type="button" class="btn btn-outline-danger btn-sm" title="Eliminar Sesión" onclick="eliminarKine(${reg.id})">
                                        <i class="bi bi-trash3"></i>
                                    </button>
                                </div>
                            </td>
                        `;
                    }

                    tabla.innerHTML += `
                        <tr>
                            <td class="fw-bold text-nowrap">${fechaStr}</td>
                            <td class="text-danger fw-bold">${reg.lesion_motivo}</td>
                            <td>${reg.tratamiento}${obsHtml}</td>
                            <td class="text-muted small"><i class="bi bi-person-badge"></i> ${reg.profesional_nombre}</td>
                            ${botonesAccion}
                        </tr>
                    `;
                });
            } catch (error) {
                tabla.innerHTML = '<tr><td colspan="5" class="text-center text-danger py-3">Error al cargar.</td></tr>';
            }
        }

        document.getElementById('form-kine').addEventListener('submit', async (e) => {
            e.preventDefault();
            const nuevoReg = {
                jugador_id: idJugador,
                fecha: document.getElementById('k-fecha').value,
                lesion_motivo: document.getElementById('k-motivo').value,
                tratamiento: document.getElementById('k-tratamiento').value,
                observaciones: document.getElementById('k-observaciones').value,
                profesional_nombre: sessionStorage.getItem('usuarioLogueado') || 'Kinesiólogo'
            };
            try {
                const res = await fetch('/kinesiologia', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(nuevoReg)
                });
                if (res.ok) {
                    bootstrap.Modal.getInstance(document.getElementById('modalKine')).hide();
                    document.getElementById('form-kine').reset();
                    document.getElementById('k-fecha').valueAsDate = new Date();
                    cargarKinesiologia();
                } else alert('❌ Error al guardar.');
            } catch (error) { alert('❌ Error de servidor.'); }
        });

        function abrirEdicionKine(id) {
            const registro = historialKine.find(r => r.id === id);
            if (!registro) return;
            document.getElementById('edit-k-id').value = registro.id;
            if (registro.fecha) {
                const d = new Date(registro.fecha);
                d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                document.getElementById('edit-k-fecha').value = `${year}-${month}-${day}`;
            }
            document.getElementById('edit-k-motivo').value = registro.lesion_motivo || '';
            document.getElementById('edit-k-tratamiento').value = registro.tratamiento || '';
            document.getElementById('edit-k-observaciones').value = registro.observaciones || '';
            const modalEl = document.getElementById('modalEditarKine');
            const modalInstance = bootstrap.Modal.getOrCreateInstance(modalEl);
            modalInstance.show();
        }

        document.getElementById('form-editar-kine').addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('edit-k-id').value;
            const act = {
                fecha: document.getElementById('edit-k-fecha').value,
                lesion_motivo: document.getElementById('edit-k-motivo').value,
                tratamiento: document.getElementById('edit-k-tratamiento').value,
                observaciones: document.getElementById('edit-k-observaciones').value
            };
            try {
                const res = await fetch(`/kinesiologia/${id}`, {
                    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(act)
                });
                if (res.ok) {
                    bootstrap.Modal.getInstance(document.getElementById('modalEditarKine')).hide();
                    cargarKinesiologia(); 
                } else alert('❌ Error al actualizar.');
            } catch (error) { alert('❌ Error de servidor.'); }
        });

        async function eliminarKine(id) {
            if (!confirm('⚠️ ¿ELIMINAR definitivamente esta sesión?')) return;
            try {
                const res = await fetch(`/kinesiologia/${id}`, { method: 'DELETE' });
                if (res.ok) cargarKinesiologia(); 
                else alert('❌ Error al eliminar.');
            } catch (error) { console.error('Error:', error); }
        }