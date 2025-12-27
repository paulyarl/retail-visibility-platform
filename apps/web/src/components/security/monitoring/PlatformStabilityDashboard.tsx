/**
 * Platform Stability Dashboard
 * Advanced analytics and insights for platform stability monitoring
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import {
  Shield,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Users,
  Globe,
  Clock,
  Zap,
  Target,
  BarChart3,
  Lightbulb,
  RefreshCw
} from 'lucide-react';
import { api } from '@/lib/api';

interface StabilityInsights {
  summary: {
    totalIncidents: number;
    criticalIncidents: number;
    warningIncidents: number;
    infoIncidents: number;
  };
  patterns: {
    topEndpoints: Array<{ endpoint: string; count: number }>;
    topIPs: Array<{ ip: string; count: number }>;
    userBehaviorPatterns: {
      authenticatedVsAnonymous: { authenticated: number; anonymous: number };
      userMaturity: { newUsers: number; establishedUsers: number };
      userTypes: { powerUsers: number; regularUsers: number };
    };
    geographicPatterns: {
      topCountries: Array<{ country: string; count: number }>;
      internationalDistribution: boolean;
    };
    temporalPatterns: {
      hourlyDistribution: Record<number, number>;
      peakActivityHour: number;
      offHoursActivity: number;
    };
  };
  risks: {
    bruteForceIndicators: {
      authRateLimitIncidents: number;
      uniqueIPsAttemptingAuth: number;
      uniqueUsersTargeted: number;
      riskLevel: string;
    };
    scrapingIndicators: {
      searchRateLimitIncidents: number;
      anonymousSearchActivity: number;
      potentialScraping: boolean;
      riskLevel: string;
    };
    abuseIndicators: {
      uploadAbuseIncidents: number;
      apiAbuseIncidents: number;
      resourceAbuseRisk: string;
    };
    platformStabilityScore: {
      score: number;
      level: string;
      factors: { criticalCount: number; warningCount: number; infoCount: number };
    };
  };
  recommendations: string[];
}

export function PlatformStabilityDashboard() {
  const [insights, setInsights] = useState<StabilityInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState(24);

  const fetchInsights = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/api/admin/security/stability-insights?timeframe=${timeframe}`);
      if (!response.ok) throw new Error('Failed to fetch stability insights');
      const data = await response.json();
      setInsights(data);
    } catch (err) {
      console.error('Failed to fetch stability insights:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch insights');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, [timeframe]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-32 bg-muted animate-pulse rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !insights) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-32">
          <div className="text-center">
            <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-2" />
            <p className="text-muted-foreground">Failed to load stability insights</p>
            <Button onClick={fetchInsights} variant="outline" className="mt-2">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getStabilityColor = (level: string) => {
    switch (level) {
      case 'excellent': return 'text-green-600 bg-green-100';
      case 'good': return 'text-blue-600 bg-blue-100';
      case 'fair': return 'text-yellow-600 bg-yellow-100';
      case 'poor': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'high': return 'text-red-600 bg-red-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-8 w-8" />
            Platform Stability Dashboard
          </h2>
          <p className="text-muted-foreground mt-2">
            Advanced analytics for platform stability and security insights
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(Number(e.target.value))}
            className="px-3 py-2 border rounded-md text-sm"
          >
            <option value={1}>Last Hour</option>
            <option value={6}>Last 6 Hours</option>
            <option value={24}>Last 24 Hours</option>
            <option value={72}>Last 3 Days</option>
            <option value={168}>Last Week</option>
          </select>
          <Button onClick={fetchInsights} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Stability Score */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Platform Stability Score
          </CardTitle>
          <CardDescription>
            Overall platform health based on incident analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-4xl font-bold">{insights.risks.platformStabilityScore.score.toFixed(1)}%</div>
              <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mt-1 ${getStabilityColor(insights.risks.platformStabilityScore.level)}`}>
                {insights.risks.platformStabilityScore.level.toUpperCase()}
              </div>
            </div>
            <div className="text-right text-sm text-muted-foreground">
              <div>Critical: {insights.risks.platformStabilityScore.factors.criticalCount}</div>
              <div>Warning: {insights.risks.platformStabilityScore.factors.warningCount}</div>
              <div>Info: {insights.risks.platformStabilityScore.factors.infoCount}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Incidents</CardDescription>
            <CardTitle className="text-2xl">{insights.summary.totalIncidents}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Critical Incidents</CardDescription>
            <CardTitle className="text-2xl text-destructive">{insights.summary.criticalIncidents}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Brute Force Risk</CardDescription>
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">{insights.risks.bruteForceIndicators.authRateLimitIncidents}</CardTitle>
              <Badge variant="default" className={getRiskColor(insights.risks.bruteForceIndicators.riskLevel)}>
                {insights.risks.bruteForceIndicators.riskLevel}
              </Badge>
            </div>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Scraping Risk</CardDescription>
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">{insights.risks.scrapingIndicators.searchRateLimitIncidents}</CardTitle>
              <Badge variant="default" className={getRiskColor(insights.risks.scrapingIndicators.riskLevel)}>
                {insights.risks.scrapingIndicators.riskLevel}
              </Badge>
            </div>
          </CardHeader>
        </Card>
      </div>

      <Tabs defaultValue="patterns" className="space-y-4">
        <TabsList>
          <TabsTrigger value="patterns" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Behavior Patterns
          </TabsTrigger>
          <TabsTrigger value="risks" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Risk Analysis
          </TabsTrigger>
          <TabsTrigger value="recommendations" className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4" />
            Recommendations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="patterns" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* User Behavior */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  User Behavior Patterns
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 rounded-lg bg-blue-50">
                    <div className="text-2xl font-bold text-blue-600">
                      {insights.patterns.userBehaviorPatterns.authenticatedVsAnonymous.authenticated}
                    </div>
                    <div className="text-sm text-muted-foreground">Authenticated</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-gray-50">
                    <div className="text-2xl font-bold text-gray-600">
                      {insights.patterns.userBehaviorPatterns.authenticatedVsAnonymous.anonymous}
                    </div>
                    <div className="text-sm text-muted-foreground">Anonymous</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 rounded-lg bg-green-50">
                    <div className="text-lg font-bold text-green-600">
                      {insights.patterns.userBehaviorPatterns.userTypes.powerUsers}
                    </div>
                    <div className="text-sm text-muted-foreground">Power Users</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-purple-50">
                    <div className="text-lg font-bold text-purple-600">
                      {insights.patterns.userBehaviorPatterns.userMaturity.newUsers}
                    </div>
                    <div className="text-sm text-muted-foreground">New Users</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Geographic Patterns */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Geographic Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {insights.patterns.geographicPatterns.topCountries.map((country, index) => (
                    <div key={country.country} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${index === 0 ? 'bg-blue-500' : index === 1 ? 'bg-green-500' : 'bg-gray-400'}`} />
                        <span className="font-medium">{country.country}</span>
                      </div>
                      <Badge variant="default">{country.count}</Badge>
                    </div>
                  ))}
                </div>
                {insights.patterns.geographicPatterns.internationalDistribution && (
                  <div className="mt-4 p-3 rounded-lg bg-blue-50">
                    <p className="text-sm text-blue-700">
                      🌍 International activity detected - monitor for unusual patterns
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Top Endpoints */}
          <Card>
            <CardHeader>
              <CardTitle>Most Targeted Endpoints</CardTitle>
              <CardDescription>Endpoints with highest incident frequency</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {insights.patterns.topEndpoints.slice(0, 5).map((endpoint, index) => (
                  <div key={endpoint.endpoint} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        index === 0 ? 'bg-red-500 text-white' :
                        index === 1 ? 'bg-orange-500 text-white' :
                        'bg-gray-200 text-gray-700'
                      }`}>
                        {index + 1}
                      </div>
                      <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                        {endpoint.endpoint}
                      </code>
                    </div>
                    <Badge variant="default">{endpoint.count} incidents</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="risks" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Brute Force Analysis */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  Brute Force Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 rounded-lg bg-red-50">
                    <div className="text-2xl font-bold text-red-600">
                      {insights.risks.bruteForceIndicators.authRateLimitIncidents}
                    </div>
                    <div className="text-sm text-muted-foreground">Auth Attempts</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-orange-50">
                    <div className="text-2xl font-bold text-orange-600">
                      {insights.risks.bruteForceIndicators.uniqueIPsAttemptingAuth}
                    </div>
                    <div className="text-sm text-muted-foreground">Unique IPs</div>
                  </div>
                </div>
                <div className={`p-3 rounded-lg ${
                  insights.risks.bruteForceIndicators.riskLevel === 'high' ? 'bg-red-50 border-red-200' :
                  insights.risks.bruteForceIndicators.riskLevel === 'medium' ? 'bg-yellow-50 border-yellow-200' :
                  'bg-green-50 border-green-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Risk Level:</span>
                    <Badge className={getRiskColor(insights.risks.bruteForceIndicators.riskLevel)}>
                      {insights.risks.bruteForceIndicators.riskLevel.toUpperCase()}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Resource Abuse Analysis */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-yellow-500" />
                  Resource Abuse Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 rounded-lg bg-blue-50">
                    <div className="text-2xl font-bold text-blue-600">
                      {insights.risks.abuseIndicators.uploadAbuseIncidents}
                    </div>
                    <div className="text-sm text-muted-foreground">Upload Abuse</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-purple-50">
                    <div className="text-2xl font-bold text-purple-600">
                      {insights.risks.abuseIndicators.apiAbuseIncidents}
                    </div>
                    <div className="text-sm text-muted-foreground">API Abuse</div>
                  </div>
                </div>
                <div className={`p-3 rounded-lg ${
                  insights.risks.abuseIndicators.resourceAbuseRisk === 'high' ? 'bg-red-50 border-red-200' :
                  insights.risks.abuseIndicators.resourceAbuseRisk === 'medium' ? 'bg-yellow-50 border-yellow-200' :
                  'bg-green-50 border-green-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Resource Risk:</span>
                    <Badge className={getRiskColor(insights.risks.abuseIndicators.resourceAbuseRisk)}>
                      {insights.risks.abuseIndicators.resourceAbuseRisk.toUpperCase()}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-yellow-500" />
                Platform Stability Recommendations
              </CardTitle>
              <CardDescription>
                AI-generated recommendations based on incident analysis
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {insights.recommendations.map((recommendation, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 border border-blue-200">
                    <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                      {index + 1}
                    </div>
                    <p className="text-sm text-blue-900">{recommendation}</p>
                  </div>
                ))}
                {insights.recommendations.length === 0 && (
                  <div className="text-center py-8">
                    <Lightbulb className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-muted-foreground">No specific recommendations at this time</p>
                    <p className="text-sm text-muted-foreground mt-1">Platform stability is within normal parameters</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
