import fs from 'node:fs';
import path from 'node:path';
import { stripVTControlCharacters } from 'node:util';
import type { FullConfig, Reporter, Suite, TestCase, TestResult } from '@playwright/test/reporter';
import type { ConsoleEntry } from '../interceptor/entry/ConsoleEntry';
import type { NetworkEntry } from '../interceptor/entry/NetworkEntry';

type Attachment = TestResult['attachments'][number];

export interface ArtifactEntry {
  fileName: string;
  testName: string;
  project: string;
  line: number;
  status: TestResult['status'] | 'flaky';
  error: string | null;
  image: string | null;
  video: string | null;
  html: string | null;
  network: NetworkEntry[];
  console: ConsoleEntry[];
}

export interface ArtifactsReporterOptions {
  outputFile: string;
}

export default class ArtifactsReporter implements Reporter {
  private rootSuite?: Suite;
  private rootDir = process.cwd();

  /**
   * Creates the reporter with the options from `playwright.config.ts`.
   * @param options - `outputFile`: path of the JSON file to write
   */
  constructor(private readonly options: ArtifactsReporterOptions) {}

  /**
   * Remembers the test tree and the project root that artifact paths are made relative to.
   * @param config - resolved config of the run
   * @param suite - root suite with every test of the run
   */
  onBegin(config: FullConfig, suite: Suite): void {
    this.rootSuite = suite;
    if (config.configFile) this.rootDir = path.dirname(config.configFile);
  }

  /**
   * Collects the failed and flaky tests of the run and writes them to the output file.
   */
  onEnd(): void {
    const entries = (this.rootSuite?.allTests() ?? [])
      .filter((test) => test.outcome() === 'unexpected' || test.outcome() === 'flaky')
      .map((test) => this.entry(test))
      .filter((entry): entry is ArtifactEntry => !!entry);
    fs.mkdirSync(path.dirname(this.options.outputFile), { recursive: true });
    fs.writeFileSync(this.options.outputFile, `${JSON.stringify(entries, null, 2)}\n`);
  }

  /**
   * Keeps the reporter silent so the console output of the other reporters stays unchanged.
   * @return `false`
   */
  printsToStdio(): boolean {
    return false;
  }

  /**
   * Builds the entry of a failed or flaky test from its last failed attempt.
   * @param test - test with an unexpected or flaky outcome
   * @return artifact entry, or `undefined` when no attempt failed
   */
  private entry(test: TestCase): ArtifactEntry | undefined {
    const result = test.results.findLast((item) => item.status !== test.expectedStatus);
    if (!result) return undefined;
    const messages = [
      ...new Set(result.errors.map((error) => stripVTControlCharacters(error.message ?? error.value ?? ''))),
    ].filter(Boolean);
    return {
      fileName: this.relative(test.location.file),
      testName: test.titlePath().slice(3).join(' › '),
      project: test.parent.project()?.name ?? '',
      line: test.location.line,
      status: test.outcome() === 'flaky' ? 'flaky' : result.status,
      error: messages.length ? messages.join('\n') : null,
      image:
        this.attachment(result, (item) => item.name === 'screenshot') ??
        this.attachment(result, (item) => item.contentType.startsWith('image/')),
      video: this.attachment(result, (item) => item.name === 'video'),
      html: this.attachment(result, (item) => item.name === 'dom'),
      ...this.capture(result),
    };
  }

  /**
   * Reads the API calls and console entries that BaseTest attached to a failed attempt as `interceptor`.
   * @param result - attempt of the test
   * @return captured `network` and `console` entries, empty when nothing was attached
   */
  private capture(result: TestResult): Pick<ArtifactEntry, 'network' | 'console'> {
    const body = result.attachments.find((item) => item.name === 'interceptor' && item.body)?.body;
    if (!body) return { network: [], console: [] };
    try {
      const parsed = JSON.parse(body.toString()) as Partial<Pick<ArtifactEntry, 'network' | 'console'>>;
      return { network: parsed.network ?? [], console: parsed.console ?? [] };
    } catch {
      return { network: [], console: [] };
    }
  }

  /**
   * Finds the first attachment of an attempt that has a file and matches the condition.
   * @param result - attempt of the test
   * @param match - condition for the attachment, e.g. by name or content type
   * @return path relative to the project root, or `null` when there is no such file
   */
  private attachment(result: TestResult, match: (item: Attachment) => boolean): string | null {
    const found = result.attachments.find((item) => item.path && match(item));
    return found?.path ? this.relative(found.path) : null;
  }

  /**
   * Makes a path relative to the project root, with forward slashes on every OS.
   * @param file - absolute path
   * @return relative path
   */
  private relative(file: string): string {
    return path.relative(this.rootDir, file).split(path.sep).join('/');
  }
}
