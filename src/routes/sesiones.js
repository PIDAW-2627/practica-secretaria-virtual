import express, { Router } from 'express';
import bcrypt from 'bcryptjs';
import { problema, metodoNoPermitido } from '../lib/problema.js';
import { MAX_INTENTOS_LOGIN, vistaPublica } from '../dominio.js';

const CREDENCIALES_INCORRECTAS = 'Usuario o contraseña incorrectos';
const CUENTA_BLOQUEADA = 'Cuenta bloqueada por demasiados intentos fallidos. Pasa por secretaría para desbloquearla.';

export function crearRouterSesiones(alumnos) {
  const router = Router();

  // Iniciar sesión: solo acepta el formato de un formulario HTML clásico
  async function iniciarSesion(req, res) {
    if (!req.is('application/x-www-form-urlencoded')) {
      return problema(res, 415, 'Este formulario no entiende ese formato de datos');
    }

    const { username, password } = req.body;
    if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
      return problema(res, 400, 'Debes enviar username y password');
    }

    const alumno = await alumnos.buscarPorUsername(username);
    // Misma respuesta si el usuario no existe que si la contraseña falla:
    // así no se revela qué usuarios están matriculados
    if (!alumno) return problema(res, 401, CREDENCIALES_INCORRECTAS);

    if (alumno.bloqueado) return problema(res, 423, CUENTA_BLOQUEADA);

    if (!(await bcrypt.compare(password, alumno.passwordHash))) {
      const intentosFallidos = alumno.intentosFallidos + 1;
      const bloqueado = intentosFallidos >= MAX_INTENTOS_LOGIN;
      await alumnos.actualizar(alumno.id, { intentosFallidos, bloqueado });
      return bloqueado
        ? problema(res, 423, CUENTA_BLOQUEADA)
        : problema(res, 401, CREDENCIALES_INCORRECTAS);
    }

    if (alumno.intentosFallidos > 0) {
      await alumnos.actualizar(alumno.id, { intentosFallidos: 0 });
    }

    res.json({ mensaje: 'Acceso concedido', alumno: vistaPublica(alumno) });
  }

  router.route('/')
    .post(express.urlencoded({ extended: false, limit: '10kb' }), iniciarSesion)
    .all(metodoNoPermitido('POST'));

  return router;
}
