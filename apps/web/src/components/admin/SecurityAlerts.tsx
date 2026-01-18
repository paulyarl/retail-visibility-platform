'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { SecurityPagination } from './SecurityPagination';
import { AlertTriangle, Shield, TrendingUp, Users, Eye, EyeOff, Clock, User, Globe, UserCheck, UserX } from 'lucide-react';

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface SecurityAlert {
  id: string;
  userId: string;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  metadata: any;
  read: boolean;
  createdAt: string;
  readAt?: string;
  userEmail?: string;
  userFirstName?: string;
  userLastName?: string;
}

export default function SecurityAlerts() {
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAlerts(currentPage, pageSize);
  }, [currentPage, pageSize]);

  const fetchAlerts = async (page: number = currentPage, limit: number = pageSize) => {
    try {
      setError(null);
      setLoading(true);
      const { api } = await import('@/lib/api');
      const response = await api.get(`/api/admin/security/alerts?page=${page}&limit=${limit}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch security alerts');
      }

      const data = await response.json();
      setAlerts(data.data || []);
      setPagination(data.pagination || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch alerts');
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1); // Reset to first page when changing page size
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500 text-white';
      case 'warning': return 'bg-orange-500 text-white';
      case 'info': return 'bg-blue-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="h-4 w-4" />;
      case 'warning': return <AlertTriangle className="h-4 w-4" />;
      case 'info': return <Shield className="h-4 w-4" />;
      default: return <Shield className="h-4 w-4" />;
    }
  };

  const extractEnhancedDeviceInfo = (metadata: any) => {
    if (!metadata) return { device: 'Unknown', browser: 'Unknown', location: 'Unknown' };
    
    const device = metadata.device || {};
    const location = metadata.location || {};
    const summary = metadata.summary || {};
    
    return {
      device: `${device.device || 'Unknown'} - ${device.browser || 'Unknown'} ${device.version || ''}`.trim(),
      browser: device.browser || 'Unknown',
      version: device.version || '',
      fingerprint: device.fingerprint || 'Unknown',
      isBot: device.isBot || false,
      isMobile: device.isMobile || false,
      isTablet: device.isTablet || false,
      location: summary.location || `${location.cloudflare?.city || location.geo?.city || 'Unknown'}, ${location.cloudflare?.country || location.geo?.country || 'Unknown'}`,
      country: location.cloudflare?.country || location.geo?.country || 'Unknown',
      city: location.cloudflare?.city || location.geo?.city || 'Unknown',
      timezone: location.cloudflare?.timezone || location.geo?.timezone || 'Unknown',
      threatLevel: summary.threatLevel || 'low',
      riskFactors: summary.riskFactors || [],
      isSuspicious: summary.isSuspicious || false,
    };
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-red-600">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
            <p>{error}</p>
            <Button onClick={() => fetchAlerts()} className="mt-2" size="sm">
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Recent Security Alerts</h3>
        <Badge variant="default" className="border-gray-300">{alerts.length} alerts</Badge>
      </div>

      {alerts.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground">
              <Shield className="h-8 w-8 mx-auto mb-2" />
              <p>No security alerts found</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => {
          const deviceInfo = extractEnhancedDeviceInfo(alert.metadata);
          
          return (
            <Card key={alert.id} className={`border-l-4 border-l-${
              alert.severity === 'critical' ? 'red' : 
              alert.severity === 'warning' ? 'orange' : 
              'blue'
            }-500`}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={getSeverityColor(alert.severity)}>
                        {getSeverityIcon(alert.severity)}
                        <span className="ml-1">{alert.severity.toUpperCase()}</span>
                      </Badge>
                      
                      {/* User Type Badge */}
                      {alert.metadata?.application?.isPlatformUser ? (
                        <Badge variant="default" className="text-xs bg-gray-100 text-gray-800 border-gray-300">
                          <UserCheck className="h-3 w-3 mr-1" />
                          PLATFORM USER
                        </Badge>
                      ) : (
                        <Badge variant="default" className="text-xs bg-red-100 text-red-800 border-red-200">
                          <UserX className="h-3 w-3 mr-1" />
                          EXTERNAL ACTOR
                        </Badge>
                      )}
                      
                      {deviceInfo.isSuspicious && (
                        <Badge variant="default" className="text-xs bg-red-100 text-red-800 border-red-200">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          SUSPICIOUS
                        </Badge>
                      )}
                      <span className="text-sm text-muted-foreground">
                        {formatDate(alert.createdAt)}
                      </span>
                    </div>
                    
                    <h4 className="font-semibold mb-1">{alert.title}</h4>
                    <p className="text-sm text-muted-foreground mb-2">{alert.message}</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs text-muted-foreground">
                      {/* Location Information */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 font-medium">
                          <Globe className="h-3 w-3" />
                          Location
                        </div>
                        <div className="ml-4">
                          <div>📍 {deviceInfo.location}</div>
                          {deviceInfo.timezone !== 'Unknown' && (
                            <div>🕐 {deviceInfo.timezone}</div>
                          )}
                        </div>
                      </div>
                      
                      {/* Device Information */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 font-medium">
                          <Eye className="h-3 w-3" />
                          Device
                        </div>
                        <div className="ml-4">
                          <div>🖥️ {deviceInfo.device}</div>
                          {deviceInfo.isBot && (
                            <div className="text-orange-600">🤖 Bot/Crawler</div>
                          )}
                          {deviceInfo.isMobile && (
                            <div>📱 Mobile Device</div>
                          )}
                          {deviceInfo.isTablet && (
                            <div>📱 Tablet Device</div>
                          )}
                        </div>
                      </div>
                      
                      {/* Network & Endpoint */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 font-medium">
                          <Shield className="h-3 w-3" />
                          Network
                        </div>
                        <div className="ml-4">
                          <div>🌐 IP: {alert.metadata?.network?.ip || alert.metadata?.ipAddress || 'Unknown'}</div>
                          <div>🔗 Endpoint: {alert.metadata?.application?.endpoint || alert.metadata?.endpoint || 'Unknown'}</div>
                          {deviceInfo.threatLevel !== 'low' && (
                            <div className={`font-medium ${
                              deviceInfo.threatLevel === 'critical' ? 'text-red-600' :
                              deviceInfo.threatLevel === 'high' ? 'text-orange-600' :
                              'text-yellow-600'
                            }`}>
                              ⚠️ Threat: {deviceInfo.threatLevel.toUpperCase()}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Rate Analysis - Only for rate limit alerts */}
                      {alert.type === 'rate_limit_exceeded' && alert.metadata?.rateAnalysis && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 font-medium">
                            <TrendingUp className="h-3 w-3" />
                            Request Rate Analysis
                          </div>
                          <div className="ml-4">
                            <div>📊 Current: {alert.metadata.rateAnalysis.currentRate} req/min</div>
                            <div>📈 Trend: {alert.metadata.rateAnalysis.rateTrend === 'increasing' ? '📈 Rising' : 
                                      alert.metadata.rateAnalysis.rateTrend === 'decreasing' ? '📉 Falling' : '➡️ Stable'}</div>
                            <div>🎯 Limit: {alert.metadata.rateAnalysis.limitInfo?.limit || 'Unknown'} req/15min</div>
                            <div>⚡ Used: {alert.metadata.rateAnalysis.limitInfo?.current || 'Unknown'}/{alert.metadata.rateAnalysis.limitInfo?.limit || 'Unknown'}</div>
                            {alert.metadata.rateAnalysis.historicalAverage > 0 && (
                              <div>📊 Avg: {alert.metadata.rateAnalysis.historicalAverage.toFixed(1)} req/min (7-day)</div>
                            )}
                            {alert.metadata.rateAnalysis.triggerReason && (
                              <div className={`font-medium ${
                                alert.metadata.rateAnalysis.triggerReason === 'limit_exceeded' ? 'text-red-600' : 'text-orange-600'
                              }`}>
                                🔴 Trigger: {alert.metadata.rateAnalysis.triggerReason === 'limit_exceeded' ? 'Limit Exceeded' : 'Rate Too High'}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Risk Factors */}
                    {deviceInfo.riskFactors.length > 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <div className="text-xs font-medium mb-1">Risk Factors:</div>
                        <div className="flex flex-wrap gap-1">
                          {deviceInfo.riskFactors.map((factor: string, index: number) => (
                            <Badge key={index} variant="default" className="text-xs bg-gray-100 text-gray-800 border-gray-300">
                              {factor}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* User Information */}
                    {alert.userEmail && (
                      <div className="mt-2 pt-2 border-t">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <User className="h-3 w-3" />
                          <span>User: {alert.userEmail}</span>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-1 ml-4">
                    {alert.read ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-blue-500" />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}  // Close alerts.map function
        </div>
      )}
    </div>
  );
}
