/**
 * Common functional contract shared by all page objects (implemented once in `BasePage`).
 *
 * Elements are addressed by name instead of by locator: every page declares string-literal unions for its
 * fields, buttons, checkboxes and radio buttons and maps each name to a locator. The names are type-checked,
 * so `loginPage.fillData('email', ...)` compiles while `loginPage.fillData('title', ...)` does not.
 *
 * Like the Java `FunctionalPage<P>`, every method returns the page itself, so calls chain. The calls are queued
 * and run in order when the chain is awaited:
 * `await get(LoginPage, Route.login).fillData('email', email).fillData('password', password).clickActionButton('login')`
 *
 * @typeParam FieldName       names of inputs/textareas of the page
 * @typeParam ButtonName      names of clickable action elements (buttons, action links, tabs)
 * @typeParam CheckboxName    names of checkboxes
 * @typeParam RadioButtonName names of radio buttons
 */
export interface FunctionalPage<
  FieldName extends string = never,
  ButtonName extends string = never,
  CheckboxName extends string = never,
  RadioButtonName extends string = never,
> extends PromiseLike<void> {
  /* ---------- Input / form data ---------- */

  /**
   * Types data into the field (replaces the current value).
   * @param field - name of the field
   * @param data - value to enter
   * @return current page instance
   */
  fillData(field: FieldName, data: string | number): this;

  /* ---------- Buttons ---------- */

  /**
   * Clicks the action element.
   * @param button - name of the action element
   * @return current page instance
   */
  clickActionButton(button: ButtonName): this;

  /* ---------- Checkboxes ---------- */

  /**
   * Checks one or more checkboxes (idempotent: no-op when already checked).
   * @param checkboxes - names of the checkboxes
   * @return current page instance
   */
  checkCheckbox(...checkboxes: CheckboxName[]): this;

  /**
   * Unchecks one or more checkboxes (idempotent: no-op when already unchecked).
   * @param checkboxes - names of the checkboxes
   * @return current page instance
   */
  uncheckCheckbox(...checkboxes: CheckboxName[]): this;

  /**
   * Asserts the checked state of the checkbox.
   * @param checkbox - name of the checkbox
   * @param checked - expected state
   * @return current page instance
   */
  verifyCheckboxStatus(checkbox: CheckboxName, checked: boolean): this;

  /* ---------- Radio buttons ---------- */

  /**
   * Selects the radio button.
   * @param radioButton - name of the radio button
   * @return current page instance
   */
  clickRadioButton(radioButton: RadioButtonName): this;

  /**
   * Asserts the selected state of the radio button.
   * @param radioButton - name of the radio button
   * @param checked - expected state
   * @return current page instance
   */
  verifyRadioButtonStatus(radioButton: RadioButtonName, checked: boolean): this;

  /* ---------- Verifications ---------- */

  /**
   * Asserts the current value of the field.
   * @param field - name of the field
   * @param value - expected value
   * @return current page instance
   */
  verifyFieldData(field: FieldName, value: string | number): this;

  /**
   * Asserts presence or absence of the validation error for the field.
   * @param field - name of the field
   * @param exist - `true` the error must be visible, `false` hidden or absent
   * @return current page instance
   */
  verifyErrorField(field: FieldName, exist: boolean): this;

  /**
   * Asserts the validation error text shown for the field.
   * @param field - name of the field
   * @param errorMessage - expected error text
   * @return current page instance
   */
  verifyErrorFieldText(field: FieldName, errorMessage: string): this;

  /**
   * Asserts the element is visible or hidden/absent.
   * @param element - name of a field, button, checkbox or radio button
   * @param exist - `true` the element must be visible, `false` hidden or absent
   * @return current page instance
   */
  verifyElementExist(element: FieldName | ButtonName | CheckboxName | RadioButtonName, exist: boolean): this;
}
