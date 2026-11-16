type UnauthorizedHandler = () => void;

let onUnauthorized: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler): void {
  onUnauthorized = handler;
}

export function notifyUnauthorized(): void {
  onUnauthorized?.();
}

/** Strip storage/header mistakes without changing a valid JWT. */
export function normalizeStoredToken(raw: string | null): string | null {
  if (!raw) {
    return null;
  }

  let token = raw.trim();
  if (
    (token.startsWith('"') && token.endsWith('"')) ||
    (token.startsWith("'") && token.endsWith("'"))
  ) {
    token = token.slice(1, -1).trim();
  }
  if (token.toLowerCase().startsWith('bearer ')) {
    token = token.slice(7).trim();
  }

  return token || null;
}
