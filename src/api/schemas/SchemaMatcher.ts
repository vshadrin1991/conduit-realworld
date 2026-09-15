import type { JsonSchema } from './Schema';
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
};
