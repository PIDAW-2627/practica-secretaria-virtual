#!/usr/bin/env sh
# Cifra o descifra con una contraseña (gpg simétrico, AES-256) los archivos listados en .vault.
# Al repositorio solo se suben las copias .gpg; los originales deben estar en .gitignore.
# En Windows se ejecuta desde Git Bash, que ya incluye gpg.
set -e
cd "$(dirname "$0")"

LISTA=.vault

uso() {
  echo "Uso: sh vault.sh cifrar|descifrar" >&2
  exit 1
}

pedir_clave() {
  printf '%s' "$1" >&2
  stty -echo 2>/dev/null || true
  IFS= read -r respuesta
  stty echo 2>/dev/null || true
  echo >&2
}

# Lee .vault ignorando líneas vacías, comentarios y los \r de Windows.
archivos() {
  sed -e 's/\r$//' -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' "$LISTA" | grep -v -e '^$' -e '^#'
}

[ -f "$LISTA" ] || { echo "No existe $LISTA: crea el archivo con una ruta por línea." >&2; exit 1; }
case "$1" in cifrar|descifrar) ;; *) uso ;; esac

pedir_clave "Contraseña: "; CLAVE=$respuesta
if [ "$1" = cifrar ]; then
  pedir_clave "Repite la contraseña: "
  [ "$CLAVE" = "$respuesta" ] || { echo "Las contraseñas no coinciden." >&2; exit 1; }
fi
[ -n "$CLAVE" ] || { echo "La contraseña no puede estar vacía." >&2; exit 1; }

archivos | while IFS= read -r f; do
  if [ "$1" = cifrar ]; then
    if [ ! -f "$f" ]; then echo "  omitido (no existe): $f"; continue; fi
    if git rev-parse --git-dir >/dev/null 2>&1 && ! git check-ignore -q "$f"; then
      echo "  AVISO: $f no está en .gitignore y podría subirse en claro" >&2
    fi
    printf '%s' "$CLAVE" | gpg --batch --yes --quiet --passphrase-fd 0 --pinentry-mode loopback \
      --symmetric --cipher-algo AES256 --output "$f.gpg" "$f"
    echo "  cifrado: $f.gpg"
  else
    if [ ! -f "$f.gpg" ]; then echo "  omitido (no existe): $f.gpg"; continue; fi
    printf '%s' "$CLAVE" | gpg --batch --yes --quiet --passphrase-fd 0 --pinentry-mode loopback \
      --decrypt --output "$f" "$f.gpg"
    echo "  descifrado: $f"
  fi
done
