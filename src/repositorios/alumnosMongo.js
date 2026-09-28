import mongoose from 'mongoose';
import { CICLOS, TUTORES } from '../dominio.js';
import { UsernameDuplicadoError } from './errores.js';

const esquemaAlumno = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  ciclo: { type: String, enum: CICLOS, required: true },
  tutor: { type: String, enum: TUTORES, required: true },
  edad: { type: Number, required: true },
  curso: { type: Number, default: 1 },
  intentosFallidos: { type: Number, default: 0 },
  bloqueado: { type: Boolean, default: false },
});

const AlumnoModelo = mongoose.model('Alumno', esquemaAlumno);

function aObjeto(documento) {
  if (!documento) return null;
  const { _id, __v, ...resto } = documento.toObject();
  return { id: _id.toString(), ...resto };
}

/** Repositorio de alumnos sobre MongoDB. Misma interfaz que alumnosMemoria. */
export const alumnosMongo = {
  async crear(datos) {
    try {
      return aObjeto(await AlumnoModelo.create(datos));
    } catch (error) {
      if (error.code === 11000) throw new UsernameDuplicadoError(datos.username);
      throw error;
    }
  },

  async buscarPorUsername(username) {
    return aObjeto(await AlumnoModelo.findOne({ username: String(username) }));
  },

  async buscarPorId(id) {
    // Un id con formato inválido es un alumno que no existe, no un error 500
    if (!mongoose.isValidObjectId(id)) return null;
    return aObjeto(await AlumnoModelo.findById(id));
  },

  async actualizar(id, cambios) {
    if (!mongoose.isValidObjectId(id)) return null;
    return aObjeto(await AlumnoModelo.findByIdAndUpdate(id, cambios, { new: true }));
  },

  async eliminar(id) {
    if (!mongoose.isValidObjectId(id)) return false;
    const resultado = await AlumnoModelo.deleteOne({ _id: id });
    return resultado.deletedCount === 1;
  },
};
