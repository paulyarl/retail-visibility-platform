/**
 * Content & Marketing Step (Step 4)
 * 
 * Content creation and marketing optimization with:
 * - Product descriptions (basic and enhanced)
 * - Key features bullet points
 * - Technical specifications
 * - SEO optimization
 * - AI-powered content enhancement
 * - Tag management
 * 
 * Fourth step in the 7-step product creation wizard
 */

'use client';

import { useState, useEffect } from 'react';
import { 
  FileText, 
  Sparkles, 
  List, 
  Settings, 
  Search,
  Plus,
  X,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';

import { Textarea } from '@/components/ui/Textarea';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@mantine/core';
import { Switch } from '@/components/ui/Switch';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { Separator } from '@/components/ui/Separator';

interface ContentStepProps {
  data: {
    description: string;
    enhancedDescription: string;
    features: string[];
    specifications: Record<string, any>;
    seoTitle?: string;
    seoDescription?: string;
    tags: string[];
  };
  errors: Record<string, string>;
  onChange: (data: any) => void;
}

const COMMON_FEATURES = [
  'High quality materials',
  'Durable construction',
  'Easy to use',
  'Compact design',
  'Energy efficient',
  'Water resistant',
  'Fast performance',
  'Long battery life',
  'Multi-functional',
  'Premium finish'
];

const SPECIFICATION_TEMPLATES = {
  electronics: {
    dimensions: '10 x 5 x 2 inches',
    weight: '1.5 lbs',
    battery: '5000mAh',
    connectivity: 'Bluetooth 5.0, USB-C',
    materials: 'Aluminum, plastic'
  },
  clothing: {
    material: '100% cotton',
    care: 'Machine washable',
    sizes: 'XS, S, M, L, XL',
    fit: 'Regular fit',
    origin: 'Made in USA'
  },
  furniture: {
    dimensions: '72 x 36 x 30 inches',
    weight: '45 lbs',
    materials: 'Solid wood, metal',
    assembly: 'Required',
    warranty: '5 years'
  }
};

export default function ContentStep({ data, errors, onChange }: ContentStepProps) {
  const [newFeature, setNewFeature] = useState('');
  const [newSpecKey, setNewSpecKey] = useState('');
  const [newSpecValue, setNewSpecValue] = useState('');
  const [newTag, setNewTag] = useState('');
  const [isGeneratingContent, setIsGeneratingContent] = useState(false);

  // Validate content in real-time
  const [descriptionError, setDescriptionError] = useState('');
  const [enhancedDescriptionError, setEnhancedDescriptionError] = useState('');

  useEffect(() => {
    if (data.description && data.description.trim().length > 0) {
      if (data.description.trim().length < 10) {
        setDescriptionError('Description must be at least 10 characters');
      } else if (data.description.trim().length > 2000) {
        setDescriptionError('Description must be less than 2000 characters');
      } else {
        setDescriptionError('');
      }
    } else {
      setDescriptionError('');
    }
  }, [data.description]);

  useEffect(() => {
    if (data.enhancedDescription && data.enhancedDescription.trim().length > 0) {
      if (data.enhancedDescription.trim().length < 50) {
        setEnhancedDescriptionError('Enhanced description must be at least 50 characters');
      } else if (data.enhancedDescription.trim().length > 5000) {
        setEnhancedDescriptionError('Enhanced description must be less than 5000 characters');
      } else {
        setEnhancedDescriptionError('');
      }
    } else {
      setEnhancedDescriptionError('');
    }
  }, [data.enhancedDescription]);

  const handleDescriptionChange = (value: string) => {
    onChange({
      ...data,
      description: value
    });
  };

  const handleEnhancedDescriptionChange = (value: string) => {
    onChange({
      ...data,
      enhancedDescription: value
    });
  };

  const handleAddFeature = () => {
    if (newFeature.trim() && !data.features.includes(newFeature.trim())) {
      onChange({
        ...data,
        features: [...data.features, newFeature.trim()]
      });
      setNewFeature('');
    }
  };

  const handleRemoveFeature = (index: number) => {
    onChange({
      ...data,
      features: data.features.filter((_, i) => i !== index)
    });
  };

  const handleAddSpecification = () => {
    if (newSpecKey.trim() && newSpecValue.trim()) {
      onChange({
        ...data,
        specifications: {
          ...data.specifications,
          [newSpecKey.trim()]: newSpecValue.trim()
        }
      });
      setNewSpecKey('');
      setNewSpecValue('');
    }
  };

  const handleRemoveSpecification = (key: string) => {
    const newSpecs = { ...data.specifications };
    delete newSpecs[key];
    onChange({
      ...data,
      specifications: newSpecs
    });
  };

  const handleAddTag = () => {
    if (newTag.trim() && !data.tags.includes(newTag.trim())) {
      onChange({
        ...data,
        tags: [...data.tags, newTag.trim()]
      });
      setNewTag('');
    }
  };

  const handleRemoveTag = (index: number) => {
    onChange({
      ...data,
      tags: data.tags.filter((_, i) => i !== index)
    });
  };

  const handleGenerateContent = async () => {
    setIsGeneratingContent(true);
    try {
      // Simulate AI content generation
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Mock AI-generated content
      const mockEnhancedDescription = `Experience exceptional quality and performance with this premium product. Designed with attention to detail and crafted from the finest materials, this item delivers outstanding value and reliability. Perfect for both everyday use and special occasions, it combines innovative features with timeless design to exceed your expectations.`;
      
      const mockFeatures = [
        'Premium quality construction',
        'Innovative design features',
        'Exceptional value for money',
        'Versatile functionality',
        'Reliable performance'
      ];
      
      const mockSpecs = {
        'Material': 'Premium materials',
        'Dimensions': 'Standard size',
        'Weight': 'Lightweight',
        'Warranty': '1 year warranty'
      };

      onChange({
        ...data,
        enhancedDescription: mockEnhancedDescription,
        features: [...new Set([...data.features, ...mockFeatures])],
        specifications: { ...data.specifications, ...mockSpecs }
      });
    } catch (error) {
      console.error('Error generating content:', error);
    } finally {
      setIsGeneratingContent(false);
    }
  };

  const handleQuickAddFeatures = (category: string) => {
    const templates = COMMON_FEATURES.slice(0, 5);
    onChange({
      ...data,
      features: [...new Set([...data.features, ...templates])]
    });
  };

  const handleQuickAddSpecs = (category: keyof typeof SPECIFICATION_TEMPLATES) => {
    onChange({
      ...data,
      specifications: { ...data.specifications, ...SPECIFICATION_TEMPLATES[category] }
    });
  };

  const getContentQuality = () => {
    let score = 0;
    if (data.description && data.description.length >= 10) score += 20;
    if (data.enhancedDescription && data.enhancedDescription.length >= 50) score += 30;
    if (data.features.length >= 3) score += 20;
    if (Object.keys(data.specifications).length >= 3) score += 20;
    if (data.tags.length >= 3) score += 10;
    return score;
  };

  const getQualityColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-gray-400';
  };

  const getQualityBadge = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Needs Work';
  };

  const isFormValid = () => {
    return (
      data.description.trim().length >= 10 &&
      data.description.trim().length <= 2000 &&
      !descriptionError &&
      !enhancedDescriptionError
    );
  };

  const contentQuality = getContentQuality();

  return (
    <div className="space-y-6">
      {/* Help Section */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <div className="flex items-start space-x-3">
            <FileText className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-900">Content & Marketing</h4>
              <p className="text-sm text-blue-700 mt-1">
                Create compelling product content with descriptions, features, specifications, and SEO optimization.
                Use AI-powered tools to enhance your content and improve discoverability.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content Quality Indicator */}
      <Card className="border-purple-200 bg-purple-50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <div className="font-medium">Content Quality</div>
                <div className="text-sm text-gray-600">
                  {contentQuality}% Complete
                </div>
              </div>
            </div>
            <div className="text-right">
              <Badge className={getQualityColor(contentQuality)}>
                {getQualityBadge(contentQuality)}
              </Badge>
            </div>
          </div>
          <div className="mt-3">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${contentQuality}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Basic Description */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-base font-medium">Product Description</Label>
          <div className="text-sm text-gray-500">
            {data.description.length}/2000 characters
          </div>
        </div>
        <Textarea
          value={data.description}
          onChange={(e) => handleDescriptionChange(e.target.value)}
          placeholder="Enter a clear, concise description of your product..."
          className={`min-h-[100px] ${descriptionError ? 'border-red-500' : ''}`}
        />
        {descriptionError && (
          <Alert className="mt-2">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{descriptionError}</AlertDescription>
          </Alert>
        )}
      </div>

      {/* Enhanced Description */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-base font-medium">Enhanced Description</Label>
            <p className="text-sm text-gray-500">Marketing-focused description for SEO and customer engagement</p>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateContent}
              disabled={isGeneratingContent}
              className="flex items-center space-x-2"
            >
              <Sparkles className="h-4 w-4" />
              {isGeneratingContent ? 'Generating...' : 'AI Enhance'}
            </Button>
            <div className="text-sm text-gray-500">
              {data.enhancedDescription.length}/5000 characters
            </div>
          </div>
        </div>
        <Textarea
          value={data.enhancedDescription}
          onChange={(e) => handleEnhancedDescriptionChange(e.target.value)}
          placeholder="Create a compelling marketing description that highlights benefits and features..."
          className={`min-h-[150px] ${enhancedDescriptionError ? 'border-red-500' : ''}`}
        />
        {enhancedDescriptionError && (
          <Alert className="mt-2">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{enhancedDescriptionError}</AlertDescription>
          </Alert>
        )}
      </div>

      <Separator />

      {/* Key Features */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-base font-medium">Key Features</Label>
          <div className="flex items-center space-x-2">
            <Badge variant="default">{data.features.length} features</Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleQuickAddFeatures('general')}
            >
              Quick Add
            </Button>
          </div>
        </div>
        
        <div className="space-y-2">
          {data.features.map((feature, index) => (
            <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm">{feature}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveFeature(index)}
                className="p-1"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <div className="flex items-center space-x-2">
          <Input
            placeholder="Add a key feature..."
            value={newFeature}
            onChange={(e) => setNewFeature(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddFeature()}
            className="flex-1"
          />
          <Button onClick={handleAddFeature} disabled={!newFeature.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Separator />

      {/* Technical Specifications */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-base font-medium">Technical Specifications</Label>
          <div className="flex items-center space-x-2">
            <Badge variant="default">{Object.keys(data.specifications).length} specs</Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleQuickAddSpecs('electronics')}
            >
              Quick Add
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          {Object.entries(data.specifications).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <span className="text-sm font-medium text-gray-700">{key}:</span>
                <span className="text-sm">{value}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveSpecification(key)}
                className="p-1"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Input
            placeholder="Specification name..."
            value={newSpecKey}
            onChange={(e) => setNewSpecKey(e.target.value)}
          />
          <Input
            placeholder="Specification value..."
            value={newSpecValue}
            onChange={(e) => setNewSpecValue(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddSpecification()}
          />
        </div>
        <Button onClick={handleAddSpecification} disabled={!newSpecKey.trim() || !newSpecValue.trim()}>
          <Plus className="h-4 w-4 mr-2" />
          Add Specification
        </Button>
      </div>

      <Separator />

      {/* Tags */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-base font-medium">Product Tags</Label>
          <Badge variant="default">{data.tags.length} tags</Badge>
        </div>

        <div className="flex flex-wrap gap-2">
          {data.tags.map((tag, index) => (
            <Badge key={index} variant="info" className="flex items-center space-x-1">
              <span>{tag}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveTag(index)}
                className="p-0 h-3 w-3"
              >
                <X className="h-2 w-2" />
              </Button>
            </Badge>
          ))}
        </div>

        <div className="flex items-center space-x-2">
          <Input
            placeholder="Add a tag..."
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
            className="flex-1"
          />
          <Button onClick={handleAddTag} disabled={!newTag.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Validation Summary */}
      <Card className={isFormValid() ? 'border-green-200 bg-green-50' : 'border-gray-200'}>
        <CardContent className="p-4">
          <div className="flex items-center space-x-3">
            {isFormValid() ? (
              <FileText className="h-5 w-5 text-green-600" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
            )}
            <div>
              <h4 className="font-medium">
                {isFormValid() ? 'Content ready' : 'Content needs attention'}
              </h4>
              <p className="text-sm text-gray-600">
                {isFormValid() 
                  ? 'Product content is properly configured with descriptions and features.'
                  : 'Please add a valid description before continuing.'
                }
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
