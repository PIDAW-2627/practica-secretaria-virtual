import { randomUUID } from 'node:crypto';
import { UsernameDuplicadoError } from './errores.js';

/** Repositorio en memoria: para los tests y para probar la API sin MongoDB. */
export function crearAlumnosMemoria() {
  const alumnos = new Map();

  return {
    async crear(datos) {
      const existe = [...alumnos.values()].some((a) => a.username === datos.username);
      if (existe) throw new UsernameDuplicadoError(datos.username);

      const alumno = { id: randomUUID(), curso: 1, intentosFallidos: 0, bloqueado: false, ...datos };
      alumnos.set(alumno.id, alumno);
      return { ...alumno };
    },

    async buscarPorUsername(username) {
      const alumno = [...alumnos.values()].find((a) => a.username === username);
      return alumno ? { ...alumno } : null;
    },

    async buscarPorId(id) {
      const alumno = alumnos.get(id);
      return alumno ? { ...alumno } : null;
    },

    async actualizar(id, cambios) {
      const alumno = alumnos.get(id);
      if (!alumno) return null;
      Object.assign(alumno, cambios);
      return { ...alumno };
    },

    async eliminar(id) {
      return alumnos.delete(id);
    },
  };
}
