import type { Locator } from '@playwright/test';
import { BasePage } from '@/base/BasePage';

type FieldName = 'title' | 'description' | 'body' | 'tags';
type ButtonName = 'submit';

export class EditorPage extends BasePage<FieldName, ButtonName> {
  protected readonly root = this.page.getByPlaceholder('Article Title');

  protected readonly fields: Record<FieldName, Locator> = {
    title: this.page.getByPlaceholder('Article Title'),
    description: this.page.getByPlaceholder("What's this article about?"),
    body: this.page.getByPlaceholder('Write your article (in markdown)'),
    // Tags are entered comma-separated: pressing Enter in this field submits the form.
    tags: this.page.getByPlaceholder('Enter tags'),
  };

  protected readonly buttons: Record<ButtonName, Locator> = {
    submit: this.page.getByRole('button', { name: /Publish Article|Update Article/ }),
  };

  readonly errorMessages: Locator = this.page.locator('.error-messages');
}
