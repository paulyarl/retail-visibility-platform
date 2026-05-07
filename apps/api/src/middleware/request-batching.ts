/**
 * Request Batching Middleware
 * Combines multiple API calls into single batched requests
 * Reduces network round trips and improves performance
 */

import { Request, Response, NextFunction } from 'express';

interface BatchedRequest {
  id: string;
  path: string;
  method: string;
  headers: Record<string, string>;
  body?: any;
}

interface BatchedResponse {
  id: string;
  status: number;
  headers: Record<string, string>;
  body: any;
  error?: string;
}

// In-memory batch storage (in production, use Redis)
const batchStore = new Map<string, {
  requests: BatchedRequest[];
  timeout: NodeJS.Timeout;
  resolve: (responses: BatchedResponse[]) => void;
  reject: (error: Error) => void;
}>();

const BATCH_TIMEOUT = 50; // ms - how long to wait for batching
const MAX_BATCH_SIZE = 10; // Maximum requests per batch

/**
 * Middleware to enable request batching
 * Clients can send POST /api/batch with array of requests
 */
export function batchMiddleware(req: Request, res: Response, next: NextFunction) {
  // Handle batched requests at /api/batch
  if (req.path === '/api/batch' && req.method === 'POST') {
    handleBatchedRequests(req, res);
    return;
  }

  // For individual requests, check if we should batch them
  if (shouldBatchRequest(req)) {
    addToBatch(req, res);
    return;
  }

  next();
}

/**
 * Handle incoming batched requests
 */
async function handleBatchedRequests(req: Request, res: Response) {
  try {
    const requests: BatchedRequest[] = req.body;

    if (!Array.isArray(requests) || requests.length === 0) {
      return res.status(400).json({
        error: 'Invalid batch request. Expected array of requests.'
      });
    }

    if (requests.length > MAX_BATCH_SIZE) {
      return res.status(400).json({
        error: `Batch too large. Maximum ${MAX_BATCH_SIZE} requests per batch.`
      });
    }

    // Process each request in the batch
    const responses: BatchedResponse[] = await Promise.all(
      requests.map(async (batchedReq) => {
        try {
          // Create a mock request/response for this batched request
          const mockReq = createMockRequest(batchedReq, req);
          const mockRes = createMockResponse();

          // Route the request through Express
          await routeRequest(mockReq, mockRes);

          return {
            id: batchedReq.id,
            status: mockRes.statusCode,
            headers: mockRes.getHeaders(),
            body: mockRes.body
          };
        } catch (error) {
          return {
            id: batchedReq.id,
            status: 500,
            headers: {},
            body: null,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      })
    );

    res.json(responses);
  } catch (error) {
    console.error('[BATCH] Error processing batched requests:', error);
    res.status(500).json({
      error: 'Failed to process batch request'
    });
  }
}

/**
 * Check if a request should be batched
 */
function shouldBatchRequest(req: Request): boolean {
  // Only batch GET requests to avoid side effects
  if (req.method !== 'GET') return false;

  // Only batch certain endpoints that are commonly requested together
  const batchablePaths = [
    /^\/api\/tenants\/[^\/]+$/,
    /^\/api\/tenants\/[^\/]+\/tier$/,
    /^\/api\/tenants\/[^\/]+\/usage$/,
    /^\/api\/dashboard\/stats$/,
  ];

  return batchablePaths.some(pattern => pattern.test(req.path));
}

/**
 * Add request to batch or create new batch
 */
function addToBatch(req: Request, res: Response) {
  const batchKey = getBatchKey(req);

  if (batchStore.has(batchKey)) {
    // Add to existing batch
    const batch = batchStore.get(batchKey)!;
    batch.requests.push({
      id: generateRequestId(),
      path: req.path,
      method: req.method,
      headers: req.headers as Record<string, string>,
      body: req.body
    });

    // If batch is full, execute immediately
    if (batch.requests.length >= MAX_BATCH_SIZE) {
      clearTimeout(batch.timeout);
      executeBatch(batchKey);
    }
  } else {
    // Create new batch
    const batchId = batchKey;
    const requests: BatchedRequest[] = [{
      id: generateRequestId(),
      path: req.path,
      method: req.method,
      headers: req.headers as Record<string, string>,
      body: req.body
    }];

    // Create promise that will resolve when batch executes
    let resolve: (responses: BatchedResponse[]) => void;
    let reject: (error: Error) => void;

    const batchPromise = new Promise<BatchedResponse[]>((res, rej) => {
      resolve = res;
      reject = rej;
    });

    // Set timeout to execute batch
    const timeout = setTimeout(() => {
      executeBatch(batchId);
    }, BATCH_TIMEOUT);

    batchStore.set(batchId, {
      requests,
      timeout,
      resolve: resolve!,
      reject: reject!
    });

    // Wait for batch to complete, then send response
    batchPromise
      .then(responses => {
        // Send the first response (since this was a single request added to batch)
        const response = responses[0];
        res.status(response.status).json(response.body);
      })
      .catch(error => {
        res.status(500).json({ error: error.message });
      });
  }
}

/**
 * Execute a batch of requests
 */
async function executeBatch(batchId: string) {
  const batch = batchStore.get(batchId);
  if (!batch) return;

  try {
    console.log(`[BATCH] Executing batch ${batchId} with ${batch.requests.length} requests`);

    // Convert individual requests to a batch request
    const batchRequest = {
      method: 'POST',
      url: '/api/batch',
      body: batch.requests
    };

    // Process the batch (this would call handleBatchedRequests)
    const responses: BatchedResponse[] = await Promise.all(
      batch.requests.map(async (req) => {
        try {
          // Create mock request/response
          const mockReq = createMockRequest(req, {} as Request);
          const mockRes = createMockResponse();

          // Route through Express
          await routeRequest(mockReq, mockRes);

          return {
            id: req.id,
            status: mockRes.statusCode,
            headers: mockRes.getHeaders(),
            body: mockRes.body
          };
        } catch (error) {
          return {
            id: req.id,
            status: 500,
            headers: {},
            body: null,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      })
    );

    batch.resolve(responses);
  } catch (error) {
    batch.reject(error instanceof Error ? error : new Error('Batch execution failed'));
  } finally {
    batchStore.delete(batchId);
  }
}

/**
 * Generate unique batch key based on request characteristics
 */
function getBatchKey(req: Request): string {
  // Group requests by user and similar characteristics
  const userId = (req as any).user?.userId || (req as any).user?.id || 'anonymous';
  const userAgent = req.get('User-Agent') || 'unknown';

  // Create a hash of request characteristics for batching
  return `${userId}:${userAgent}:${Date.now()}`;
}

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create mock request object for routing
 */
function createMockRequest(batchedReq: BatchedRequest, originalReq: Request): any {
  return {
    ...originalReq,
    path: batchedReq.path,
    method: batchedReq.method,
    headers: { ...originalReq.headers, ...batchedReq.headers },
    body: batchedReq.body,
    params: extractParams(batchedReq.path),
    query: {},
  };
}

/**
 * Create mock response object
 */
function createMockResponse(): any {
  const headers: Record<string, string> = {};
  let body: any = null;
  let statusCode = 200;

  const mockRes = {
    status: (code: number) => {
      statusCode = code;
      return mockRes;
    },
    json: (data: any) => {
      body = data;
      return mockRes;
    },
    send: (data: any) => {
      body = data;
      return mockRes;
    },
    setHeader: (name: string, value: string) => {
      headers[name] = value;
    },
    getHeaders: () => headers,
    get statusCode() { return statusCode; },
    get body() { return body; }
  };

  return mockRes;
}

/**
 * Extract params from path
 */
function extractParams(path: string): Record<string, string> {
  // Simple param extraction for common patterns
  const tenantMatch = path.match(/\/api\/tenants\/([^\/]+)/);
  if (tenantMatch) {
    return { id: tenantMatch[1] };
  }
  return {};
}

/**
 * Route request through Express (simplified version)
 */
async function routeRequest(req: any, res: any): Promise<void> {
  // This would need to be implemented to actually route through your Express app
  // For now, just return a mock response
  res.status(200).json({ message: 'Mock response for batched request' });
}

/**
 * Client-side batching utility
 */
export class RequestBatcher {
  private pendingRequests: Map<string, BatchedRequest> = new Map();
  private batchTimeout: NodeJS.Timeout | null = null;

  constructor(private apiBaseUrl: string) {}

  /**
   * Add request to batch
   */
  async add(request: Omit<BatchedRequest, 'id'>): Promise<any> {
    const batchedRequest: BatchedRequest = {
      ...request,
      id: generateRequestId()
    };

    this.pendingRequests.set(batchedRequest.id, batchedRequest);

    // If we have a batch timeout, clear it
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }

    // Set new timeout to send batch
    return new Promise((resolve, reject) => {
      this.batchTimeout = setTimeout(async () => {
        try {
          const responses = await this.executeBatch();
          const response = responses.find(r => r.id === batchedRequest.id);
          resolve(response?.body);
        } catch (error) {
          reject(error);
        }
      }, BATCH_TIMEOUT);
    });
  }

  /**
   * Execute pending batch
   */
  private async executeBatch(): Promise<BatchedResponse[]> {
    if (this.pendingRequests.size === 0) return [];

    const requests = Array.from(this.pendingRequests.values());
    this.pendingRequests.clear();

    console.log(`[CLIENT BATCH] Sending batch of ${requests.length} requests`);

    const response = await fetch(`${this.apiBaseUrl}/api/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requests)
    });

    if (!response.ok) {
      throw new Error(`Batch request failed: ${response.status}`);
    }

    const data = await response.json();
    return data as BatchedResponse[];
  }

  /**
   * Force execute current batch immediately
   */
  async flush(): Promise<void> {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

    if (this.pendingRequests.size > 0) {
      await this.executeBatch();
    }
  }
}
