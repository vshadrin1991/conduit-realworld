import { BaseComponent } from '@/base/BaseComponent';

type ConfirmationButton = 'accept' | 'dismiss';

/**
 * Native browser dialogs (`confirm`, `alert`, `prompt`) — Conduit asks "Want to delete the article?" via `confirm`.
 * Exposed on every page as `page.confirmation`. Playwright auto-dismisses dialogs without a handler, so the answer
 * must be registered before the action:
 *
 * const dialog = articlePage.confirmation.answerNext('accept');
 * await articlePage.clickActionButton('deleteArticle');
 * expect(await dialog).toBe('Want to delete the article?');
 */
export class Confirmation extends BaseComponent {
  /**
   * Registers the answer to the next native dialog of the page; call it before the action that opens the dialog.
   * @param button - `accept` to confirm the dialog, `dismiss` to cancel it
   * @return promise of the dialog message, resolved once the dialog is answered
   */
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
