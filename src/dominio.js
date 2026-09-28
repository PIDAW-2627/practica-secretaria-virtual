// Reglas de negocio de la Secretaría Virtual del IES Turing.

export const CICLOS = ['SMR', 'ASIR', 'DAW', 'DAM'];
export const TUTORES = ['Ada', 'Alan', 'Grace', 'Linus', 'Margaret'];
export const EDAD_MINIMA = 16;
export const CURSO_MAXIMO = 2;
export const MAX_INTENTOS_LOGIN = 3;
export const EQUIPOS = { minimo: 1, maximo: 30 };

export const TAREAS = [
  'Configurar una VLAN en el switch del aula',
  'Documentar la API de tu proyecto con OpenAPI',
  'Montar un servidor web con nginx en Docker',
  'Hacer una copia de seguridad y comprobar que se restaura',
  'Revisar los logs del servidor y encontrar el error 500',
  'Escribir tests para el endpoint de login',
];

/** Datos públicos de un alumno: nunca el hash ni los contadores internos. */
export function vistaPublica(alumno) {
  const { id, username, ciclo, tutor, edad, curso } = alumno;
  return { id, username, ciclo, tutor, edad, curso };
}
