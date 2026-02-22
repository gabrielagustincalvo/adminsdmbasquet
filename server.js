const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bcrypt = require('bcryptjs'); // <--- Importante: Seguridad

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.json());

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
  const { nombre, apellido, dni, direccion, telefono, correo, usuario, password, rol } = req.body;

  try {
    // Generamos la encriptación de la contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Guardamos todos los datos en la nueva tabla
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

    // C. Si todo coincide, le damos luz verde y le mandamos su ROL para que el Frontend sepa qué mostrarle
    res.json({ 
      mensaje: 'Login exitoso', 
      usuario: {
        id: usuarioDB.id,
        nombre: usuarioDB.nombre,
        rol: usuarioDB.rol // <--- ¡Esto es clave para los permisos después!
      } 
    });
  } catch (err) {
    console.error('Error en el login:', err.message);
    res.status(500).json({ mensaje: 'Error interno del servidor al iniciar sesión' });
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
// ARRANQUE DEL SERVIDOR
// ==========================================
app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});
