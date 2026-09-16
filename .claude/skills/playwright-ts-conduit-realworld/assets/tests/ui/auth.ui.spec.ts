import { getTestUser } from '@/api/client/session/auth/User';
import { expect, test } from '@/base/BaseTest';
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

    await get(LoginPage, Route.login);
    await get(LoginPage).fillData('email', user.email);
    await get(LoginPage).fillData('password', user.password);
    await get(LoginPage).clickActionButton('login');

    await get(LoginPage).verifyErrorField('email', true);
    await get(LoginPage).verifyErrorFieldText('email', 'Email not found sign in first');
    await expect(get(LoginPage).header.loginLink).toBeVisible();
  });

  test('user logs out from the header menu', async ({ get }) => {
    const testUser = await getTestUser();

    await get(LoginPage, Route.login);
    await get(LoginPage).fillData('email', testUser.email);
    await get(LoginPage).fillData('password', testUser.password);
    await get(LoginPage).clickActionButton('login');

    await get(HomePage).waitUntilPageLoaded();
    await expect(get(HomePage).header.userAvatar(testUser.username)).toBeVisible();
    await get(HomePage).button.click(get(HomePage).header.userMenu);
    await get(HomePage).button.click(get(HomePage).header.menuItem('Logout'));

    await expect(get(HomePage).header.loginLink).toBeVisible();
    expect(await get(LocalStorage).getItem('loggedUser')).toBeNull();
  });
});
