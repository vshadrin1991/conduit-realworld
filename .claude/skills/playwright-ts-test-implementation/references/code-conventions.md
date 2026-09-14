# Code conventions

Part of the [playwright-ts-test-implementation](../SKILL.md) skill. Paths like `assets/…` and `scripts/…` are relative to the skill folder.

Read when adding public methods to base classes, helpers, flows or components, or before writing any comment.

## No comments in code

Code carries no explanatory comments: no `//` comments and no one-line `/** … */` or `/* … */` comments — not on fields, locators, types, config values or functions, and not inside test bodies. Names, types and small functions explain the code; app knowledge goes to [app-behaviour](app-behaviour.md), conventions to the skill references.

Allowed:

- multi-line JSDoc blocks on functions, methods, getters and constructors — the documentation below (no class-level blocks on page objects and utility classes);
- tool directives such as `// eslint-disable-next-line <rule>` and `// @ts-expect-error <reason>`.

A decision that would otherwise need a comment (why a response is mocked, why `.first()` is safe) goes into the task or the pull request description.

## Documentation comments

Every function, method, getter and constructor with parameters — public, protected and private — in base classes (`BaseTest`, `BasePage`, `FunctionalPage`, `BaseComponent`), `src/utilities` (logger, reporter, test data), page objects, helpers, flows and components gets a JSDoc block:

- one sentence on what it does (add a second clause only when the behaviour is not obvious, e.g. when it throws);
- `@param name - meaning` for every parameter, in order; a destructured options object is one `@param` that lists its keys and defaults;
- `@return` with the result whenever it is not `void`, including `undefined`/`null` cases; write `@return`, never `@returns`;
- no rationale, history or conventions in the block — those go to the task, pull request or skill references.

Chainable page actions return `current page instance`:

```ts
/**
 * Opens a hash route unless already there, then waits for the page to render.
 * @param route - hash route to navigate to, e.g. `Route.article(slug)`
 * @return current page instance
 */
navigate(route: string): this {
```

Utility functions and private helpers follow the same shape:

```ts
/**
 * Remembers the test tree and the project root that artifact paths are made relative to.
 * @param config - resolved config of the run
 * @param suite - root suite with every test of the run
 */
onBegin(config: FullConfig, suite: Suite): void {
```

### Page objects

Page classes get no class-level comment, and locator fields and named maps stay without comments; getters and locator-returning methods get a block:

```ts
export class ArticlePage extends BasePage<FieldName, ButtonName> {
  readonly comments: Locator = this.root.locator('.card:not(.comment-form)');

  /**
   * Returns the comment card that contains the text.
   * @param text - text of the comment
   * @return locator of the comment card
   */
  comment(text: string): Locator {
```
