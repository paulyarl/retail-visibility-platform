'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Upload, FileText, ArrowLeft, ArrowRight, CheckCircle2, AlertCircle, Loader2, Download } from 'lucide-react';
import { faqService } from '@/services/FaqService';

type Step = 'upload' | 'map' | 'preview' | 'import';

interface ParsedRow {
  [key: string]: string;
}

interface ColumnMapping {
  question: string;
  answer: string;
  category: string;
  scope: string;
  status: string;
  tags: string;
}

interface ImportResult {
  created: number;
  skipped: number;
  errors: number;
}

interface FaqImportWizardProps {
  tenantId: string;
  categories: { id: string; name: string }[];
  onComplete?: () => void;
  onCancel?: () => void;
}

const CSV_COLUMNS = ['question', 'answer', 'category', 'scope', 'status', 'tags'];

const DEFAULT_MAPPING: ColumnMapping = {
  question: '',
  answer: '',
  category: '',
  scope: '',
  status: '',
  tags: '',
};

export default function FaqImportWizard({ tenantId, categories, onComplete, onCancel }: FaqImportWizardProps) {
  const [step, setStep] = useState<Step>('upload');
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>(DEFAULT_MAPPING);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const parseCSV = useCallback((text: string): { headers: string[]; rows: ParsedRow[] } => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return { headers: [], rows: [] };

    const splitLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (const ch of line) {
        if (ch === '"') {
          inQuotes = !inQuotes;
        } else if (ch === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
      result.push(current.trim());
      return result;
    };

    const hdrs = splitLine(lines[0]);
    const parsedRows = lines.slice(1).map((line) => {
      const vals = splitLine(line);
      const obj: ParsedRow = {};
      hdrs.forEach((h, i) => {
        obj[h] = vals[i] || '';
      });
      return obj;
    });

    return { headers: hdrs, rows: parsedRows };
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setCsvText(text);
      const { headers: hdrs, rows: parsedRows } = parseCSV(text);
      setHeaders(hdrs);
      setRows(parsedRows);

      // Auto-map columns by matching header names
      const autoMap = { ...DEFAULT_MAPPING };
      for (const h of hdrs) {
        const lower = h.toLowerCase().trim();
        if (lower.includes('question') || lower.includes('q')) autoMap.question = h;
        else if (lower.includes('answer') || lower.includes('a') || lower.includes('response')) autoMap.answer = h;
        else if (lower.includes('category') || lower.includes('cat')) autoMap.category = h;
        else if (lower.includes('scope') || lower.includes('type')) autoMap.scope = h;
        else if (lower.includes('status')) autoMap.status = h;
        else if (lower.includes('tag')) autoMap.tags = h;
      }
      setMapping(autoMap);
    };
    reader.readAsText(file);
  };

  const handlePaste = () => {
    if (!csvText.trim()) return;
    setError(null);
    const { headers: hdrs, rows: parsedRows } = parseCSV(csvText);
    setHeaders(hdrs);
    setRows(parsedRows);
    const autoMap = { ...DEFAULT_MAPPING };
    for (const h of hdrs) {
      const lower = h.toLowerCase().trim();
      if (lower.includes('question') || lower.includes('q')) autoMap.question = h;
      else if (lower.includes('answer') || lower.includes('a') || lower.includes('response')) autoMap.answer = h;
      else if (lower.includes('category') || lower.includes('cat')) autoMap.category = h;
      else if (lower.includes('scope') || lower.includes('type')) autoMap.scope = h;
      else if (lower.includes('status')) autoMap.status = h;
      else if (lower.includes('tag')) autoMap.tags = h;
    }
    setMapping(autoMap);
  };

  const canProceedToMap = headers.length > 0 && rows.length > 0;
  const isMappingValid = mapping.question && mapping.answer;

  const handleImport = async () => {
    setImporting(true);
    setError(null);
    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const row of rows) {
      try {
        const question = row[mapping.question] || '';
        const answer = row[mapping.answer] || '';
        if (!question.trim() || !answer.trim()) {
          skipped++;
          continue;
        }
        const categoryName = mapping.category ? (row[mapping.category] || '').trim() : '';
        const matchedCategory = categoryName
          ? categories.find((c) => c.name.toLowerCase() === categoryName.toLowerCase())
          : null;
        const categoryId = matchedCategory?.id || null;

        await faqService.createFAQ(tenantId, {
          question: question.trim(),
          answer: answer.trim(),
          category_id: categoryId,
          scope: (row[mapping.scope] || 'storefront') as 'storefront' | 'product',
          status: (row[mapping.status] || 'draft') as 'active' | 'draft' | 'archived',
          tags: row[mapping.tags] ? row[mapping.tags].split(',').map((t) => t.trim()) : [],
        });
        created++;
      } catch {
        errors++;
      }
    }

    setResult({ created, skipped, errors });
    setImporting(false);
    setStep('import');
  };

  const downloadTemplate = () => {
    const csv = 'question,answer,category,scope,status,tags\n"What is your return policy?","We accept returns within 30 days...",Shipping,storefront,draft,returns;shipping\n"Do you offer free shipping?","Free shipping on orders over $50",Shipping,storefront,draft,shipping';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'faq-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const steps: { key: Step; label: string; num: number }[] = [
    { key: 'upload', label: 'Upload', num: 1 },
    { key: 'map', label: 'Map Columns', num: 2 },
    { key: 'preview', label: 'Preview', num: 3 },
    { key: 'import', label: 'Import', num: 4 },
  ];

  const stepIndex = steps.findIndex((s) => s.key === step);

  return (
    <div className="space-y-6">
      {/* Step Indicator */}
      <div className="flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                i < stepIndex
                  ? 'bg-green-100 text-green-700'
                  : i === stepIndex
                  ? 'bg-blue-600 text-white'
                  : 'bg-neutral-100 text-neutral-400'
              }`}
            >
              {i < stepIndex ? <CheckCircle2 className="w-4 h-4" /> : s.num}
            </div>
            <span className={`text-sm ${i === stepIndex ? 'font-medium text-neutral-900' : 'text-neutral-500'}`}>
              {s.label}
            </span>
            {i < steps.length - 1 && <div className="w-8 h-px bg-neutral-200" />}
          </div>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upload CSV File</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed border-neutral-200 rounded-lg p-8 text-center">
              <Upload className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
              <p className="text-neutral-600 mb-2">Drag and drop a CSV file, or click to browse</p>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
                id="csv-upload"
              />
              <label htmlFor="csv-upload" className="cursor-pointer">
                <Button variant="outline" size="sm" asChild>
                  <span>Choose File</span>
                </Button>
              </label>
              {fileName && (
                <p className="mt-2 text-sm text-green-600 flex items-center justify-center gap-1">
                  <FileText className="w-4 h-4" /> {fileName}
                </p>
              )}
            </div>

            <div className="text-center text-neutral-400 text-sm">— or paste CSV content —</div>

            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="question,answer,category,scope,status,tags&#10;What is...?,The answer is...,Shipping,storefront,draft,shipping"
              className="w-full h-32 px-3 py-2 text-sm border border-neutral-200 rounded-md font-mono"
            />

            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" className="gap-1.5" onClick={downloadTemplate}>
                <Download className="w-3.5 h-3.5" /> Download Template
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={onCancel}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={!csvText.trim()}
                  onClick={() => {
                    handlePaste();
                    if (headers.length > 0) setStep('map');
                  }}
                >
                  Next <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Map Columns */}
      {step === 'map' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Map CSV Columns to FAQ Fields</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-neutral-500">
              Match each FAQ field to the corresponding column in your CSV. Required fields are marked.
            </p>

            <div className="space-y-3">
              {CSV_COLUMNS.map((field) => (
                <div key={field} className="flex items-center gap-3">
                  <label className="w-24 text-sm font-medium text-neutral-700 flex items-center gap-1">
                    {field}
                    {(field === 'question' || field === 'answer') && (
                      <span className="text-red-500">*</span>
                    )}
                  </label>
                  <select
                    value={mapping[field as keyof ColumnMapping]}
                    onChange={(e) => setMapping((m) => ({ ...m, [field]: e.target.value }))}
                    className="h-9 px-3 rounded-md border border-neutral-200 bg-white text-sm flex-1"
                  >
                    <option value="">— Skip —</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="outline" size="sm" onClick={() => setStep('upload')}>
                <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
              </Button>
              <Button size="sm" disabled={!isMappingValid} onClick={() => setStep('preview')}>
                Next <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Preview */}
      {step === 'preview' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preview Import ({Math.min(rows.length, 5)} of {rows.length} rows)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200">
                    <th className="text-left py-2 px-2 font-medium text-neutral-500">#</th>
                    <th className="text-left py-2 px-2 font-medium text-neutral-500">Question</th>
                    <th className="text-left py-2 px-2 font-medium text-neutral-500">Answer</th>
                    <th className="text-left py-2 px-2 font-medium text-neutral-500">Scope</th>
                    <th className="text-left py-2 px-2 font-medium text-neutral-500">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 5).map((row, i) => (
                    <tr key={i} className="border-b border-neutral-100">
                      <td className="py-2 px-2 text-neutral-400">{i + 1}</td>
                      <td className="py-2 px-2 max-w-[200px] truncate">{row[mapping.question] || '—'}</td>
                      <td className="py-2 px-2 max-w-[300px] truncate">{row[mapping.answer] || '—'}</td>
                      <td className="py-2 px-2">
                        <Badge variant="outline">{row[mapping.scope] || 'storefront'}</Badge>
                      </td>
                      <td className="py-2 px-2">
                        <Badge variant="outline">{row[mapping.status] || 'draft'}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {rows.length > 5 && (
              <p className="text-xs text-neutral-400">
                Showing first 5 of {rows.length} rows. All rows will be imported.
              </p>
            )}

            <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-md text-sm text-blue-700">
              <FileText className="w-4 h-4" />
              {rows.length} FAQs will be created as <strong>draft</strong> status by default.
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="outline" size="sm" onClick={() => setStep('map')}>
                <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
              </Button>
              <Button size="sm" onClick={handleImport} disabled={importing} className="gap-2">
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {importing ? 'Importing...' : `Import ${rows.length} FAQs`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Result */}
      {step === 'import' && result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Import Complete</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <CheckCircle2 className="w-6 h-6 text-green-600 mx-auto mb-1" />
                <p className="text-2xl font-semibold text-green-700">{result.created}</p>
                <p className="text-sm text-green-600">Created</p>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <AlertCircle className="w-6 h-6 text-yellow-600 mx-auto mb-1" />
                <p className="text-2xl font-semibold text-yellow-700">{result.skipped}</p>
                <p className="text-sm text-yellow-600">Skipped</p>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <AlertCircle className="w-6 h-6 text-red-500 mx-auto mb-1" />
                <p className="text-2xl font-semibold text-red-600">{result.errors}</p>
                <p className="text-sm text-red-500">Errors</p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button size="sm" onClick={onComplete}>
                Done
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
