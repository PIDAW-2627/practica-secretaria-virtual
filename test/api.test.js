import { describe, it, beforeEach, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { crearApp } from '../src/app.js';
import { crearAlumnosMemoria } from '../src/repositorios/alumnosMemoria.js';

const ANA = { username: 'ana', password: '1234', ciclo: 'DAW', tutor: 'Ada', edad: 17 };

let app;
let carpetaEntregas;

before(async () => {
  carpetaEntregas = await mkdtemp(path.join(tmpdir(), 'entregas-'));
});
after(async () => {
  await rm(carpetaEntregas, { recursive: true, force: true });
});
beforeEach(() => {
  app = crearApp({ alumnos: crearAlumnosMemoria(), carpetaEntregas });
});

const matricular = (datos = ANA) => request(app).post('/alumnos').send(datos);
const login = (username, password) =>
  request(app).post('/sesiones').type('form').send({ username, password });

describe('POST /alumnos (matrícula)', () => {
  it('matricula con JSON válido y responde 201', async () => {
    const res = await matricular();
    assert.equal(res.status, 201);
    assert.match(res.body.mensaje, /ana matriculado en 1º de DAW/);
  });

  it('rechaza otros formatos con 415', async () => {
    const res = await request(app).post('/alumnos').type('form').send(ANA);
    assert.equal(res.status, 415);
    assert.match(res.headers['content-type'], /application\/problem\+json/);
  });

  it('indica los campos que faltan con 400', async () => {
    const res = await matricular({ username: 'ana' });
    assert.equal(res.status, 400);
    assert.deepEqual(res.body.faltan, ['password', 'ciclo', 'tutor', 'edad']);
  });

  it('rechaza ciclo, tutor o edad no válidos con 422', async () => {
    const res = await matricular({ ...ANA, ciclo: 'ESO', tutor: 'Tim', edad: 14 });
    assert.equal(res.status, 422);
    assert.deepEqual(res.body.errors.map((e) => e.campo), ['ciclo', 'tutor', 'edad']);
  });

  it('rechaza operadores de MongoDB en lugar de texto', async () => {
    const res = await matricular({ ...ANA, username: { $gt: '' } });
    assert.equal(res.status, 422);
  });

  it('responde 409 si el usuario ya existe', async () => {
    await matricular();
    const res = await matricular();
    assert.equal(res.status, 409);
  });

  it('responde 400 si el JSON está mal formado', async () => {
    const res = await request(app).post('/alumnos').type('json').send('{"username": ');
    assert.equal(res.status, 400);
  });

  it('responde 405 con la cabecera Allow si se usa otro método', async () => {
    const res = await request(app).get('/alumnos');
    assert.equal(res.status, 405);
    assert.equal(res.headers.allow, 'POST');
  });
});

describe('POST /sesiones (login)', () => {
  beforeEach(() => matricular());

  it('da acceso con urlencoded y no expone el hash', async () => {
    const res = await login('ana', '1234');
    assert.equal(res.status, 200);
    assert.equal(res.body.alumno.username, 'ana');
    assert.ok(res.body.alumno.id);
    assert.equal(res.body.alumno.passwordHash, undefined);
  });

  it('rechaza JSON con 415', async () => {
    const res = await request(app).post('/sesiones').send({ username: 'ana', password: '1234' });
    assert.equal(res.status, 415);
  });

  it('responde igual a usuario inexistente y a contraseña incorrecta', async () => {
    const inexistente = await login('nadie', '1234');
    const incorrecta = await login('ana', 'mal');
    assert.equal(inexistente.status, 401);
    assert.equal(incorrecta.status, 401);
    assert.equal(inexistente.body.title, incorrecta.body.title);
  });

  it('bloquea la cuenta al tercer fallo con 423, incluso con la contraseña buena', async () => {
    await login('ana', 'mal');
    await login('ana', 'mal');
    assert.equal((await login('ana', 'mal')).status, 423);
    assert.equal((await login('ana', '1234')).status, 423);
  });

  it('reinicia el contador de fallos tras un acceso correcto', async () => {
    await login('ana', 'mal');
    await login('ana', 'mal');
    await login('ana', '1234');
    assert.equal((await login('ana', 'mal')).status, 401);
  });
});

describe('Promoción y baja', () => {
  let id;
  beforeEach(async () => {
    await matricular();
    id = (await login('ana', '1234')).body.alumno.id;
  });

  it('promociona a 2º con POST sin cuerpo y después responde 409', async () => {
    const primera = await request(app).post(`/alumnos/${id}/promocion`);
    assert.equal(primera.status, 200);
    assert.equal(primera.body.curso, 2);
    assert.equal((await request(app).post(`/alumnos/${id}/promocion`)).status, 409);
  });

  it('responde 404 si el alumno no existe', async () => {
    assert.equal((await request(app).post('/alumnos/no-existe/promocion')).status, 404);
  });

  it('exige Basic auth para la baja', async () => {
    const res = await request(app).delete(`/alumnos/${id}`);
    assert.equal(res.status, 401);
    assert.match(res.headers['www-authenticate'], /^Basic/);
  });

  it('impide dar de baja a otro alumno con 403', async () => {
    await matricular({ ...ANA, username: 'luis' });
    const res = await request(app).delete(`/alumnos/${id}`).auth('luis', '1234');
    assert.equal(res.status, 403);
  });

  it('da de baja con 204 y después el login falla', async () => {
    const res = await request(app).delete(`/alumnos/${id}`).auth('ana', '1234');
    assert.equal(res.status, 204);
    assert.equal(res.text, '');
    assert.equal((await login('ana', '1234')).status, 401);
  });
});

describe('Endpoints de secretaría', () => {
  it('GET /tareas/aleatoria devuelve texto plano', async () => {
    const res = await request(app).get('/tareas/aleatoria');
    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'], /text\/plain/);
  });

  it('GET /consultas/jefatura usa la query string', async () => {
    const res = await request(app).get('/consultas/jefatura').query({ duda: '¿Cuándo es el examen?' });
    assert.equal(res.status, 200);
    assert.match(res.body.mensaje, /¿Cuándo es el examen\?/);
    assert.equal((await request(app).get('/consultas/jefatura')).status, 400);
  });

  it('GET /consultas/:persona responde a personas conocidas y 404 al resto', async () => {
    assert.equal((await request(app).get('/consultas/conserjeria')).status, 200);
    const res = await request(app).get('/consultas/director');
    assert.equal(res.status, 404);
    assert.ok(res.body.disponibles.includes('biblioteca'));
  });

  it('POST /equipos/inscripcion solo acepta text/plain con un número de 1 a 30', async () => {
    const enviar = (tipo, cuerpo) => request(app).post('/equipos/inscripcion').type(tipo).send(cuerpo);
    assert.equal((await enviar('text/plain', '7')).status, 200);
    assert.equal((await enviar('text/plain', '31')).status, 422);
    assert.equal((await enviar('text/plain', '3.5')).status, 422);
    const json = await enviar('json', '{"equipo":7}');
    assert.equal(json.status, 415);
    assert.equal(json.headers['accept-post'], 'text/plain');
  });

  it('POST /incidencias acepta cualquier text/* y rechaza lo demás', async () => {
    const md = await request(app).post('/incidencias').type('text/markdown').send('# Falla el proyector');
    assert.equal(md.status, 201);
    assert.equal(md.body.bytes, 20);
    const json = await request(app).post('/incidencias').send({ texto: 'hola' });
    assert.equal(json.status, 415);
  });

  it('responde 404 en formato problem+json a rutas desconocidas', async () => {
    const res = await request(app).get('/no-existe');
    assert.equal(res.status, 404);
    assert.match(res.headers['content-type'], /application\/problem\+json/);
  });
});

describe('POST /entregas', () => {
  const PDF = Buffer.from('%PDF-1.4\n% documento de prueba\n');

  it('guarda un PDF con un nombre generado y responde 201', async () => {
    const res = await request(app)
      .post('/entregas')
      .field('asignatura', 'Redes Locales')
      .attach('archivo', PDF, '../../etc/passwd.pdf');
    assert.equal(res.status, 201);
    assert.match(res.body.guardadoComo, /^uploads\/\d+-[0-9a-f]{8}\.pdf$/);
    assert.equal((await readdir(carpetaEntregas)).length, 1);
  });

  it('rechaza un archivo que no es PDF aunque se llame .pdf', async () => {
    const res = await request(app)
      .post('/entregas')
      .field('asignatura', 'Redes Locales')
      .attach('archivo', Buffer.from('\x89PNG\r\n'), { filename: 'tarea.pdf', contentType: 'application/pdf' });
    assert.equal(res.status, 422);
  });

  it('exige el campo asignatura y el campo archivo', async () => {
    const sinAsignatura = await request(app).post('/entregas').attach('archivo', PDF, 'tarea.pdf');
    assert.equal(sinAsignatura.status, 400);
    const campoIncorrecto = await request(app).post('/entregas').attach('fichero', PDF, 'tarea.pdf');
    assert.equal(campoIncorrecto.status, 400);
  });

  it('rechaza las entregas que no son multipart con 415', async () => {
    const res = await request(app).post('/entregas').send({ asignatura: 'Redes' });
    assert.equal(res.status, 415);
  });
});
