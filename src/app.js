import express from 'express';
import { problema } from './lib/problema.js';
import { crearRouterAlumnos } from './routes/alumnos.js';
import { crearRouterSesiones } from './routes/sesiones.js';
import { crearRouterSecretaria } from './routes/secretaria.js';
import { crearRouterEntregas } from './routes/entregas.js';

/**
 * Construye la aplicación con sus dependencias inyectadas:
 * en producción, el repositorio de MongoDB; en los tests, uno en memoria.
 */
export function crearApp({ alumnos, carpetaEntregas }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // la API está detrás de nginx

  app.get('/salud', (req, res) => res.json({ estado: 'ok' }));

  app.use('/alumnos', crearRouterAlumnos(alumnos));
  app.use('/sesiones', crearRouterSesiones(alumnos));
  app.use('/entregas', crearRouterEntregas(carpetaEntregas));
  app.use('/', crearRouterSecretaria());

  app.use((req, res) => problema(res, 404, `No existe la ruta ${req.method} ${req.path}`));

  // Express 5 envía aquí también los errores de los controladores async
  app.use((error, req, res, next) => {
    if (error.type === 'entity.parse.failed') return problema(res, 400, 'El cuerpo no es JSON válido');
    if (error.type === 'entity.too.large') return problema(res, 413, 'El cuerpo de la petición es demasiado grande');
    console.error(error);
    problema(res, 500, 'Error interno del servidor');
  });

  return app;
}
