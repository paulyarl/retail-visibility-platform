/**
 * Automated Inventory Management System
 * 
 * Automated inventory management with:
 * - Automated stock level monitoring
 * - Smart reordering based on sales trends
 * - Predictive demand forecasting
 * - Automated price optimization
 * - Inventory health scoring
 * - Automated alerts and notifications
 * - Integration with suppliers
 * - Batch processing and scheduling
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, Badge, Button, Tooltip, Progress, Alert } from '@/components/ui';
import { 
  Bot, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  Package, 
  DollarSign, 
  Clock, 
  Settings, 
  Play, 
  Pause, 
  RefreshCw,
  BarChart3,
  Zap,
  Bell,
  CheckCircle,
  XCircle,
  Calendar,
  Target,
  Activity
} from 'lucide-react';
import { clientLogger } from '@/lib/client-logger';

interface AutomatedInventoryProps {
  tenantId: string;
  onAutomationEnabled: (enabled: boolean) => void;
  onRuleCreate: (rule: AutomationRule) => void;
  onRuleUpdate: (rule: AutomationRule) => void;
  onRuleDelete: (ruleId: string) => void;
}

interface AutomationRule {
  id: string;
  name: string;
  description: string;
  type: 'reorder' | 'price_optimization' | 'stock_alert' | 'demand_forecast' | 'health_check';
  enabled: boolean;
  conditions: RuleCondition[];
  actions: RuleAction[];
  schedule: RuleSchedule;
  lastRun?: string;
  nextRun?: string;
  performance: {
    totalRuns: number;
    successRate: number;
    averageExecutionTime: number;
  };
}

interface RuleCondition {
  field: 'stock_level' | 'sales_velocity' | 'price' | 'category' | 'seasonal';
  operator: 'less_than' | 'greater_than' | 'equals' | 'between' | 'trend_up' | 'trend_down';
  value: any;
  threshold?: number;
}

interface RuleAction {
  type: 'reorder' | 'adjust_price' | 'send_alert' | 'update_status' | 'create_task';
  parameters: any;
}

interface RuleSchedule {
  frequency: 'real_time' | 'hourly' | 'daily' | 'weekly' | 'monthly';
  timezone: string;
  nextRun: string;
}

interface InventoryHealth {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  issues: HealthIssue[];
  recommendations: HealthRecommendation[];
  lastAssessment: string;
}

interface HealthIssue {
  id: string;
  type: 'low_stock' | 'overstock' | 'slow_moving' | 'dead_stock' | 'price_mismatch';
  severity: 'low' | 'medium' | 'high' | 'critical';
  productId: string;
  productName: string;
  description: string;
  impact: number;
  recommendation: string;
}

interface HealthRecommendation {
  id: string;
  type: 'reorder' | 'price_adjustment' | 'promotion' | 'discontinue';
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  expectedImpact: string;
  effort: 'low' | 'medium' | 'high';
}

interface DemandForecast {
  productId: string;
  productName: string;
  currentStock: number;
  forecast30Days: number;
  forecast90Days: number;
  confidence: number;
  factors: ForecastFactor[];
  recommendation: string;
}

interface ForecastFactor {
  factor: string;
  impact: number;
  description: string;
}

/**
 * Automated Inventory Management System
 */
export default function AutomatedInventory({
  tenantId,
  onAutomationEnabled,
  onRuleCreate,
  onRuleUpdate,
  onRuleDelete,
}: AutomatedInventoryProps) {
  const [automationEnabled, setAutomationEnabled] = useState(true);
  const [activeRules, setActiveRules] = useState<AutomationRule[]>([]);
  const [inventoryHealth, setInventoryHealth] = useState<InventoryHealth | null>(null);
  const [demandForecasts, setDemandForecasts] = useState<DemandForecast[]>([]);
  const [systemAlerts, setSystemAlerts] = useState<any[]>([]);
  const [showCreateRuleModal, setShowCreateRuleModal] = useState(false);
  const [selectedRule, setSelectedRule] = useState<AutomationRule | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Mock data - in production, fetch from API
  useEffect(() => {
    // Simulate loading automation rules
    setActiveRules([
      {
        id: 'rule-1',
        name: 'Low Stock Reorder',
        description: 'Automatically reorder products when stock falls below threshold',
        type: 'reorder',
        enabled: true,
        conditions: [
          { field: 'stock_level', operator: 'less_than', value: 10, threshold: 10 }
        ],
        actions: [
          { type: 'reorder', parameters: { quantity: 50, supplier: 'default' } }
        ],
        schedule: {
          frequency: 'real_time',
          timezone: 'UTC',
          nextRun: new Date().toISOString(),
        },
        performance: {
          totalRuns: 156,
          successRate: 98.7,
          averageExecutionTime: 2.3,
        },
      },
      {
        id: 'rule-2',
        name: 'Price Optimization',
        description: 'Adjust prices based on demand and competition',
        type: 'price_optimization',
        enabled: true,
        conditions: [
          { field: 'sales_velocity', operator: 'trend_down', value: 0.2 }
        ],
        actions: [
          { type: 'adjust_price', parameters: { adjustment: -10, maxDecrease: 25 } }
        ],
        schedule: {
          frequency: 'daily',
          timezone: 'UTC',
          nextRun: new Date(Date.now() + 86400000).toISOString(),
        },
        performance: {
          totalRuns: 45,
          successRate: 91.1,
          averageExecutionTime: 15.7,
        },
      },
      {
        id: 'rule-3',
        name: 'Stock Health Check',
        description: 'Monitor inventory health and identify issues',
        type: 'health_check',
        enabled: true,
        conditions: [],
        actions: [
          { type: 'send_alert', parameters: { threshold: 70 } }
        ],
        schedule: {
          frequency: 'weekly',
          timezone: 'UTC',
          nextRun: new Date(Date.now() + 604800000).toISOString(),
        },
        performance: {
          totalRuns: 12,
          successRate: 100,
          averageExecutionTime: 45.2,
        },
      },
    ]);

    // Simulate loading inventory health
    setInventoryHealth({
      score: 82,
      grade: 'B',
      issues: [
        {
          id: 'issue-1',
          type: 'low_stock',
          severity: 'high',
          productId: 'prod-1',
          productName: 'Wireless Headphones',
          description: 'Stock level critically low',
          impact: 85,
          recommendation: 'Reorder immediately to avoid stockouts',
        },
        {
          id: 'issue-2',
          type: 'slow_moving',
          severity: 'medium',
          productId: 'prod-2',
          productName: 'Bluetooth Speaker',
          description: 'Product not selling well',
          impact: 45,
          recommendation: 'Consider promotion or price reduction',
        },
      ],
      recommendations: [
        {
          id: 'rec-1',
          type: 'reorder',
          priority: 'high',
          title: 'Reorder Wireless Headphones',
          description: 'Stock at critical level, reorder 50 units',
          expectedImpact: 'Prevent stockouts, maintain sales',
          effort: 'low',
        },
        {
          id: 'rec-2',
          type: 'price_adjustment',
          priority: 'medium',
          title: 'Adjust Bluetooth Speaker Price',
          description: 'Reduce price by 15% to increase sales velocity',
          expectedImpact: 'Increase sales by 30%',
          effort: 'medium',
        },
      ],
      lastAssessment: new Date().toISOString(),
    });

    // Simulate loading demand forecasts
    setDemandForecasts([
      {
        productId: 'prod-1',
        productName: 'Wireless Headphones',
        currentStock: 8,
        forecast30Days: 45,
        forecast90Days: 120,
        confidence: 87,
        factors: [
          { factor: 'Seasonal Trend', impact: 0.3, description: 'Increasing demand for audio products' },
          { factor: 'Historical Sales', impact: 0.5, description: 'Strong sales in last 3 months' },
          { factor: 'Market Growth', impact: 0.2, description: 'Category growing 15% YoY' },
        ],
        recommendation: 'Increase stock to 50 units to meet forecasted demand',
      },
      {
        productId: 'prod-2',
        productName: 'Bluetooth Speaker',
        currentStock: 25,
        forecast30Days: 8,
        forecast90Days: 15,
        confidence: 72,
        factors: [
          { factor: 'Seasonal Trend', impact: -0.2, description: 'Declining demand for speakers' },
          { factor: 'Historical Sales', impact: -0.4, description: 'Sales down 40% from last year' },
          { factor: 'Competition', impact: -0.3, description: 'New competitors entered market' },
        ],
        recommendation: 'Reduce stock to 15 units, consider promotion',
      },
    ]);
  }, [tenantId]);

  // Toggle automation
  const toggleAutomation = useCallback(() => {
    const newState = !automationEnabled;
    setAutomationEnabled(newState);
    onAutomationEnabled(newState);
  }, [automationEnabled, onAutomationEnabled]);

  // Run automation rules
  const runAutomation = useCallback(async () => {
    setIsProcessing(true);
    try {
      // Simulate running automation rules
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // In production, this would make API calls to run each rule
      console.log('Running automation rules...');
      
    } catch (error) {
      clientLogger.error('Error running automation:', { detail: error });
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Get rule type icon
  const getRuleTypeIcon = (type: AutomationRule['type']) => {
    switch (type) {
      case 'reorder': return <Package className="w-4 h-4" />;
      case 'price_optimization': return <DollarSign className="w-4 h-4" />;
      case 'stock_alert': return <AlertTriangle className="w-4 h-4" />;
      case 'demand_forecast': return <TrendingUp className="w-4 h-4" />;
      case 'health_check': return <Activity className="w-4 h-4" />;
      default: return <Bot className="w-4 h-4" />;
    }
  };

  // Get health grade color
  const getHealthGradeColor = (grade: InventoryHealth['grade']) => {
    switch (grade) {
      case 'A': return 'text-green-600 bg-green-100';
      case 'B': return 'text-blue-600 bg-blue-100';
      case 'C': return 'text-yellow-600 bg-yellow-100';
      case 'D': return 'text-orange-600 bg-orange-100';
      case 'F': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  // Get severity color
  const getSeverityColor = (severity: HealthIssue['severity']) => {
    switch (severity) {
      case 'low': return 'text-blue-600';
      case 'medium': return 'text-yellow-600';
      case 'high': return 'text-orange-600';
      case 'critical': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Automated Inventory</h3>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${automationEnabled ? 'bg-green-500' : 'bg-gray-400'}`} />
            <span className="text-sm text-gray-600">
              {automationEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={automationEnabled ? 'default' : 'outline'}
            onClick={toggleAutomation}
            className="flex items-center gap-2"
          >
            {automationEnabled ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {automationEnabled ? 'Disable' : 'Enable'} Automation
          </Button>
          <Button
            variant="outline"
            onClick={runAutomation}
            disabled={!automationEnabled || isProcessing}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
            {isProcessing ? 'Running...' : 'Run Now'}
          </Button>
        </div>
      </div>

      {/* Inventory Health Overview */}
      {inventoryHealth && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-gray-900 dark:text-white">Inventory Health</h4>
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${getHealthGradeColor(inventoryHealth.grade)}`}>
                Grade {inventoryHealth.grade} ({inventoryHealth.score}/100)
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{inventoryHealth.issues.length}</div>
                <div className="text-sm text-gray-500">Issues Found</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{inventoryHealth.recommendations.length}</div>
                <div className="text-sm text-gray-500">Recommendations</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {inventoryHealth.recommendations.filter(r => r.priority === 'high').length}
                </div>
                <div className="text-sm text-gray-500">High Priority</div>
              </div>
            </div>

            <Progress value={inventoryHealth.score} className="h-2" />
          </CardContent>
        </Card>
      )}

      {/* Active Rules */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-gray-900 dark:text-white">Active Rules ({activeRules.filter(r => r.enabled).length})</h4>
          <Button
            variant="outline"
            onClick={() => setShowCreateRuleModal(true)}
            className="flex items-center gap-2"
          >
            <Bot className="w-4 h-4" />
            Create Rule
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeRules.map((rule) => (
            <Card key={rule.id} className={`${!rule.enabled ? 'opacity-50' : ''}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="text-primary-600">
                      {getRuleTypeIcon(rule.type)}
                    </div>
                    <div>
                      <h5 className="font-medium text-gray-900 dark:text-white">{rule.name}</h5>
                      <p className="text-sm text-gray-500">{rule.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedRule(rule)}
                      className="h-7 w-7 p-0"
                    >
                      <Settings className="w-3 h-3" />
                    </Button>
                    <div className={`w-2 h-2 rounded-full ${rule.enabled ? 'bg-green-500' : 'bg-gray-400'}`} />
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Success Rate:</span>
                    <span className="font-medium text-green-600">{rule.performance.successRate}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Total Runs:</span>
                    <span className="font-medium">{rule.performance.totalRuns}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Next Run:</span>
                    <span className="font-medium">
                      {rule.nextRun ? new Date(rule.nextRun).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                  <Badge variant={rule.enabled ? 'success' : 'default'} className="text-xs">
                    {rule.enabled ? 'Active' : 'Inactive'}
                  </Badge>
                  <Badge variant="info" className="text-xs">
                    {rule.schedule.frequency}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Demand Forecasts */}
      <div className="space-y-4">
        <h4 className="font-semibold text-gray-900 dark:text-white">Demand Forecasts</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {demandForecasts.map((forecast) => (
            <Card key={forecast.productId}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h5 className="font-medium text-gray-900 dark:text-white">{forecast.productName}</h5>
                  <div className={`px-2 py-1 rounded text-xs font-medium ${
                    forecast.confidence > 80 ? 'bg-green-100 text-green-800' :
                    forecast.confidence > 60 ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {forecast.confidence}% confidence
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 text-sm mb-3">
                  <div>
                    <span className="text-gray-500">Current:</span>
                    <div className="font-medium">{forecast.currentStock}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">30 Days:</span>
                    <div className={`font-medium ${forecast.forecast30Days > forecast.currentStock ? 'text-red-600' : 'text-green-600'}`}>
                      {forecast.forecast30Days}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500">90 Days:</span>
                    <div className={`font-medium ${forecast.forecast90Days > forecast.currentStock ? 'text-red-600' : 'text-green-600'}`}>
                      {forecast.forecast90Days}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm">
                    <span className="text-gray-500">Recommendation:</span>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {forecast.recommendation}
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-1">
                    {forecast.factors.map((factor, index) => (
                      <Tooltip key={index} content={`${factor.description} (${(factor.impact * 100).toFixed(0)}% impact)`}>
                        <Badge variant="default" className="text-xs">
                          {factor.factor}
                        </Badge>
                      </Tooltip>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Issues & Recommendations */}
      {inventoryHealth && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Issues */}
          <Card>
            <CardContent className="p-6">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Issues Detected</h4>
              <div className="space-y-3">
                {inventoryHealth.issues.map((issue) => (
                  <div key={issue.id} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className={`mt-1 ${getSeverityColor(issue.severity)}`}>
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h5 className="font-medium text-gray-900 dark:text-white">{issue.productName}</h5>
                        <Badge variant="default" className={`text-xs ${getSeverityColor(issue.severity)}`}>
                          {issue.severity}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{issue.description}</p>
                      <p className="text-xs text-gray-500 mt-1">Impact: {issue.impact}%</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recommendations */}
          <Card>
            <CardContent className="p-6">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Recommendations</h4>
              <div className="space-y-3">
                {inventoryHealth.recommendations.map((rec) => (
                  <div key={rec.id} className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="mt-1 text-blue-600">
                      <Target className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h5 className="font-medium text-gray-900 dark:text-white">{rec.title}</h5>
                        <Badge variant="default" className={`text-xs ${
                          rec.priority === 'high' ? 'text-red-600' :
                          rec.priority === 'medium' ? 'text-yellow-600' :
                          'text-gray-600'
                        }`}>
                          {rec.priority}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{rec.description}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span>Impact: {rec.expectedImpact}</span>
                        <span>Effort: {rec.effort}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
