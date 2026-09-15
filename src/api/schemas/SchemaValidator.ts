import type { ErrorObject, ValidateFunction } from 'ajv';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { Schema, type JsonSchema } from './Schema';

const ajv = new Ajv2020({ allErrors: true, allowUnionTypes: true });
addFormats(ajv);
for (const schema of Object.values(Schema)) ajv.addSchema(schema);

/**
 * Formats one validation error as a readable line, e.g. `/author/bio must be string,null`.
 * @param error - error reported by the validator
 * @return line naming the field and what is wrong with it
 */
function describe(error: ErrorObject): string {
  const field = error.instancePath || 'the value';
  const property = 'additionalProperty' in error.params ? ` "${String(error.params.additionalProperty)}"` : '';
  const missing = 'missingProperty' in error.params ? ` "${String(error.params.missingProperty)}"` : '';
  return `${field} ${error.message}${property}${missing}`;
}

/**
 * Returns the compiled validator of a schema, reusing the instance registered at startup.
 * @param schema - schema from `Schema`
 * @return validation function of the schema
 */
function validatorOf(schema: JsonSchema): ValidateFunction {
  return ajv.getSchema(schema.$id) ?? ajv.compile(schema);
}

/**
 * Validates a value against a JSON schema of `Schema`.
 * @param data - value to validate, normally a model returned by an endpoint helper or a parsed response body
 * @param schema - schema from `Schema`, e.g. `Schema.ARTICLE`
 * @return readable validation errors, empty when the value matches the schema
 */
export function validateSchema(data: unknown, schema: JsonSchema): string[] {
  const validate = validatorOf(schema);
  return validate(data) ? [] : (validate.errors ?? []).map(describe);
}
