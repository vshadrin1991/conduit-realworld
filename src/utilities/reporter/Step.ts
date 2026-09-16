import { test } from '@playwright/test';

interface StepLocation {
  file: string;
  line: number;
  column: number;
}

/**
 * The first stack frame outside this helper and the framework base classes — the spec line that called the page
 * method. Without it a failed step is reported inside `BasePage` instead of at the line the test author wrote.
 * @return location of the calling spec line, or `undefined` when the stack has no such frame
 */
function callerLocation(): StepLocation | undefined {
  const prepare = Error.prepareStackTrace;
  Error.prepareStackTrace = (_, frames) => frames;
  const holder = {} as { stack?: NodeJS.CallSite[] };
  Error.captureStackTrace(holder, inStep);
  const frames = holder.stack ?? [];
  Error.prepareStackTrace = prepare;
  for (const frame of frames) {
    const file = frame.getFileName();
    if (!file || /[\\/]src[\\/]base[\\/]|node_modules|^node:/.test(file)) continue;
    return { file, line: frame.getLineNumber() ?? 0, column: frame.getColumnNumber() ?? 0 };
  }
  return undefined;
}

/**
 * Runs `action` as a report step named `title`, or directly when no test is running. The step and the error of a
 * failed action are reported at the spec line that called it, not inside the framework.
 * @param title - step title shown in the report, e.g. `ArticlePage.fillData(comment)`
 * @param action - action to run inside the step
 * @return promise resolved when the action has finished
 */
export async function inStep(title: string, action: () => Promise<void>): Promise<void> {
  const location = callerLocation();
  const run = async () => {
    try {
      await action();
    } catch (error) {
      if (location && error instanceof Error) {
        error.stack = `${error.message}\n    at ${location.file}:${location.line}:${location.column}`;
      }
      throw error;
    }
  };
  try {
    test.info();
  } catch {
    return run();
  }
  await test.step(title, run, { location });
}
