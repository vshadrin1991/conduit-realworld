import { authConfig } from '@/config/auth.config';

export abstract class RestClientFactory {
  private static readonly BASE_HEADERS: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  static headers(token?: string): Record<string, string> {
    return token
      ? { ...RestClientFactory.BASE_HEADERS, Authorization: `${authConfig.tokenScheme} ${token}` }
      : { ...RestClientFactory.BASE_HEADERS };
  }
}
