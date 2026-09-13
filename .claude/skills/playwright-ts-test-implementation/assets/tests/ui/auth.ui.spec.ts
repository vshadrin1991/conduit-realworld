// GOOD EXAMPLE — UI spec with a mocked response, header menu and browser storage.
// Location in the project: tests/ui/<feature>.ui.spec.ts
import { expect, test } from '@/base/BaseTest';
import { Interceptor } from '@/pageObject/components/Interceptor';
import { LocalStorage } from '@/pageObject/components/LocalStorage';
import { Session } from '@/pageObject/components/Session';
import { HomePage } from '@/pageObject/pages/HomePage';
import { LoginPage } from '@/pageObject/pages/LoginPage';
import { Route } from '@/pageObject/routes';
import { generateUser } from '@/utilities/tests/TestDataGenerator';

test.describe('Authentication UI', () => {
  test('shows the server error for invalid credentials', async ({ get }) => {
    // Mocked: the UI behaviour is under test, and real login calls spend the ~5/hour auth quota.
    await get(Interceptor).mock('**/api/users/login', {
      status: 404,
      json: { errors: { body: ['Email not found sign in first'] } },
    });
    const user = generateUser();

    // Verifications chain like actions and run in the same awaited chain.
    await get(LoginPage, Route.login)
      .fillData('email', user.email)
      .fillData('password', user.password)
      .clickActionButton('login')
      .verifyErrorField('email', true)
      .verifyErrorFieldText('email', 'Email not found sign in first');

    await expect(get(LoginPage).header.loginLink).toBeVisible();
  });

  test('user logs out from the header menu', async ({ get }) => {
    const testUser = await get(Session).login();

    await get(HomePage, Route.home);

    const homePage = get(HomePage);
    await expect(homePage.header.userAvatar(testUser.username)).toBeVisible();
    // Header items are shared locators, not named page buttons: click them with the page's element helper.
    await homePage.button.click(homePage.header.userMenu);
    await homePage.button.click(homePage.header.menuItem('Logout'));

    await expect(homePage.header.loginLink).toBeVisible();
    expect(await get(LocalStorage).getItem('loggedUser')).toBeNull();
  });
});
