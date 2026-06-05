/**
 * User Context Analysis Component
 * Displays user-aware security context and patterns
 */

'use client';

import { SecurityAlert } from '@/types/security';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Progress } from '@/components/ui/Progress';
import { User, Shield, Activity, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UserContextProps {
  alerts: SecurityAlert[];
}

export function UserContextAnalysis({ alerts }: UserContextProps) {
  // Extract user context from alerts
  const userContexts = alerts.reduce((acc, alert) => {
    const app = alert.metadata?.application;
    if (app?.userId) {
      if (!acc[app.userId]) {
        acc[app.userId] = {
          userId: app.userId,
          email: app.userEmail,
          role: app.userRole,
          isAuthenticated: app.isAuthenticated,
          isPlatformUser: app.isPlatformUser,
          isExternalActor: app.isExternalActor,
          alerts: [],
          firstSeen: alert.createdAt,
          lastSeen: alert.createdAt,
          endpoints: new Set(),
          methods: new Set(),
          suspiciousCount: 0
        };
      }
      
      acc[app.userId].alerts.push(alert);
      
      // Update timestamps
      if (new Date(alert.createdAt) < new Date(acc[app.userId].firstSeen)) {
        acc[app.userId].firstSeen = alert.createdAt;
      }
      if (new Date(alert.createdAt) > new Date(acc[app.userId].lastSeen)) {
        acc[app.userId].lastSeen = alert.createdAt;
      }
      
      // Collect endpoints and methods
      if (app.requestPath) acc[app.userId].endpoints.add(app.requestPath);
      if (alert.metadata?.method) acc[app.userId].methods.add(alert.metadata.method);
      
      // Count suspicious alerts
      if (alert.metadata?.summary?.isSuspicious) {
        acc[app.userId].suspiciousCount++;
      }
    }
    
    return acc;
  }, {} as Record<string, any>);

  const userArray = Object.values(userContexts);
  const uniqueRoles = [...new Set(userArray.map(u => u.role))];
  const suspiciousUsers = userArray.filter(u => u.suspiciousCount > 0);
  const externalActors = userArray.filter(u => u.isExternalActor);

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'PLATFORM_ADMIN': return 'text-purple-500 bg-purple-500/10';
      case 'PLATFORM_SUPPORT': return 'text-blue-500 bg-blue-500/10';
      case 'TENANT_OWNER': return 'text-green-500 bg-green-500/10';
      case 'TENANT_ADMIN': return 'text-yellow-500 bg-yellow-500/10';
      case 'TENANT_MANAGER': return 'text-orange-500 bg-orange-500/10';
      default: return 'text-gray-500 bg-gray-500/10';
    }
  };

  const getUserRisk = (user: any) => {
    if (user.isExternalActor) return { level: 'critical', color: 'text-red-500 bg-red-500/10', bg: 'bg-red-500/10' };
    if (user.suspiciousCount > 0) return { level: 'high', color: 'text-orange-500 bg-orange-500/10', bg: 'bg-orange-500/10' };
    if (user.alerts.length > 20) return { level: 'medium', color: 'text-yellow-500 bg-yellow-500/10', bg: 'bg-yellow-500/10' };
    return { level: 'low', color: 'text-green-500 bg-green-500/10', bg: 'bg-green-500/10' };
  };

  const getEndpointDistribution = () => {
    const endpoints = userArray.flatMap(u => Array.from(u.endpoints)) as string[];
    return endpoints.reduce((acc: Record<string, number>, endpoint: string) => {
      acc[endpoint] = (acc[endpoint] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  };

  const getMethodDistribution = () => {
    const methods = userArray.flatMap(u => Array.from(u.methods)) as string[];
    return methods.reduce((acc: Record<string, number>, method: string) => {
      acc[method] = (acc[method] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  };

  const endpointDist = getEndpointDistribution();
  const methodDist = getMethodDistribution();

  return (
    <div className="space-y-6">
      {/* User Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-2xl font-bold">{userArray.length}</div>
                <div className="text-xs text-muted-foreground">Unique Users</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-2xl font-bold">{userArray.filter(u => u.isAuthenticated).length}</div>
                <div className="text-xs text-muted-foreground">Authenticated</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-2xl font-bold">{uniqueRoles.length}</div>
                <div className="text-xs text-muted-foreground">User Roles</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-2xl font-bold text-orange-500">{suspiciousUsers.length}</div>
                <div className="text-xs text-muted-foreground">Suspicious</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* User Roles Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>User Roles Distribution</CardTitle>
          <CardDescription>
            Security events by user role and permission level
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {uniqueRoles.map(role => {
              const count = userArray.filter(u => u.role === role).length;
              const percentage = userArray.length > 0 ? (count / userArray.length) * 100 : 0;
              
              return (
                <div key={role} className="flex items-center gap-4">
                  <div className="w-32">
                    <Badge className={getRoleColor(role)}>
                      {role.replace('_', ' ')}
                    </Badge>
                  </div>
                  <div className="flex-1">
                    <Progress value={percentage} className="h-2" />
                  </div>
                  <div className="text-sm text-muted-foreground w-12 text-right">
                    {count}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Access Patterns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Endpoint Access</CardTitle>
            <CardDescription>
              Most frequently accessed endpoints
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(endpointDist)
                .sort(([,a], [,b]) => (b as number) - (a as number))
                .slice(0, 10)
                .map(([endpoint, count]: [string, number]) => {
                  const percentage = alerts.length > 0 ? (count / alerts.length) * 100 : 0;
                  return (
                    <div key={endpoint} className="flex items-center gap-2">
                      <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">
                        {endpoint}
                      </code>
                      <div className="w-20">
                        <Progress value={percentage} className="h-1" />
                      </div>
                      <div className="text-xs text-muted-foreground w-8">{count}</div>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>HTTP Methods</CardTitle>
            <CardDescription>
              Request method distribution
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(methodDist).map(([method, count]: [string, number]) => {
                const percentage = alerts.length > 0 ? (count / alerts.length) * 100 : 0;
                return (
                  <div key={method} className="flex items-center gap-2">
                    <div className="w-16 text-sm font-mono">{method}</div>
                    <div className="flex-1">
                      <Progress value={percentage} className="h-2" />
                    </div>
                    <div className="text-xs text-muted-foreground w-8">{count}</div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* User Details */}
      <Card>
        <CardHeader>
          <CardTitle>User Activity Details</CardTitle>
          <CardDescription>
            Individual user security context and behavior patterns
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {userArray.map(user => {
              const risk = getUserRisk(user);
              
              return (
                <div key={user.userId} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{user.email || 'Unknown Email'}</span>
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            ID: {user.userId}
                          </code>
                        </div>
                        <Badge className={getRoleColor(user.role)}>
                          {user.role?.replace('_', ' ')}
                        </Badge>
                        {user.isAuthenticated && (
                          <Badge variant="secondary" className="text-xs">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Authenticated
                          </Badge>
                        )}
                        {user.isExternalActor && (
                          <Badge variant="error" className="text-xs">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            External Actor
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{user.alerts.length} events</span>
                        <span>{user.endpoints.size} endpoints</span>
                        <span>First: {new Date(user.firstSeen).toLocaleDateString()}</span>
                        <span>Last: {new Date(user.lastSeen).toLocaleDateString()}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className={cn(risk.bg, risk.color)}>
                        {risk.level} risk
                      </Badge>
                      {user.suspiciousCount > 0 && (
                        <Badge variant="error" className="text-xs">
                          {user.suspiciousCount} suspicious
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  {/* Activity Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="font-medium mb-1">Recent Endpoints</div>
                      <div className="flex flex-wrap gap-1">
                        {(Array.from(user.endpoints) as string[]).slice(0, 3).map((endpoint: string) => (
                          <code key={endpoint} className="text-xs bg-muted px-1 py-0.5 rounded">
                            {endpoint}
                          </code>
                        ))}
                        {user.endpoints.size > 3 && (
                          <span className="text-xs text-muted-foreground">
                            +{user.endpoints.size - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div>
                      <div className="font-medium mb-1">Request Methods</div>
                      <div className="flex flex-wrap gap-1">
                        {(Array.from(user.methods) as string[]).map((method: string) => (
                          <Badge key={method} variant="outline" className="text-xs">
                            {method}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <div className="font-medium mb-1">User Status</div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1">
                          <div className={cn(
                            "w-2 h-2 rounded-full",
                            user.isAuthenticated ? "bg-green-500" : "bg-red-500"
                          )} />
                          <span className="text-xs">
                            {user.isAuthenticated ? "Authenticated" : "Unauthenticated"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className={cn(
                            "w-2 h-2 rounded-full",
                            user.isPlatformUser ? "bg-blue-500" : "bg-gray-500"
                          )} />
                          <span className="text-xs">
                            {user.isPlatformUser ? "Platform User" : "External"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* External Actors Alert */}
      {externalActors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-500">
              <AlertTriangle className="h-5 w-5" />
              External Actors Detected
            </CardTitle>
            <CardDescription>
              Unauthenticated or external access attempts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {externalActors.map(actor => (
                <div key={actor.userId} className="flex items-center justify-between p-3 rounded-lg border bg-red-500/5">
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {actor.email || 'Unknown Email'}
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        ID: {actor.userId}
                      </code>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {actor.alerts.length} events • {actor.endpoints.size} endpoints
                    </div>
                  </div>
                  <Badge variant="error" className="text-xs">
                    External Actor
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No User Data */}
      {userArray.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">No User Context</p>
            <p className="text-sm text-muted-foreground mt-1">
              No security events with user information found
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
