export class UsernameDuplicadoError extends Error {
  constructor(username) {
    super(`El usuario ${username} ya existe`);
    this.name = 'UsernameDuplicadoError';
  }
}
