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
import { inStep } from '@/utilities/reporter/Step';

/**
 * Base for every page object. Obtain pages in tests through `get(PageClass)` / `get(PageClass, route)`.
 * - `root` must be an element that exists only when the page is rendered; it is used to wait for the page.
 * - Pages only declare locators: named elements in `fields`, `buttons`, `checkboxes`, `radioButtons`, `errors`
 *   and read-only content as public locators. No multi-step business methods.
 * - Every page action is async and must be awaited on its own; each runs as a report step named after the page and
 *   the call (`ArticlePage.fillData(comment)`) and reported at the spec line that called it.
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
   * Runs `action` as a named report step.
   * @param title - step title without the class name, e.g. `fillData(title)`
   * @param action - page action to run
   * @return promise resolved when the action has finished
   */
  protected async step(title: string, action: () => Promise<void>): Promise<void> {
    return inStep(`${this.constructor.name}.${title}`, action);
  }

  /**
   * Opens a hash route unless already there, then waits for the page to render.
   * @param route - hash route to navigate to, e.g. `Route.article(slug)`
   * @return promise resolved when the action has finished
   */
  async navigate(route: string): Promise<void> {
    return this.step(`navigate(${route})`, async () => {
      await this.navigation.to(route);
      await expect(this.root).toBeVisible();
    });
  }

  /**
   * Waits until the page is rendered (its `root` is visible); use after an action that navigates to this page.
   * @return promise resolved when the action has finished
   */
  async waitUntilPageLoaded(): Promise<void> {
    return this.step('waitUntilPageLoaded()', async () => {
      await expect(this.root).toBeVisible();
    });
  }

  /**
   * Types data into a named field, replacing its current value (password values are masked in logs).
   * @param field - name of the field declared in `fields`
   * @param data - value to enter
   * @return promise resolved when the action has finished
   */
  async fillData(field: FieldName, data: string | number): Promise<void> {
    return this.step(`fillData(${field})`, async () => {
      this.log.info(`Fill "${field}"${/password/i.test(field) ? '' : ` with "${data}"`}`);
      await this.input.enter(this.resolve(this.fields, field, 'field'), data);
    });
  }

  /**
   * Clicks a named action element.
   * @param button - name of the element declared in `buttons`
   * @return promise resolved when the action has finished
   */
  async clickActionButton(button: ButtonName): Promise<void> {
    return this.step(`clickActionButton(${button})`, async () => {
      this.log.info(`Click "${button}"`);
      await this.button.click(this.resolve(this.buttons, button, 'button'));
    });
  }

  /**
   * Checks named checkboxes; already checked ones are left as they are.
   * @param checkboxes - names of the checkboxes declared in `checkboxes`
   * @return promise resolved when the action has finished
   */
  async checkCheckbox(...checkboxes: CheckboxName[]): Promise<void> {
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
   * @return promise resolved when the action has finished
   */
  async uncheckCheckbox(...checkboxes: CheckboxName[]): Promise<void> {
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
   * @return promise resolved when the action has finished
   */
  async verifyCheckboxStatus(checkbox: CheckboxName, checked: boolean): Promise<void> {
    return this.step(`verifyCheckboxStatus(${checkbox}, ${checked})`, async () => {
      await this.checkbox.verifyStatus(this.resolve(this.checkboxes, checkbox, 'checkbox'), checked);
    });
  }

  /**
   * Selects a named radio button; an already selected one is left as it is.
   * @param radioButton - name of the radio button declared in `radioButtons`
   * @return promise resolved when the action has finished
   */
  async clickRadioButton(radioButton: RadioButtonName): Promise<void> {
    return this.step(`clickRadioButton(${radioButton})`, async () => {
      this.log.info(`Select "${radioButton}"`);
      await this.radioButton.click(this.resolve(this.radioButtons, radioButton, 'radio button'));
    });
  }

  /**
   * Asserts the selected state of a named radio button.
   * @param radioButton - name of the radio button declared in `radioButtons`
   * @param checked - expected state: `true` selected, `false` not selected
   * @return promise resolved when the action has finished
   */
  async verifyRadioButtonStatus(radioButton: RadioButtonName, checked: boolean): Promise<void> {
    return this.step(`verifyRadioButtonStatus(${radioButton}, ${checked})`, async () => {
      await this.radioButton.verifyStatus(this.resolve(this.radioButtons, radioButton, 'radio button'), checked);
    });
  }

  /**
   * Asserts the current value of a named field.
   * @param field - name of the field declared in `fields`
   * @param value - expected value
   * @return promise resolved when the action has finished
   */
  async verifyFieldData(field: FieldName, value: string | number): Promise<void> {
    return this.step(`verifyFieldData(${field})`, async () => {
      await this.input.verifyValue(this.resolve(this.fields, field, 'field'), value);
    });
  }

  /**
   * Asserts the value of an attribute of a named field, e.g. the input type behind the placeholder.
   * @param field - name of the field declared in `fields`
   * @param attribute - attribute name, e.g. `type`
   * @param value - expected attribute value
   * @return promise resolved when the action has finished
   */
  async verifyFieldAttribute(field: FieldName, attribute: string, value: string | RegExp): Promise<void> {
    return this.step(`verifyFieldAttribute(${field}, ${attribute})`, async () => {
      const input = await this.input.getInput(this.resolve(this.fields, field, 'field'));
      await expect(input).toHaveAttribute(attribute, value);
    });
  }

  /**
   * Asserts that the validation error of a named field is shown or hidden.
   * @param field - name of the field declared in `errors`
   * @param exist - `true` the error must be visible, `false` hidden or absent
   * @return promise resolved when the action has finished
   */
  async verifyErrorField(field: FieldName, exist: boolean): Promise<void> {
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
   * @return promise resolved when the action has finished
   */
  async verifyErrorFieldText(field: FieldName, errorMessage: string): Promise<void> {
    return this.step(`verifyErrorFieldText(${field})`, async () => {
      await expect(this.resolve(this.errors, field, 'error')).toHaveText(errorMessage);
    });
  }

  /**
   * Asserts that a named element of any group is visible or hidden.
   * @param element - name of a field, button, checkbox or radio button
   * @param exist - `true` the element must be visible, `false` hidden or absent
   * @return promise resolved when the action has finished
   */
  async verifyElementExist(
    element: FieldName | ButtonName | CheckboxName | RadioButtonName,
    exist: boolean,
  ): Promise<void> {
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
   * Asserts that every given element is visible, e.g. header links that are not in the page's named maps.
   * @param elements - locators of the elements
   * @return promise resolved when the action has finished
   */
  async verifyElementIsVisible(...elements: Locator[]): Promise<void> {
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
