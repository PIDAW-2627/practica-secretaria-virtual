/**
 * Todas las respuestas de error de la API tienen la misma forma,
 * siguiendo la RFC 9457 (Problem Details for HTTP APIs).
 */
export function problema(res, status, title, detalle = {}) {
  res
    .status(status)
    .type('application/problem+json')
    .json({ status, title, ...detalle });
}

/**
 * Responde 405 indicando en la cabecera Allow qué métodos sí admite la ruta.
 * Es una pista para el alumnado: leer la cabecera Allow revela el verbo correcto.
 */
export function metodoNoPermitido(...permitidos) {
  return (req, res) => {
    res.set('Allow', permitidos.join(', '));
    problema(res, 405, 'Método no permitido en esta ruta');
  };
}
