'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { SecurityPagination } from './SecurityPagination';
import { AlertTriangle, Shield, TrendingUp, Users, Eye, EyeOff, Clock, User, Globe, UserCheck, UserX, ChevronDown, ChevronUp, Cpu, Activity, MapPin, Network } from 'lucide-react';

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
  const [expandedAlerts, setExpandedAlerts] = useState<Set<string>>(new Set());

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

  const toggleAlertExpansion = (alertId: string) => {
    setExpandedAlerts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(alertId)) {
        newSet.delete(alertId);
      } else {
        newSet.add(alertId);
      }
      return newSet;
    });
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
            const isExpanded = expandedAlerts.has(alert.id);
            
            return (
            <Card key={alert.id} className={`border-l-4 border-l-${
              alert.severity === 'critical' ? 'red' : 
              alert.severity === 'warning' ? 'orange' : 
              'blue'
            }-500`}>
              <CardContent className="pt-4">
                {/* Clickable Header */}
                <div 
                  className="cursor-pointer hover:bg-gray-50 -mx-2 px-2 py-1 rounded transition-colors"
                  onClick={() => toggleAlertExpansion(alert.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={getSeverityColor(alert.severity)}>
                          {getSeverityIcon(alert.severity)}
                          <span className="ml-1">{alert.severity.toUpperCase()}</span>
                        </Badge>
                        <Badge variant="default" className="text-xs bg-gray-100 text-gray-800 border-gray-300">
                          {alert.type}
                        </Badge>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          {isExpanded ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )}
                          <span>Click to {isExpanded ? 'hide' : 'show'} details</span>
                        </div>
                      </div>
                      <h4 className="font-medium text-sm">{alert.title}</h4>
                      <p className="text-sm text-muted-foreground mt-1">{alert.message}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(alert.createdAt).toLocaleString()}
                        </div>
                        {alert.userEmail && (
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            <span>{alert.userEmail}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1 ml-4">
                      {alert.read ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-blue-500" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expandable Details */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      
                      {/* Device Information */}
                      {alert.metadata.device && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 font-medium text-sm">
                            <Cpu className="h-4 w-4" />
                            Device Information
                          </div>
                          <div className="space-y-1 text-xs text-muted-foreground bg-gray-50 p-2 rounded">
                            <div><strong>OS:</strong> {alert.metadata.device.os}</div>
                            <div><strong>Browser:</strong> {alert.metadata.device.browser}</div>
                            <div><strong>Bot:</strong> {alert.metadata.device.isBot ? 'Yes' : 'No'}</div>
                            <div><strong>Mobile:</strong> {alert.metadata.device.isMobile ? 'Yes' : 'No'}</div>
                            <div><strong>Desktop:</strong> {alert.metadata.device.isDesktop ? 'Yes' : 'No'}</div>
                          </div>
                        </div>
                      )}

                      {/* Network Information */}
                      {alert.metadata.network && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 font-medium text-sm">
                            <Network className="h-4 w-4" />
                            Network Information
                          </div>
                          <div className="space-y-1 text-xs text-muted-foreground bg-gray-50 p-2 rounded">
                            <div><strong>IP Address:</strong> {alert.metadata.network.ip}</div>
                            <div><strong>Behind Proxy:</strong> {alert.metadata.network.isBehindProxy ? 'Yes' : 'No'}</div>
                            {alert.metadata.network.proxyChain?.length > 0 && (
                              <div><strong>Proxy Chain:</strong> {alert.metadata.network.proxyChain.join(', ')}</div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Location Information */}
                      {alert.metadata.location && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 font-medium text-sm">
                            <MapPin className="h-4 w-4" />
                            Location Information
                          </div>
                          <div className="space-y-1 text-xs text-muted-foreground bg-gray-50 p-2 rounded">
                            <div><strong>City:</strong> {alert.metadata.location.city}</div>
                            <div><strong>Country:</strong> {alert.metadata.location.country}</div>
                            <div><strong>Timezone:</strong> {alert.metadata.location.timezone}</div>
                          </div>
                        </div>
                      )}

                      {/* Request Information */}
                      {(alert.metadata.endpoint || alert.metadata.method) && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 font-medium text-sm">
                            <Activity className="h-4 w-4" />
                            Request Information
                          </div>
                          <div className="space-y-1 text-xs text-muted-foreground bg-gray-50 p-2 rounded">
                            {alert.metadata.endpoint && (
                              <div><strong>Endpoint:</strong> {alert.metadata.endpoint}</div>
                            )}
                            {alert.metadata.method && (
                              <div><strong>Method:</strong> {alert.metadata.method}</div>
                            )}
                            {alert.metadata.userAgent && (
                              <div><strong>User Agent:</strong> {alert.metadata.userAgent}</div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Threat Analysis */}
                      {alert.metadata.threatLevel && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 font-medium text-sm">
                            <AlertTriangle className="h-4 w-4" />
                            Threat Analysis
                          </div>
                          <div className="space-y-1 text-xs text-muted-foreground bg-gray-50 p-2 rounded">
                            <div><strong>Threat Level:</strong> 
                              <span className={`ml-1 px-1 rounded text-white ${
                                alert.metadata.threatLevel === 'critical' ? 'bg-red-500' :
                                alert.metadata.threatLevel === 'high' ? 'bg-orange-500' :
                                alert.metadata.threatLevel === 'medium' ? 'bg-yellow-500' :
                                'bg-green-500'
                              }`}>
                                {alert.metadata.threatLevel.toUpperCase()}
                              </span>
                            </div>
                            {alert.metadata.confidence && (
                              <div><strong>Confidence:</strong> {Math.round(alert.metadata.confidence * 100)}%</div>
                            )}
                            {alert.metadata.riskFactors?.length > 0 && (
                              <div><strong>Risk Factors:</strong> {alert.metadata.riskFactors.join(', ')}</div>
                            )}
                            {alert.metadata.incident && (
                              <div><strong>Incident:</strong> {alert.metadata.incident}</div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Rate Analysis */}
                      {alert.metadata.rateAnalysis && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 font-medium text-sm">
                            <TrendingUp className="h-4 w-4" />
                            Rate Analysis
                          </div>
                          <div className="space-y-1 text-xs text-muted-foreground bg-gray-50 p-2 rounded">
                            <div><strong>Current Rate:</strong> {alert.metadata.rateAnalysis.currentRate}/min</div>
                            <div><strong>Historical Avg:</strong> {alert.metadata.rateAnalysis.historicalAverage}/min</div>
                            <div><strong>Trend:</strong> {alert.metadata.rateAnalysis.rateTrend}</div>
                            <div><strong>Trigger:</strong> {alert.metadata.rateAnalysis.triggerReason}</div>
                            {alert.metadata.rateAnalysis.limitInfo && (
                              <>
                                <div><strong>Limit:</strong> {alert.metadata.rateAnalysis.limitInfo.limit}</div>
                                <div><strong>Remaining:</strong> {alert.metadata.rateAnalysis.limitInfo.remaining}</div>
                              </>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Authentication Details */}
                      {alert.metadata.failureReason && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 font-medium text-sm">
                            <UserX className="h-4 w-4" />
                            Authentication Details
                          </div>
                          <div className="space-y-1 text-xs text-muted-foreground bg-gray-50 p-2 rounded">
                            <div><strong>Failure Reason:</strong> {alert.metadata.failureReason}</div>
                            {alert.metadata.attemptedEmail && (
                              <div><strong>Attempted Email:</strong> {alert.metadata.attemptedEmail}</div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Raw Metadata */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 font-medium text-sm">
                          <Globe className="h-4 w-4" />
                          Raw Metadata
                        </div>
                        <div className="text-xs text-muted-foreground bg-gray-50 p-2 rounded max-h-32 overflow-y-auto">
                          <pre className="whitespace-pre-wrap">
                            {JSON.stringify(alert.metadata, null, 2)}
                          </pre>
                        </div>
                      </div>

                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        </div>
      )}
      
      {/* Pagination Controls */}
      {pagination && (
        <div className="mt-6">
          <SecurityPagination
            pagination={pagination}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            loading={loading}
          />
        </div>
      )}
    </div>
  );
}
