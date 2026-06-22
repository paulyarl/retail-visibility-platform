/**
 * Google Gemini Provider
 *
 * Chat completions + embeddings via @google/generative-ai SDK.
 */

import { logger } from '../../logger';
import type { AiProvider, ChatCompletionRequest, ChatCompletionResult, EmbeddingRequest, EmbeddingResult } from './AiProvider';

export class GoogleProvider implements AiProvider {
  readonly name = 'google';
  private genAI: any = null;

  constructor() {
    if (process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY) {
      try {
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY);
        logger.info('[GoogleProvider] Initialized (Gemini)');
      } catch (e) {
        logger.warn('[GoogleProvider] Failed to init', undefined, { error: String(e) });
      }
    }
  }

  isAvailable(): boolean {
    return this.genAI !== null;
  }

  async generateChatCompletion(req: ChatCompletionRequest): Promise<ChatCompletionResult> {
    if (!this.genAI) throw new Error('Google AI not initialized — set GOOGLE_API_KEY');

    const model = this.genAI.getGenerativeModel({
      model: req.model,
      generationConfig: {
        maxOutputTokens: req.maxTokens || 300,
        temperature: req.temperature ?? 0.5,
      },
    });

    // Convert messages to Gemini format
    const systemMsg = req.messages.find(m => m.role === 'system');
    const conversationMessages = req.messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    // Gemini doesn't have a separate system param in older SDK versions;
    // prepend system message as a user message if present
    if (systemMsg) {
      conversationMessages.unshift({
        role: 'user',
        parts: [{ text: `[System Instructions]\n${systemMsg.content}` }],
      });
    }

    const result = await model.generateContent({
      contents: conversationMessages,
    });

    const content = result.response?.text?.() || result.response?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return {
      content: content.trim(),
      model: req.model,
      usage: result.response?.usageMetadata ? {
        promptTokens: result.response.usageMetadata.promptTokenCount,
        completionTokens: result.response.usageMetadata.candidatesTokenCount,
        totalTokens: result.response.usageMetadata.totalTokenCount,
      } : undefined,
    };
  }

  async generateEmbeddings(req: EmbeddingRequest): Promise<EmbeddingResult> {
    if (!this.genAI) throw new Error('Google AI not initialized — set GOOGLE_API_KEY');

    const model = this.genAI.getGenerativeModel({ model: req.model });

    // Gemini embeddings API processes one input at a time
    const allEmbeddings: number[][] = [];
    for (const input of req.inputs) {
      const result = await model.embedContent({
        content: { parts: [{ text: input }], role: 'user' },
      });
      const embedding = result.embedding?.values;
      if (embedding) {
        allEmbeddings.push(embedding);
      } else {
        throw new Error('Google embedding returned empty result');
      }
    }

    return {
      embeddings: allEmbeddings,
      model: req.model,
    };
  }
}
