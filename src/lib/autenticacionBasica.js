/**
 * Lee la cabecera "Authorization: Basic base64(usuario:contraseña)".
 * Devuelve { username, password } o null si falta o está mal formada.
 */
export function leerCredencialesBasic(req) {
  const cabecera = req.get('Authorization') ?? '';
  const [esquema, valor] = cabecera.split(' ');
  if (esquema?.toLowerCase() !== 'basic' || !valor) return null;

  const decodificado = Buffer.from(valor, 'base64').toString('utf8');
  const separador = decodificado.indexOf(':');
  if (separador === -1) return null;

  return {
    username: decodificado.slice(0, separador),
    password: decodificado.slice(separador + 1),
  };
}
