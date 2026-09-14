import { getTestUser, type TestUser } from '@/api/client/session/auth/testUser';
import { BaseComponent } from '@/base/BaseComponent';
import { authConfig } from '@/config/auth.config';

const SESSION_KEY = authConfig.sessionStorageKey;

/**
 * Browser session. UI tests start as guests; a test that needs a logged-in browser calls `login()` before
 * navigating. The SPA restores its session from `localStorage.loggedUser`, so no login request (and no auth
 * rate-limit quota) is spent.
 */
export class Session extends BaseComponent {
  async login(user?: TestUser): Promise<TestUser> {
    const account = user ?? (await getTestUser());
    const loggedUser = {
      email: account.email,
      username: account.username,
      bio: null,
      image: null,
      token: account.token,
    };
    const value = JSON.stringify({
      headers: { Authorization: `${authConfig.tokenScheme} ${account.token}` },
      isAuth: true,
      loggedUser,
    });
    await this.page.context().addInitScript(
      ([key, session]) => {
        if (!window.localStorage.getItem(key)) window.localStorage.setItem(key, session);
      },
      [SESSION_KEY, value],
    );
    this.log.info(`Browser session prepared for ${account.username}`);
    return account;
  }
}
