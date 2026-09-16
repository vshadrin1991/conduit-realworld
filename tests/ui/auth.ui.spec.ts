import {getTestUser} from '@/api/client/session/auth/User';
import {expect, test} from '@/base/BaseTest';
import {Interceptor} from '@/utilities/interceptor/Interceptor';
import {LocalStorage} from '@/pageObject/components/LocalStorage';
import {HomePage} from '@/pageObject/pages/HomePage';
import {LoginPage} from '@/pageObject/pages/LoginPage';
import {RegisterPage} from '@/pageObject/pages/RegisterPage';
import {Route} from '@/pageObject/pagePath/Routes';
import {generateUser} from '@/utilities/tests/TestDataGenerator';

test.describe('Authentication UI', () => {
    test('sign-up page shows the heading, the sign-in link, the fields and the button', async ({get}) => {
        const user = generateUser();

        await get(RegisterPage, Route.register);

        await get(RegisterPage).verifyElementExist('signIn', true);
        await get(RegisterPage).verifyElementExist('username', true);
        await get(RegisterPage).verifyElementExist('email', true);
        await get(RegisterPage).verifyElementExist('password', true);
        await get(RegisterPage).verifyElementExist('signUp', true);
        await get(RegisterPage).verifyFieldAttribute('email', 'type', 'email');
        await get(RegisterPage).fillData('password', user.password);
        await get(RegisterPage).verifyFieldAttribute('password', 'type', 'password');
    });

    test('"Sign in to your account" opens the sign-in page', async ({get}) => {
        await get(RegisterPage, Route.register);

        await get(RegisterPage).clickActionButton('signIn');

        await get(LoginPage).waitUntilPageLoaded();
        await expect(get(LoginPage).page).toHaveURL(/#\/login$/);
    });

    test('user can sign up', async ({get}) => {
        const user = generateUser();

        await get(RegisterPage, Route.register);
        await get(RegisterPage).fillData('username', user.username);
        await get(RegisterPage).fillData('email', user.email);
        await get(RegisterPage).fillData('password', user.password);
        await get(RegisterPage).clickActionButton('signUp');

        await get(HomePage).waitUntilPageLoaded();
        await expect(get(RegisterPage).errorMessages).toBeHidden();
        await expect(get(HomePage).header.newArticleLink).toBeVisible();
        await expect(get(HomePage).header.userAvatar(user.username)).toBeVisible();
        await get(HomePage).button.click(get(HomePage).header.userMenu);
        await expect(get(HomePage).header.menuItem('Profile')).toBeVisible();
        await expect(get(HomePage).header.menuItem('Settings')).toBeVisible();
        await expect(get(HomePage).header.menuItem('Logout')).toBeVisible();
    });

    test('sign-up form shows the duplicate email error', async ({get}) => {
        const existing = await getTestUser();
        const user = generateUser({email: existing.email});

        await get(RegisterPage, Route.register);
        await get(RegisterPage).fillData('username', user.username);
        await get(RegisterPage).fillData('email', user.email);
        await get(RegisterPage).fillData('password', user.password);
        await get(RegisterPage).clickActionButton('signUp');

        await expect(get(RegisterPage).errorMessages).toHaveCount(1);
        await expect(get(RegisterPage).errorMessages).toContainText('Email already exists.. try logging in');
        await expect(get(RegisterPage).page).toHaveURL(/#\/register$/);
        await expect(get(RegisterPage).header.loginLink).toBeVisible();
        await expect(get(RegisterPage).header.signUpLink).toBeVisible();
    });

    test('sign-in page shows the heading, the sign-up link, the fields and the button', async ({get}) => {
        const user = generateUser();

        await get(LoginPage, Route.login);

        await get(LoginPage).verifyElementExist('needAnAccount', true);
        await get(LoginPage).verifyElementExist('email', true);
        await get(LoginPage).verifyElementExist('password', true);
        await get(LoginPage).verifyElementExist('login', true);
        await get(LoginPage).verifyFieldAttribute('email', 'type', 'email');
        await get(LoginPage).fillData('password', user.password);
        await get(LoginPage).verifyFieldAttribute('password', 'type', 'password');
    });

    test('"Need an account?" opens the sign-up page', async ({get}) => {
        await get(LoginPage, Route.login);

        await get(LoginPage).clickActionButton('needAnAccount');

        await get(RegisterPage).waitUntilPageLoaded();
        await expect(get(RegisterPage).page).toHaveURL(/#\/register$/);
    });

    test('user can log in', async ({get}) => {
        const testUser = await getTestUser();

        await get(LoginPage, Route.login);
        await get(LoginPage).fillData('email', testUser.email);
        await get(LoginPage).fillData('password', testUser.password);
        await get(LoginPage).clickActionButton('login');

        await get(HomePage).waitUntilPageLoaded();
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

    test('sign-in form shows the unknown email error', async ({get}) => {
        await get(Interceptor).mock('**/api/users/login', {
            status: 404,
            json: {errors: {body: ['Email not found sign in first']}},
        });
        const user = generateUser();

        await get(LoginPage, Route.login);
        await get(LoginPage).fillData('email', user.email);
        await get(LoginPage).fillData('password', user.password);
        await get(LoginPage).clickActionButton('login');

        await expect(get(LoginPage).errorMessages).toHaveCount(1);
        await expect(get(LoginPage).errorMessages).toContainText('Email not found sign in first');
        await expect(get(LoginPage).page).toHaveURL(/#\/login$/);
        await expect(get(LoginPage).header.loginLink).toBeVisible();
    });

    test('sign-in form shows the wrong password error', async ({get}) => {
        await get(Interceptor).mock('**/api/users/login', {
            status: 422,
            json: {errors: {body: ['Wrong email/password combination']}},
        });
        const testUser = await getTestUser();

        await get(LoginPage, Route.login);
        await get(LoginPage).fillData('email', testUser.email);
        await get(LoginPage).fillData('password', `wrong-${generateUser().password}`);
        await get(LoginPage).clickActionButton('login');

        await expect(get(LoginPage).errorMessages).toHaveCount(1);
        await expect(get(LoginPage).errorMessages).toContainText('Wrong email/password combination');
        await expect(get(LoginPage).page).toHaveURL(/#\/login$/);
        expect(await get(LocalStorage).getItem('loggedUser')).toBeNull();
    });

    test('repeated failed sign-ins keep one error block', async ({get}) => {
        const testUser = await getTestUser();
        const unknown = generateUser();
        await get(Interceptor).mock('**/api/users/login', {
            status: 422,
            json: {errors: {body: ['Wrong email/password combination']}},
        });

        await get(LoginPage, Route.login);
        await get(LoginPage).fillData('email', testUser.email);
        await get(LoginPage).fillData('password', unknown.password);
        await get(LoginPage).clickActionButton('login');

        await expect(get(LoginPage).errorMessages).toHaveCount(1);
        await expect(get(LoginPage).errorMessages).toContainText('Wrong email/password combination');

        await get(Interceptor).mock('**/api/users/login', {
            status: 404,
            json: {errors: {body: ['Email not found sign in first']}},
        });
        await get(LoginPage).fillData('email', unknown.email);
        await get(LoginPage).clickActionButton('login');

        await expect(get(LoginPage).errorMessages).toHaveCount(1);
        await expect(get(LoginPage).errorMessages).toContainText('Email not found sign in first');
    });
});
