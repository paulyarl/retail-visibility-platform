/**
 * Predictive Analytics and AI Insights
 * 
 * AI-powered analytics with:
 * - Predictive demand forecasting
 * - Price optimization recommendations
 * - Inventory optimization insights
 * - Customer behavior analysis
 * - Market trend predictions
 * - AI-powered recommendations
 * - Anomaly detection
 * - Performance predictions
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, Badge, Button, Tooltip, Progress, Modal, ModalFooter } from '@/components/ui';
import { 
  Brain, 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Zap, 
  AlertTriangle, 
  CheckCircle, 
  BarChart3, 
  PieChart, 
  Activity,
  Lightbulb,
  Eye,
  DollarSign,
  Package,
  Users,
  Calendar,
  Settings,
  Download,
  RefreshCw
} from 'lucide-react';

interface PredictiveAnalyticsProps {
  tenantId: string;
  onInsightAction: (insight: AIInsight) => void;
  onModelRetrain: () => void;
  onExportReport: (reportType: string) => void;
}

interface AIInsight {
  id: string;
  type: 'demand_forecast' | 'price_optimization' | 'inventory_optimization' | 'customer_behavior' | 'market_trend' | 'anomaly_detection';
  title: string;
  description: string;
  confidence: number;
  impact: 'low' | 'medium' | 'high' | 'critical';
  priority: 'low' | 'medium' | 'high';
  data: any;
  recommendations: Recommendation[];
  timestamp: string;
  modelVersion: string;
  accuracy: number;
}

interface Recommendation {
  id: string;
  action: string;
  description: string;
  expectedOutcome: string;
  effort: 'low' | 'medium' | 'high';
  timeframe: 'immediate' | 'short' | 'medium' | 'long';
  confidence: number;
}

interface PredictiveModel {
  id: string;
  name: string;
  type: 'demand' | 'price' | 'inventory' | 'customer' | 'market';
  accuracy: number;
  lastTrained: string;
  dataPoints: number;
  features: string[];
  performance: {
    precision: number;
    recall: number;
    f1Score: number;
  };
}

interface AnomalyDetection {
  id: string;
  productId: string;
  productName: string;
  anomalyType: 'sales_spike' | 'inventory_glitch' | 'price_mismatch' | 'demand_drop' | 'unusual_pattern';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  detectedAt: string;
  confidence: number;
  suggestedAction: string;
}

interface MarketTrend {
  category: string;
  trend: 'rising' | 'stable' | 'declining';
  confidence: number;
  factors: TrendFactor[];
  prediction: string;
  timeframe: string;
}

interface TrendFactor {
  factor: string;
  weight: number;
  description: string;
  currentValue: number;
  historicalAverage: number;
}

/**
 * Predictive Analytics and AI Insights Component
 */
export default function PredictiveAnalytics({
  tenantId,
  onInsightAction,
  onModelRetrain,
  onExportReport,
}: PredictiveAnalyticsProps) {
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [models, setModels] = useState<PredictiveModel[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyDetection[]>([]);
  const [marketTrends, setMarketTrends] = useState<MarketTrend[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedInsight, setSelectedInsight] = useState<AIInsight | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Mock data - in production, fetch from AI/ML API
  useEffect(() => {
    // Simulate loading AI insights
    setInsights([
      {
        id: 'insight-1',
        type: 'demand_forecast',
        title: 'Wireless Headphones Demand Surge',
        description: 'AI predicts 45% increase in demand for wireless headphones over next 30 days',
        confidence: 87,
        impact: 'high',
        priority: 'high',
        data: {
          currentDemand: 120,
          predictedDemand: 174,
          timeframe: '30 days',
          factors: ['seasonal_trend', 'market_growth', 'competitor_shortage'],
        },
        recommendations: [
          {
            id: 'rec-1',
            action: 'Increase Stock',
            description: 'Increase inventory by 50 units to meet predicted demand',
            expectedOutcome: 'Prevent stockouts, capture additional sales',
            effort: 'low',
            timeframe: 'short',
            confidence: 85,
          },
          {
            id: 'rec-2',
            action: 'Price Optimization',
            description: 'Consider 5% price increase to maximize revenue',
            expectedOutcome: 'Increase revenue by 12% while maintaining demand',
            effort: 'medium',
            timeframe: 'medium',
            confidence: 72,
          },
        ],
        timestamp: new Date().toISOString(),
        modelVersion: 'v2.1.0',
        accuracy: 92.3,
      },
      {
        id: 'insight-2',
        type: 'price_optimization',
        title: 'Bluetooth Speaker Price Mismatch',
        description: 'AI identifies pricing opportunity for Bluetooth speakers',
        confidence: 91,
        impact: 'medium',
        priority: 'medium',
        data: {
          currentPrice: 79.99,
          optimalPrice: 89.99,
          elasticity: -0.8,
          competitorPrices: [69.99, 84.99, 94.99],
        },
        recommendations: [
          {
            id: 'rec-3',
            action: 'Adjust Price',
            description: 'Increase price to $89.99 to optimize revenue',
            expectedOutcome: 'Increase revenue by 15% with minimal demand impact',
            effort: 'low',
            timeframe: 'immediate',
            confidence: 88,
          },
        ],
        timestamp: new Date().toISOString(),
        modelVersion: 'v2.1.0',
        accuracy: 89.7,
      },
      {
        id: 'insight-3',
        type: 'inventory_optimization',
        title: 'Dead Stock Identification',
        description: 'AI identifies 8 products with no sales in 90 days',
        confidence: 95,
        impact: 'medium',
        priority: 'medium',
        data: {
          deadStockCount: 8,
          totalValue: 2450.00,
          categories: ['accessories', 'electronics'],
        },
        recommendations: [
          {
            id: 'rec-4',
            action: 'Clearance Promotion',
            description: 'Run 50% off promotion to clear dead stock',
            expectedOutcome: 'Recover 60% of inventory value',
            effort: 'medium',
            timeframe: 'short',
            confidence: 78,
          },
        ],
        timestamp: new Date().toISOString(),
        modelVersion: 'v2.1.0',
        accuracy: 96.1,
      },
    ]);

    // Simulate loading predictive models
    setModels([
      {
        id: 'model-1',
        name: 'Demand Forecast Model',
        type: 'demand',
        accuracy: 92.3,
        lastTrained: new Date(Date.now() - 86400000 * 7).toISOString(),
        dataPoints: 15680,
        features: ['historical_sales', 'seasonal_patterns', 'market_trends', 'competitor_pricing'],
        performance: {
          precision: 0.91,
          recall: 0.89,
          f1Score: 0.90,
        },
      },
      {
        id: 'model-2',
        name: 'Price Optimization Model',
        type: 'price',
        accuracy: 89.7,
        lastTrained: new Date(Date.now() - 86400000 * 3).toISOString(),
        dataPoints: 12450,
        features: ['price_elasticity', 'competitor_pricing', 'demand_patterns', 'seasonal_factors'],
        performance: {
          precision: 0.87,
          recall: 0.92,
          f1Score: 0.89,
        },
      },
      {
        id: 'model-3',
        name: 'Customer Behavior Model',
        type: 'customer',
        accuracy: 85.2,
        lastTrained: new Date(Date.now() - 86400000 * 14).toISOString(),
        dataPoints: 23400,
        features: ['browsing_patterns', 'purchase_history', 'seasonal_preferences', 'demographic_data'],
        performance: {
          precision: 0.83,
          recall: 0.88,
          f1Score: 0.85,
        },
      },
    ]);

    // Simulate loading anomalies
    setAnomalies([
      {
        id: 'anomaly-1',
        productId: 'prod-1',
        productName: 'Wireless Headphones',
        anomalyType: 'sales_spike',
        severity: 'high',
        description: 'Unusual 300% increase in sales over 24 hours',
        detectedAt: new Date(Date.now() - 86400000).toISOString(),
        confidence: 92,
        suggestedAction: 'Investigate marketing campaign effectiveness',
      },
      {
        id: 'anomaly-2',
        productId: 'prod-2',
        productName: 'Bluetooth Speaker',
        anomalyType: 'demand_drop',
        severity: 'medium',
        description: '40% drop in demand over 7 days',
        detectedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
        confidence: 78,
        suggestedAction: 'Review pricing and marketing strategy',
      },
    ]);

    // Simulate loading market trends
    setMarketTrends([
      {
        category: 'Audio Equipment',
        trend: 'rising',
        confidence: 88,
        factors: [
          { factor: 'Remote Work', weight: 0.4, description: 'Increased remote work drives audio demand', currentValue: 0.8, historicalAverage: 0.5 },
          { factor: 'Gaming Growth', weight: 0.3, description: 'Gaming industry growth', currentValue: 0.7, historicalAverage: 0.4 },
          { factor: 'Technology Adoption', weight: 0.3, description: 'Wireless technology adoption', currentValue: 0.9, historicalAverage: 0.6 },
        ],
        prediction: 'Continued growth expected through Q4 2024',
        timeframe: '6 months',
      },
      {
        category: 'Wearable Devices',
        trend: 'stable',
        confidence: 75,
        factors: [
          { factor: 'Market Saturation', weight: 0.5, description: 'Market reaching saturation', currentValue: 0.8, historicalAverage: 0.7 },
          { factor: 'New Innovations', weight: 0.3, description: 'New product innovations', currentValue: 0.6, historicalAverage: 0.6 },
          { factor: 'Competition', weight: 0.2, description: 'Increased competition', currentValue: 0.7, historicalAverage: 0.5 },
        ],
        prediction: 'Stable demand with seasonal fluctuations',
        timeframe: '3 months',
      },
    ]);
  }, [tenantId]);

  // Refresh analytics
  const refreshAnalytics = useCallback(async () => {
    setIsProcessing(true);
    try {
      // Simulate API call to refresh AI analytics
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log('Refreshing AI analytics...');
      
    } catch (error) {
      console.error('Error refreshing analytics:', error);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Get insight type icon
  const getInsightTypeIcon = (type: AIInsight['type']) => {
    switch (type) {
      case 'demand_forecast': return <TrendingUp className="w-4 h-4" />;
      case 'price_optimization': return <DollarSign className="w-4 h-4" />;
      case 'inventory_optimization': return <Package className="w-4 h-4" />;
      case 'customer_behavior': return <Users className="w-4 h-4" />;
      case 'market_trend': return <BarChart3 className="w-4 h-4" />;
      case 'anomaly_detection': return <AlertTriangle className="w-4 h-4" />;
      default: return <Brain className="w-4 h-4" />;
    }
  };

  // Get impact color
  const getImpactColor = (impact: AIInsight['impact']) => {
    switch (impact) {
      case 'low': return 'text-blue-600 bg-blue-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'critical': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  // Get priority color
  const getPriorityColor = (priority: AIInsight['priority']) => {
    switch (priority) {
      case 'low': return 'text-gray-600';
      case 'medium': return 'text-yellow-600';
      case 'high': return 'text-orange-600';
      default: return 'text-gray-600';
    }
  };

  // Get trend icon
  const getTrendIcon = (trend: MarketTrend['trend']) => {
    switch (trend) {
      case 'rising': return <TrendingUp className="w-4 h-4 text-green-600" />;
      case 'declining': return <TrendingDown className="w-4 h-4 text-red-600" />;
      case 'stable': return <Activity className="w-4 h-4 text-gray-600" />;
      default: return <Activity className="w-4 h-4 text-gray-600" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-600" />
            AI Analytics & Insights
          </h3>
          <Badge variant="info" className="text-xs">
            {insights.length} Active Insights
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={refreshAnalytics}
            disabled={isProcessing}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
            {isProcessing ? 'Analyzing...' : 'Refresh'}
          </Button>
          <Button
            variant="outline"
            onClick={() => onModelRetrain()}
            className="flex items-center gap-2"
          >
            <Zap className="w-4 h-4" />
            Retrain Models
          </Button>
          <Button
            variant="outline"
            onClick={() => onExportReport('ai-analytics')}
            className="flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Model Performance */}
      <Card>
        <CardContent className="p-6">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-4">AI Model Performance</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {models.map((model) => (
              <div key={model.id} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <h5 className="font-medium text-gray-900 dark:text-white">{model.name}</h5>
                  <Badge variant="default" className="text-xs">
                    {model.type}
                  </Badge>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Accuracy:</span>
                    <span className="font-medium text-green-600">{model.accuracy}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Data Points:</span>
                    <span className="font-medium">{model.dataPoints.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">F1 Score:</span>
                    <span className="font-medium">{(model.performance.f1Score * 100).toFixed(1)}%</span>
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  Last trained: {new Date(model.lastTrained).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* AI Insights */}
      <div className="space-y-4">
        <h4 className="font-semibold text-gray-900 dark:text-white">AI Insights</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {insights.map((insight) => (
            <Card key={insight.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="text-purple-600">
                      {getInsightTypeIcon(insight.type)}
                    </div>
                    <div>
                      <h5 className="font-medium text-gray-900 dark:text-white">{insight.title}</h5>
                      <p className="text-sm text-gray-500">{insight.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedInsight(insight);
                        setShowDetailsModal(true);
                      }}
                      className="h-7 w-7 p-0"
                    >
                      <Eye className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Confidence:</span>
                    <div className="flex items-center gap-1">
                      <Progress value={insight.confidence} className="h-2 w-20" />
                      <span className="font-medium">{insight.confidence}%</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className={`text-xs ${getImpactColor(insight.impact)}`}>
                      {insight.impact}
                    </Badge>
                    <Badge variant="default" className={`text-xs ${getPriorityColor(insight.priority)}`}>
                      {insight.priority}
                    </Badge>
                    <Badge variant="default" className="text-xs">
                      {insight.modelVersion}
                    </Badge>
                  </div>

                  {insight.recommendations.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Recommendations:</span>
                      <div className="space-y-1">
                        {insight.recommendations.slice(0, 2).map((rec) => (
                          <div key={rec.id} className="flex items-start gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                            <Lightbulb className="w-4 h-4 text-blue-600 mt-0.5" />
                            <div className="flex-1">
                              <p className="text-sm text-gray-900 dark:text-white font-medium">{rec.action}</p>
                              <p className="text-xs text-gray-600">{rec.description}</p>
                              <div className="flex items-center gap-2 mt-1 text-xs">
                                <span className="text-gray-500">Impact: {rec.expectedOutcome}</span>
                                <span className="text-gray-500">Effort: {rec.effort}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Anomaly Detection */}
      <Card>
        <CardContent className="p-6">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Anomaly Detection</h4>
          <div className="space-y-3">
            {anomalies.map((anomaly) => (
              <div key={anomaly.id} className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                <div className={`mt-1 ${
                  anomaly.severity === 'critical' ? 'text-red-600' :
                  anomaly.severity === 'high' ? 'text-orange-600' :
                  anomaly.severity === 'medium' ? 'text-yellow-600' :
                  'text-blue-600'
                }`}>
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h5 className="font-medium text-gray-900 dark:text-white">{anomaly.productName}</h5>
                    <Badge variant="default" className={`text-xs ${
                      anomaly.severity === 'critical' ? 'text-red-600' :
                      anomaly.severity === 'high' ? 'text-orange-600' :
                      anomaly.severity === 'medium' ? 'text-yellow-600' :
                      'text-blue-600'
                    }`}>
                      {anomaly.anomalyType.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{anomaly.description}</p>
                  <div className="flex items-center justify-between mt-2 text-xs">
                    <span className="text-gray-500">Detected: {new Date(anomaly.detectedAt).toLocaleDateString()}</span>
                    <span className="text-gray-500">Confidence: {anomaly.confidence}%</span>
                  </div>
                  <p className="text-xs text-blue-600 mt-1">
                    <strong>Suggested Action:</strong> {anomaly.suggestedAction}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Market Trends */}
      <Card>
        <CardContent className="p-6">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Market Trends</h4>
          <div className="space-y-4">
            {marketTrends.map((trend, index) => (
              <div key={index} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {getTrendIcon(trend.trend)}
                    <div>
                      <h5 className="font-medium text-gray-900 dark:text-white">{trend.category}</h5>
                      <p className="text-sm text-gray-500">{trend.prediction}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className={`text-xs ${
                      trend.trend === 'rising' ? 'text-green-600' :
                      trend.trend === 'declining' ? 'text-red-600' :
                      'text-gray-600'
                    }`}>
                      {trend.trend}
                    </Badge>
                    <Badge variant="default" className="text-xs">
                      {trend.confidence}% confidence
                    </Badge>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">Key Factors:</span>
                  </div>
                  <div className="space-y-1">
                    {trend.factors.map((factor, factorIndex) => (
                      <div key={factorIndex} className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">{factor.description}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-600">Weight: {(factor.weight * 100).toFixed(0)}%</span>
                          <span className={`${
                            factor.currentValue > factor.historicalAverage ? 'text-green-600' :
                            factor.currentValue < factor.historicalAverage ? 'text-red-600' :
                            'text-gray-600'
                          }`}>
                            {factor.currentValue > factor.historicalAverage ? '↑' : factor.currentValue < factor.historicalAverage ? '↓' : '→'} {Math.abs(factor.currentValue - factor.historicalAverage).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="text-xs text-gray-500 mt-2">
                  Timeframe: {trend.timeframe}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Insight Details Modal */}
      {showDetailsModal && selectedInsight && (
        <Modal
          isOpen={showDetailsModal}
          onClose={() => setShowDetailsModal(false)}
          title={selectedInsight.title}
          description={selectedInsight.description}
        >
          <div className="space-y-6">
            {/* Insight Details */}
            <div>
              <h5 className="font-medium text-gray-900 dark:text-white mb-3">Insight Details</h5>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Type:</span>
                  <div className="flex items-center gap-2">
                    {getInsightTypeIcon(selectedInsight.type)}
                    <span className="font-medium capitalize">{selectedInsight.type.replace('_', ' ')}</span>
                  </div>
                </div>
                <div>
                  <span className="text-gray-500">Confidence:</span>
                  <div className="flex items-center gap-2">
                    <Progress value={selectedInsight.confidence} className="h-2 w-32" />
                    <span className="font-medium">{selectedInsight.confidence}%</span>
                  </div>
                </div>
                <div>
                  <span className="text-gray-500">Model Version:</span>
                  <span className="font-medium">{selectedInsight.modelVersion}</span>
                </div>
                <div>
                  <span className="text-gray-500">Accuracy:</span>
                  <span className="font-medium text-green-600">{selectedInsight.accuracy}%</span>
                </div>
              </div>
            </div>

            {/* Data Visualization */}
            <div>
              <h5 className="font-medium text-gray-900 dark:text-white mb-3">Data Analysis</h5>
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <pre className="text-xs text-gray-700 dark:text-gray-300 overflow-x-auto">
                  {JSON.stringify(selectedInsight.data, null, 2)}
                </pre>
              </div>
            </div>

            {/* Recommendations */}
            <div>
              <h5 className="font-medium text-gray-900 dark:text-white mb-3">Recommendations</h5>
              <div className="space-y-3">
                {selectedInsight.recommendations.map((rec) => (
                  <div key={rec.id} className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-start gap-3">
                      <Lightbulb className="w-5 h-5 text-blue-600 mt-0.5" />
                      <div className="flex-1">
                        <h6 className="font-medium text-gray-900 dark:text-white">{rec.action}</h6>
                        <p className="text-sm text-gray-700 dark:text-gray-300">{rec.description}</p>
                        <div className="flex items-center gap-4 mt-2 text-sm">
                          <div>
                            <span className="text-gray-500">Expected Outcome:</span>
                            <p className="font-medium text-gray-900 dark:text-white">{rec.expectedOutcome}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Effort:</span>
                            <p className="font-medium text-gray-900 dark:text-white">{rec.effort}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Timeframe:</span>
                            <p className="font-medium text-gray-900 dark:text-white">{rec.timeframe}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Confidence:</span>
                            <p className="font-medium text-gray-900 dark:text-white">{rec.confidence}%</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onInsightAction(selectedInsight)}
                            className="flex-1"
                          >
                            Apply Recommendation
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <ModalFooter>
            <Button variant="ghost" onClick={() => setShowDetailsModal(false)}>
              Close
            </Button>
            <Button
              onClick={() => {
                onInsightAction(selectedInsight);
                setShowDetailsModal(false);
              }}
              className="bg-primary-600 hover:bg-primary-700"
            >
              Apply All Recommendations
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}
