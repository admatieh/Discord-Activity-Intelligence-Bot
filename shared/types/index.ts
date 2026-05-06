// shared/types/index.ts
export interface ApiResponse<T = any> {
  success: boolean;
  data: T | null;
  error: string | null;
  meta?: Record<string, any>;
  requestId?: string;
}

export interface CommandContext {
  source: 'discord' | 'dashboard' | 'api';
  user: {
    id: string;
    username: string;
    roles?: string[];
  };
  guild?: {
    id: string;
    name: string;
  };
}

export interface ExecutionResponse {
  output: string;
  exitCode: number;
  executionMs: number;
  logs: string[];
  timestamp: string;
}
