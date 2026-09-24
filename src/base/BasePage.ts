import { expect, type Locator, type Page } from '@playwright/test';
import { Button } from '@/pageObject/components/Button';
import { Checkbox } from '@/pageObject/components/Checkbox';
import { Confirmation } from '@/pageObject/components/Confirmation';
import { Header } from '@/pageObject/components/Header';
import { Input } from '@/pageObject/components/Input';
import { Navigation } from '@/pageObject/components/Navigation';
import { RadioButton } from '@/pageObject/components/RadioButton';
import { Text } from '@/pageObject/components/Text';
import { createLogger } from '@/utilities/logger/Logger';
import { callerLocation, inStep } from '@/utilities/reporter/Step';

const queues = new WeakMap<Page, Promise<void>>();

/**
 * Base for every page object. Obtain pages in tests through `get(PageClass)` / `get(PageClass, route)`.
 * - `root` must be an element that exists only when the page is rendered; it is used to wait for the page.
 * - Pages only declare locators: named elements in `fields`, `buttons`, `checkboxes`, `radioButtons`, `errors`
 *   and read-only content as public locators. No multi-step business methods.
 * - Page actions return the page, so steps chain and the chain is awaited once:
 *   `await get(EditorPage, Route.newArticle).fillData('title', title).clickActionButton('submit')`;
 *   `.next(ArticlePage)` continues on the page a click lands on. Each action runs as a report step named after the
 *   page and the call (`ArticlePage.fillData(comment)`) and reported at the spec line that called it.
 * - Element components (`input`, `button`, `checkbox`, `radioButton`, `text`) and `navigation` are exposed on the
 *   page; tests call them from the page for locators outside the named maps:
 *   `await homePage.button.click(homePage.header.userMenu)`, `await articlePage.text.getTexts(articlePage.tags)`.
 * - Native dialogs are answered through the page as well: `articlePage.confirmation.answerNext('accept')`.
 */
export abstract class BasePage<
  FieldName extends string = never,
  ButtonName extends string = never,
  CheckboxName extends string = never,
  RadioButtonName extends string = never,
> {
  readonly header: Header;

  readonly log = createLogger(this.constructor.name);
  readonly input: Input;
  readonly button: Button;
  readonly checkbox: Checkbox;
  readonly radioButton: RadioButton;
  readonly text: Text;
  readonly confirmation: Confirmation;
  readonly navigation: Navigation;

  protected abstract readonly root: Locator;

  protected readonly fields = {} as Record<FieldName, Locator>;
  protected readonly errors = {} as Partial<Record<FieldName, Locator>>;
  protected readonly buttons = {} as Record<ButtonName, Locator>;
  protected readonly checkboxes = {} as Record<CheckboxName, Locator>;
  protected readonly radioButtons = {} as Record<RadioButtonName, Locator>;

  /**
   * @param page - Playwright page the page object acts on
   */
  constructor(readonly page: Page) {
    this.header = new Header(page);
    this.input = new Input(page);
    this.button = new Button(page);
    this.checkbox = new Checkbox(page);
    this.radioButton = new RadioButton(page);
    this.text = new Text(page);
    this.confirmation = new Confirmation(page);
    this.navigation = new Navigation(page);
  }

  /**
   * Queues `action` as a named report step after the actions already queued on the browser page.
   * @param title - step title without the class name, e.g. `fillData(title)`
   * @param action - page action to run
   * @return current page instance
   */
  protected step(title: string, action: () => Promise<void>): this {
    const location = callerLocation();
    const queued = queues.get(this.page) ?? Promise.resolve();
    queues.set(
      this.page,
      queued.then(() => inStep(`${this.constructor.name}.${title}`, action, location)),
    );
    return this;
  }

  /**
   * Runs the actions queued on the browser page, so a chain is awaited once:
   * `await get(EditorPage, Route.newArticle).fillData('title', title).clickActionButton('submit')`.
   * @param onFulfilled - called when every queued action has passed
   * @param onRejected - called with the error of the first failed action; the actions after it are skipped
   * @return promise of the callback result
   */
  then<TResult1 = void, TResult2 = never>(
    onFulfilled?: ((value: void) => TResult1 | PromiseLike<TResult1>) | null,
    onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    const queued = queues.get(this.page) ?? Promise.resolve();
    queues.delete(this.page);
    return queued.then(onFulfilled, onRejected);
  }

  /**
   * Continues the chain on another page object of the same browser page, e.g. after a click that navigates:
   * `.clickActionButton('submit').next(ArticlePage).waitUntilPageLoaded()`.
   * @param pageClass - page object class to continue with
   * @return page object whose actions run after the ones already queued
   */
  next<T extends BasePage<string, string, string, string>>(pageClass: new (page: Page) => T): T {
    return new pageClass(this.page);
  }

  /**
   * Opens a hash route unless already there, then waits for the page to render.
   * @param route - hash route to navigate to, e.g. `Route.article(slug)`
   * @return current page instance
   */
  navigate(route: string): this {
    return this.step(`navigate(${route})`, async () => {
      await this.navigation.to(route);
      await expect(this.root).toBeVisible();
    });
  }

  /**
   * Waits until the page is rendered (its `root` is visible); use after an action that navigates to this page.
   * @return current page instance
   */
  waitUntilPageLoaded(): this {
    return this.step('waitUntilPageLoaded()', async () => {
      await expect(this.root).toBeVisible();
    });
  }

  /**
   * Types data into a named field, replacing its current value (password values are masked in logs).
   * @param field - name of the field declared in `fields`
   * @param data - value to enter
   * @return current page instance
   */
  fillData(field: FieldName, data: string | number): this {
    return this.step(`fillData(${field})`, async () => {
      this.log.info(`Fill "${field}"${/password/i.test(field) ? '' : ` with "${data}"`}`);
      await this.input.enter(this.resolve(this.fields, field, 'field'), data);
    });
  }

  /**
   * Clicks a named action element.
   * @param button - name of the element declared in `buttons`
   * @return current page instance
   */
  clickActionButton(button: ButtonName): this {
    return this.step(`clickActionButton(${button})`, async () => {
      this.log.info(`Click "${button}"`);
      await this.button.click(this.resolve(this.buttons, button, 'button'));
    });
  }

  /**
   * Checks named checkboxes; already checked ones are left as they are.
   * @param checkboxes - names of the checkboxes declared in `checkboxes`
   * @return current page instance
   */
  checkCheckbox(...checkboxes: CheckboxName[]): this {
    return this.step(`checkCheckbox(${checkboxes.join(', ')})`, async () => {
      for (const checkbox of checkboxes) {
        this.log.info(`Check "${checkbox}"`);
        await this.checkbox.check(this.resolve(this.checkboxes, checkbox, 'checkbox'));
      }
    });
  }

  /**
   * Unchecks named checkboxes; already unchecked ones are left as they are.
   * @param checkboxes - names of the checkboxes declared in `checkboxes`
   * @return current page instance
   */
  uncheckCheckbox(...checkboxes: CheckboxName[]): this {
    return this.step(`uncheckCheckbox(${checkboxes.join(', ')})`, async () => {
      for (const checkbox of checkboxes) {
        this.log.info(`Uncheck "${checkbox}"`);
        await this.checkbox.uncheck(this.resolve(this.checkboxes, checkbox, 'checkbox'));
      }
    });
  }

  /**
   * Asserts the checked state of a named checkbox.
   * @param checkbox - name of the checkbox declared in `checkboxes`
   * @param checked - expected state: `true` checked, `false` unchecked
   * @return current page instance
   */
  verifyCheckboxStatus(checkbox: CheckboxName, checked: boolean): this {
    return this.step(`verifyCheckboxStatus(${checkbox}, ${checked})`, async () => {
      await this.checkbox.verifyStatus(this.resolve(this.checkboxes, checkbox, 'checkbox'), checked);
    });
  }

  /**
   * Selects a named radio button; an already selected one is left as it is.
   * @param radioButton - name of the radio button declared in `radioButtons`
   * @return current page instance
   */
  clickRadioButton(radioButton: RadioButtonName): this {
    return this.step(`clickRadioButton(${radioButton})`, async () => {
      this.log.info(`Select "${radioButton}"`);
      await this.radioButton.click(this.resolve(this.radioButtons, radioButton, 'radio button'));
    });
  }

  /**
   * Asserts the selected state of a named radio button.
   * @param radioButton - name of the radio button declared in `radioButtons`
   * @param checked - expected state: `true` selected, `false` not selected
   * @return current page instance
   */
  verifyRadioButtonStatus(radioButton: RadioButtonName, checked: boolean): this {
    return this.step(`verifyRadioButtonStatus(${radioButton}, ${checked})`, async () => {
      await this.radioButton.verifyStatus(this.resolve(this.radioButtons, radioButton, 'radio button'), checked);
    });
  }

  /**
   * Asserts the current value of a named field.
   * @param field - name of the field declared in `fields`
   * @param value - expected value
   * @return current page instance
   */
  verifyFieldData(field: FieldName, value: string | number): this {
    return this.step(`verifyFieldData(${field})`, async () => {
      await this.input.verifyValue(this.resolve(this.fields, field, 'field'), value);
    });
  }

  /**
   * Asserts the value of an attribute of a named field, e.g. the input type behind the placeholder.
   * @param field - name of the field declared in `fields`
   * @param attribute - attribute name, e.g. `type`
   * @param value - expected attribute value
   * @return current page instance
   */
  verifyFieldAttribute(field: FieldName, attribute: string, value: string | RegExp): this {
    return this.step(`verifyFieldAttribute(${field}, ${attribute})`, async () => {
      const input = await this.input.getInput(this.resolve(this.fields, field, 'field'));
      await expect(input).toHaveAttribute(attribute, value);
    });
  }

  /**
   * Asserts that the validation error of a named field is shown or hidden.
   * @param field - name of the field declared in `errors`
   * @param exist - `true` the error must be visible, `false` hidden or absent
   * @return current page instance
   */
  verifyErrorField(field: FieldName, exist: boolean): this {
    return this.step(`verifyErrorField(${field}, ${exist})`, async () => {
      const error = this.resolve(this.errors, field, 'error');
      if (exist) await expect(error).toBeVisible();
      else await expect(error).toBeHidden();
    });
  }

  /**
   * Asserts the validation error text of a named field.
   * @param field - name of the field declared in `errors`
   * @param errorMessage - expected error text
   * @return current page instance
   */
  verifyErrorFieldText(field: FieldName, errorMessage: string): this {
    return this.step(`verifyErrorFieldText(${field})`, async () => {
      await expect(this.resolve(this.errors, field, 'error')).toHaveText(errorMessage);
    });
  }

  /**
   * Asserts that a named element of any group is visible or hidden.
   * @param element - name of a field, button, checkbox or radio button
   * @param exist - `true` the element must be visible, `false` hidden or absent
   * @return current page instance
   */
  verifyElementExist(element: FieldName | ButtonName | CheckboxName | RadioButtonName, exist: boolean): this {
    return this.step(`verifyElementExist(${element}, ${exist})`, async () => {
      const all = { ...this.fields, ...this.buttons, ...this.checkboxes, ...this.radioButtons } as Partial<
        Record<FieldName | ButtonName | CheckboxName | RadioButtonName, Locator>
      >;
      const locator = this.resolve(all, element, 'element');
      if (exist) await expect(locator).toBeVisible();
      else await expect(locator).toBeHidden();
    });
  }

  /**
   * Compares the accessibility tree of an element with the recorded `src/snapshots/<name>.aria.yml`.
   * @param name - snapshot file name without the extension, e.g. `settings-form`
   * @param element - element to capture, the page root by default
   * @return current page instance
   */
  verifyAriaSnapshot(name: string, element: Locator = this.root): this {
    return this.step(`verifyAriaSnapshot(${name})`, async () => {
      await expect(element).toMatchAriaSnapshot({ name: `${name}.aria.yml` });
    });
  }

  /**
   * Asserts that every given element is visible, e.g. header links that are not in the page's named maps.
   * @param elements - locators of the elements
   * @return current page instance
   */
  verifyElementIsVisible(...elements: Locator[]): this {
    return this.step(`verifyElementIsVisible(${elements.join(', ')})`, async () => {
      for (const element of elements) await expect(element).toBeVisible();
    });
  }

  /**
   * Looks up a named element and fails with a readable message when the page does not declare it.
   * @param elements - element map of the page (`fields`, `buttons`, ...)
   * @param name - element name
   * @param kind - element kind used in the error message
   * @return locator of the element
   */
  private resolve<K extends string>(elements: Partial<Record<K, Locator>>, name: K, kind: string): Locator {
    const locator = elements[name];
    if (!locator) throw new Error(`${this.constructor.name} has no ${kind} named "${name}"`);
    return locator;
  }
}
