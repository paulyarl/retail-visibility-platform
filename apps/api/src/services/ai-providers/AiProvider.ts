/**
 * AI Provider Interface
 *
 * Abstraction layer for multiple AI providers (OpenAI, Anthropic, Google, Mistral).
 * Each provider implements this interface for embeddings + chat completions.
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
}

export interface ChatCompletionResult {
  content: string;
  model: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

export interface EmbeddingRequest {
  model: string;
  inputs: string[];
}

export interface EmbeddingResult {
  embeddings: number[][];
  model: string;
  usage?: {
    promptTokens?: number;
    totalTokens?: number;
  };
}

export interface AiProvider {
  /** Provider identifier (e.g. "openai", "anthropic", "google", "mistral") */
  readonly name: string;

  /** Whether this provider is configured and ready to use */
  isAvailable(): boolean;

  /** Generate chat completion */
  generateChatCompletion(req: ChatCompletionRequest): Promise<ChatCompletionResult>;

  /** Generate embeddings for a batch of texts */
  generateEmbeddings(req: EmbeddingRequest): Promise<EmbeddingResult>;
}

export type ProviderType = 'openai' | 'anthropic' | 'google' | 'mistral';

export const PROVIDER_MODELS: Record<ProviderType, { chat: { value: string; label: string }[]; embedding: { value: string; label: string }[] }> = {
  openai: {
    chat: [
      { value: 'gpt-4o-mini', label: 'gpt-4o-mini ($0.15/1M in, $0.60/1M out)' },
      { value: 'gpt-4o', label: 'gpt-4o ($2.50/1M in, $10/1M out)' },
      { value: 'gpt-4.1-mini', label: 'gpt-4.1-mini ($0.40/1M in, $1.60/1M out)' },
      { value: 'gpt-4.1-nano', label: 'gpt-4.1-nano ($0.10/1M in, $0.40/1M out)' },
    ],
    embedding: [
      { value: 'text-embedding-3-small', label: 'text-embedding-3-small ($0.02/1M tokens)' },
      { value: 'text-embedding-3-large', label: 'text-embedding-3-large ($0.13/1M tokens)' },
      { value: 'text-embedding-ada-002', label: 'text-embedding-ada-002 ($0.10/1M tokens)' },
    ],
  },
  anthropic: {
    chat: [
      { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku ($0.80/1M in, $4/1M out)' },
      { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet ($3/1M in, $15/1M out)' },
      { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus ($15/1M in, $75/1M out)' },
    ],
    embedding: [
      { value: 'voyage-3', label: 'Voyage-3 ($0.06/1M tokens) — via Voyage AI' },
      { value: 'voyage-3-lite', label: 'Voyage-3-Lite ($0.02/1M tokens) — via Voyage AI' },
    ],
  },
  google: {
    chat: [
      { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash ($0.10/1M in, $0.40/1M out)' },
      { value: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash-Lite ($0.075/1M in, $0.30/1M out)' },
      { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash ($0.075/1M in, $0.30/1M out)' },
      { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro ($1.25/1M in, $5/1M out)' },
    ],
    embedding: [
      { value: 'text-embedding-004', label: 'text-embedding-004 (free tier available)' },
    ],
  },
  mistral: {
    chat: [
      { value: 'mistral-small-latest', label: 'Mistral Small ($0.20/1M in, $0.60/1M out)' },
      { value: 'mistral-large-latest', label: 'Mistral Large ($2/1M in, $6/1M out)' },
      { value: 'open-mistral-nemo', label: 'Mistral Nemo ($0.15/1M in, $0.15/1M out)' },
    ],
    embedding: [
      { value: 'mistral-embed', label: 'mistral-embed ($0.10/1M tokens)' },
    ],
  },
};

export const PROVIDER_OPTIONS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic (Claude)' },
  { value: 'google', label: 'Google (Gemini)' },
  { value: 'mistral', label: 'Mistral' },
];
