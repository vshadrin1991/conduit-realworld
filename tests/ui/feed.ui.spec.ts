import {APIClient} from '@/api/client/APIClient';
import {expect, test} from '@/base/BaseTest';
import {HomePage} from '@/pageObject/pages/HomePage';
import {Route} from '@/pageObject/pagePath/Routes';

const PAGE_SIZE = 3;

test.describe('Home feed UI', () => {
    test('guest sees the banner and only the global feed tab', async ({get}) => {
        await get(HomePage, Route.home);

        await expect(get(HomePage).bannerTitle).toHaveText('conduit');
        await expect(get(HomePage).bannerTagline).toHaveText('A place to share your knowledge.');
        await expect(get(HomePage).feedTabs).toHaveCount(1);
        await expect(get(HomePage).selectedFeedTab).toHaveText('Global Feed');
    });

    test('global feed shows three articles per page', async ({get}) => {
        await get(HomePage, Route.home);

        await expect(get(HomePage).articlePreviews).toHaveCount(PAGE_SIZE);
    });

    test('article preview shows the author, tags and the links of the article', async ({get}) => {
        const [article] = await get(APIClient).api.articles.create();

        await get(HomePage, Route.home);

        const preview = await get(HomePage).findArticleInFeed(article.title);
        await expect(preview).toContainText(article.description);
        await expect(get(HomePage).articleAuthorLink(article.title)).toHaveAttribute(
            'href',
            `#${Route.profile(article.author.username)}`,
        );
        await expect(get(HomePage).articleLink(article.title)).toHaveAttribute(
            'href',
            `#${Route.article(article.slug)}`,
        );
        await expect(get(HomePage).articleLink(article.title)).toContainText('Read more...');
        await expect(get(HomePage).articleFavoriteCount(article.title)).toHaveText(`( ${article.favoritesCount} )`);
        const tags = await get(HomePage).text.getTexts(get(HomePage).articleTags(article.title));
        expect(tags.toSorted()).toEqual(article.tagList.toSorted());
    });

    test('selecting the next page loads other articles and marks it as current', async ({get}) => {
        await get(HomePage, Route.home);

        await expect(get(HomePage).articlePreviews).toHaveCount(PAGE_SIZE);
        const firstPage = await get(HomePage).text.getTexts(get(HomePage).articleTitles);
        await get(HomePage).button.click(get(HomePage).feedPageButton(2));

        await expect(get(HomePage).feedPageButton(2)).toHaveAccessibleName('Page 2 is your current page');
        await expect(get(HomePage).articleTitles.first()).not.toHaveText(firstPage[0]);
        await expect(get(HomePage).articlePreviews).toHaveCount(PAGE_SIZE);
        const secondPage = await get(HomePage).text.getTexts(get(HomePage).articleTitles);
        expect(secondPage.filter((title) => firstPage.includes(title))).toEqual([]);
    });

    test('the last pagination page matches the total article count', async ({get}) => {
        await get(HomePage, Route.home);

        await expect(get(HomePage).lastFeedPage).toBeVisible();
        const [lastPage] = await get(HomePage).text.getTexts(get(HomePage).lastFeedPage);
        const {articlesCount} = await get(APIClient, {guest: true}).get.articles.list({limit: 1});

        expect(Number(lastPage)).toBe(Math.ceil(articlesCount / PAGE_SIZE));
    });

    test('a popular tag opens a feed tab listing only its articles', async ({get}) => {
        await get(HomePage, Route.home);

        await expect(get(HomePage).popularTags.first()).toBeVisible();
        const [tag] = await get(HomePage).text.getTexts(get(HomePage).popularTags.first());
        await get(HomePage).button.click(get(HomePage).popularTags.first());

        await expect(get(HomePage).feedTabs).toHaveCount(2);
        await expect(get(HomePage).selectedFeedTab).toHaveText(tag);
        await expect(async () => {
            const tagLists = await get(HomePage).text.getTexts(get(HomePage).articleTagLists);
            expect(tagLists.length).toBeGreaterThan(0);
            expect(tagLists.length).toBeLessThanOrEqual(PAGE_SIZE);
            expect(tagLists.every((tags) => tags.split('\n').includes(tag))).toBe(true);
        }).toPass();
    });
});
