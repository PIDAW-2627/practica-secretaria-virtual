import express, { Router } from 'express';
import bcrypt from 'bcryptjs';
import { problema, metodoNoPermitido } from '../lib/problema.js';
import { leerCredencialesBasic } from '../lib/autenticacionBasica.js';
import { UsernameDuplicadoError } from '../repositorios/errores.js';
import { CICLOS, TUTORES, EDAD_MINIMA, CURSO_MAXIMO } from '../dominio.js';

const CAMPOS_OBLIGATORIOS = ['username', 'password', 'ciclo', 'tutor', 'edad'];

function validarMatricula(datos) {
  const errores = [];
  if (typeof datos.username !== 'string' || !/^[a-z0-9_]{3,30}$/i.test(datos.username)) {
    errores.push({ campo: 'username', mensaje: 'De 3 a 30 letras, números o guiones bajos' });
  }
  if (typeof datos.password !== 'string' || datos.password.length < 4) {
    errores.push({ campo: 'password', mensaje: 'Texto de al menos 4 caracteres' });
  }
  if (!CICLOS.includes(datos.ciclo)) {
    errores.push({ campo: 'ciclo', mensaje: `Debe ser uno de: ${CICLOS.join(', ')}` });
  }
  if (!TUTORES.includes(datos.tutor)) {
    errores.push({ campo: 'tutor', mensaje: `Debe ser uno de: ${TUTORES.join(', ')}` });
  }
  if (!Number.isInteger(datos.edad) || datos.edad < EDAD_MINIMA) {
    errores.push({ campo: 'edad', mensaje: `Número entero; hace falta tener al menos ${EDAD_MINIMA} años` });
  }
  return errores;
}

export function crearRouterAlumnos(alumnos) {
  const router = Router();

  // Matricular a un alumno (JSON)
  async function matricular(req, res) {
    if (!req.is('application/json')) {
      return problema(res, 415, 'La matrícula solo se acepta en formato JSON');
    }

    const faltan = CAMPOS_OBLIGATORIOS.filter((campo) => req.body?.[campo] === undefined);
    if (faltan.length > 0) {
      return problema(res, 400, 'Faltan datos para la matrícula', { faltan });
    }

    const errores = validarMatricula(req.body);
    if (errores.length > 0) {
      return problema(res, 422, 'Los datos de la matrícula no son válidos', { errors: errores });
    }

    const { username, password, ciclo, tutor, edad } = req.body; // solo los campos esperados
    try {
      await alumnos.crear({
        username,
        passwordHash: await bcrypt.hash(password, 10),
        ciclo,
        tutor,
        edad,
      });
    } catch (error) {
      if (error instanceof UsernameDuplicadoError) {
        return problema(res, 409, `Ya existe un alumno con el usuario ${username}`);
      }
      throw error;
    }

    res.status(201).json({
      mensaje: `Alumno ${username} matriculado en 1º de ${ciclo}, con ${tutor} en la tutoría`,
    });
  }

  // Promocionar de curso: acción no idempotente y sin cuerpo → POST
  async function promocionar(req, res) {
    const alumno = await alumnos.buscarPorId(req.params.id);
    if (!alumno) return problema(res, 404, 'Alumno no encontrado');

    if (alumno.curso >= CURSO_MAXIMO) {
      return problema(res, 409, `${alumno.username} ya está en ${CURSO_MAXIMO}º: lo siguiente es titular`);
    }

    const actualizado = await alumnos.actualizar(alumno.id, { curso: alumno.curso + 1 });
    res.json({
      mensaje: `¡Enhorabuena! ${actualizado.username} promociona a ${actualizado.curso}º de ${actualizado.ciclo}`,
      curso: actualizado.curso,
    });
  }

  // Baja de matrícula: requiere las credenciales del propio alumno en Authorization: Basic
  async function darDeBaja(req, res) {
    const credenciales = leerCredencialesBasic(req);
    if (!credenciales) {
      res.set('WWW-Authenticate', 'Basic realm="Secretaria Virtual", charset="UTF-8"');
      return problema(res, 401, 'Identifícate con tu usuario y contraseña para darte de baja');
    }

    const alumno = await alumnos.buscarPorId(req.params.id);
    if (!alumno) return problema(res, 404, 'Alumno no encontrado');

    if (credenciales.username !== alumno.username) {
      return problema(res, 403, 'Solo puedes tramitar tu propia baja');
    }
    if (!(await bcrypt.compare(credenciales.password, alumno.passwordHash))) {
      res.set('WWW-Authenticate', 'Basic realm="Secretaria Virtual", charset="UTF-8"');
      return problema(res, 401, 'Usuario o contraseña incorrectos');
    }

    await alumnos.eliminar(alumno.id);
    res.status(204).end();
  }

  router.route('/')
    .post(express.json({ limit: '10kb' }), matricular)
    .all(metodoNoPermitido('POST'));

  router.route('/:id/promocion')
    .post(promocionar)
    .all(metodoNoPermitido('POST'));

  router.route('/:id')
    .delete(darDeBaja)
    .all(metodoNoPermitido('DELETE'));

  return router;
}
