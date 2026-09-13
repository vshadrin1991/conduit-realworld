import { faker } from '@faker-js/faker';
import type { NewArticle } from '@/api/request/articles/NewArticle';
import type { NewComment } from '@/api/request/comments/NewComment';
import type { NewUser } from '@/api/request/users/NewUser';
import { envConfig } from '@/config/env.config';

const ALPHANUMERIC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyz';

/** Tags outlive deleted articles on the shared server, so generated articles reuse fixed tags. */
export const AUTOMATION_TAGS = ['playwright', 'e2e'];

/** `yyyyMMddHHmmss` in UTC. */
function timestamp(date = new Date()): string {
  return date.toISOString().replace(/\D/g, '').slice(0, 14);
}

/** @returns random first name prefixed with the automation key */
export function generateFirstName(): string {
  return `${envConfig.automationKey}${faker.person.firstName()}`;
}

/** @returns random last name prefixed with the automation key */
export function generateLastName(): string {
  return `${envConfig.automationKey}${faker.person.lastName()}`;
}

/** @returns the template with every `?` replaced by a random letter */
export function generateLetterifyData(template: string): string {
  return template.replace(/\?/g, () => faker.string.alpha());
}

/** @returns the template with every `#` replaced by a random digit */
export function generateNumerifyData(template: string): string {
  return template.replace(/#/g, () => String(faker.number.int(9)));
}

/** @returns random integer, `min` inclusive and `max` exclusive */
export function generateNumber(min: number, max: number): number {
  return faker.number.int({ min, max: max - 1 });
}

/**
 * @returns test name `data_automationKey_yyyyMMddHHmmss` plus a 4-char random suffix
 * (the suffix keeps names unique across parallel workers within the same second)
 */
export function generateTestsName(data: unknown): string {
  return `${data}_${envConfig.automationKey}_${timestamp()}${generateStringOfLength(4)}`;
}

/** @returns random words followed by the automation key */
export function generateSeparateTestsName(): string {
  return `${faker.word.words(3)} ${envConfig.automationKey}`;
}

/** @returns test name `dataAutomationKeyyyyyMMddHHmmss` plus a random suffix, without separators */
export function generateShortTestsName(data: string): string {
  return `${data}${envConfig.automationKey}${timestamp()}${generateStringOfLength(4)}`;
}

/** @returns current date shifted by the given amounts, as `yyyy-MM-ddTHH:mm:ssZ` */
export function generateDate({ days = 0, hours = 0, minutes = 0, seconds = 0 } = {}): string {
  const shiftMs = (((days * 24 + hours) * 60 + minutes) * 60 + seconds) * 1000;
  return new Date(Date.now() + shiftMs).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** @returns random email in the example.com domain */
export function generateEmail(): string {
  return `${faker.internet.username().toLowerCase()}@example.com`;
}

/** @returns random single-line sentence */
export function generatePhrase(): string {
  return faker.lorem.sentence();
}

/** @returns random city name */
export function generateCity(): string {
  return faker.location.city();
}

/** @returns random full address without apostrophes */
export function generateAddress(): string {
  return faker.location.streetAddress(true).replaceAll("'", '');
}

/** @returns random string of `count` characters taken from `template` */
export function generateStringOfLength(count: number, template = ALPHANUMERIC): string {
  return Array.from({ length: count }, () => template[Math.floor(Math.random() * template.length)]).join('');
}

/** @returns random MAC address */
export function generateMacAddress(): string {
  return faker.internet.mac();
}

/** @returns random IPv4 address */
export function generateIp(): string {
  return faker.internet.ipv4();
}

/** @returns true when the value (name, title, slug) belongs to automation test data */
export function isAutomationData(value: string): boolean {
  return value.toLowerCase().includes(envConfig.automationKey.toLowerCase());
}

/* ---------- Conduit models ---------- */

export function generateUser(overrides: Partial<NewUser> = {}): NewUser {
  const username = generateShortTestsName('user').toLowerCase();
  return {
    username,
    email: `${username}@example.com`,
    password: `Pw!${generateStringOfLength(10)}`,
    ...overrides,
  };
}

export function generateArticle(overrides: Partial<NewArticle> = {}): NewArticle {
  return {
    title: generateTestsName('Article'),
    description: generatePhrase(),
    body: faker.lorem.sentences(2),
    tagList: [...AUTOMATION_TAGS],
    ...overrides,
  };
}

export function generateComment(overrides: Partial<NewComment> = {}): NewComment {
  return { body: `${generatePhrase()} ${generateTestsName('comment')}`, ...overrides };
}
