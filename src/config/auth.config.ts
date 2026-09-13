import path from 'node:path';
import { readNumber, readOptionalString, readString, ROOT_DIR } from './loader';

const email = readOptionalString('TEST_USER_EMAIL');
const password = readOptionalString('TEST_USER_PASSWORD');
if (Boolean(email) !== Boolean(password)) {
  throw new Error('Config: set both TEST_USER_EMAIL and TEST_USER_PASSWORD, or neither.');
}

const dir = path.resolve(ROOT_DIR, readString('AUTH_DIR', '.auth'));

/** Authentication of the shared test user and the browser session. */
export const authConfig = {
  /** Existing account to run tests as; without it a user is registered once and cached. */
  user: email && password ? { email, password } : undefined,
  /** Git-ignored directory with the cached user (credentials + token). */
  dir,
  userFile: path.join(dir, 'user.json'),
  /** Cross-worker lock so parallel workers resolve (and register) the user only once. */
  lockDir: path.join(dir, '.lock'),
  /** A lock older than this is considered left by a crashed run and removed. */
  lockStaleMs: readNumber('AUTH_LOCK_STALE_MS', 60_000),
  /** localStorage key in which the SPA keeps its session. */
  sessionStorageKey: 'loggedUser',
  /** Authorization header scheme of the Conduit API: `Authorization: Token <jwt>`. */
  tokenScheme: 'Token',
} as const;
