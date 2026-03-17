        let todosLosJugadores = [];
        let todosLosEmpleados = [];
        let todosLosPagos = [];
        let todosLosEgresos = [];

        // ==========================================
        // MOTOR TEMPORAL DEFINITIVO (CORREGIDO)
        // ==========================================
        function esActivoEnElMes(persona, mesSeleccionado) {
            if (mesSeleccionado === 'Todos') return true;

            const nombresMeses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
            const indiceMes = nombresMeses.indexOf(mesSeleccionado);
            const anioActual = new Date().getFullYear();

            // 🌟 NUEVA REGLA DE NEGOCIO:
            // Si la persona es un JUGADOR (no tiene rol de empleado) y se le registró
            // un pago en este mes, se le da un "Pase VIP" y cuenta como activo,
            // sin importar su fecha real de ingreso al sistema.
            const esJugador = !persona.rol; 
            if (esJugador && typeof todosLosPagos !== 'undefined') {
                const tienePagoEsteMes = todosLosPagos.some(pago => 
                    Number(pago.jugador_id) === Number(persona.id) && 
                    pago.mes_correspondiente === mesSeleccionado
                );
                if (tienePagoEsteMes) {
                    return true;
                }
            }

            if (persona.fecha_baja) {
                const baja = new Date(persona.fecha_baja);
                baja.setMinutes(baja.getMinutes() + baja.getTimezoneOffset());
                
                if (baja.getFullYear() < anioActual || (baja.getFullYear() === anioActual && baja.getMonth() <= indiceMes)) {
                    if (persona.fecha_reingreso) {
                        const reingreso = new Date(persona.fecha_reingreso);
                        reingreso.setMinutes(reingreso.getMinutes() + reingreso.getTimezoneOffset());
                        if (reingreso.getFullYear() < anioActual || (reingreso.getFullYear() === anioActual && reingreso.getMonth() <= indiceMes)) {
                            return true; 
                        }
                    }
                    return false; 
                }
            }

            if (persona.fecha_alta) {
                const alta = new Date(persona.fecha_alta);
                alta.setMinutes(alta.getMinutes() + alta.getTimezoneOffset());
                return (alta.getFullYear() < anioActual || (alta.getFullYear() === anioActual && alta.getMonth() <= indiceMes));
            }

            return true; 
        }

        // --- 2. LÓGICA DE CATEGORÍAS ---
        function obtenerCategoria(fechaNacimiento) {
            if (!fechaNacimiento) return 'Sin Fecha';
            const anio = new Date(fechaNacimiento).getFullYear();
            
            if (anio >= 2019 && anio <= 2022) return 'Escuelita';
            if (anio === 2018 || anio === 2017) return 'Pre Mini';
            if (anio === 2016 || anio === 2015) return 'Mini (U11)';
            if (anio === 2014 || anio === 2013) return 'Infantiles (U13)';
            if (anio === 2012 || anio === 2011) return 'Cadetes (U15)';
            if (anio === 2010 || anio === 2009) return 'Juveniles (U17)';
            if (anio >= 2005 && anio <= 2008) return 'Liga Próximo (U21)';
            if (anio <= 2004) return 'Primera';
            return 'Otras'; 
        }

        // ==========================================
        // SISTEMA DE NAVEGACIÓN
        // ==========================================
        window.addEventListener('hashchange', procesarHash);

        function procesarHash() {
            const hash = window.location.hash || '#categorias';

            // Al navegar, limpiamos la barra de búsqueda para que no quede trabada
            document.getElementById('buscador-general').value = '';

            document.getElementById('vista-categorias').style.display = 'none';
            document.getElementById('vista-dashboard').style.display = 'none';
            document.getElementById('vista-jugadores').style.display = 'none';
            document.getElementById('vista-staff').style.display = 'none';
            document.getElementById('vista-inactivos').style.display = 'none';
            document.getElementById('vista-busqueda').style.display = 'none';

            document.getElementById('filtro-rama').style.display = 'block'; 
            document.getElementById('filtro-mes').style.display = 'block';

            if (hash === '#staff') {
                verStaff();
            } else if (hash === '#inactivos') {
                verInactivos();
            } else if (hash.startsWith('#jugadores-')) {
                const categoria = decodeURIComponent(hash.replace('#jugadores-', ''));
                verJugadores(categoria);
            } else {
                renderizarCategorias();
            }
        }

        // ==========================================
        // LÓGICA DEL BUSCADOR INTELIGENTE
        // ==========================================
        document.getElementById('buscador-general').addEventListener('input', function(e) {
            const textoBusqueda = e.target.value.toLowerCase().trim();
            
            // Si el texto es muy corto, restauramos la vista normal
            if (textoBusqueda.length < 2) {
                if (document.getElementById('vista-busqueda').style.display === 'block') {
                    procesarHash(); // Recarga la vista en la que estábamos
                }
                return;
            }

            // Ocultar todo lo demás
            document.getElementById('vista-categorias').style.display = 'none';
            document.getElementById('vista-dashboard').style.display = 'none';
            document.getElementById('vista-jugadores').style.display = 'none';
            document.getElementById('vista-staff').style.display = 'none';
            document.getElementById('vista-inactivos').style.display = 'none';
            
            // Mostrar los resultados de búsqueda
            document.getElementById('vista-busqueda').style.display = 'block';

            const tabla = document.getElementById('lista-resultados-busqueda');
            tabla.innerHTML = '';

            // Filtrar jugadores por nombre, apellido o DNI
            const resultados = todosLosJugadores.filter(j => {
                const nombreCompleto = `${j.nombre} ${j.apellido}`.toLowerCase();
                const dni = (j.dni || '').toString();
                return nombreCompleto.includes(textoBusqueda) || dni.includes(textoBusqueda);
            });

            if (resultados.length === 0) {
                tabla.innerHTML = '<tr><td colspan="4" class="text-center py-5 text-muted fw-bold">No se encontraron jugadores con ese criterio.</td></tr>';
                return;
            }

            resultados.forEach(jugador => {
                const edad = jugador.fecha_nacimiento ? `${new Date().getFullYear() - new Date(jugador.fecha_nacimiento).getFullYear()} años` : '-';
                const categoria = obtenerCategoria(jugador.fecha_nacimiento);
                
                const estaDeBaja = jugador.fecha_baja !== null;
                const opacidad = estaDeBaja ? 'opacity-50' : '';
                const estadoBadge = estaDeBaja ? '<span class="badge bg-danger ms-2 shadow-sm">BAJA</span>' : '<span class="badge bg-success ms-2 shadow-sm">ACTIVO</span>';

                tabla.innerHTML += `
                    <tr class="${opacidad}">
                        <td>
                            <div class="fw-bold">${jugador.nombre} ${jugador.apellido}</div>
                            <div class="text-muted small"><i class="bi bi-card-text"></i> ${jugador.dni || '-'}</div>
                        </td>
                        <td>
                            <div class="fw-bold text-dark">${categoria} <span class="badge ${jugador.rama === 'Femenino' ? 'bg-danger' : 'bg-primary'} badge-rama ms-1">${jugador.rama || 'Masculino'}</span></div>
                            <div class="text-muted small">${edad}</div>
                        </td>
                        <td>${estadoBadge}</td>
                        <td>
                            <a href="ficha.html?id=${jugador.id}" class="btn btn-outline-dark btn-sm">
                                <i class="bi bi-person-vcard"></i> Ficha
                            </a>
                        </td>
                    </tr>
                `;
            });
        });

        function limpiarBusqueda() {
            document.getElementById('buscador-general').value = '';
            procesarHash(); // Simula "Atrás" a la vista anterior
        }

        // --- RENDERIZADO DE VISTAS ---
        function renderizarCategorias() {
            document.getElementById('vista-dashboard').style.display = 'block'; 
            document.getElementById('vista-categorias').style.display = 'flex';
            document.getElementById('titulo-pantalla').innerText = 'Categorías';

            const ramaFiltro = document.getElementById('filtro-rama').value;
            const mesFiltro = document.getElementById('filtro-mes').value;
            const contenedor = document.getElementById('vista-categorias');
            contenedor.innerHTML = '';

            const agrupados = {};

            todosLosJugadores.forEach(jugador => {
                const ramaJugador = jugador.rama || 'Masculino'; 
                if (ramaFiltro !== 'Todos' && ramaJugador !== ramaFiltro) return;
                if (!esActivoEnElMes(jugador, mesFiltro)) return;

                const cat = obtenerCategoria(jugador.fecha_nacimiento);
                if (!agrupados[cat]) agrupados[cat] = [];
                agrupados[cat].push(jugador);
            });

            const ordenOficial = ['Escuelita', 'Pre Mini', 'Mini (U11)', 'Infantiles (U13)', 'Cadetes (U15)', 'Juveniles (U17)', 'Liga Próximo (U21)', 'Primera', 'Sin Fecha', 'Otras'];
            const categoriasPresentes = Object.keys(agrupados).sort((a, b) => ordenOficial.indexOf(a) - ordenOficial.indexOf(b));

            if (categoriasPresentes.length === 0) {
                contenedor.innerHTML = `<div class="col-12 text-center text-muted mt-5"><h4>No hay jugadores en esta categoría/mes.</h4></div>`;
                return;
            }

            categoriasPresentes.forEach(cat => {
                const cantidad = agrupados[cat].length;
                let colorBorde = cat === 'Primera' ? 'border-danger' : (cat.includes('U') ? 'border-warning' : 'border-success');

                const tarjeta = `
                    <div class="col-md-4 col-lg-3">
                        <div class="card h-100 shadow-sm card-categoria border-top border-4 ${colorBorde}" onclick="window.location.hash = '#jugadores-${cat}'">
                            <div class="card-body text-center">
                                <h4 class="card-title text-dark fw-bold mb-3">${cat}</h4>
                                <span class="badge bg-secondary rounded-pill px-3 py-2 fs-6">
                                    <i class="bi bi-people-fill"></i> ${cantidad} jugadores
                                </span>
                            </div>
                        </div>
                    </div>
                `;
                contenedor.innerHTML += tarjeta;
            });
        }

        function verJugadores(categoriaSeleccionada) {
            document.getElementById('vista-jugadores').style.display = 'block';
            document.getElementById('filtro-mes').style.display = 'none'; 
            
            const ramaFiltro = document.getElementById('filtro-rama').value;
            const mesFiltro = document.getElementById('filtro-mes').value;
            let textoRama = ramaFiltro === 'Todos' ? '' : ` (${ramaFiltro})`;
            document.getElementById('titulo-pantalla').innerText = `${categoriaSeleccionada}${textoRama}`;

            const tabla = document.getElementById('lista-jugadores');
            tabla.innerHTML = '';

            const filtrados = todosLosJugadores.filter(jugador => {
                const ramaJugador = jugador.rama || 'Masculino';
                const pasaFiltroRama = (ramaFiltro === 'Todos' || ramaJugador === ramaFiltro);
                const pasaTiempo = esActivoEnElMes(jugador, mesFiltro); 
                
                return pasaFiltroRama && pasaTiempo && obtenerCategoria(jugador.fecha_nacimiento) === categoriaSeleccionada;
            });

            filtrados.sort((a, b) => (a.fecha_baja ? 1 : 0) - (b.fecha_baja ? 1 : 0));

            filtrados.forEach(jugador => {
                const edad = jugador.fecha_nacimiento ? `${new Date().getFullYear() - new Date(jugador.fecha_nacimiento).getFullYear()} años` : '-';
                const anioNac = jugador.fecha_nacimiento ? new Date(jugador.fecha_nacimiento).getFullYear() : '-';
                
                const estaDeBaja = jugador.fecha_baja !== null;
                const opacidad = estaDeBaja ? 'opacity-50' : '';
                const cartelBaja = estaDeBaja ? '<span class="badge bg-danger ms-2">BAJA</span>' : '';
                
                const fila = `
                    <tr class="${opacidad}">
                        <td>
                            <div class="fw-bold">${jugador.nombre} ${jugador.apellido} ${cartelBaja}</div>
                            <div class="text-muted small">ID: #${jugador.id}</div>
                        </td>
                        <td>
                            <div>${edad}</div>
                            <div class="text-muted small">Clase ${anioNac}</div>
                        </td>
                        <td class="d-none d-md-table-cell"><span class="badge ${jugador.rama === 'Femenino' ? 'bg-danger' : 'bg-primary'} badge-rama">${jugador.rama || 'Masculino'}</span></td>
                        <td class="d-none d-md-table-cell">${jugador.telefono || '-'}</td>
                        <td>
                            <a href="ficha.html?id=${jugador.id}" class="btn btn-outline-dark btn-sm">
                                <i class="bi bi-person-vcard"></i> Ficha
                            </a>
                        </td>
                    </tr>
                `;
                tabla.innerHTML += fila;
            });
        }

        function verStaff() {
            document.getElementById('vista-staff').style.display = 'block';
            document.getElementById('titulo-pantalla').innerText = 'Directorio del Staff';
            document.getElementById('filtro-rama').style.display = 'none'; 
            document.getElementById('filtro-mes').style.display = 'none';

            const mesFiltro = document.getElementById('filtro-mes').value;
            const tabla = document.getElementById('lista-staff');
            tabla.innerHTML = '';

            const filtrados = todosLosEmpleados.filter(emp => esActivoEnElMes(emp, mesFiltro));

            filtrados.forEach(emp => {
                let badgeClass = 'bg-info text-dark';
                if (emp.rol === 'Admin Principal') badgeClass = 'bg-dark text-white';
                if (emp.rol === 'Cuerpo Tecnico') badgeClass = 'bg-warning text-dark';

                const fila = `
                    <tr>
                        <td>
                            <div class="fw-bold">${emp.nombre} ${emp.apellido}</div>
                            <div class="text-muted small">DNI: ${emp.dni || '-'}</div>
                        </td>
                        <td><span class="badge ${badgeClass}">${emp.rol}</span></td>
                        <td class="d-none d-md-table-cell">${emp.telefono || '-'}</td>
                        <td>
                            <a href="ficha-empleado.html?id=${emp.id}" class="btn btn-outline-dark btn-sm">
                                <i class="bi bi-person-vcard"></i> Ficha
                            </a>
                        </td>
                    </tr>
                `;
                tabla.innerHTML += fila;
            });
        }

        function verInactivos() {
            document.getElementById('vista-inactivos').style.display = 'block';
            document.getElementById('titulo-pantalla').innerText = 'Jugadores Inactivos';
            document.getElementById('filtro-rama').style.display = 'none'; 
            document.getElementById('filtro-mes').style.display = 'none';

            const tabla = document.getElementById('lista-inactivos');
            tabla.innerHTML = '';

            const inactivos = todosLosJugadores.filter(j => j.fecha_baja !== null);

            if (inactivos.length === 0) {
                tabla.innerHTML = '<tr><td colspan="4" class="text-center py-5 text-muted fw-bold">No hay jugadores inactivos actualmente.</td></tr>';
                return;
            }

            inactivos.forEach(j => {
                const fBS = new Date(j.fecha_baja);
                fBS.setMinutes(fBS.getMinutes() + fBS.getTimezoneOffset());
                
                const fila = `
                    <tr>
                        <td>
                            <div class="fw-bold">${j.nombre} ${j.apellido}</div>
                            <div class="text-muted small">ID: #${j.id}</div>
                        </td>
                        <td class="d-none d-md-table-cell"><span class="badge ${j.rama === 'Femenino' ? 'bg-danger' : 'bg-primary'}">${j.rama || 'Masculino'}</span></td>
                        <td class="text-danger fw-bold"><i class="bi bi-calendar-x"></i> ${fBS.toLocaleDateString('es-AR')}</td>
                        <td>
                            <a href="ficha.html?id=${j.id}" class="btn btn-outline-dark btn-sm">
                                <i class="bi bi-person-vcard"></i> Ficha para Reactivar
                            </a>
                        </td>
                    </tr>
                `;
                tabla.innerHTML += fila;
            });
        }

        // --- 3. INICIALIZAR EL PANEL ---
        async function inicializarPanel() {
            try {
                const nombresMeses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
                const mesActual = nombresMeses[new Date().getMonth()];
                document.getElementById('filtro-mes').value = mesActual;

                const [resJug, resEmp, resPagos, resEgresos] = await Promise.all([
                    fetch('/jugadores'),
                    fetch('/empleados'),
                    fetch('/pagos-todos'),
                    fetch('/egresos')
                ]);

                todosLosJugadores = await resJug.json();
                todosLosEmpleados = await resEmp.json();
                todosLosPagos = await resPagos.json();
                todosLosEgresos = await resEgresos.json();
                
                cargarDashboard();
                procesarHash();
            } catch (error) {
                console.error('Error al cargar datos:', error);
            }
        }

        inicializarPanel();

        // --- LÓGICA DE PERMISOS ---
        const rolUsuario = sessionStorage.getItem('usuarioRol');

        // 1. Permisos del Administrativo
        if (rolUsuario === 'Administrativo') {
            const btnAsistencia = document.getElementById('btn-asistencia');
            if (btnAsistencia) btnAsistencia.style.display = 'none';
        }

        // 2. Permisos de Creación de Usuarios (Solo Admin Principal)
        const btnCrearUsuario = document.getElementById('btn-crear-usuario');
        if (btnCrearUsuario && rolUsuario !== 'Admin Principal') {
            btnCrearUsuario.style.display = 'none';
        }
        
        // 3. Permisos del Cuerpo Técnico
        if (rolUsuario === 'Cuerpo Tecnico') {
            const btnNuevoJugador = document.querySelector('a[href="alta.html"]');
            if (btnNuevoJugador) btnNuevoJugador.style.display = 'none';

            const botonesTesoreria = document.querySelectorAll('.btn-tesoreria');
            botonesTesoreria.forEach(btn => btn.style.display = 'none');
        }

        // 4. NUEVO: PERMISOS DEL CUERPO MÉDICO (Kinesiólogo / Médico)
        // Solo pueden ver jugadores. Se les oculta todo lo administrativo y deportivo.
        if (rolUsuario === 'Kinesiologo' || rolUsuario === 'Medico') {
            const btnNuevoJugador = document.querySelector('a[href="alta.html"]');
            const btnAsistencia = document.getElementById('btn-asistencia');
            const btnIngresos = document.getElementById('btn-ingresos');
            const btnEgresos = document.getElementById('btn-egresos');

            if (btnNuevoJugador) btnNuevoJugador.style.display = 'none';
            if (btnAsistencia) btnAsistencia.style.display = 'none';
            if (btnIngresos) btnIngresos.style.display = 'none';
            if (btnEgresos) btnEgresos.style.display = 'none';
        }

        // ==========================================
        // LÓGICA DEL DASHBOARD DE ESTADÍSTICAS 
        // ==========================================
        let chartRamas = null;
        let chartCategorias = null;

        function cargarDashboard() {
            const selectRama = document.getElementById('filtro-rama');
            const ramaSeleccionada = selectRama ? selectRama.value : 'Todos';
            
            const selectMes = document.getElementById('filtro-mes');
            const mesSeleccionado = selectMes ? selectMes.value : 'Todos';

            const jugadoresFiltrados = todosLosJugadores.filter(j => {
                const ramaJugador = j.rama || 'Masculino'; 
                const pasaRama = (!selectRama || ramaSeleccionada === 'Todos' || ramaSeleccionada === '') ? true : (ramaJugador === ramaSeleccionada);
                return pasaRama && esActivoEnElMes(j, mesSeleccionado);
            });

            const staffFiltrado = todosLosEmpleados.filter(emp => esActivoEnElMes(emp, mesSeleccionado));

            document.getElementById('dash-jugadores').innerText = jugadoresFiltrados.length;
            document.getElementById('dash-staff').innerText = staffFiltrado.length;

            const rolDash = sessionStorage.getItem('usuarioRol');
            if (rolDash === 'Cuerpo Tecnico') {
                const tarjetaReca = document.getElementById('tarjeta-recaudacion');
                if(tarjetaReca) tarjetaReca.style.display = 'none';
                const tarjetaEgre = document.getElementById('tarjeta-egresos');
                if(tarjetaEgre) tarjetaEgre.style.display = 'none';
            } else {
                // 🌟 CORRECCIÓN CRÍTICA DE SUMA DE INGRESOS: Convertimos a Number() por seguridad
                const idsFiltrados = jugadoresFiltrados.map(j => Number(j.id));
                let sumaIngresos = 0;
                
                todosLosPagos.forEach(pago => {
                    const coincideRamaYTiempo = idsFiltrados.includes(Number(pago.jugador_id));
                    const coincideMes = mesSeleccionado === 'Todos' || pago.mes_correspondiente === mesSeleccionado;
                    if (coincideRamaYTiempo && coincideMes) sumaIngresos += Number(pago.monto);
                });
                document.getElementById('dash-recaudacion').innerText = `$${sumaIngresos.toLocaleString('es-AR')}`;

                let sumaEgresos = 0;
                const nombresMeses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
                
                todosLosEgresos.forEach(egreso => {
                    const fechaObj = new Date(egreso.fecha);
                    fechaObj.setMinutes(fechaObj.getMinutes() + fechaObj.getTimezoneOffset());
                    const mesEgresoStr = nombresMeses[fechaObj.getMonth()];
                    const coincideMes = mesSeleccionado === 'Todos' || mesEgresoStr === mesSeleccionado;
                    if (coincideMes) sumaEgresos += Number(egreso.monto);
                });
                
                const cardEgresos = document.getElementById('dash-egresos');
                if (cardEgresos) cardEgresos.innerText = `$${sumaEgresos.toLocaleString('es-AR')}`;
            }

            let masc = 0, fem = 0;
            jugadoresFiltrados.forEach(j => {
                if (j.rama === 'Femenino') fem++;
                else masc++;
            });

            if (chartRamas) chartRamas.destroy(); 
            chartRamas = new Chart(document.getElementById('graficoRamas'), {
                type: 'doughnut',
                data: {
                    labels: ['Masculino', 'Femenino'],
                    datasets: [{
                        data: [masc, fem],
                        backgroundColor: ['#0d6efd', '#dc3545'], 
                        borderWidth: 0
                    }]
                },
                options: { maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'bottom' } } }
            });

            const conteoCat = {
                'Escuelita': 0, 'Pre Mini': 0, 'Mini (U11)': 0, 
                'Infantiles (U13)': 0, 'Cadetes (U15)': 0, 
                'Juveniles (U17)': 0, 'Liga Próximo (U21)': 0, 'Primera': 0
            };

            jugadoresFiltrados.forEach(j => {
                const cat = obtenerCategoria(j.fecha_nacimiento);
                if (conteoCat[cat] !== undefined) conteoCat[cat]++;
            });

            if (chartCategorias) chartCategorias.destroy();
            chartCategorias = new Chart(document.getElementById('graficoCategorias'), {
                type: 'bar',
                data: {
                    labels: Object.keys(conteoCat),
                    datasets: [{
                        label: 'Jugadores',
                        data: Object.values(conteoCat),
                        backgroundColor: '#198754', 
                        borderRadius: 5
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false } }, 
                    scales: { y: { beginAtZero: true, ticks: { stepSize: 5 } } }
                }
            });
        }

        window.addEventListener('pageshow', function(event) {
            if (event.persisted || (typeof window.performance != 'undefined' && window.performance.navigation.type === 2)) {
                window.location.reload(); 
            }
        });