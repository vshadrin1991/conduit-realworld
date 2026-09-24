import { getTestUser } from '@/api/client/session/auth/User';
import { expect, test } from '@/base/BaseTest';
import { Interceptor } from '@/utilities/interceptor/Interceptor';
import { LocalStorage } from '@/pageObject/components/LocalStorage';
import { HomePage } from '@/pageObject/pages/HomePage';
import { LoginPage } from '@/pageObject/pages/LoginPage';
import { RegisterPage } from '@/pageObject/pages/RegisterPage';
import { Route } from '@/pageObject/pagePath/Routes';
import { Tag } from '@/utilities/tests/Tag';
import { generateUser } from '@/utilities/tests/TestDataGenerator';

test.describe('Authentication UI', () => {
  test('sign-up page shows the heading, the sign-in link, the fields and the button', async ({ get }) => {
    const user = generateUser();

    await get(RegisterPage, Route.register)
      .verifyElementExist('signIn', true)
      .verifyElementExist('username', true)
      .verifyElementExist('email', true)
      .verifyElementExist('password', true)
      .verifyElementExist('signUp', true)
      .verifyFieldAttribute('email', 'type', 'email')
      .fillData('password', user.password)
      .verifyFieldAttribute('password', 'type', 'password');
  });

  test('"Sign in to your account" opens the sign-in page', async ({ get }) => {
    await get(RegisterPage, Route.register).clickActionButton('signIn').next(LoginPage).waitUntilPageLoaded();

    await expect(get(LoginPage).page).toHaveURL(/#\/login$/);
  });

  test('user can sign up', { tag: Tag.AUTH_QUOTA }, async ({ get }) => {
    const user = generateUser();

    await get(RegisterPage, Route.register)
      .fillData('username', user.username)
      .fillData('email', user.email)
      .fillData('password', user.password)
      .clickActionButton('signUp')
      .next(HomePage)
      .waitUntilPageLoaded();

    await expect(get(RegisterPage).errorMessages).toBeHidden();
    await expect(get(HomePage).header.newArticleLink).toBeVisible();
    await expect(get(HomePage).header.userAvatar(user.username)).toBeVisible();
    await get(HomePage).button.click(get(HomePage).header.userMenu);
    await expect(get(HomePage).header.menuItem('Profile')).toBeVisible();
    await expect(get(HomePage).header.menuItem('Settings')).toBeVisible();
    await expect(get(HomePage).header.menuItem('Logout')).toBeVisible();
  });

  test('sign-up form shows the duplicate email error', { tag: Tag.AUTH_QUOTA }, async ({ get }) => {
    const existing = await getTestUser();
    const user = generateUser({ email: existing.email });

    await get(RegisterPage, Route.register)
      .fillData('username', user.username)
      .fillData('email', user.email)
      .fillData('password', user.password)
      .clickActionButton('signUp');

    await expect(get(RegisterPage).errorMessages).toHaveCount(1);
    await expect(get(RegisterPage).errorMessages).toContainText('Email already exists.. try logging in');
    await expect(get(RegisterPage).page).toHaveURL(/#\/register$/);
    await expect(get(RegisterPage).header.loginLink).toBeVisible();
    await expect(get(RegisterPage).header.signUpLink).toBeVisible();
  });

  test('sign-in page shows the heading, the sign-up link, the fields and the button', async ({ get }) => {
    const user = generateUser();

    await get(LoginPage, Route.login)
      .verifyElementExist('needAnAccount', true)
      .verifyElementExist('email', true)
      .verifyElementExist('password', true)
      .verifyElementExist('login', true)
      .verifyFieldAttribute('email', 'type', 'email')
      .fillData('password', user.password)
      .verifyFieldAttribute('password', 'type', 'password');
  });

  test('"Need an account?" opens the sign-up page', async ({ get }) => {
    await get(LoginPage, Route.login).clickActionButton('needAnAccount').next(RegisterPage).waitUntilPageLoaded();

    await expect(get(RegisterPage).page).toHaveURL(/#\/register$/);
  });

  test('user can log in', { tag: Tag.AUTH_QUOTA }, async ({ get }) => {
    const testUser = await getTestUser();

    await get(LoginPage, Route.login)
      .fillData('email', testUser.email)
      .fillData('password', testUser.password)
      .clickActionButton('login')
      .next(HomePage)
      .waitUntilPageLoaded();

    await expect(get(LoginPage).errorMessages).toBeHidden();
    await expect(get(HomePage).header.homeLink).toBeVisible();
    await expect(get(HomePage).header.newArticleLink).toBeVisible();
    await expect(get(HomePage).header.userAvatar(testUser.username)).toBeVisible();
    await expect(get(HomePage).header.loginLink).toBeHidden();
    await get(HomePage).button.click(get(HomePage).header.userMenu);
    await expect(get(HomePage).header.menuItem('Profile')).toBeVisible();
    await expect(get(HomePage).header.menuItem('Settings')).toBeVisible();
    await expect(get(HomePage).header.menuItem('Logout')).toBeVisible();
  });

  test('sign-in form shows the unknown email error', async ({ get }) => {
    await get(Interceptor).mock('**/api/users/login', {
      status: 404,
      json: { errors: { body: ['Email not found sign in first'] } },
    });
    const user = generateUser();

    await get(LoginPage, Route.login)
      .fillData('email', user.email)
      .fillData('password', user.password)
      .clickActionButton('login');

    await expect(get(LoginPage).errorMessages).toHaveCount(1);
    await expect(get(LoginPage).errorMessages).toContainText('Email not found sign in first');
    await expect(get(LoginPage).page).toHaveURL(/#\/login$/);
    await expect(get(LoginPage).header.loginLink).toBeVisible();
  });

  test('sign-in form shows the wrong password error', async ({ get }) => {
    await get(Interceptor).mock('**/api/users/login', {
      status: 422,
      json: { errors: { body: ['Wrong email/password combination'] } },
    });
    const testUser = await getTestUser();

    await get(LoginPage, Route.login)
      .fillData('email', testUser.email)
      .fillData('password', `wrong-${generateUser().password}`)
      .clickActionButton('login');

    await expect(get(LoginPage).errorMessages).toHaveCount(1);
    await expect(get(LoginPage).errorMessages).toContainText('Wrong email/password combination');
    await expect(get(LoginPage).page).toHaveURL(/#\/login$/);
    expect(await get(LocalStorage).getItem('loggedUser')).toBeNull();
  });

  test('repeated failed sign-ins keep one error block', async ({ get }) => {
    const testUser = await getTestUser();
    const unknown = generateUser();
    await get(Interceptor).mock('**/api/users/login', {
      status: 422,
      json: { errors: { body: ['Wrong email/password combination'] } },
    });

    await get(LoginPage, Route.login)
      .fillData('email', testUser.email)
      .fillData('password', unknown.password)
      .clickActionButton('login');

    await expect(get(LoginPage).errorMessages).toHaveCount(1);
    await expect(get(LoginPage).errorMessages).toContainText('Wrong email/password combination');

    await get(Interceptor).mock('**/api/users/login', {
      status: 404,
      json: { errors: { body: ['Email not found sign in first'] } },
    });
    await get(LoginPage).fillData('email', unknown.email).clickActionButton('login');

    await expect(get(LoginPage).errorMessages).toHaveCount(1);
    await expect(get(LoginPage).errorMessages).toContainText('Email not found sign in first');
  });
});
