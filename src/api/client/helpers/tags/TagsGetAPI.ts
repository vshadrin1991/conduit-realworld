import type { TagsResponse } from '@/api/responses/tags/Tag';
import { BasePath } from '../../path/BasePath';
import { RestClient } from '../../RestClient';

export class TagsGetAPI extends RestClient {
  async list(): Promise<string[]> {
    return (await this.json<TagsResponse>({ name: 'list tags', path: BasePath.TAGS })).tags;
  }
}
