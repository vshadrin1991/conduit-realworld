import path from 'node:path';
import { readNumber, readOptionalString, readString, ROOT_DIR } from './loader';

const email = readOptionalString('TEST_USER_EMAIL');
const password = readOptionalString('TEST_USER_PASSWORD');
if (Boolean(email) !== Boolean(password)) {
  throw new Error('Config: set both TEST_USER_EMAIL and TEST_USER_PASSWORD, or neither.');
}

const dir = path.resolve(ROOT_DIR, readString('AUTH_DIR', '.auth'));

export const authConfig = {
  user: email && password ? { email, password } : undefined,
  dir,
  userFile: path.join(dir, 'user.json'),
  lockDir: path.join(dir, '.lock'),
  lockStaleMs: readNumber('AUTH_LOCK_STALE_MS', 60_000),
  tokenScheme: 'Token',
} as const;
