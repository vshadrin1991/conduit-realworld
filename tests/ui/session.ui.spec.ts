import {getTestUser} from '@/api/client/session/auth/User';
import {AUTH_QUOTA, expect, test} from '@/base/BaseTest';
import {LocalStorage} from '@/pageObject/components/LocalStorage';
import {HomePage} from '@/pageObject/pages/HomePage';
import {LoginPage} from '@/pageObject/pages/LoginPage';
import {Route} from '@/pageObject/pagePath/Routes';

interface StoredSession {
    isAuth: boolean;
    loggedUser: { email: string; username: string; token: string };
}

test.describe('Session UI', () => {
    test('guest header shows the logo and the guest links', async ({get}) => {
        await get(LoginPage, Route.login);

        const loginPage = get(LoginPage);
        await loginPage.verifyElementIsVisible(
            loginPage.header.logo,
            loginPage.header.homeLink,
            loginPage.header.loginLink,
            loginPage.header.signUpLink,
            loginPage.header.sourceCodeLink
        )

        await loginPage.button.click(loginPage.header.logo);

        const homePage = get(HomePage);
        await homePage.waitUntilPageLoaded();
        await expect(homePage.page).toHaveURL(/#\/$/);
    });

    test('signed-in header shows New Article and the user menu', {tag: AUTH_QUOTA}, async ({get}) => {
        const testUser = await getTestUser();

        await get(LoginPage, Route.login)
            .fillData('email', testUser.email)
            .fillData('password', testUser.password)
            .clickActionButton('login');

        const homePage = get(HomePage);
        await homePage.waitUntilPageLoaded();
        await expect(homePage.header.homeLink).toBeVisible();
        await expect(homePage.header.newArticleLink).toBeVisible();
        await expect(homePage.header.userAvatar(testUser.username)).toBeVisible();
        await homePage.button.click(homePage.header.userMenu);
        await expect(homePage.header.menuItem('Profile')).toBeVisible();
        await expect(homePage.header.menuItem('Settings')).toBeVisible();
        await expect(homePage.header.menuItem('Logout')).toBeVisible();
    });

    test('sign-in stores the user in localStorage as loggedUser', {tag: AUTH_QUOTA}, async ({get}) => {
        const testUser = await getTestUser();
        await get(LoginPage, Route.login);
        expect(await get(LocalStorage).getItem('loggedUser')).toBeNull();

        await get(LoginPage)
            .fillData('email', testUser.email)
            .fillData('password', testUser.password)
            .clickActionButton('login');

        await get(HomePage).waitUntilPageLoaded();
        const stored = await get(LocalStorage).getItem<StoredSession>('loggedUser');
        expect(stored?.loggedUser).toMatchObject({email: testUser.email, username: testUser.username});
    });

    test('reload keeps the user signed in', {tag: AUTH_QUOTA}, async ({get}) => {
        const testUser = await getTestUser();
        await get(LoginPage, Route.login)
            .fillData('email', testUser.email)
            .fillData('password', testUser.password)
            .clickActionButton('login');
        const homePage = get(HomePage);
        await homePage.waitUntilPageLoaded();
        await expect(homePage.header.userAvatar(testUser.username)).toBeVisible();

        await homePage.page.reload();

        await homePage.waitUntilPageLoaded();
        await expect(homePage.header.newArticleLink).toBeVisible();
        await expect(homePage.header.userAvatar(testUser.username)).toBeVisible();
        expect(await get(LocalStorage).getItem('loggedUser')).not.toBeNull();

        await homePage.page.goto(`/#${Route.home}`);

        await homePage.waitUntilPageLoaded();
        await expect(homePage.header.userAvatar(testUser.username)).toBeVisible();
    });

    test('logout clears the session and restores the guest header', {tag: AUTH_QUOTA}, async ({get}) => {
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
        await expect(homePage.header.logo).toBeVisible();
        await expect(homePage.header.homeLink).toBeVisible();
        await expect(homePage.header.signUpLink).toBeVisible();
        await expect(homePage.header.sourceCodeLink).toBeVisible();
        await expect(homePage.header.userMenu).toBeHidden();
        expect(await get(LocalStorage).getItem('loggedUser')).toBeNull();
    });

    test('after logout a reload keeps the user signed out', {tag: AUTH_QUOTA}, async ({get}) => {
        const testUser = await getTestUser();
        await get(LoginPage, Route.login)
            .fillData('email', testUser.email)
            .fillData('password', testUser.password)
            .clickActionButton('login');
        const homePage = get(HomePage);
        await homePage.waitUntilPageLoaded();
        await homePage.button.click(homePage.header.userMenu);
        await homePage.button.click(homePage.header.menuItem('Logout'));
        await expect(homePage.header.loginLink).toBeVisible();

        await homePage.page.reload();

        await homePage.waitUntilPageLoaded();
        await expect(homePage.header.loginLink).toBeVisible();
        await expect(homePage.header.userMenu).toBeHidden();
        expect(await get(LocalStorage).getItem('loggedUser')).toBeNull();
    });

    test('guest is redirected from the editor and the settings to the home page', async ({get}) => {
        await get(HomePage, Route.newArticle);

        const homePage = get(HomePage);
        await expect(homePage.page).toHaveURL(/#\/$/);

        await get(HomePage, Route.settings);

        await expect(homePage.page).toHaveURL(/#\/$/);
    });

    test('user who logged out is redirected from protected pages', {tag: AUTH_QUOTA}, async ({get}) => {
        const testUser = await getTestUser();
        await get(LoginPage, Route.login)
            .fillData('email', testUser.email)
            .fillData('password', testUser.password)
            .clickActionButton('login');
        const homePage = get(HomePage);
        await homePage.waitUntilPageLoaded();
        await homePage.button.click(homePage.header.userMenu);
        await homePage.button.click(homePage.header.menuItem('Logout'));
        await expect(homePage.header.loginLink).toBeVisible();

        await get(HomePage, Route.settings);

        await expect(homePage.page).toHaveURL(/#\/$/);

        await get(HomePage, Route.newArticle);

        await expect(homePage.page).toHaveURL(/#\/$/);
    });
});
