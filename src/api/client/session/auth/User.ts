import fs from 'node:fs';
import { request, type APIRequestContext } from '@playwright/test';
import type { NewUser } from '@/api/request/users/NewUser';
import { authConfig } from '@/config/auth.config';
import { envConfig } from '@/config/env.config';
import { createLogger } from '@/utilities/logger/Logger';
import { generateUser } from '@/utilities/tests/TestDataGenerator';
import { APIClient } from '../../APIClient';
import { BasePath } from '../../path/BasePath';

const log = createLogger('TestUser');

export interface TestUser extends NewUser {
  token: string;
}

const users = new Map<string, Promise<TestUser>>();

/**
 * The shared test user (credentials + token). Nothing is prepared globally: the user is resolved on first use
 * in a worker, so only tests that need authentication pay for it. Resolution order: valid cached token
 * (`.auth/user.json`, 1 GET) → login with env or cached credentials → registration. A file lock makes parallel
 * workers wait for each other, so a fresh checkout registers the user only once.
 */
export function getTestUser(): Promise<TestUser> {
  return getSharedUser(authConfig.userFile);
}

/**
 * The secondary account for cross-user permission checks (comment/article edits by another user, following).
 * Cached in `.auth/other-user.json` next to the main user, so it is registered once per checkout, not per run.
 * `TEST_USER_*` credentials apply only to the main user.
 */
export function getOtherUser(): Promise<TestUser> {
  return getSharedUser(authConfig.otherUserFile);
}

function getSharedUser(userFile: string): Promise<TestUser> {
  let user = users.get(userFile);
  if (!user) {
    user = withAuthLock(async () => {
      const context = await request.newContext({ baseURL: envConfig.baseUrl });
      try {
        const resolved = await resolveTestUser(context, userFile);
        fs.writeFileSync(userFile, JSON.stringify(resolved, null, 2));
        return resolved;
      } finally {
        await context.dispose();
      }
    }).catch((error: unknown) => {
      users.delete(userFile);
      throw error;
    });
    users.set(userFile, user);
  }
  return user;
}

function readCachedUser(userFile: string): TestUser | undefined {
  if (!fs.existsSync(userFile)) return undefined;
  return JSON.parse(fs.readFileSync(userFile, 'utf-8')) as TestUser;
}

async function resolveTestUser(context: APIRequestContext, userFile: string): Promise<TestUser> {
  const envUser = userFile === authConfig.userFile ? authConfig.user : undefined;
  const cached = readCachedUser(userFile);
  const cacheMatchesEnv = !envUser || envUser.email === cached?.email;

  if (cached && cacheMatchesEnv) {
    const response = await new APIClient(context, cached.token).response({
      name: 'check cached token',
      path: BasePath.USER,
      statusCode: 0,
    });
    if (response.ok()) {
      log.info(`Reusing cached test user ${cached.username}`);
      return cached;
    }
    if (response.status() === 429) {
      throw new Error(
        `Rate limited while checking the cached token of ${cached.email} (retry after ${response.headers()['retry-after']}s); no sign-in was attempted.`,
      );
    }
    log.warn(`Cached token for ${cached.email} is no longer valid (${response.status()})`);
  }

  const guest = new APIClient(context);
  const credentials = envUser ?? cached;
  if (credentials) {
    log.info(`Logging in as ${credentials.email}`);
    try {
      const user = await guest.post.users.login(credentials);
      return {
        email: credentials.email,
        password: credentials.password,
        username: user.username,
        token: user.token,
      };
    } catch (error) {
      if (envUser) throw error;
      log.warn(`Login as ${credentials.email} failed, registering a fresh user instead`, error);
    }
  }

  const newUser = generateUser();
  log.info(`Registering a new test user ${newUser.username}`);
  const user = await guest.post.users.with(newUser);
  return { ...newUser, token: user.token };
}

async function withAuthLock<T>(action: () => Promise<T>): Promise<T> {
  fs.mkdirSync(authConfig.dir, { recursive: true });
  for (;;) {
    try {
      fs.mkdirSync(authConfig.lockDir);
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      const age = Date.now() - fs.statSync(authConfig.lockDir, { throwIfNoEntry: false })!.mtimeMs;
      if (age > authConfig.lockStaleMs) fs.rmSync(authConfig.lockDir, { recursive: true, force: true });
      else await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  try {
    return await action();
  } finally {
    fs.rmSync(authConfig.lockDir, { recursive: true, force: true });
  }
}
