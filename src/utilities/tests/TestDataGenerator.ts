import { faker } from '@faker-js/faker';
import type { NewArticle } from '@/api/request/articles/NewArticle';
import type { NewComment } from '@/api/request/comments/NewComment';
import type { NewUser } from '@/api/request/users/NewUser';
import { envConfig } from '@/config/env.config';

const ALPHANUMERIC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyz';

export const AUTOMATION_TAGS = ['playwright', 'e2e'];

/**
 * Formats a date as `yyyyMMddHHmmss` in UTC.
 * @param date - date to format, now by default
 * @return timestamp digits
 */
function timestamp(date = new Date()): string {
  return date.toISOString().replace(/\D/g, '').slice(0, 14);
}

/**
 * Generates a first name prefixed with the automation key.
 * @return first name
 */
export function generateFirstName(): string {
  return `${envConfig.automationKey}${faker.person.firstName()}`;
}

/**
 * Generates a last name prefixed with the automation key.
 * @return last name
 */
export function generateLastName(): string {
  return `${envConfig.automationKey}${faker.person.lastName()}`;
}

/**
 * Replaces every `?` in the template with a random letter.
 * @param template - text with `?` placeholders, e.g. `user-???`
 * @return filled text
 */
export function generateLetterifyData(template: string): string {
  return template.replace(/\?/g, () => faker.string.alpha());
}

/**
 * Replaces every `#` in the template with a random digit.
 * @param template - text with `#` placeholders, e.g. `+1-###-###`
 * @return filled text
 */
export function generateNumerifyData(template: string): string {
  return template.replace(/#/g, () => String(faker.number.int(9)));
}

/**
 * Generates a random integer from `min` (inclusive) to `max` (exclusive).
 * @param min - lowest possible value
 * @param max - upper bound, never returned
 * @return random integer
 */
export function generateNumber(min: number, max: number): number {
  return faker.number.int({ min, max: max - 1 });
}

/**
 * Generates a unique name `data_automationKey_yyyyMMddHHmmss` with a 4-character random suffix that keeps names
 * unique across parallel workers within the same second.
 * @param data - name prefix, e.g. `Article`
 * @return unique test name
 */
export function generateTestsName(data: unknown): string {
  return `${data}_${envConfig.automationKey}_${timestamp()}${generateStringOfLength(4)}`;
}

/**
 * Generates three random words followed by the automation key.
 * @return test name with spaces
 */
export function generateSeparateTestsName(): string {
  return `${faker.word.words(3)} ${envConfig.automationKey}`;
}

/**
 * Generates a unique name without separators: `data`, automation key, timestamp and a 4-character random suffix.
 * @param data - name prefix, e.g. `user`
 * @return unique test name
 */
export function generateShortTestsName(data: string): string {
  return `${data}${envConfig.automationKey}${timestamp()}${generateStringOfLength(4)}`;
}

/**
 * Generates an ISO date-time without milliseconds, shifted from now.
 * @param shift - `days`, `hours`, `minutes` and `seconds` to add; negative values go back in time
 * @return ISO date-time, e.g. `2026-09-14T10:00:00Z`
 */
export function generateDate({ days = 0, hours = 0, minutes = 0, seconds = 0 } = {}): string {
  const shiftMs = (((days * 24 + hours) * 60 + minutes) * 60 + seconds) * 1000;
  return new Date(Date.now() + shiftMs).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/**
 * Generates a random email address in the `example.com` domain.
 * @return email address
 */
export function generateEmail(): string {
  return `${faker.internet.username().toLowerCase()}@example.com`;
}

/**
 * Generates a random sentence.
 * @return sentence
 */
export function generatePhrase(): string {
  return faker.lorem.sentence();
}

/**
 * Generates a random city name.
 * @return city name
 */
export function generateCity(): string {
  return faker.location.city();
}

/**
 * Generates a random street address with the apartment number and without apostrophes.
 * @return street address
 */
export function generateAddress(): string {
  return faker.location.streetAddress(true).replaceAll("'", '');
}

/**
 * Generates a random string from the characters of the template.
 * @param count - length of the string
 * @param template - allowed characters, Latin letters and digits by default
 * @return random string
 */
export function generateStringOfLength(count: number, template = ALPHANUMERIC): string {
  return Array.from({ length: count }, () => template[Math.floor(Math.random() * template.length)]).join('');
}

/**
 * Generates a random MAC address.
 * @return MAC address
 */
export function generateMacAddress(): string {
  return faker.internet.mac();
}

/**
 * Generates a random IPv4 address.
 * @return IPv4 address
 */
export function generateIp(): string {
  return faker.internet.ipv4();
}

/**
 * Checks whether a value contains the automation key (case-insensitive), i.e. was created by tests.
 * @param value - name, title or other text to check
 * @return `true` for data created by automation
 */
export function isAutomationData(value: string): boolean {
  return value.toLowerCase().includes(envConfig.automationKey.toLowerCase());
}

/**
 * Generates a unique user for registration.
 * @param overrides - fields to use instead of generated values
 * @return new user payload
 */
export function generateUser(overrides: Partial<NewUser> = {}): NewUser {
  const username = generateShortTestsName('user').toLowerCase();
  return {
    username,
    email: `${username}@example.com`,
    password: `Pw!${generateStringOfLength(10)}`,
    ...overrides,
  };
}

/**
 * Generates an article with a unique title and the automation tags.
 * @param overrides - fields to use instead of generated values
 * @return new article payload
 */
export function generateArticle(overrides: Partial<NewArticle> = {}): NewArticle {
  return {
    title: generateTestsName('Article'),
    description: generatePhrase(),
    body: faker.lorem.sentences(2),
    tagList: [...AUTOMATION_TAGS],
    ...overrides,
  };
}

/**
 * Generates a comment whose body contains a unique test name.
 * @param overrides - fields to use instead of generated values
 * @return new comment payload
 */
export function generateComment(overrides: Partial<NewComment> = {}): NewComment {
  return { body: `${generatePhrase()} ${generateTestsName('comment')}`, ...overrides };
}
