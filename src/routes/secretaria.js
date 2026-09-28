import express, { Router } from 'express';
import { problema, metodoNoPermitido } from '../lib/problema.js';
import { TAREAS, EQUIPOS } from '../dominio.js';

const RESPUESTAS = {
  conserjeria: 'Las llaves del aula 14 están en el tablón. Devuélvelas antes de las 14:30.',
  orientacion: 'Pide cita en el formulario de la web y hablamos con calma.',
  biblioteca: 'Puedes llevarte hasta tres libros durante quince días.',
  secretaria: 'Ese certificado tarda tres días hábiles. Te avisamos por correo.',
};

export function crearRouterSecretaria() {
  const router = Router();

  // Tarea aleatoria (texto plano)
  router.route('/tareas/aleatoria')
    .get((req, res) => {
      const tarea = TAREAS[Math.floor(Math.random() * TAREAS.length)];
      res.type('text/plain').send(`Tu tarea para hoy: ${tarea}`);
    })
    .all(metodoNoPermitido('GET', 'HEAD'));

  // Consulta a jefatura con parámetro de consulta (?duda=...)
  router.route('/consultas/jefatura')
    .get((req, res) => {
      const { duda } = req.query;
      if (typeof duda !== 'string' || duda.trim() === '') {
        return problema(res, 400, 'Escribe tu duda en el parámetro duda de la URL');
      }
      res.json({
        mensaje: `Jefatura de estudios responde a "${duda}": revisa primero la programación didáctica y, si sigue sin quedar claro, habla con tu tutor o tutora.`,
      });
    })
    .all(metodoNoPermitido('GET', 'HEAD'));

  // Consulta a otras personas del centro con parámetro de ruta (/consultas/:persona)
  router.route('/consultas/:persona')
    .get((req, res) => {
      const persona = req.params.persona.toLowerCase();
      const respuesta = RESPUESTAS[persona];
      if (!respuesta) {
        return problema(res, 404, `En el centro no hay nadie llamado ${req.params.persona}`, {
          disponibles: ['jefatura', ...Object.keys(RESPUESTAS)],
        });
      }
      res.json({ mensaje: `Respuesta de ${persona}: ${respuesta}` });
    })
    .all(metodoNoPermitido('GET', 'HEAD'));

  // Inscribirse en un equipo del Proyecto Intermodular (texto plano)
  router.route('/equipos/inscripcion')
    .post(express.text({ limit: '1kb' }), (req, res) => {
      if (!req.is('text/plain')) {
        res.set('Accept-Post', 'text/plain');
        return problema(res, 415, 'Formato de datos no soportado en esta ruta');
      }
      const texto = req.body.trim();
      const numero = Number(texto);
      if (!/^\d+$/.test(texto) || numero < EQUIPOS.minimo || numero > EQUIPOS.maximo) {
        return problema(res, 422, `El número de equipo debe ser un entero entre ${EQUIPOS.minimo} y ${EQUIPOS.maximo}`);
      }
      res.json({ mensaje: `Te has unido al equipo ${numero} del Proyecto Intermodular` });
    })
    .all(metodoNoPermitido('POST'));

  // Comunicar una incidencia: cualquier formato de texto (text/plain, text/markdown, text/html...)
  router.route('/incidencias')
    .post(express.text({ type: 'text/*', limit: '10kb' }), (req, res) => {
      if (!req.is('text/*')) {
        return problema(res, 415, 'Formato de datos no soportado en esta ruta');
      }
      if (req.body.trim() === '') {
        return problema(res, 400, 'La incidencia está vacía');
      }
      res.status(201).json({
        mensaje: 'Incidencia registrada. El equipo TIC la revisará en breve.',
        formatoRecibido: req.get('Content-Type'),
        bytes: Buffer.byteLength(req.body),
      });
    })
    .all(metodoNoPermitido('POST'));

  return router;
}
