const bcrypt = require('bcryptjs');
// Esta es la contraseña que queremos encriptar
const password = '1234'; 
// Aquí ocurre la magia
const salt = bcrypt.genSaltSync(10);
const hash = bcrypt.hashSync(password, salt);
console.log(hash);