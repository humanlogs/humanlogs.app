/**
 * Ports and URLs shared by the Playwright config, the server bootstrapper and
 * the tests. Fixed (not random) so every process agrees without a handshake;
 * override them when 3100/54329 are already taken.
 */
export const E2E_APP_PORT = Number(process.env.E2E_APP_PORT ?? 3100);
export const E2E_DB_PORT = Number(process.env.E2E_DB_PORT ?? 54329);

export const baseURL = `http://localhost:${E2E_APP_PORT}`;

export const testDatabaseUrl = () =>
  `postgresql://postgres:postgres@127.0.0.1:${E2E_DB_PORT}/postgres`;
