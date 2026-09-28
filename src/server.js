import mongoose from 'mongoose';
import { mkdir } from 'node:fs/promises';
import { crearApp } from './app.js';
import { alumnosMongo } from './repositorios/alumnosMongo.js';
import { crearAlumnosMemoria } from './repositorios/alumnosMemoria.js';

const PUERTO = Number(process.env.PORT ?? 3000);
const MONGO_URI = process.env.MONGO_URI ?? 'mongodb://localhost:27017/secretaria';
const CARPETA_ENTREGAS = process.env.CARPETA_ENTREGAS ?? 'uploads';
const EN_MEMORIA = process.env.REPOSITORIO === 'memoria';

async function crearRepositorio() {
  if (EN_MEMORIA) {
    console.log('Datos en memoria: se pierden al parar el servidor');
    return crearAlumnosMemoria();
  }
  await mongoose.connect(MONGO_URI);
  console.log('Conectado a MongoDB');
  return alumnosMongo;
}

await mkdir(CARPETA_ENTREGAS, { recursive: true });
const alumnos = await crearRepositorio();

const app = crearApp({ alumnos, carpetaEntregas: CARPETA_ENTREGAS });
app.listen(PUERTO, () => console.log(`Secretaría Virtual escuchando en el puerto ${PUERTO}`));
