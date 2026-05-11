'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { 
  Bell, 
  Mail, 
  MessageSquare, 
  Smartphone, 
  Save, 
  Loader2, 
  CheckCircle,
  Heart,
  Star,
  List,
  TrendingDown,
  Package
} from 'lucide-react';
import customerNotificationsService, { NotificationPreferences } from '@/services/CustomerNotificationsService';

export default function NotificationsPage() {
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    // Order notifications
    orderUpdates: true,
    shippingUpdates: true,
    
    // Engagement notifications
    heartUpdates: true,
    reviewReminders: true,
    reviewResponses: true,
    listUpdates: true,
    listReminders: true,
    
    // Marketing notifications
    promotionalEmails: false,
    recommendedProducts: true,
    priceDropAlerts: true,
    backInStock: true,
    
    // SMS settings
    smsEnabled: false,
    smsPhone: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    const result = await customerNotificationsService.getPreferences();
    if (result.success && result.preferences) {
      setPreferences(result.preferences);
    }
    setIsLoading(false);
  };

  const handleToggle = (field: keyof NotificationPreferences) => {
    setPreferences(prev => ({ ...prev, [field]: !prev[field] }));
    setSuccess(false);
  };

  const handlePhoneChange = (value: string) => {
    setPreferences(prev => ({ ...prev, smsPhone: value }));
    setSuccess(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    const result = await customerNotificationsService.updatePreferences(preferences);
    if (result.success) {
      setSuccess(true);
    }
    setIsSaving(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Notification Preferences</h1>
        <p className="text-gray-600 mt-1">Manage how you receive updates</p>
      </div>

      {/* Success Message */}
      {success && (
        <div className="flex items-center gap-2 p-4 rounded-lg bg-green-50 text-green-700">
          <CheckCircle className="w-5 h-5" />
          Preferences saved successfully
        </div>
      )}

      {/* Order Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Order Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center justify-between p-4 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
            <div>
              <p className="font-medium text-gray-900">Order Confirmations</p>
              <p className="text-sm text-gray-600">Receive email when order is placed</p>
            </div>
            <input
              type="checkbox"
              checked={preferences.orderUpdates}
              onChange={() => handleToggle('orderUpdates')}
              className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          </label>

          <label className="flex items-center justify-between p-4 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
            <div>
              <p className="font-medium text-gray-900">Shipping Updates</p>
              <p className="text-sm text-gray-600">Get notified when order ships and is delivered</p>
            </div>
            <input
              type="checkbox"
              checked={preferences.shippingUpdates}
              onChange={() => handleToggle('shippingUpdates')}
              className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          </label>
        </CardContent>
      </Card>

      {/* Engagement Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="w-5 h-5" />
            Engagement Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center justify-between p-4 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
            <div>
              <p className="font-medium text-gray-900">Heart Updates</p>
              <p className="text-sm text-gray-600">When products you hearted go on sale or are low stock</p>
            </div>
            <input
              type="checkbox"
              checked={preferences.heartUpdates}
              onChange={() => handleToggle('heartUpdates')}
              className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          </label>

          <label className="flex items-center justify-between p-4 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
            <div>
              <p className="font-medium text-gray-900">Review Reminders</p>
              <p className="text-sm text-gray-600">Reminders to review purchased products</p>
            </div>
            <input
              type="checkbox"
              checked={preferences.reviewReminders}
              onChange={() => handleToggle('reviewReminders')}
              className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          </label>

          <label className="flex items-center justify-between p-4 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
            <div>
              <p className="font-medium text-gray-900">Review Responses</p>
              <p className="text-sm text-gray-600">When stores respond to your reviews</p>
            </div>
            <input
              type="checkbox"
              checked={preferences.reviewResponses}
              onChange={() => handleToggle('reviewResponses')}
              className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          </label>

          <label className="flex items-center justify-between p-4 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
            <div>
              <p className="font-medium text-gray-900">Shopping List Updates</p>
              <p className="text-sm text-gray-600">When items on your lists go on sale or are unavailable</p>
            </div>
            <input
              type="checkbox"
              checked={preferences.listUpdates}
              onChange={() => handleToggle('listUpdates')}
              className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          </label>

          <label className="flex items-center justify-between p-4 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
            <div>
              <p className="font-medium text-gray-900">Shopping List Reminders</p>
              <p className="text-sm text-gray-600">Reminders about items on your shopping lists</p>
            </div>
            <input
              type="checkbox"
              checked={preferences.listReminders}
              onChange={() => handleToggle('listReminders')}
              className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          </label>
        </CardContent>
      </Card>

      {/* Marketing Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="w-5 h-5" />
            Deals & Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center justify-between p-4 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
            <div>
              <p className="font-medium text-gray-900">Price Drop Alerts</p>
              <p className="text-sm text-gray-600">When products you viewed drop in price</p>
            </div>
            <input
              type="checkbox"
              checked={preferences.priceDropAlerts}
              onChange={() => handleToggle('priceDropAlerts')}
              className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          </label>

          <label className="flex items-center justify-between p-4 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
            <div>
              <p className="font-medium text-gray-900">Back in Stock</p>
              <p className="text-sm text-gray-600">When out-of-stock items are available again</p>
            </div>
            <input
              type="checkbox"
              checked={preferences.backInStock}
              onChange={() => handleToggle('backInStock')}
              className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          </label>

          <label className="flex items-center justify-between p-4 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
            <div>
              <p className="font-medium text-gray-900">Recommended Products</p>
              <p className="text-sm text-gray-600">Personalized product recommendations based on your activity</p>
            </div>
            <input
              type="checkbox"
              checked={preferences.recommendedProducts}
              onChange={() => handleToggle('recommendedProducts')}
              className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          </label>

          <label className="flex items-center justify-between p-4 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
            <div>
              <p className="font-medium text-gray-900">Promotional Emails</p>
              <p className="text-sm text-gray-600">Sales, new products, and special offers from stores</p>
            </div>
            <input
              type="checkbox"
              checked={preferences.promotionalEmails}
              onChange={() => handleToggle('promotionalEmails')}
              className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          </label>
        </CardContent>
      </Card>

      {/* SMS Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            SMS Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center justify-between p-4 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
            <div>
              <p className="font-medium text-gray-900">Enable SMS</p>
              <p className="text-sm text-gray-600">Receive order updates via text message</p>
            </div>
            <input
              type="checkbox"
              checked={preferences.smsEnabled}
              onChange={() => handleToggle('smsEnabled')}
              className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          </label>

          {preferences.smsEnabled && (
            <div className="p-4 rounded-lg border border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                SMS Phone Number
              </label>
              <input
                type="tel"
                value={preferences.smsPhone || ''}
                onChange={(e) => handlePhoneChange(e.target.value)}
                placeholder="555-123-4567"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Push Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="w-5 h-5" />
            Push Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
            <p className="text-sm text-gray-600">
              Push notifications will be available when the mobile app is released.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Preferences
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
