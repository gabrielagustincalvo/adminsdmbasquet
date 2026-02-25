const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bcrypt = require('bcryptjs'); // <--- Importante: Seguridad

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// <--- MODIFICACIÓN: Se movió la inicialización de 'app' hacia arriba para que el resto del código la reconozca.
const app = express();
const port = 3000;

// Middleware
// <--- MODIFICACIÓN: Se subieron los middlewares básicos para que atrapen el formato json y cors desde el principio.
app.use(cors());
app.use(express.json());

// Crear la carpeta "uploads" automáticamente si no existe
if (!fs.existsSync(path.join(__dirname, 'uploads'))) {
    fs.mkdirSync(path.join(__dirname, 'uploads'));
}

// Configurar cómo y dónde se guardan los archivos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, 'uploads/'))
  },
  filename: function (req, file, cb) {
    // Le agregamos la fecha al nombre para que nunca haya dos archivos llamados igual
    cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '-'))
  }
});
const upload = multer({ storage: storage });

// Hacer que la carpeta uploads sea pública para poder ver los archivos desde la web
// <--- MODIFICACIÓN: Al estar debajo de "const app = express();", esta línea ya no dará el error "Cannot access 'app' before initialization".
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configuración de la Base de Datos
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'club_db',
  password: '185132Gaby', // Tu contraseña
  port: 5432,
});

// 1. Ruta de prueba
app.get('/', (req, res) => {
  res.send('¡Hola! El servidor del Club está funcionando 🏀');
});

// ==========================================
//        MÓDULO DE USUARIOS Y SEGURIDAD
// ==========================================

// 1. RUTA DE REGISTRO COMPLETO
app.post('/registro', async (req, res) => {
  const { nombre, apellido, dni, direccion, telefono, correo, usuario, password, rol, rolCreador } = req.body;

  // ==========================================
  // BARRERA DE SEGURIDAD DEFINITIVA
  // ==========================================
  // Si el que manda la petición NO es Admin Principal, bloqueamos la acción.
  if (rolCreador !== 'Admin Principal') {
      return res.status(403).json({ 
          mensaje: 'Acceso Denegado: Operación reservada exclusivamente para el Administrador Principal.' 
      });
  }
  // ==========================================

  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const query = `
      INSERT INTO usuarios (nombre, apellido, dni, direccion, telefono, correo, usuario, password, rol) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id, nombre, usuario, rol
    `;
    const values = [nombre, apellido, dni, direccion, telefono, correo, usuario, hashedPassword, rol];
    
    const result = await pool.query(query, values);

    res.json({ mensaje: 'Usuario registrado con éxito', usuario: result.rows[0] });
  } catch (err) {
    console.error('Error al registrar:', err.message);
    res.status(500).json({ mensaje: 'Error al registrar. Es posible que el DNI, Correo o Usuario ya existan.' });
  }
});


// 2. RUTA DE LOGIN (Actualizada para contraseñas seguras)
app.post('/login', async (req, res) => {
  const { usuario, password } = req.body;

  try {
    // A. Buscamos si el usuario escrito existe en la base de datos
    const query = 'SELECT * FROM usuarios WHERE usuario = $1';
    const result = await pool.query(query, [usuario]);

    if (result.rows.length === 0) {
      return res.status(401).json({ mensaje: 'El usuario no existe' });
    }

    const usuarioDB = result.rows[0];

    // B. Comparamos la contraseña que escribió con la contraseña encriptada de la BD
    const passwordValida = await bcrypt.compare(password, usuarioDB.password);

    if (!passwordValida) {
      return res.status(401).json({ mensaje: 'Contraseña incorrecta' });
    }

   // Agregamos la bandera debe_cambiar_pass para que el frontend sepa qué hacer
    res.json({ 
      mensaje: 'Login exitoso', 
      usuario: {
        id: usuarioDB.id,
        nombre: usuarioDB.nombre,
        rol: usuarioDB.rol,
        debe_cambiar_pass: usuarioDB.debe_cambiar_pass // <--- NUEVO
      } 
    });
  } catch (err) {
    console.error('Error en el login:', err.message);
    res.status(500).json({ mensaje: 'Error interno del servidor al iniciar sesión' });
  }
});

// 2.5 RUTA PARA CAMBIO DE CONTRASEÑA OBLIGATORIO (Primer Ingreso)
app.post('/cambiar-password-obligatorio', async (req, res) => {
  const { id, nuevaPassword } = req.body;
  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(nuevaPassword, salt);

    // Actualizamos la clave y le quitamos la etiqueta de "debe cambiar" (lo pasamos a FALSE)
    const query = 'UPDATE usuarios SET password = $1, debe_cambiar_pass = FALSE WHERE id = $2';
    await pool.query(query, [hashedPassword, id]);

    res.json({ mensaje: 'Contraseña actualizada correctamente. Bienvenido al sistema.' });
  } catch (err) {
    console.error('Error al forzar cambio de clave:', err.message);
    res.status(500).json({ mensaje: 'Error al actualizar la contraseña.' });
  }
});

// -----------------------------------------------------

// 3. RUTA PARA RECUPERAR CONTRASEÑA
app.post('/recuperar', async (req, res) => {
  const { correo, dni, nuevaPassword } = req.body;

  try {
    // A. Buscamos si existe alguien con ese correo EXACTO y ese DNI EXACTO
    const queryCheck = 'SELECT id, usuario FROM usuarios WHERE correo = $1 AND dni = $2';
    const resultCheck = await pool.query(queryCheck, [correo, dni]);

    if (resultCheck.rows.length === 0) {
      return res.status(404).json({ mensaje: 'No encontramos ninguna cuenta que coincida con ese Correo y DNI.' });
    }

    const usuarioDB = resultCheck.rows[0];

    // B. Si existe, encriptamos la nueva contraseña que eligió
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(nuevaPassword, salt);

    // C. Guardamos la nueva contraseña en la base de datos
    const queryUpdate = 'UPDATE usuarios SET password = $1 WHERE id = $2';
    await pool.query(queryUpdate, [hashedPassword, usuarioDB.id]);

    // Le devolvemos un mensaje de éxito y le recordamos cuál era su usuario
    res.json({ 
        mensaje: 'Contraseña actualizada con éxito', 
        usuarioRecordado: usuarioDB.usuario 
    });
    
  } catch (err) {
    console.error('Error al recuperar contraseña:', err.message);
    res.status(500).json({ mensaje: 'Error interno del servidor al intentar recuperar la cuenta.' });
  }
});

// 3. Rutas de Jugadores (GET y POST)
app.get('/jugadores', async (req, res) => {
    const result = await pool.query('SELECT * FROM jugadores ORDER BY id ASC');
    res.json(result.rows);
});

app.get('/jugadores/:id', async (req, res) => {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM jugadores WHERE id = $1', [id]);
    res.json(result.rows[0]);
});

// 4. Ruta para CREAR (Guardar) un nuevo jugador
app.post('/jugadores', async (req, res) => {
  try {
    // PARTE 1: Atrapamos los datos de la web (Agregamos 'rama' al final)
    const { 
        nombre, apellido, dni, fecha_nacimiento, telefono, 
        contacto_emergencia_nombre, contacto_emergencia_tel,
        grupo_sanguineo, alergias, lesiones, cirugias, rama 
    } = req.body;

    // PARTE 2: Armamos la instrucción SQL (Agregamos 'rama' y el '$12')
    const query = `
      INSERT INTO jugadores (
          nombre, apellido, dni, fecha_nacimiento, telefono, 
          contacto_emergencia_nombre, contacto_emergencia_tel,
          grupo_sanguineo, alergias, lesiones, cirugias, rama 
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *
    `;
    
    // PARTE 3: Pasamos los valores reales (Agregamos 'rama' al final de la lista)
    const values = [
        nombre, apellido, dni, fecha_nacimiento, telefono, 
        contacto_emergencia_nombre, contacto_emergencia_tel,
        grupo_sanguineo || null, 
        alergias || 'Ninguna', 
        lesiones || 'Ninguna', 
        cirugias || 'Ninguna',
        rama || 'Masculino' 
    ];

    const result = await pool.query(query, values);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Error al guardar el jugador');
  }
});

// 5. Ruta para ACTUALIZAR (Editar) un jugador
app.put('/jugadores/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { 
        nombre, apellido, dni, fecha_nacimiento, telefono, 
        contacto_emergencia_nombre, contacto_emergencia_tel,
        grupo_sanguineo, alergias, lesiones, cirugias, rama 
    } = req.body;

    // Le decimos a la base de datos: "Actualizá (UPDATE) estos campos DONDE el id sea el que te paso"
    const query = `
      UPDATE jugadores 
      SET nombre = $1, apellido = $2, dni = $3, fecha_nacimiento = $4, 
          telefono = $5, contacto_emergencia_nombre = $6, contacto_emergencia_tel = $7,
          grupo_sanguineo = $8, alergias = $9, lesiones = $10, cirugias = $11, rama = $12
      WHERE id = $13 RETURNING *
    `;
    
    const values = [
        nombre, apellido, dni, fecha_nacimiento, telefono, 
        contacto_emergencia_nombre, contacto_emergencia_tel,
        grupo_sanguineo || null, alergias || 'Ninguna', 
        lesiones || 'Ninguna', cirugias || 'Ninguna', rama || 'Masculino', 
        id // <--- El comodín $13 es el ID
    ];

    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ mensaje: 'Jugador no encontrado' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Error al actualizar el jugador');
  }
});

// 6. Ruta para ELIMINAR (Borrar) un jugador
app.delete('/jugadores/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Le decimos a la base de datos: Borrá la fila donde el ID sea este
    const result = await pool.query('DELETE FROM jugadores WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ mensaje: 'Jugador no encontrado' });
    }
    
    res.json({ mensaje: 'Jugador eliminado correctamente' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Error al eliminar el jugador');
  }
});

// 7. Ruta para SUBIR DOCUMENTOS (Apto Médico, DNI)
app.post('/jugadores/:id/documentos', upload.fields([
  { name: 'apto_medico', maxCount: 1 },
  { name: 'dni_frente', maxCount: 1 },
  { name: 'dni_dorso', maxCount: 1 }
]), async (req, res) => {
  try {
    const { id } = req.params;
    let queryUpdates = [];
    let values = [];
    let counter = 1;

    // Detectamos qué archivos llegaron y preparamos la actualización SQL
    if (req.files['apto_medico']) {
      queryUpdates.push(`apto_medico = $${counter++}`);
      values.push(req.files['apto_medico'][0].filename);
    }
    if (req.files['dni_frente']) {
      queryUpdates.push(`dni_frente = $${counter++}`);
      values.push(req.files['dni_frente'][0].filename);
    }
    if (req.files['dni_dorso']) {
      queryUpdates.push(`dni_dorso = $${counter++}`);
      values.push(req.files['dni_dorso'][0].filename);
    }

    if (queryUpdates.length === 0) {
      return res.status(400).json({mensaje: "No se enviaron archivos."});
    }

    values.push(id);
    const query = `UPDATE jugadores SET ${queryUpdates.join(', ')} WHERE id = $${counter} RETURNING *`;
    
    await pool.query(query, values);
    res.json({ mensaje: 'Documentos guardados exitosamente.' });
  } catch (err) {
    console.error('Error al subir documentos:', err.message);
    res.status(500).send('Error interno del servidor.');
  }
});

// ==========================================
//        MÓDULO DE TESORERÍA (PAGOS)
// ==========================================

// 1. Obtener el historial de pagos de un jugador específico
app.get('/pagos/:jugador_id', async (req, res) => {
  try {
    const { jugador_id } = req.params;
    const query = 'SELECT * FROM pagos WHERE jugador_id = $1 ORDER BY fecha_pago DESC';
    const result = await pool.query(query, [jugador_id]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener pagos:', err.message);
    res.status(500).send('Error interno del servidor');
  }
});

// 2. Registrar un nuevo pago (Cobrar cuota)
app.post('/pagos', async (req, res) => {
  try {
    const { jugador_id, fecha_pago, mes_correspondiente, monto, metodo, observaciones } = req.body;
    
    const query = `
      INSERT INTO pagos (jugador_id, fecha_pago, mes_correspondiente, monto, metodo, observaciones)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
    `;
    const values = [jugador_id, fecha_pago, mes_correspondiente, monto, metodo, observaciones];
    
    await pool.query(query, values);
    res.json({ mensaje: '¡Pago registrado con éxito!' });
  } catch (err) {
    console.error('Error al registrar pago:', err.message);
    res.status(500).send('Error al guardar el pago');
  }
});

// 3. Obtener el total recaudado y la cantidad de cuotas pagadas (Estadísticas generales)
app.get('/pagos-totales', async (req, res) => {
  try {
    // Le pedimos a la base de datos que cuente las filas y sume la columna monto
    const query = 'SELECT COUNT(*) as cantidad, SUM(monto) as total FROM pagos';
    const result = await pool.query(query);
    
    // Devolvemos el resultado (si no hay nada, devuelve 0)
    res.json({
      cantidad: result.rows[0].cantidad || 0,
      total: result.rows[0].total || 0
    });
  } catch (err) {
    console.error('Error al obtener totales de pagos:', err.message);
    res.status(500).send('Error interno del servidor');
  }
});

// 4. Obtener TODOS los pagos (Historial global con nombres)
app.get('/pagos-todos', async (req, res) => {
  try {
    const query = `
      SELECT p.*, j.nombre, j.apellido 
      FROM pagos p 
      JOIN jugadores j ON p.jugador_id = j.id 
      ORDER BY p.fecha_pago DESC
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener todos los pagos:', err.message);
    res.status(500).send('Error interno del servidor');
  }
});

// 5. Editar un pago existente
app.put('/pagos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { mes_correspondiente, fecha_pago, monto, metodo, observaciones } = req.body;
    
    const query = `
      UPDATE pagos 
      SET mes_correspondiente = $1, fecha_pago = $2, monto = $3, metodo = $4, observaciones = $5
      WHERE id = $6 RETURNING *
    `;
    const values = [mes_correspondiente, fecha_pago, monto, metodo, observaciones, id];
    
    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ mensaje: 'Pago no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error al editar pago:', err.message);
    res.status(500).send('Error al guardar los cambios del pago');
  }
});

// 6. Eliminar un pago (Anular recibo)
app.delete('/pagos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM pagos WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ mensaje: 'Pago no encontrado' });
    }
    res.json({ mensaje: 'Pago anulado correctamente' });
  } catch (err) {
    console.error('Error al eliminar pago:', err.message);
    res.status(500).send('Error al eliminar el pago');
  }
});

// ==========================================
//        MÓDULO DE ASISTENCIA (DT / PROFE)
// ==========================================

// 1. Obtener TODO el historial de asistencia de UN SOLO JUGADOR (Va PRIMERO para evitar choques)
app.get('/asistencia/jugador/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const query = `
      SELECT fecha, tipo_entrenamiento, estado 
      FROM asistencia
      WHERE jugador_id = $1
      ORDER BY fecha DESC
    `;
    const result = await pool.query(query, [id]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener historial del jugador:', err.message);
    res.status(500).send('Error interno');
  }
});

// 2. Obtener la asistencia de una fecha Y UN TIPO específico (Va SEGUNDO)
app.get('/asistencia/:fecha/:tipo', async (req, res) => {
  try {
    const { fecha, tipo } = req.params;
    const result = await pool.query(
      'SELECT * FROM asistencia WHERE fecha = $1 AND tipo_entrenamiento = $2', 
      [fecha, tipo]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener asistencia:', err.message);
    res.status(500).send('Error interno del servidor');
  }
});

// 3. Guardar o actualizar la planilla completa
app.post('/asistencia', async (req, res) => {
  try {
    const asistencias = req.body;
    
    for (let asis of asistencias) {
      const query = `
        INSERT INTO asistencia (jugador_id, fecha, tipo_entrenamiento, estado)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (jugador_id, fecha, tipo_entrenamiento) 
        DO UPDATE SET estado = EXCLUDED.estado
      `;
      await pool.query(query, [asis.jugador_id, asis.fecha, asis.tipo_entrenamiento, asis.estado]);
    }
    
    res.json({ mensaje: '¡Planilla guardada con éxito!' });
  } catch (err) {
    console.error('Error al guardar asistencia:', err.message);
    res.status(500).send('Error al guardar la asistencia');
  }
});

// ==========================================
//        MÓDULO DE STAFF / EMPLEADOS
// ==========================================

// 1. Obtener la lista de todo el personal (SIN enviar las contraseñas)
app.get('/empleados', async (req, res) => {
  try {
    // Traemos todos los datos médicos y personales, pero excluimos usuario y password
    const query = `
      SELECT id, nombre, apellido, dni, direccion, telefono, correo, rol, 
             fecha_nacimiento, contacto_emergencia_nombre, contacto_emergencia_tel, 
             grupo_sanguineo, alergias, lesiones, cirugias 
      FROM usuarios 
      ORDER BY rol, nombre ASC
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener la lista de empleados:', err.message);
    res.status(500).send('Error interno del servidor');
  }
});

// 2. Obtener un empleado específico para armar su Ficha Médica
app.get('/empleados/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const query = `
      SELECT id, nombre, apellido, dni, direccion, telefono, correo, rol, 
             fecha_nacimiento, contacto_emergencia_nombre, contacto_emergencia_tel, 
             grupo_sanguineo, alergias, lesiones, cirugias 
      FROM usuarios 
      WHERE id = $1
    `;
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ mensaje: 'Empleado no encontrado' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error al obtener la ficha del empleado:', err.message);
    res.status(500).send('Error interno del servidor');
  }
});

// 3. ACTUALIZAR (Editar) los datos médicos y personales de un empleado
app.put('/empleados/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { 
        nombre, apellido, dni, fecha_nacimiento, telefono, direccion,
        contacto_emergencia_nombre, contacto_emergencia_tel,
        grupo_sanguineo, alergias, lesiones, cirugias 
    } = req.body;

    const query = `
      UPDATE usuarios 
      SET nombre = $1, apellido = $2, dni = $3, fecha_nacimiento = $4, 
          telefono = $5, direccion = $6, contacto_emergencia_nombre = $7, 
          contacto_emergencia_tel = $8, grupo_sanguineo = $9, 
          alergias = $10, lesiones = $11, cirugias = $12
      WHERE id = $13 RETURNING *
    `;
    
    const values = [
        nombre, apellido, dni, fecha_nacimiento, telefono, direccion,
        contacto_emergencia_nombre, contacto_emergencia_tel,
        grupo_sanguineo || null, alergias || 'Ninguna', 
        lesiones || 'Ninguna', cirugias || 'Ninguna', 
        id 
    ];

    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ mensaje: 'Empleado no encontrado' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error al actualizar el empleado:', err.message);
    res.status(500).send('Error interno al guardar los cambios.');
  }
});

// ==========================================
//        MÓDULO DE KINESIOLOGÍA
// ==========================================

// 1. Traer el historial kinesiológico de un jugador específico
app.get('/kinesiologia/:jugador_id', async (req, res) => {
  try {
    const { jugador_id } = req.params;
    // Buscamos los registros y los ordenamos por fecha de más nuevo a más viejo
    const query = `
      SELECT id, fecha, lesion_motivo, tratamiento, observaciones, profesional_nombre 
      FROM registros_kine 
      WHERE jugador_id = $1 
      ORDER BY fecha DESC, id DESC
    `;
    const result = await pool.query(query, [jugador_id]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener el historial de kinesiología:', err.message);
    res.status(500).send('Error interno del servidor');
  }
});

// 2. Guardar una nueva sesión de kinesiología
app.post('/kinesiologia', async (req, res) => {
  try {
    const { jugador_id, fecha, lesion_motivo, tratamiento, observaciones, profesional_nombre } = req.body;
    
    const query = `
      INSERT INTO registros_kine (jugador_id, fecha, lesion_motivo, tratamiento, observaciones, profesional_nombre) 
      VALUES ($1, $2, $3, $4, $5, $6) 
      RETURNING *
    `;
    const values = [jugador_id, fecha, lesion_motivo, tratamiento, observaciones, profesional_nombre];
    
    const result = await pool.query(query, values);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error al guardar el registro kinesiológico:', err.message);
    res.status(500).send('Error al guardar el registro');
  }
});

// 3. Editar un registro kinesiológico
app.put('/kinesiologia/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { fecha, lesion_motivo, tratamiento, observaciones } = req.body;

    const query = `
      UPDATE registros_kine 
      SET fecha = $1, lesion_motivo = $2, tratamiento = $3, observaciones = $4
      WHERE id = $5 RETURNING *
    `;
    const values = [fecha, lesion_motivo, tratamiento, observaciones, id];

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ mensaje: 'Registro no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error al editar registro kinesiológico:', err.message);
    res.status(500).send('Error interno al editar');
  }
});

// 4. Eliminar un registro kinesiológico
app.delete('/kinesiologia/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM registros_kine WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ mensaje: 'Registro no encontrado' });
    }
    res.json({ mensaje: 'Registro eliminado correctamente' });
  } catch (err) {
    console.error('Error al eliminar registro kinesiológico:', err.message);
    res.status(500).send('Error interno al eliminar');
  }
});

// ==========================================
// ARRANQUE DEL SERVIDOR
// ==========================================
app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});
