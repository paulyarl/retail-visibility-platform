/**
 * Centralized Logging System with Multiple Transports
 * Supports console, file, database, and Sentry for production monitoring
 * REQ: REQ-2025-904
 *
 * Transports:
 *   1. ConsoleTransport  — always on, colorized in dev, JSON in prod
 *   2. FileTransport     — production only, async writes with size-based rotation
 *   3. DatabaseTransport — ERROR-level entries persisted to application_error_log table
 *   4. SentryTransport   — ERROR-level entries sent to Sentry (when DSN is configured)
 */
import type { Request, Response, NextFunction } from "express";
import type { RequestCtx } from "./context";
import * as fs from 'fs';
import * as path from 'path';
import { prisma } from "./prisma";

// Log levels with severity
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

// Log entry interface
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  tenantId?: string | null;
  region?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  duration?: number;
  userId?: string;
  ip?: string;
  userAgent?: string;
  correlationId?: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  [key: string]: any;
}

// Transport interface for different logging destinations
interface LogTransport {
  log(entry: LogEntry): void;
}

// Console transport for development
class ConsoleTransport implements LogTransport {
  log(entry: LogEntry): void {
    const levelColors = {
      [LogLevel.ERROR]: '\x1b[31m', // Red
      [LogLevel.WARN]: '\x1b[33m',  // Yellow
      [LogLevel.INFO]: '\x1b[36m',  // Cyan
      [LogLevel.DEBUG]: '\x1b[35m', // Magenta
    };

    const levelNames = {
      [LogLevel.ERROR]: 'ERROR',
      [LogLevel.WARN]: 'WARN',
      [LogLevel.INFO]: 'INFO',
      [LogLevel.DEBUG]: 'DEBUG',
    };

    const color = levelColors[entry.level] || '\x1b[37m'; // White default
    const levelName = levelNames[entry.level] || 'UNKNOWN';
    const reset = '\x1b[0m';

    const output = process.env.NODE_ENV === 'production'
      ? JSON.stringify(entry)
      : `${color}[${levelName}]${reset} ${entry.message} ${entry.tenantId ? `(tenant: ${entry.tenantId})` : ''}`;

    if (entry.level === LogLevel.ERROR) {
      console.error(output);
    } else {
      console.log(output);
    }
  }
}

// File transport for production logging — async, non-blocking
class FileTransport implements LogTransport {
  private logDir: string;
  private maxFileSize: number;
  private maxFiles: number;
  private streamCache: Map<string, fs.WriteStream> = new Map();

  constructor(logDir = './logs', maxFileSize = 10 * 1024 * 1024, maxFiles = 5) {
    this.logDir = logDir;
    this.maxFileSize = maxFileSize;
    this.maxFiles = maxFiles;
    this.ensureLogDirectory();
  }

  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private getLogFilePath(): string {
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    return path.join(this.logDir, `app-${date}.log`);
  }

  private getStream(logFile: string): fs.WriteStream {
    let stream = this.streamCache.get(logFile);
    if (stream && !stream.destroyed) {
      return stream;
    }

    stream = fs.createWriteStream(logFile, { flags: 'a' });
    stream.on('error', (err) => {
      console.error('File log stream error:', err);
      this.streamCache.delete(logFile);
    });
    this.streamCache.set(logFile, stream);
    return stream;
  }

  private rotateLogFile(): void {
    const logFile = this.getLogFilePath();
    try {
      if (fs.existsSync(logFile)) {
        const stats = fs.statSync(logFile);
        if (stats.size > this.maxFileSize) {
          const backupFile = `${logFile}.${Date.now()}.bak`;
          const stream = this.streamCache.get(logFile);
          if (stream) {
            stream.end();
            this.streamCache.delete(logFile);
          }
          fs.renameSync(logFile, backupFile);
        }
      }
    } catch {
      // rotation is best-effort
    }
  }

  log(entry: LogEntry): void {
    try {
      this.rotateLogFile();
      const logFile = this.getLogFilePath();
      const stream = this.getStream(logFile);
      const logLine = JSON.stringify(entry) + '\n';
      stream.write(logLine);
    } catch (error) {
      // Fallback to console if file logging fails
      console.error('File logging failed:', error);
      new ConsoleTransport().log(entry);
    }
  }
}

// Database transport — persists ERROR-level entries to application_error_log
class DatabaseTransport implements LogTransport {
  private enabled: boolean;

  constructor() {
    this.enabled = process.env.LOG_DB_ENABLED === 'true' ||
                   process.env.NODE_ENV === 'production';
  }

  log(entry: LogEntry): void {
    if (!this.enabled || entry.level !== LogLevel.ERROR) return;

    // Fire-and-forget — never block the event loop for DB logging
    setImmediate(() => {
      this.persist(entry).catch(() => {
        // Silently fail — console transport already has the entry
      });
    });
  }

  private async persist(entry: LogEntry): Promise<void> {
    const data: any = {
      level: LogLevel[entry.level].toLowerCase(),
      message: entry.message,
      stack_trace: entry.error?.stack || null,
      error_name: entry.error?.name || null,
      tenant_id: entry.tenantId || null,
      user_id: entry.userId || null,
      request_method: entry.method || null,
      request_path: entry.path || null,
      status_code: entry.statusCode || null,
      correlation_id: entry.correlationId || null,
      context: {
        region: entry.region,
        ip: entry.ip,
        userAgent: entry.userAgent,
        duration: entry.duration,
        ...this.extractExtraContext(entry),
      },
    };

    await prisma.application_error_log.create({ data });
  }

  private extractExtraContext(entry: LogEntry): Record<string, any> {
    const known = new Set([
      'timestamp', 'level', 'message', 'tenantId', 'region',
      'method', 'path', 'statusCode', 'duration', 'userId',
      'ip', 'userAgent', 'correlationId', 'error',
    ]);
    const extra: Record<string, any> = {};
    for (const [key, value] of Object.entries(entry)) {
      if (!known.has(key)) {
        extra[key] = value;
      }
    }
    return extra;
  }
}

// Sentry transport — sends ERROR-level entries to Sentry
class SentryTransport implements LogTransport {
  private enabled: boolean;

  constructor() {
    this.enabled = !!process.env.SENTRY_DSN && process.env.SENTRY_DSN.trim() !== '';
  }

  log(entry: LogEntry): void {
    if (!this.enabled || entry.level !== LogLevel.ERROR) return;
    if (process.env.NODE_ENV === 'development') return;

    try {
      this.capture(entry);
    } catch {
      // Silently fail — console transport already has the entry
    }
  }

  private capture(entry: LogEntry): void {
    // Dynamic import to avoid loading Sentry in dev
    const Sentry = require('@sentry/node') as typeof import('@sentry/node');

    Sentry.withScope((scope) => {
      if (entry.tenantId) scope.setTag('tenant_id', entry.tenantId);
      if (entry.userId) scope.setUser({ id: entry.userId });
      if (entry.correlationId) scope.setTag('correlation_id', entry.correlationId);
      if (entry.method) scope.setTag('method', entry.method);
      if (entry.path) scope.setTag('path', entry.path);
      if (entry.statusCode) scope.setTag('status_code', entry.statusCode);
      if (entry.region) scope.setTag('region', entry.region);

      scope.setContext('log_entry', {
        message: entry.message,
        timestamp: entry.timestamp,
        level: LogLevel[entry.level],
        ip: entry.ip,
        userAgent: entry.userAgent,
        duration: entry.duration,
      });

      const error = entry.error
        ? new Error(entry.error.message)
        : new Error(entry.message);

      if (entry.error?.name) {
        (error as any).name = entry.error.name;
      }
      if (entry.error?.stack) {
        (error as any).stack = entry.error.stack;
      }

      Sentry.captureException(error);
    });
  }
}

// Main logger class
class Logger {
  private transports: LogTransport[] = [];
  private minLevel: LogLevel;

  constructor(minLevel: LogLevel = LogLevel.INFO) {
    this.minLevel = minLevel;
    this.setupTransports();
  }

  private setupTransports(): void {
    // Always add console transport
    this.transports.push(new ConsoleTransport());

    // Add file transport in production
    if (process.env.NODE_ENV === 'production') {
      const logDir = process.env.LOG_DIR || './logs';
      this.transports.push(new FileTransport(logDir));
    }

    // Add database transport for persistent error storage
    this.transports.push(new DatabaseTransport());

    // Add Sentry transport for error tracking
    this.transports.push(new SentryTransport());
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.minLevel;
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    context?: RequestCtx,
    meta?: Record<string, any>
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...meta,
    };

    if (context) {
      entry.tenantId = context.tenantId;
      entry.region = context.region;
      if (context.correlationId) entry.correlationId = context.correlationId;
      if (context.userId) entry.userId = context.userId;
      if (context.ip) entry.ip = context.ip;
      if (context.userAgent) entry.userAgent = context.userAgent;
    }

    return entry;
  }

  log(level: LogLevel, message: string, context?: RequestCtx, meta?: Record<string, any>): void {
    if (!this.shouldLog(level)) return;

    const entry = this.createLogEntry(level, message, context, meta);

    this.transports.forEach(transport => {
      try {
        transport.log(entry);
      } catch (error) {
        console.error('Logging transport failed:', error);
      }
    });
  }

  error(message: string, context?: RequestCtx, meta?: Record<string, any>): void {
    this.log(LogLevel.ERROR, message, context, meta);
  }

  warn(message: string, context?: RequestCtx, meta?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, context, meta);
  }

  info(message: string, context?: RequestCtx, meta?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, context, meta);
  }

  debug(message: string, context?: RequestCtx, meta?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, context, meta);
  }
}

// Create singleton logger instance
const logger = new Logger(
  process.env.LOG_LEVEL === 'debug' ? LogLevel.DEBUG :
  process.env.LOG_LEVEL === 'warn' ? LogLevel.WARN :
  process.env.LOG_LEVEL === 'error' ? LogLevel.ERROR :
  LogLevel.INFO
);

// Export singleton logger
export { logger };

// Legacy function for backward compatibility
export function logWithContext(req: Request, level: "info" | "warn" | "error", message: string, meta?: Record<string, any>) {
  const ctx = (req as any).ctx as RequestCtx | undefined;

  const logLevel = level === 'error' ? LogLevel.ERROR :
                   level === 'warn' ? LogLevel.WARN :
                   LogLevel.INFO;

  logger.log(logLevel, message, ctx, {
    method: req.method,
    path: req.path,
    userAgent: req.headers['user-agent'],
    ip: req.ip || req.connection.remoteAddress,
    ...meta,
  });
}

// Request logging middleware
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const ctx = (req as any).ctx as RequestCtx | undefined;

  // Log incoming request
  logger.info(`Request: ${req.method} ${req.path}`, ctx, {
    method: req.method,
    path: req.path,
    query: req.query,
    userAgent: req.headers['user-agent'],
    ip: req.ip || req.connection.remoteAddress,
  });

  // Log response when finished
  (res as any).on('finish', () => {
    const duration = Date.now() - startTime;
    const level = (res as any).statusCode >= 500 ? LogLevel.ERROR :
                  (res as any).statusCode >= 400 ? LogLevel.WARN :
                  LogLevel.INFO;

    logger.log(level, `Response: ${req.method} ${req.path} ${(res as any).statusCode}`, ctx, {
      method: req.method,
      path: req.path,
      statusCode: (res as any).statusCode,
      duration,
    });
  });

  next();
}
