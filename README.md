# Secretaría Virtual del IES Turing

API de práctica para el taller de HTTP: el alumnado la consume con Bruno (o Postman) y con curl, descubriendo qué método, qué formato y qué códigos usa cada endpoint.

## Puesta en marcha

Requisitos: Docker con el plugin de Compose.

```bash
docker compose up --build -d
curl http://localhost:8080/salud        # → {"estado":"ok"}
```

La API queda detrás de nginx en `http://localhost:8080`. MongoDB no se expone fuera de la red de Docker.

Las entregas (`POST /entregas`) se guardan en la carpeta `uploads/` del proyecto. El contenedor se ejecuta con el usuario `node` (uid 1000): si en algún equipo el usuario del host tiene otro uid y las entregas fallan con 500, basta con `chmod 777 uploads`.

### Sin Docker ni MongoDB

Para probarla rápido en local, con los datos en memoria:

```bash
npm install
npm run start:memoria                    # http://localhost:3000
```

### Tests

```bash
npm test
```

Los tests usan un repositorio en memoria, así que no necesitan MongoDB.

## Operaciones del profesor

Desbloquear una cuenta (tras tres intentos fallidos de login):

```bash
docker compose exec mongo mongosh secretaria --eval \
  'db.alumnos.updateOne({ username: "ana" }, { $set: { bloqueado: false, intentosFallidos: 0 } })'
```

Vaciar todos los datos para empezar de cero:

```bash
docker compose down -v
```

## Estructura

```text
src/
├── server.js               Arranque: elige repositorio (MongoDB o memoria) y escucha
├── app.js                  Construye la app de Express con las dependencias inyectadas
├── dominio.js              Reglas: ciclos, tutores, edad mínima, tareas...
├── lib/                    Respuestas de error (RFC 9457) y lectura de Basic auth
├── repositorios/           Acceso a datos: MongoDB y memoria, con la misma interfaz
└── routes/                 Un router por área: alumnos, sesiones, secretaría, entregas
test/api.test.js            Tests de todos los endpoints (node:test + supertest)
SOLUCIONARIO.md.gpg         Respuestas de la práctica, cifradas (sh vault.sh descifrar)
```

## Cambios respecto a la versión anterior

- **Temática:** secretaría de un instituto en lugar de temática militar.
- **Infraestructura:** nginx apuntaba a un servicio `node` que no existía (el servicio se llamaba `api`), el healthcheck usaba `curl`, que no viene en la imagen alpine, y la API se publicaba en un puerto distinto al que usaba `curl.sh`. Ahora todo pasa por nginx en el 8080.
- **Métodos:** "cumplir años" sumaba 1 con `PUT`, que debe ser idempotente; ahora la acción equivalente (promocionar de curso) usa `POST`. La baja ya no lleva cuerpo en el `DELETE`: se identifica con `Authorization: Basic`.
- **Códigos de estado:** usuario inexistente devolvía 500; datos inválidos, 400 en todos los casos; un id mal formado provocaba 500. Ahora se usan 201, 204, 401, 403, 404, 405 (con `Allow`), 409, 413, 415, 422 y 423.
- **Seguridad:** el login responde igual si el usuario no existe que si la contraseña falla; se validan tipos para evitar inyección de operadores de MongoDB; las entregas se comprueban por contenido (firma `%PDF-`) y se guardan con un nombre generado, nunca con el original.
- **Errores:** todos siguen el mismo formato `application/problem+json`.
