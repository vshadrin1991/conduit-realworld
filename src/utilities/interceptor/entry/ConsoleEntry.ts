export type ConsoleLevel = 'error' | 'warning' | 'info' | 'debug';

export interface ConsoleEntry {
  level: ConsoleLevel;
  text: string;
  location: string | null;
  at: number;
}
