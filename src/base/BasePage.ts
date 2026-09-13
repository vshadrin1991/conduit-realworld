import { expect, test, type Locator, type Page } from '@playwright/test';
import { Button } from '@/pageObject/components/Button';
import { Checkbox } from '@/pageObject/components/Checkbox';
import { Header } from '@/pageObject/components/Header';
import { Input } from '@/pageObject/components/Input';
import { RadioButton } from '@/pageObject/components/RadioButton';
import { Text } from '@/pageObject/components/Text';
import { createLogger } from '@/utilities/logger/logger';
import type { FunctionalPage } from './FunctionalPage';

interface StepLocation {
  file: string;
  line: number;
  column: number;
}

/**
 * The first stack frame outside the framework base classes — the spec line that queued the step.
 * @return location of the calling spec line, or `undefined` when the stack has no such frame
 */
function callerLocation(): StepLocation | undefined {
  for (const frame of new Error().stack?.split('\n').slice(1) ?? []) {
    const match = frame.match(/\(?((?:\/|[A-Za-z]:\\)[^():]+):(\d+):(\d+)\)?$/);
    if (!match) continue;
    const [, file, line, column] = match;
    if (/[\\/]src[\\/]base[\\/]|node_modules/.test(file)) continue;
    return { file, line: Number(line), column: Number(column) };
  }
  return undefined;
}

/**
 * Runs `action` as a report step (or directly when no test is running).
 * @param title - step title shown in the report
 * @param action - page action to run
 * @param location - spec line the step and its error point to
 * @return promise resolved when the action has finished
 */
async function runStep(title: string, action: () => Promise<void>, location?: StepLocation): Promise<void> {
  const run = async () => {
    try {
      await action();
    } catch (error) {
      // Queued actions run after the spec line has returned, so its frame is not in the stack:
      // point the error at the line that queued the step, which reporters show as the code frame.
      if (location && error instanceof Error) {
        error.stack = `${error.message}\n    at ${location.file}:${location.line}:${location.column}`;
      }
      throw error;
    }
  };
  try {
    test.info();
  } catch {
    return run(); // outside of a running test
  }
  await test.step(title, run, { location });
}

/**
 * Base for every page object. Obtain pages in tests through `get(PageClass)` / `get(PageClass, route)`.
 * - `root` must be an element that exists only when the page is rendered; it is used to wait for the page.
 * - Pages only declare locators: named elements in `fields`, `buttons`, `checkboxes`, `radioButtons`, `errors`
 *   and read-only content as public locators. No multi-step business methods.
 * - Page actions are fluent: each call is queued and returns the page; awaiting the page (the chain) runs the
 *   queued actions in order, each as a report step located at the spec line that queued it.
 * - Element components (`input`, `button`, `checkbox`, `radioButton`, `text`) are exposed on the page; tests call
 *   them from the page for locators outside the named maps: `await homePage.button.click(homePage.header.userMenu)`,
 *   `await articlePage.text.getTexts(articlePage.tags)`.
 */
export abstract class BasePage<
  FieldName extends string = never,
  ButtonName extends string = never,
  CheckboxName extends string = never,
  RadioButtonName extends string = never,
> implements FunctionalPage<FieldName, ButtonName, CheckboxName, RadioButtonName>
{
  /** Top navigation bar shared by all pages. */
  readonly header: Header;

  readonly log = createLogger(this.constructor.name);
  /** Input helper for any locator: `page.input.enter(locator, text)`. */
  readonly input: Input;
  /** Button helper for any locator: `page.button.click(locator)`. */
  readonly button: Button;
  /** Checkbox helper for any locator: `page.checkbox.check(locator)`. */
  readonly checkbox: Checkbox;
  /** Radio button helper for any locator: `page.radioButton.click(locator)`. */
  readonly radioButton: RadioButton;
  /** Text helper for any locator: `page.text.getTexts(page.tags)`. */
  readonly text: Text;

  protected abstract readonly root: Locator;

  protected readonly fields = {} as Record<FieldName, Locator>;
  /** Validation error locators by field name (only fields that show errors). */
  protected readonly errors = {} as Partial<Record<FieldName, Locator>>;
  protected readonly buttons = {} as Record<ButtonName, Locator>;
  protected readonly checkboxes = {} as Record<CheckboxName, Locator>;
  protected readonly radioButtons = {} as Record<RadioButtonName, Locator>;

  /** Actions queued by chained calls and not awaited yet. */
  private queue: Promise<void> = Promise.resolve();

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
  }

  /* ---------- Chaining ---------- */

  /**
   * Runs the queued actions. Resolves with `void` — never with the page itself, because resolving a promise
   * with a thenable object would await it again endlessly.
   * @param onFulfilled - callback invoked when all queued actions have finished
   * @param onRejected - callback invoked with the error of the first failed action
   * @return promise of the callback result
   */
  then<TResult1 = void, TResult2 = never>(
    onFulfilled?: ((value: void) => TResult1 | PromiseLike<TResult1>) | null,
    onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    const pending = this.queue;
    this.queue = Promise.resolve();
    return pending.then(onFulfilled, onRejected);
  }

  /**
   * Queues `action` as a named report step.
   * @param title - step title without the class name, e.g. `fillData(title)`
   * @param action - page action to run when the chain is awaited
   * @return current page instance
   */
  protected enqueue(title: string, action: () => Promise<void>): this {
    const location = callerLocation();
    const stepTitle = `${this.constructor.name}.${title}`;
    this.queue = this.queue.then(() => runStep(stepTitle, action, location));
    return this;
  }

  /**
   * Waits for queued actions; call it first in non-chainable async page helpers.
   * @return promise resolved when all queued actions have finished
   */
  protected async settled(): Promise<void> {
    await this;
  }

  /* ---------- Navigation ---------- */

  /**
   * Opens a hash route unless already there, then waits for the page to render.
   * @param route - hash route to navigate to, e.g. `Route.article(slug)`
   * @return current page instance
   */
  navigate(route: string): this {
    return this.enqueue(`navigate(${route})`, async () => {
      const target = `/#${route}`;
      if (!this.page.url().endsWith(target)) {
        this.log.info(`Navigate to ${target}`);
        await this.page.goto(target);
      }
      await expect(this.root).toBeVisible();
    });
  }

  /**
   * Waits until the page is rendered (its `root` is visible); use after an action that navigates to this page.
   * @return current page instance
   */
  waitUntilPageLoaded(): this {
    return this.enqueue('waitUntilPageLoaded()', async () => {
      await expect(this.root).toBeVisible();
    });
  }

  /* ---------- FunctionalPage ---------- */

  /**
   * Types data into a named field, replacing its current value (password values are masked in logs).
   * @param field - name of the field declared in `fields`
   * @param data - value to enter
   * @return current page instance
   */
  fillData(field: FieldName, data: string | number): this {
    return this.enqueue(`fillData(${field})`, async () => {
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
    return this.enqueue(`clickActionButton(${button})`, async () => {
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
    return this.enqueue(`checkCheckbox(${checkboxes.join(', ')})`, async () => {
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
    return this.enqueue(`uncheckCheckbox(${checkboxes.join(', ')})`, async () => {
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
    return this.enqueue(`verifyCheckboxStatus(${checkbox}, ${checked})`, async () => {
      await this.checkbox.verifyStatus(this.resolve(this.checkboxes, checkbox, 'checkbox'), checked);
    });
  }

  /**
   * Selects a named radio button; an already selected one is left as it is.
   * @param radioButton - name of the radio button declared in `radioButtons`
   * @return current page instance
   */
  clickRadioButton(radioButton: RadioButtonName): this {
    return this.enqueue(`clickRadioButton(${radioButton})`, async () => {
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
    return this.enqueue(`verifyRadioButtonStatus(${radioButton}, ${checked})`, async () => {
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
    return this.enqueue(`verifyFieldData(${field})`, async () => {
      await this.input.verifyValue(this.resolve(this.fields, field, 'field'), value);
    });
  }

  /**
   * Asserts that the validation error of a named field is shown or hidden.
   * @param field - name of the field declared in `errors`
   * @param exist - `true` the error must be visible, `false` hidden or absent
   * @return current page instance
   */
  verifyErrorField(field: FieldName, exist: boolean): this {
    return this.enqueue(`verifyErrorField(${field}, ${exist})`, async () => {
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
    return this.enqueue(`verifyErrorFieldText(${field})`, async () => {
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
    return this.enqueue(`verifyElementExist(${element}, ${exist})`, async () => {
      const all = { ...this.fields, ...this.buttons, ...this.checkboxes, ...this.radioButtons } as Partial<
        Record<FieldName | ButtonName | CheckboxName | RadioButtonName, Locator>
      >;
      const locator = this.resolve(all, element, 'element');
      if (exist) await expect(locator).toBeVisible();
      else await expect(locator).toBeHidden();
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
