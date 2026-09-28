import { Router } from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { problema, metodoNoPermitido } from '../lib/problema.js';

const TAMANO_MAXIMO = 5 * 1024 * 1024; // 5 MB
const FIRMA_PDF = Buffer.from('%PDF-');

const subida = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: TAMANO_MAXIMO, files: 1, fields: 5 },
}).single('archivo');

const ERRORES_MULTER = {
  LIMIT_FILE_SIZE: [413, 'El archivo supera los 5 MB'],
  LIMIT_UNEXPECTED_FILE: [400, 'El archivo debe enviarse en el campo "archivo" (y solo uno)'],
  LIMIT_FILE_COUNT: [400, 'Solo se admite un archivo por entrega'],
};

export function crearRouterEntregas(carpetaEntregas) {
  const router = Router();

  function recibirArchivo(req, res, next) {
    if (!req.is('multipart/form-data')) {
      return problema(res, 415, 'Las entregas deben enviarse como un formulario con archivo adjunto');
    }
    subida(req, res, (error) => {
      if (!error) return next();
      const [status, title] = ERRORES_MULTER[error.code] ?? [400, 'No se ha podido leer el formulario'];
      problema(res, status, title);
    });
  }

  async function entregar(req, res) {
    if (!req.file) return problema(res, 400, 'No has adjuntado ningún archivo en el campo "archivo"');

    const asignatura = req.body.asignatura?.trim();
    if (!asignatura) return problema(res, 400, 'Indica la asignatura en el campo "asignatura"');

    // Se comprueba el contenido real, no el nombre ni el tipo que declara el cliente
    if (!req.file.buffer.subarray(0, FIRMA_PDF.length).equals(FIRMA_PDF)) {
      return problema(res, 422, 'El archivo no es un PDF, aunque se llame .pdf');
    }

    // Nunca se usa el nombre original para guardar: podría contener rutas como ../../
    const nombre = `${Date.now()}-${randomUUID().slice(0, 8)}.pdf`;
    await writeFile(path.join(carpetaEntregas, nombre), req.file.buffer);

    res.status(201).json({
      mensaje: `Entrega de ${asignatura} recibida. ¡Suerte con la nota!`,
      nombreOriginal: req.file.originalname,
      guardadoComo: `uploads/${nombre}`,
      bytes: req.file.size,
    });
  }

  router.route('/')
    .post(recibirArchivo, entregar)
    .all(metodoNoPermitido('POST'));

  return router;
}
