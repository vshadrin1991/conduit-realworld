import { BaseComponent } from '@/base/BaseComponent';

type ConfirmationButton = 'accept' | 'dismiss';

/**
 * Native browser dialogs (`confirm`, `alert`, `prompt`) — Conduit asks "Want to delete the article?" via `confirm`.
 * Playwright auto-dismisses dialogs without a handler, so the answer must be registered before the action:
 *
 * const dialog = get(Confirmation).answerNext('accept');
 * await articlePage.clickActionButton('deleteArticle');
 * expect(await dialog).toBe('Want to delete the article?');
 */
export class Confirmation extends BaseComponent {
  /** Waits for the next dialog, clicks `button` on it and resolves with the dialog message. */
  answerNext(button: ConfirmationButton): Promise<string> {
    return this.page.waitForEvent('dialog').then(async (dialog) => {
      const message = dialog.message();
      this.log.info(`${button === 'accept' ? 'Accept' : 'Dismiss'} ${dialog.type()} dialog: "${message}"`);
      if (button === 'accept') await dialog.accept();
      else await dialog.dismiss();
      return message;
    });
  }
}
