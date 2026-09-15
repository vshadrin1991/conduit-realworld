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

let testUser: Promise<TestUser> | undefined;

/**
 * The shared test user (credentials + token). Nothing is prepared globally: the user is resolved on first use
 * in a worker, so only tests that need authentication pay for it. Resolution order: valid cached token
 * (`.auth/user.json`, 1 GET) → login with env or cached credentials → registration. A file lock makes parallel
 * workers wait for each other, so a fresh checkout registers the user only once.
 */
export function getTestUser(): Promise<TestUser> {
  testUser ??= withAuthLock(async () => {
    const context = await request.newContext({ baseURL: envConfig.baseUrl });
    try {
      const user = await resolveTestUser(context);
      fs.writeFileSync(authConfig.userFile, JSON.stringify(user, null, 2));
      return user;
    } finally {
      await context.dispose();
    }
  }).catch((error: unknown) => {
    testUser = undefined;
    throw error;
  });
  return testUser;
}

function readCachedUser(): TestUser | undefined {
  if (!fs.existsSync(authConfig.userFile)) return undefined;
  return JSON.parse(fs.readFileSync(authConfig.userFile, 'utf-8')) as TestUser;
}

async function resolveTestUser(context: APIRequestContext): Promise<TestUser> {
  const cached = readCachedUser();
  const cacheMatchesEnv = !authConfig.user || authConfig.user.email === cached?.email;

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
  const credentials = authConfig.user ?? cached;
  if (credentials) {
    log.info(`Logging in as ${credentials.email}`);
    const user = await guest.post.users.login(credentials);
    return { email: credentials.email, password: credentials.password, username: user.username, token: user.token };
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
