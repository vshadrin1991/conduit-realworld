import {APIClient} from '@/api/client/APIClient';
import {expect, test} from '@/base/BaseTest';
import {HomePage} from '@/pageObject/pages/HomePage';
import {Route} from '@/pageObject/pagePath/Routes';

const PAGE_SIZE = 3;

test.describe('Home feed UI', () => {
    test('guest sees the banner and only the global feed tab', async ({get}) => {
        await get(HomePage, Route.home).waitUntilPageLoaded();

        const homePage = get(HomePage);
        await expect(homePage.bannerTitle).toHaveText('conduit');
        await expect(homePage.bannerTagline).toHaveText('A place to share your knowledge.');
        await expect(homePage.feedTabs).toHaveCount(1);
        await expect(homePage.selectedFeedTab).toHaveText('Global Feed');
    });

    test('global feed shows three articles per page', async ({get}) => {
        await get(HomePage, Route.home).waitUntilPageLoaded();

        await expect(get(HomePage).articlePreviews).toHaveCount(PAGE_SIZE);
    });

    test('article preview shows the author, tags and the links of the article', async ({get}) => {
        const [article] = await get(APIClient).api.articles.create();

        await get(HomePage, Route.home).waitUntilPageLoaded();

        const homePage = get(HomePage);
        const preview = await homePage.findArticleInFeed(article.title);
        await expect(preview).toContainText(article.description);
        await expect(homePage.articleAuthorLink(article.title)).toHaveAttribute(
            'href',
            `#${Route.profile(article.author.username)}`,
        );
        await expect(homePage.articleLink(article.title)).toHaveAttribute('href', `#${Route.article(article.slug)}`);
        await expect(homePage.articleLink(article.title)).toContainText('Read more...');
        await expect(homePage.articleFavoriteCount(article.title)).toHaveText(`( ${article.favoritesCount} )`);
        const tags = await homePage.text.getTexts(homePage.articleTags(article.title));
        expect(tags.toSorted()).toEqual(article.tagList.toSorted());
    });

    test('selecting the next page loads other articles and marks it as current', async ({get}) => {
        await get(HomePage, Route.home).waitUntilPageLoaded();

        const homePage = get(HomePage);
        await expect(homePage.articlePreviews).toHaveCount(PAGE_SIZE);
        const firstPage = await homePage.text.getTexts(homePage.articleTitles);
        await homePage.button.click(homePage.feedPageButton(2));

        await expect(homePage.feedPageButton(2)).toHaveAccessibleName('Page 2 is your current page');
        await expect(homePage.articleTitles.first()).not.toHaveText(firstPage[0]);
        await expect(homePage.articlePreviews).toHaveCount(PAGE_SIZE);
        const secondPage = await homePage.text.getTexts(homePage.articleTitles);
        expect(secondPage.filter((title) => firstPage.includes(title))).toEqual([]);
    });

    test('the last pagination page matches the total article count', async ({get}) => {
        await get(HomePage, Route.home).waitUntilPageLoaded();

        const homePage = get(HomePage);
        await expect(homePage.lastFeedPage).toBeVisible();
        const [lastPage] = await homePage.text.getTexts(homePage.lastFeedPage);
        const {articlesCount} = await get(APIClient, {guest: true}).get.articles.list({limit: 1});

        expect(Number(lastPage)).toBe(Math.ceil(articlesCount / PAGE_SIZE));
    });

    test('a popular tag opens a feed tab listing only its articles', async ({get}) => {
        await get(HomePage, Route.home).waitUntilPageLoaded();

        const homePage = get(HomePage);
        await expect(homePage.popularTags.first()).toBeVisible();
        const [tag] = await homePage.text.getTexts(homePage.popularTags.first());
        await homePage.button.click(homePage.popularTags.first());

        await expect(homePage.feedTabs).toHaveCount(2);
        await expect(homePage.selectedFeedTab).toHaveText(tag);
        await expect(async () => {
            const tagLists = await homePage.text.getTexts(homePage.articleTagLists);
            expect(tagLists.length).toBeGreaterThan(0);
            expect(tagLists.length).toBeLessThanOrEqual(PAGE_SIZE);
            expect(tagLists.every((tags) => tags.split('\n').includes(tag))).toBe(true);
        }).toPass();
    });
});
