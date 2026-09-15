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
 * Generates a unique name `data_automationKey_yyyyMMddHHmmss` with a 4-character random suffix that keeps names
 * unique across parallel workers within the same second.
 * @param data - name prefix, e.g. `Article`
 * @return unique test name
 */
export function generateTestsName(data: unknown): string {
  return `${data}_${envConfig.automationKey}_${timestamp()}${generateStringOfLength(4)}`;
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
 * Generates a random string from the characters of the template.
 * @param count - length of the string
 * @param template - allowed characters, Latin letters and digits by default
 * @return random string
 */
export function generateStringOfLength(count: number, template = ALPHANUMERIC): string {
  return Array.from({ length: count }, () => template[Math.floor(Math.random() * template.length)]).join('');
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
