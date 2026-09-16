import { BaseComponent } from './BaseComponent';

export class Navigation extends BaseComponent {
  /**
   * Opens the hash route of the app unless the page is already there.
   * @param route - hash route to open, e.g. `Route.article(slug)`
   * @return promise resolved when the page is at the route
   */
  async to(route: string): Promise<void> {
    const target = `/#${route}`;
    if (this.page.url().endsWith(target)) return;
    this.log.info(`Navigate to ${target}`);
    await this.page.goto(target);
  }
}
