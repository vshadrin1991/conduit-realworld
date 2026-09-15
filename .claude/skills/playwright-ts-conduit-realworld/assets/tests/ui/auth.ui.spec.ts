import { getTestUser } from '@/api/client/session/auth/User';
import { AUTH_QUOTA, expect, test } from '@/base/BaseTest';
import { Interceptor } from '@/utilities/interceptor/Interceptor';
import { LocalStorage } from '@/pageObject/components/LocalStorage';
import { HomePage } from '@/pageObject/pages/HomePage';
import { LoginPage } from '@/pageObject/pages/LoginPage';
import { Route } from '@/pageObject/pagePath/Routes';
import { generateUser } from '@/utilities/tests/TestDataGenerator';

test.describe('Authentication UI', () => {
  test('shows the server error for invalid credentials', async ({ get }) => {
    await get(Interceptor).mock('**/api/users/login', {
      status: 404,
      json: { errors: { body: ['Email not found sign in first'] } },
    });
    const user = generateUser();

    await get(LoginPage, Route.login)
      .fillData('email', user.email)
      .fillData('password', user.password)
      .clickActionButton('login')
      .verifyErrorField('email', true)
      .verifyErrorFieldText('email', 'Email not found sign in first');

    await expect(get(LoginPage).header.loginLink).toBeVisible();
  });

  test('user logs out from the header menu', { tag: AUTH_QUOTA }, async ({ get }) => {
    const testUser = await getTestUser();

    await get(LoginPage, Route.login)
      .fillData('email', testUser.email)
      .fillData('password', testUser.password)
      .clickActionButton('login');

    const homePage = get(HomePage);
    await homePage.waitUntilPageLoaded();
    await expect(homePage.header.userAvatar(testUser.username)).toBeVisible();
    await homePage.button.click(homePage.header.userMenu);
    await homePage.button.click(homePage.header.menuItem('Logout'));

    await expect(homePage.header.loginLink).toBeVisible();
    expect(await get(LocalStorage).getItem('loggedUser')).toBeNull();
  });
});
