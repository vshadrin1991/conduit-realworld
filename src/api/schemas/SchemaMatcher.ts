import type { APIResponse } from '@playwright/test';
import type { ErrorResponse } from '@/api/responses/errors/ErrorResponse';
import { Schema, type JsonSchema } from './Schema';
import { validateSchema } from './SchemaValidator';

export const schemaMatchers = {
  /**
   * Asserts that a value matches a JSON schema of `Schema`; the failure message lists every field that does not fit.
   * @param received - value to check, normally a model returned by an endpoint helper or a parsed response body
   * @param schema - schema from `Schema`, e.g. `Schema.ARTICLE`
   * @return matcher result for the Playwright expect API
   */
  toMatchSchema(received: unknown, schema: JsonSchema) {
    const errors = validateSchema(received, schema);
    const title = schema.title;
    return {
      name: 'toMatchSchema',
      pass: errors.length === 0,
      message: () =>
        errors.length
          ? `The value does not match the ${title} schema:\n${errors.map((line) => `  - ${line}`).join('\n')}`
          : `The value matches the ${title} schema, but it was expected not to.`,
    };
  },

  /**
   * Asserts that an API response is the documented error: the status (when given), the `Schema.ERROR`
   * shape and `errors.body` containing the message.
   * @param received - raw response of `get(APIClient).response(...)`
   * @param message - text that `errors.body` must contain
   * @param statusCode - expected status; skipped when omitted
   * @return matcher result for the Playwright expect API
   */
  async toBeApiError(received: APIResponse, message: string, statusCode?: number) {
    const status = received.status();
    let body: ErrorResponse | null = null;
    const problems: string[] = [];
    try {
      body = (await received.json()) as ErrorResponse;
    } catch (error) {
      problems.push(`body is not JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (body) problems.push(...validateSchema(body, Schema.ERROR));
    if (statusCode !== undefined && status !== statusCode) {
      problems.push(`status ${status}, expected ${statusCode}`);
    }
    const messages = body?.errors?.body ?? [];
    if (!messages.some((line) => line.includes(message))) {
      problems.push(`errors.body ${JSON.stringify(messages)} does not contain "${message}"`);
    }
    return {
      name: 'toBeApiError',
      pass: problems.length === 0,
      message: () =>
        problems.length
          ? `The response is not the expected API error "${message}":\n${problems.map((line) => `  - ${line}`).join('\n')}`
          : `The response is the API error "${message}", but it was expected not to be.`,
    };
  },
};
