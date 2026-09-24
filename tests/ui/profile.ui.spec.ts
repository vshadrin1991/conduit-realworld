import { APIClient } from '@/api/client/APIClient';
import { getOtherUser, getTestUser } from '@/api/client/session/auth/User';
import { expect, test } from '@/base/BaseTest';
import { Session } from '@/pageObject/components/Session';
import { HomePage } from '@/pageObject/pages/HomePage';
import { ProfilePage } from '@/pageObject/pages/ProfilePage';
import { SettingsPage } from '@/pageObject/pages/SettingsPage';
import { Route } from '@/pageObject/pagePath/Routes';
import { generatePhrase } from '@/utilities/tests/TestDataGenerator';

test.describe('Profile UI', () => {
  test('guest sees the profile card and the article tabs', async ({ get }) => {
    const testUser = await getTestUser();

    await get(ProfilePage, Route.profile(testUser.username));

    await expect(get(ProfilePage).username).toHaveText(testUser.username);
    await expect(get(ProfilePage).avatar).toHaveAttribute('alt', testUser.username);
    await get(ProfilePage).verifyElementExist('followers', true);
    await expect(get(ProfilePage).followersCount).toHaveText(/\( \d+ \)/);
    await get(ProfilePage).verifyElementIsVisible(
      get(ProfilePage).profileTab('My Articles'),
      get(ProfilePage).profileTab('Favorited Articles'),
    );
  });

  test('My Articles lists the articles of the user', async ({ get }) => {
    const [article] = await get(APIClient).api.articles.create();
    const testUser = await getTestUser();

    await get(ProfilePage, Route.profile(testUser.username));

    await expect(get(ProfilePage).articlePreview(article.title)).toBeVisible();
    await expect(get(ProfilePage).articleLink(article.title)).toHaveAttribute(
      'href',
      `#${Route.article(article.slug)}`,
    );
  });

  test('Favorited Articles lists the articles the user favorited', async ({ get }) => {
    const [article] = await get(APIClient).api.articles.create();
    await get(APIClient).post.articles.favorite(article.slug);
    const testUser = await getTestUser();

    await get(ProfilePage, Route.profileFavorites(testUser.username));

    await expect(get(ProfilePage).profileTab('Favorited Articles')).toHaveClass(/active/);
    await expect(get(ProfilePage).articlePreview(article.title)).toBeVisible();
  });

  test('guest clicking the followers button gets the login alert', async ({ get }) => {
    const testUser = await getTestUser();

    await get(ProfilePage, Route.profile(testUser.username));
    const dialog = get(ProfilePage).confirmation.answerNext('accept');
    await get(ProfilePage).clickActionButton('followers');

    expect(await dialog).toBe('You need to login first');
    await expect(get(ProfilePage).page).toHaveURL(new RegExp(`#${Route.profile(testUser.username)}$`));
  });

  test('signed-in user follows and unfollows another user from the profile', async ({ get }) => {
    const other = await getOtherUser();
    const { followersCount = 0 } = await get(APIClient).api.profiles.ensureFollowing(other.username, false);
    await get(Session).login();

    await get(ProfilePage, Route.profile(other.username));
    await expect(get(ProfilePage).followersButton).toContainText('Follow');
    await expect(get(ProfilePage).followersButton).not.toContainText('Unfollow');

    await get(ProfilePage).clickActionButton('followers');

    await expect(get(ProfilePage).followersButton).toContainText('Unfollow');
    await expect(get(ProfilePage).followersCount).toHaveText(`( ${followersCount + 1} )`);
    expect((await get(APIClient).get.profiles.byUsername(other.username)).following).toBe(true);

    await get(ProfilePage).clickActionButton('followers');

    await expect(get(ProfilePage).followersButton).not.toContainText('Unfollow');
    expect((await get(APIClient).get.profiles.byUsername(other.username)).following).toBe(false);
  });

  test('own profile shows the settings link instead of the follow button', async ({ get }) => {
    const testUser = await getTestUser();
    await get(Session).login();

    await get(ProfilePage, Route.profile(testUser.username))
      .verifyElementExist('editProfileSettings', true)
      .verifyElementExist('followers', false)
      .clickActionButton('editProfileSettings')
      .next(SettingsPage)
      .waitUntilPageLoaded();
  });
});

test.describe('Settings UI', () => {
  test('shows the settings form prefilled with the user data', async ({ get }) => {
    const testUser = await getTestUser();
    await get(Session).login();

    await get(HomePage).button.click(get(HomePage).header.userMenu);
    await get(HomePage).button.click(get(HomePage).header.menuItem('Settings'));

    await get(SettingsPage)
      .waitUntilPageLoaded()
      .verifyAriaSnapshot('settings-form', get(SettingsPage).form)
      .verifyFieldData('username', testUser.username)
      .verifyFieldData('email', testUser.email)
      .verifyFieldAttribute('password', 'type', 'password');
  });

  test('updates the bio and shows it on the profile', async ({ get }) => {
    const other = await getOtherUser();
    await get(Session).login(other);
    const bio = generatePhrase();

    await get(SettingsPage, Route.settings)
      .fillData('bio', bio)
      .fillData('password', other.password)
      .clickActionButton('updateSettings');

    await expect(async () => {
      const profile = await get(APIClient, { guest: true }).get.profiles.byUsername(other.username);
      expect(profile.bio).toBe(bio);
    }).toPass();
    await get(ProfilePage, Route.profile(other.username));
    await expect(get(ProfilePage).bio).toHaveText(bio);
  });
});
