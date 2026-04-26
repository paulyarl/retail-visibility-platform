/**
 * Billing Workflow Automation Service
 * Handles automated billing workflows, rules, and execution
 */

export interface WorkflowRule {
  id: string;
  name: string;
  description: string;
  type: 'payment' | 'invoice' | 'trial' | 'subscription';
  enabled: boolean;
  status: 'active' | 'error' | 'paused';
  trigger: string;
  conditions: Record<string, any>;
  actions: WorkflowAction[];
  successRate: number;
  lastRun?: string;
  nextRun?: string;
  executionCount: number;
  errorCount: number;
}

export interface WorkflowAction {
  id: string;
  type: 'send_email' | 'send_notification' | 'create_invoice' | 'update_tier' | 'charge_payment';
  config: Record<string, any>;
  status: 'pending' | 'completed' | 'failed';
  executedAt?: string;
  error?: string;
}

export interface WorkflowExecution {
  id: string;
  ruleId: string;
  status: 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  triggerData: Record<string, any>;
  actions: WorkflowAction[];
  result?: any;
  error?: string;
}

export interface WorkflowMetrics {
  totalRules: number;
  activeRules: number;
  totalExecutions: number;
  successRate: number;
  errorCount: number;
  lastExecution?: string;
}

class BillingWorkflowService {
  private static instance: BillingWorkflowService;
  private workflows: Map<string, WorkflowRule> = new Map();
  private executions: Map<string, WorkflowExecution[]> = new Map();

  private constructor() {
    this.initializeDefaultWorkflows();
  }

  static getInstance(): BillingWorkflowService {
    if (!BillingWorkflowService.instance) {
      BillingWorkflowService.instance = new BillingWorkflowService();
    }
    return BillingWorkflowService.instance;
  }

  private initializeDefaultWorkflows(): void {
    const defaultWorkflows: WorkflowRule[] = [
      {
        id: 'trial-expiry-reminder',
        name: 'Trial Expiry Reminder',
        description: 'Send reminders 7 days before trial expires',
        type: 'trial',
        enabled: true,
        status: 'active',
        trigger: 'trial.expiring',
        conditions: { daysBeforeExpiry: 7 },
        actions: [
          {
            id: 'send-email-reminder',
            type: 'send_email',
            config: {
              template: 'trial-expiry-reminder',
              daysBefore: 7
            },
            status: 'completed'
          }
        ],
        successRate: 95,
        lastRun: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        nextRun: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        executionCount: 15,
        errorCount: 1
      },
      {
        id: 'payment-failure-retry',
        name: 'Payment Failure Retry',
        description: 'Automatically retry failed payments after 3 days',
        type: 'payment',
        enabled: true,
        status: 'active',
        trigger: 'payment.failed',
        conditions: { retryAttempts: 3, retryDelay: 72 },
        actions: [
          {
            id: 'retry-payment',
            type: 'charge_payment',
            config: { maxRetries: 3 },
            status: 'completed'
          },
          {
            id: 'notify-failure',
            type: 'send_notification',
            config: { message: 'Payment failed, retrying...' },
            status: 'completed'
          }
        ],
        successRate: 88,
        lastRun: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
        nextRun: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
        executionCount: 8,
        errorCount: 1
      },
      {
        id: 'invoice-overdue-notice',
        name: 'Invoice Overdue Notice',
        description: 'Send overdue notices for unpaid invoices',
        type: 'invoice',
        enabled: true,
        status: 'active',
        trigger: 'invoice.overdue',
        conditions: { daysOverdue: 1 },
        actions: [
          {
            id: 'send-overdue-email',
            type: 'send_email',
            config: { template: 'invoice-overdue' },
            status: 'completed'
          }
        ],
        successRate: 92,
        lastRun: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
        nextRun: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
        executionCount: 4,
        errorCount: 0
      },
      {
        id: 'subscription-upgrade',
        name: 'Subscription Upgrade',
        description: 'Automatically upgrade subscription based on usage',
        type: 'subscription',
        enabled: true,
        status: 'active',
        trigger: 'usage.threshold',
        conditions: { usagePercentage: 80, targetTier: 'professional' },
        actions: [
          {
            id: 'upgrade-tier',
            type: 'update_tier',
            config: { targetTier: 'professional' },
            status: 'pending'
          },
          {
            id: 'send-confirmation',
            type: 'send_email',
            config: { template: 'upgrade-confirmation' },
            status: 'pending'
          }
        ],
        successRate: 100,
        lastRun: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        nextRun: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        executionCount: 2,
        errorCount: 0
      },
      {
        id: 'monthly-invoice-generation',
        name: 'Monthly Invoice Generation',
        description: 'Generate monthly invoices for all active tenants',
        type: 'invoice',
        enabled: false,
        status: 'paused',
        trigger: 'schedule.monthly',
        conditions: { dayOfMonth: 1 },
        actions: [
          {
            id: 'generate-invoices',
            type: 'create_invoice',
            config: { recurring: true },
            status: 'pending'
          }
        ],
        successRate: 0,
        executionCount: 0,
        errorCount: 0
      }
    ];

    defaultWorkflows.forEach(workflow => {
      this.workflows.set(workflow.id, workflow);
      this.executions.set(workflow.id, []);
    });
  }

  async getWorkflowRules(): Promise<WorkflowRule[]> {
    return Array.from(this.workflows.values());
  }

  async getWorkflowRule(id: string): Promise<WorkflowRule | null> {
    return this.workflows.get(id) || null;
  }

  async createWorkflowRule(workflow: Omit<WorkflowRule, 'id' | 'executionCount' | 'errorCount'>): Promise<WorkflowRule> {
    const id = `workflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newWorkflow: WorkflowRule = {
      ...workflow,
      id,
      executionCount: 0,
      errorCount: 0
    };

    this.workflows.set(id, newWorkflow);
    this.executions.set(id, []);
    return newWorkflow;
  }

  async updateWorkflowRule(id: string, updates: Partial<WorkflowRule>): Promise<WorkflowRule | null> {
    const workflow = this.workflows.get(id);
    if (!workflow) return null;

    const updatedWorkflow = { ...workflow, ...updates } as WorkflowRule;
    this.workflows.set(id, updatedWorkflow);
    return updatedWorkflow;
  }

  async deleteWorkflowRule(id: string): Promise<boolean> {
    const deleted = this.workflows.delete(id);
    if (deleted) {
      this.executions.delete(id);
    }
    return deleted;
  }

  async executeWorkflow(ruleId: string, triggerData: Record<string, any>): Promise<WorkflowExecution> {
    const rule = this.workflows.get(ruleId);
    if (!rule || !rule.enabled) {
      throw new Error(`Workflow rule ${ruleId} not found or disabled`);
    }

    const execution: WorkflowExecution = {
      id: `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ruleId,
      status: 'running',
      startedAt: new Date().toISOString(),
      triggerData,
      actions: rule.actions.map(action => ({ ...action, status: 'pending' as const }))
    };

    // Store execution
    const executions = this.executions.get(ruleId) || [];
    executions.push(execution);
    this.executions.set(ruleId, executions);

    try {
      // Simulate workflow execution
      await this.simulateWorkflowExecution(execution, rule);
      
      // Update rule metrics
      const updatedRule = { ...rule };
      updatedRule.executionCount += 1;
      updatedRule.lastRun = execution.startedAt;
      updatedRule.successRate = updatedRule.executionCount > 0 
        ? ((updatedRule.executionCount - updatedRule.errorCount - 1) / updatedRule.executionCount) * 100
        : 100;
      
      this.workflows.set(ruleId, updatedRule);
      
      return execution;
    } catch (error) {
      execution.status = 'failed';
      execution.error = error instanceof Error ? error.message : 'Unknown error';
      
      // Update error count
      const rule = this.workflows.get(ruleId);
      if (rule) {
        rule.errorCount += 1;
        rule.status = 'error';
        this.workflows.set(ruleId, rule);
      }
      
      return execution;
    }
  }

  private async simulateWorkflowExecution(execution: WorkflowExecution, rule: WorkflowRule): Promise<void> {
    // Simulate execution delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Update actions status
    execution.actions = execution.actions.map(action => ({
      ...action,
      status: 'completed' as const,
      executedAt: new Date().toISOString()
    }));

    execution.status = 'completed';
    execution.completedAt = new Date().toISOString();
    execution.result = { message: 'Workflow completed successfully' };
  }

  async getWorkflowExecutions(ruleId: string, limit: number = 10): Promise<WorkflowExecution[]> {
    const executions = this.executions.get(ruleId) || [];
    return executions
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .slice(0, limit);
  }

  async getWorkflowMetrics(): Promise<WorkflowMetrics> {
    const workflows = Array.from(this.workflows.values());
    const totalExecutions = Array.from(this.executions.values())
      .reduce((total, executions) => total + executions.length, 0);
    const totalErrors = workflows.reduce((total, workflow) => total + workflow.errorCount, 0);
    const successRate = totalExecutions > 0 ? ((totalExecutions - totalErrors) / totalExecutions) * 100 : 0;

    return {
      totalRules: workflows.length,
      activeRules: workflows.filter(w => w.enabled && w.status === 'active').length,
      totalExecutions,
      successRate,
      errorCount: totalErrors,
      lastExecution: workflows
        .filter(w => w.lastRun)
        .sort((a, b) => new Date(b.lastRun!).getTime() - new Date(a.lastRun!).getTime())[0]?.lastRun
    };
  }

  async toggleWorkflow(ruleId: string): Promise<WorkflowRule | null> {
    const workflow = this.workflows.get(ruleId);
    if (!workflow) return null;

    const updatedWorkflow = {
      ...workflow,
      enabled: !workflow.enabled,
      status: (!workflow.enabled ? 'active' : 'paused') as 'active' | 'error' | 'paused'
    } as WorkflowRule;

    this.workflows.set(ruleId, updatedWorkflow);
    return updatedWorkflow;
  }

  async testWorkflow(ruleId: string): Promise<WorkflowExecution> {
    const testTriggerData = {
      test: true,
      timestamp: new Date().toISOString(),
      tenantId: 'test-tenant',
      amount: 100
    };

    return this.executeWorkflow(ruleId, testTriggerData);
  }
}

// Export singleton instance
export const billingWorkflowService = BillingWorkflowService.getInstance();

// React hook for billing workflows
import { useState, useEffect } from 'react';

export function useBillingWorkflows() {
  const [workflows, setWorkflows] = useState<WorkflowRule[]>([]);
  const [metrics, setMetrics] = useState<WorkflowMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadWorkflows();
  }, []);

  const loadWorkflows = async () => {
    setLoading(true);
    try {
      const [workflowData, metricsData] = await Promise.all([
        billingWorkflowService.getWorkflowRules(),
        billingWorkflowService.getWorkflowMetrics()
      ]);
      setWorkflows(workflowData);
      setMetrics(metricsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workflows');
    } finally {
      setLoading(false);
    }
  };

  const executeWorkflow = async (ruleId: string, triggerData: Record<string, any>) => {
    try {
      const execution = await billingWorkflowService.executeWorkflow(ruleId, triggerData);
      await loadWorkflows(); // Refresh data
      return execution;
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to execute workflow');
    }
  };

  const toggleWorkflow = async (ruleId: string) => {
    try {
      await billingWorkflowService.toggleWorkflow(ruleId);
      await loadWorkflows(); // Refresh data
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to toggle workflow');
    }
  };

  const testWorkflow = async (ruleId: string) => {
    try {
      const execution = await billingWorkflowService.testWorkflow(ruleId);
      await loadWorkflows(); // Refresh data
      return execution;
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to test workflow');
    }
  };

  const createWorkflow = async (workflow: Omit<WorkflowRule, 'id' | 'executionCount' | 'errorCount'>) => {
    try {
      await billingWorkflowService.createWorkflowRule(workflow);
      await loadWorkflows(); // Refresh data
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to create workflow');
    }
  };

  const updateWorkflow = async (id: string, updates: Partial<WorkflowRule>) => {
    try {
      await billingWorkflowService.updateWorkflowRule(id, updates);
      await loadWorkflows(); // Refresh data
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to update workflow');
    }
  };

  const deleteWorkflow = async (id: string) => {
    try {
      await billingWorkflowService.deleteWorkflowRule(id);
      await loadWorkflows(); // Refresh data
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to delete workflow');
    }
  };

  return {
    workflows,
    metrics,
    loading,
    error,
    executeWorkflow,
    toggleWorkflow,
    testWorkflow,
    createWorkflow,
    updateWorkflow,
    deleteWorkflow,
    refreshWorkflows: loadWorkflows
  };
}
