import { getTestUser } from '@/api/client/session/auth/testUser';
import { AUTH_QUOTA, expect, test } from '@/base/BaseTest';
import { Interceptor } from '@/pageObject/components/Interceptor';
import { LocalStorage } from '@/pageObject/components/LocalStorage';
import { Session } from '@/pageObject/components/Session';
import { HomePage } from '@/pageObject/pages/HomePage';
import { LoginPage } from '@/pageObject/pages/LoginPage';
import { RegisterPage } from '@/pageObject/pages/RegisterPage';
import { Route } from '@/pageObject/routes';
import { generateUser } from '@/utilities/tests/TestDataGenerator';

test.describe('Authentication UI', () => {
  test('user can sign up', { tag: AUTH_QUOTA }, async ({ get }) => {
    const user = generateUser();

    await get(RegisterPage, Route.register)
      .fillData('username', user.username)
      .fillData('email', user.email)
      .fillData('password', user.password)
      .clickActionButton('signUp');

    const homePage = get(HomePage);
    await homePage.waitUntilPageLoaded();
    await expect(homePage.header.userAvatar(user.username)).toBeVisible();
  });

  test('user can log in', { tag: AUTH_QUOTA }, async ({ get }) => {
    const testUser = await getTestUser();

    await get(LoginPage, Route.login)
      .fillData('email', testUser.email)
      .fillData('password', testUser.password)
      .clickActionButton('login');

    const homePage = get(HomePage);
    await homePage.waitUntilPageLoaded();
    await expect(homePage.header.userAvatar(testUser.username)).toBeVisible();
  });

  test('shows the server error for invalid credentials', async ({ get }) => {
    // The response is mocked: the UI behaviour is under test, and real login calls are rate limited.
    await get(Interceptor).mock('**/api/users/login', {
      status: 404,
      json: { errors: { body: ['Email not found sign in first'] } },
    });
    const user = generateUser();

    await get(LoginPage, Route.login)
      .fillData('email', user.email)
      .fillData('password', user.password)
      .clickActionButton('login')
      .verifyErrorField('email', true);

    const loginPage = get(LoginPage);
    await expect(loginPage.errorMessages).toContainText('Email not found sign in first');
    await expect(loginPage.header.loginLink).toBeVisible();
  });

  test('user can log out', async ({ get }) => {
    const testUser = await get(Session).login();

    await get(HomePage, Route.home);
    const homePage = get(HomePage);
    await expect(homePage.header.userAvatar(testUser.username)).toBeVisible();

    await homePage.button.click(homePage.header.userMenu);
    await homePage.button.click(homePage.header.menuItem('Logout'));
    await expect(homePage.header.loginLink).toBeVisible();
    expect(await get(LocalStorage).getItem('loggedUser')).toBeNull();
  });
});
