import { getTestUser } from '@/api/client/session/auth/User';
import { expect, test } from '@/base/BaseTest';
import { LocalStorage } from '@/pageObject/components/LocalStorage';
import { Session } from '@/pageObject/components/Session';
import { HomePage } from '@/pageObject/pages/HomePage';
import { LoginPage } from '@/pageObject/pages/LoginPage';
import { Route } from '@/pageObject/pagePath/Routes';

test.describe('Session UI', () => {
  test('guest header shows the logo and the guest links', async ({ get }) => {
    await get(LoginPage, Route.login);

    await get(LoginPage).verifyElementIsVisible(
      get(LoginPage).header.logo,
      get(LoginPage).header.homeLink,
      get(LoginPage).header.loginLink,
      get(LoginPage).header.signUpLink,
      get(LoginPage).header.sourceCodeLink,
    );

    await get(LoginPage).button.click(get(LoginPage).header.logo);

    await get(HomePage).waitUntilPageLoaded();
    await expect(get(HomePage).page).toHaveURL(/#\/$/);
  });

  test('signed-in header shows New Article and the user menu', async ({ get }) => {
    const testUser = await getTestUser();
    await get(Session).login();

    await expect(get(HomePage).header.homeLink).toBeVisible();
    await expect(get(HomePage).header.newArticleLink).toBeVisible();
    await expect(get(HomePage).header.userAvatar(testUser.username)).toBeVisible();
    await get(HomePage).button.click(get(HomePage).header.userMenu);
    await expect(get(HomePage).header.menuItem('Profile')).toBeVisible();
    await expect(get(HomePage).header.menuItem('Settings')).toBeVisible();
    await expect(get(HomePage).header.menuItem('Logout')).toBeVisible();
  });

  test('sign-in stores the user in localStorage as loggedUser', async ({ get }) => {
    const testUser = await getTestUser();
    await get(LoginPage, Route.login);
    expect(await get(LocalStorage).getItem('loggedUser')).toBeNull();

    await get(LoginPage).fillData('email', testUser.email);
    await get(LoginPage).fillData('password', testUser.password);
    await get(LoginPage).clickActionButton('login');

    await get(HomePage).waitUntilPageLoaded();
    const stored = await get(LocalStorage).getItem<{ loggedUser: { email: string; username: string } }>('loggedUser');
    expect(stored?.loggedUser).toMatchObject({ email: testUser.email, username: testUser.username });
  });

  test('reload keeps the user signed in', async ({ get }) => {
    const testUser = await getTestUser();
    await get(Session).login();
    await expect(get(HomePage).header.userAvatar(testUser.username)).toBeVisible();

    await get(HomePage).navigation.reload();

    await get(HomePage).waitUntilPageLoaded();
    await expect(get(HomePage).header.newArticleLink).toBeVisible();
    await expect(get(HomePage).header.userAvatar(testUser.username)).toBeVisible();
    expect(await get(LocalStorage).getItem('loggedUser')).not.toBeNull();

    await get(HomePage).navigation.to(Route.profile(testUser.username));
    await get(HomePage).navigation.to(Route.home);

    await get(HomePage).waitUntilPageLoaded();
    await expect(get(HomePage).header.userAvatar(testUser.username)).toBeVisible();
  });

  test('logout clears the session and restores the guest header', async ({ get }) => {
    const testUser = await getTestUser();
    await get(Session).login();
    await expect(get(HomePage).header.userAvatar(testUser.username)).toBeVisible();

    await get(HomePage).button.click(get(HomePage).header.userMenu);
    await get(HomePage).button.click(get(HomePage).header.menuItem('Logout'));

    await expect(get(HomePage).header.loginLink).toBeVisible();
    await expect(get(HomePage).header.logo).toBeVisible();
    await expect(get(HomePage).header.homeLink).toBeVisible();
    await expect(get(HomePage).header.signUpLink).toBeVisible();
    await expect(get(HomePage).header.sourceCodeLink).toBeVisible();
    await expect(get(HomePage).header.userMenu).toBeHidden();
    expect(await get(LocalStorage).getItem('loggedUser')).toBeNull();
  });

  test('after logout a reload keeps the user signed out', async ({ get }) => {
    await get(Session).login();
    await get(HomePage).button.click(get(HomePage).header.userMenu);
    await get(HomePage).button.click(get(HomePage).header.menuItem('Logout'));
    await expect(get(HomePage).header.loginLink).toBeVisible();

    await get(HomePage).navigation.reload();

    await get(HomePage).waitUntilPageLoaded();
    await expect(get(HomePage).header.loginLink).toBeVisible();
    await expect(get(HomePage).header.userMenu).toBeHidden();
    expect(await get(LocalStorage).getItem('loggedUser')).toBeNull();
  });

  test('guest is redirected from the editor and the settings to the home page', async ({ get }) => {
    await get(HomePage, Route.newArticle);

    await expect(get(HomePage).page).toHaveURL(/#\/$/);

    await get(HomePage, Route.settings);

    await expect(get(HomePage).page).toHaveURL(/#\/$/);
  });

  test('user who logged out is redirected from protected pages', async ({ get }) => {
    await get(Session).login();
    await get(HomePage).button.click(get(HomePage).header.userMenu);
    await get(HomePage).button.click(get(HomePage).header.menuItem('Logout'));
    await expect(get(HomePage).header.loginLink).toBeVisible();

    await get(HomePage, Route.settings);
    await expect(get(HomePage).page).toHaveURL(/#\/$/);

    await get(HomePage, Route.newArticle);
    await expect(get(HomePage).page).toHaveURL(/#\/$/);
  });
});
