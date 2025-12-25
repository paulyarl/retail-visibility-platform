/**
 * Centralized Logging System with Multiple Transports
 * Supports console, file, and external services for production monitoring
 * REQ: REQ-2025-904
 */
import type { Request, Response, NextFunction } from "express";
import type { RequestCtx } from "./context";
import fs from 'fs';
import path from 'path';

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

// File transport for production logging
class FileTransport implements LogTransport {
  private logDir: string;
  private maxFileSize: number;
  private maxFiles: number;

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

  private rotateLogFile(): void {
    const logFile = this.getLogFilePath();
    if (fs.existsSync(logFile)) {
      const stats = fs.statSync(logFile);
      if (stats.size > this.maxFileSize) {
        // Simple rotation - rename current file and create new one
        const backupFile = `${logFile}.${Date.now()}.bak`;
        fs.renameSync(logFile, backupFile);
      }
    }
  }

  log(entry: LogEntry): void {
    try {
      this.rotateLogFile();
      const logFile = this.getLogFilePath();
      const logLine = JSON.stringify(entry) + '\n';
      fs.appendFileSync(logFile, logLine);
    } catch (error) {
      // Fallback to console if file logging fails
      console.error('File logging failed:', error);
      new ConsoleTransport().log(entry);
    }
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

    // Future: Add external service transports (CloudWatch, Loki, etc.)
    // if (process.env.LOG_CLOUDWATCH_ENABLED === 'true') {
    //   this.transports.push(new CloudWatchTransport());
    // }
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
      // correlationId not available in RequestCtx
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
export function requestLogger(req: Request, res: Response, next: Function): void {
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
    const level = (res as any).statusCode >= 400 ? LogLevel.WARN :
                  (res as any).statusCode >= 500 ? LogLevel.ERROR :
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
