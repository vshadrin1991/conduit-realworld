import type { TagsResponse } from '@/api/responses/tags/TagsResponse';
import { ConduitBasePath } from '../../path/ConduitBasePath';
import { RestClient } from '../../RestClient';

export class TagsGetAPI extends RestClient {
  async list(): Promise<string[]> {
    return (await this.json<TagsResponse>({ name: 'list tags', path: ConduitBasePath.TAGS })).tags;
  }
}
