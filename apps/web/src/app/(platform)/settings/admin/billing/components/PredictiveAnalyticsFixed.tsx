'use client';

import { useState } from 'react';
import { 
  Card, 
  Text, 
  Group, 
  Badge, 
  Stack, 
  Grid, 
  Progress,
  Button,
  Select,
  ActionIcon,
  Tooltip,
  LoadingOverlay,
  Alert
} from '@mantine/core';
import { 
  IconBrain,
  IconTrendingUp,
  IconTrendingDown,
  IconAlertTriangle,
  IconRefresh,
  IconChartBar,
  IconBulb,
  IconTarget
} from '@tabler/icons-react';

interface PredictiveAnalyticsProps {
  refreshInterval?: number;
}

interface Prediction {
  id: string;
  type: string;
  title: string;
  description: string;
  confidence: number;
  impact: 'high' | 'medium' | 'low';
  timeframe: string;
  status: 'active' | 'pending' | 'resolved';
}

interface RevenueForecast {
  month: string;
  predicted: number;
  actual?: number;
  confidence: number;
}

interface ChurnRisk {
  tenantId: string;
  tenantName: string;
  risk: 'high' | 'medium' | 'low';
  score: number;
  reasons: string[];
  recommendedAction: string;
}

export function PredictiveAnalyticsFixed({ refreshInterval = 60000 }: PredictiveAnalyticsProps) {
  const [selectedPeriod, setSelectedPeriod] = useState('90d');
  const [isLoading, setIsLoading] = useState(false);

  // Mock data for now - would be fetched from API
  const predictions: Prediction[] = [
    {
      id: '1',
      type: 'revenue',
      title: 'Revenue Growth Expected',
      description: 'Based on current trends, revenue is expected to increase by 15% next month',
      confidence: 87,
      impact: 'high',
      timeframe: '30 days',
      status: 'active'
    },
    {
      id: '2',
      type: 'churn',
      title: 'High Churn Risk Detected',
      description: '5 tenants show signs of potential churn based on usage patterns',
      confidence: 72,
      impact: 'medium',
      timeframe: '60 days',
      status: 'active'
    },
    {
      id: '3',
      type: 'opportunity',
      title: 'Upsell Opportunity',
      description: '12 tenants are likely candidates for premium tier upgrade',
      confidence: 68,
      impact: 'medium',
      timeframe: '45 days',
      status: 'pending'
    }
  ];

  const revenueForecast: RevenueForecast[] = [
    { month: 'May', predicted: 245678.90, confidence: 85 },
    { month: 'Jun', predicted: 267890.12, confidence: 82 },
    { month: 'Jul', predicted: 289012.34, confidence: 78 },
    { month: 'Aug', predicted: 301234.56, confidence: 75 },
    { month: 'Sep', predicted: 323456.78, confidence: 72 },
  ];

  const churnRisks: ChurnRisk[] = [
    {
      tenantId: '1',
      tenantName: 'Startup Tech Inc',
      risk: 'high',
      score: 85,
      reasons: ['Declining usage', 'Payment delays', 'Support tickets increased'],
      recommendedAction: 'Proactive outreach with discount offer'
    },
    {
      tenantId: '2',
      tenantName: 'Local Business Co',
      risk: 'medium',
      score: 65,
      reasons: ['Reduced feature usage', 'Login frequency decreased'],
      recommendedAction: 'Schedule success call and training session'
    },
    {
      tenantId: '3',
      tenantName: 'Global Enterprise Ltd',
      risk: 'low',
      score: 35,
      reasons: ['Slight usage variation'],
      recommendedAction: 'Monitor and continue regular check-ins'
    }
  ];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'red';
      case 'medium': return 'yellow';
      case 'low': return 'green';
      default: return 'gray';
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'high': return 'red';
      case 'medium': return 'yellow';
      case 'low': return 'green';
      default: return 'gray';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'green';
    if (confidence >= 60) return 'yellow';
    return 'red';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'blue';
      case 'pending': return 'yellow';
      case 'resolved': return 'green';
      default: return 'gray';
    }
  };

  const getPredictionIcon = (type: string) => {
    switch (type) {
      case 'revenue': return <IconTrendingUp size="1rem" color="green" />;
      case 'churn': return <IconAlertTriangle size="1rem" color="red" />;
      case 'opportunity': return <IconBulb size="1rem" color="yellow" />;
      default: return <IconBrain size="1rem" color="blue" />;
    }
  };

  const handleRefresh = () => {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 1000);
  };

  return (
    <Stack gap="md">
      <Card withBorder padding="lg" radius="md">
        <Group justify="space-between" align="center">
          <div>
            <Text size="lg" fw={600}>Predictive Analytics</Text>
            <Text size="sm" c="dimmed">AI-powered insights and forecasts for revenue and tenant behavior</Text>
          </div>
          <Group gap="sm">
            <Select
              size="sm"
              value={selectedPeriod}
              onChange={(value) => setSelectedPeriod(value || '90d')}
              data={[
                { value: '30d', label: 'Last 30 days' },
                { value: '90d', label: 'Last 90 days' },
                { value: '180d', label: 'Last 6 months' },
                { value: '1y', label: 'Last year' },
              ]}
            />
            <ActionIcon 
              variant="light" 
              color="blue"
              loading={isLoading}
              onClick={handleRefresh}
            >
              <IconRefresh size="1rem" />
            </ActionIcon>
          </Group>
        </Group>
      </Card>

      <LoadingOverlay visible={isLoading} />

      {/* Key Insights */}
      <Card withBorder padding="lg" radius="md">
        <Stack gap="md">
          <Group gap="sm">
            <IconBrain size="1.2rem" color="blue" />
            <Text size="md" fw={600}>AI Predictions</Text>
          </Group>
          
          <Stack gap="sm">
            {predictions.map((prediction) => (
              <Card key={prediction.id} padding="md" withBorder bg="gray.0">
                <Group justify="space-between" align="flex-start">
                  <div style={{ flex: 1 }}>
                    <Group gap="xs" mb="xs">
                      {getPredictionIcon(prediction.type)}
                      <Text size="sm" fw={600}>{prediction.title}</Text>
                      <Badge size="sm" color={getStatusColor(prediction.status)}>
                        {prediction.status}
                      </Badge>
                    </Group>
                    <Text size="xs" c="dimmed" mb="sm">{prediction.description}</Text>
                    <Group gap="md">
                      <Group gap="xs">
                        <Text size="xs" c="dimmed">Confidence:</Text>
                        <Badge size="xs" color={getConfidenceColor(prediction.confidence)}>
                          {formatPercentage(prediction.confidence)}
                        </Badge>
                      </Group>
                      <Group gap="xs">
                        <Text size="xs" c="dimmed">Impact:</Text>
                        <Badge size="xs" color={getImpactColor(prediction.impact)}>
                          {prediction.impact}
                        </Badge>
                      </Group>
                      <Text size="xs" c="dimmed">{prediction.timeframe}</Text>
                    </Group>
                  </div>
                </Group>
              </Card>
            ))}
          </Stack>
        </Stack>
      </Card>

      {/* Revenue Forecast */}
      <Card withBorder padding="lg" radius="md">
        <Stack gap="md">
          <Group gap="sm">
            <IconChartBar size="1.2rem" color="green" />
            <Text size="md" fw={600}>Revenue Forecast</Text>
          </Group>
          
          <Stack gap="sm">
            {revenueForecast.map((forecast) => (
              <Group key={forecast.month} justify="space-between" align="center">
                <div>
                  <Text size="sm" fw={600}>{forecast.month}</Text>
                  <Text size="xs" c="dimmed">Confidence: {formatPercentage(forecast.confidence)}</Text>
                </div>
                
                <div style={{ textAlign: 'right' }}>
                  <Text size="sm" fw={600}>{formatCurrency(forecast.predicted)}</Text>
                  <Progress 
                    value={forecast.confidence} 
                    color={getConfidenceColor(forecast.confidence)}
                    size="xs"
                    style={{ width: 100 }}
                  />
                </div>
              </Group>
            ))}
          </Stack>
        </Stack>
      </Card>

      {/* Churn Risk Analysis */}
      <Card withBorder padding="lg" radius="md">
        <Stack gap="md">
          <Group gap="sm">
            <IconAlertTriangle size="1.2rem" color="red" />
            <Text size="md" fw={600}>Churn Risk Analysis</Text>
          </Group>
          
          <Stack gap="sm">
            {churnRisks.map((risk) => (
              <Card key={risk.tenantId} padding="md" withBorder bg="gray.0">
                <Group justify="space-between" align="flex-start">
                  <div style={{ flex: 1 }}>
                    <Group gap="xs" mb="xs">
                      <Text size="sm" fw={600}>{risk.tenantName}</Text>
                      <Badge size="sm" color={getRiskColor(risk.risk)}>
                        {risk.risk} risk
                      </Badge>
                    </Group>
                    <Stack gap="xs" mb="sm">
                      <Text size="xs" c="dimmed">Risk Score: {risk.score}/100</Text>
                      <Progress 
                        value={risk.score} 
                        color={getRiskColor(risk.risk)}
                        size="xs"
                      />
                    </Stack>
                    <div>
                      <Text size="xs" fw={600} mb="xs">Risk Factors:</Text>
                      <Stack gap="xs">
                        {risk.reasons.map((reason, index) => (
                          <Text key={index} size="xs" c="dimmed">• {reason}</Text>
                        ))}
                      </Stack>
                    </div>
                    <div style={{ marginTop: '0.5rem' }}>
                      <Text size="xs" fw={600} c="blue">Recommended Action:</Text>
                      <Text size="xs" c="dimmed">{risk.recommendedAction}</Text>
                    </div>
                  </div>
                </Group>
              </Card>
            ))}
          </Stack>
        </Stack>
      </Card>

      {/* AI Insights Alert */}
      <Alert icon={<IconTarget size="1rem" />} color="blue" title="AI Model Performance">
        <Text size="sm">
          Our predictive models are currently 85% accurate for revenue forecasting and 78% accurate for churn prediction. 
          Models are retrained weekly with the latest data to improve accuracy.
        </Text>
      </Alert>
    </Stack>
  );
}
