export interface NetworkEntry {
  method: string;
  url: string;
  status: number | null;
  statusText: string | null;
  durationMs: number | null;
  requestBody: string | null;
  responseBody: string | null;
  failure: string | null;
  at: number;
}
