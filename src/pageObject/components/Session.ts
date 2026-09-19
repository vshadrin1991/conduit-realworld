import { getTestUser, type TestUser } from '@/api/client/session/auth/User';
import { HomePage } from '@/pageObject/pages/HomePage';
import { BaseComponent } from './BaseComponent';
import { LocalStorage } from './LocalStorage';

/**
 * Browser session of the app: sign-in writes the same `loggedUser` item the login form writes
 * (`{ headers: { Authorization }, isAuth, loggedUser }`), so tests get a signed-in browser without
 * spending the auth quota (~5 calls per hour). The form itself is covered by the session spec.
 */
export class Session extends BaseComponent {
  /**
   * Signs the given user in by writing `loggedUser` to localStorage and reloading; the shared test user
   * by default, so a test can act as another account through `getOtherUser()`.
   * @param user - account to sign in as, the shared test user when omitted
   * @return promise resolved when the home page is rendered signed in
   */
  async login(user?: TestUser): Promise<void> {
    const { username, email, token } = user ?? (await getTestUser());
    await this.page.goto('/');
    await new LocalStorage(this.page).setItem('loggedUser', {
      headers: { Authorization: `Token ${token}` },
      isAuth: true,
      loggedUser: { username, email, bio: null, image: null, token },
    });
    await this.page.reload();
    await new HomePage(this.page).waitUntilPageLoaded();
  }
}
