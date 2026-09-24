import { test } from '@playwright/test';

export interface StepLocation {
  file: string;
  line: number;
  column: number;
}

/**
 * The first stack frame outside the framework base classes and this reporter — the spec line that called the
 * page method. Without it a failed step is reported inside `BasePage` instead of at the line the test author
 * wrote.
 * @return location of the calling spec line, or `undefined` when the stack has no such frame
 */
export function callerLocation(): StepLocation | undefined {
  const holder = {} as { stack?: string };
  Error.captureStackTrace(holder, callerLocation);
  for (const frame of (holder.stack ?? '').split('\n').slice(1)) {
    const match = /^\s*at (?:.*? \()?(.+?):(\d+):(\d+)\)?$/.exec(frame);
    if (!match) continue;
    const [, file, line, column] = match;
    if (/[\\/]src[\\/](base|utilities[\\/]reporter)[\\/]|node_modules|^node:/.test(file)) continue;
    return { file, line: Number(line), column: Number(column) };
  }
  return undefined;
}

/**
 * Runs `action` as a report step named `title`, or directly when no test is running. The step and the error of a
 * failed action are reported at the spec line that called it, not inside the framework.
 * @param title - step title shown in the report, e.g. `ArticlePage.fillData(comment)`
 * @param action - action to run inside the step
 * @param location - spec line to report the step at, captured when the step is queued; the caller of `inStep` by default
 * @return promise resolved when the action has finished
 */
export async function inStep(
  title: string,
  action: () => Promise<void>,
  location: StepLocation | undefined = callerLocation(),
): Promise<void> {
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
