# Code conventions

Part of the [playwright-ts-test-implementation](../SKILL.md) skill. Paths like `assets/…` and `scripts/…` are relative to the skill folder.

Read when adding public methods to base classes, helpers, flows or components.

## Documentation comments

Public and protected methods of base classes (`BaseTest`, `BasePage`, `FunctionalPage`, `BaseComponent`) — and new helpers, flows and components — get a JSDoc block: one sentence on what it does, then `@param name - meaning` for every parameter and `@return` for the result. Chainable page actions return `current page instance`:

```ts
/**
 * Opens a hash route unless already there, then waits for the page to render.
 * @param route - hash route to navigate to, e.g. `Route.article(slug)`
 * @return current page instance
 */
navigate(route: string): this {
```
