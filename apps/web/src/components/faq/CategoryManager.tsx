'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Plus, X, Loader2, FolderOpen, Pencil, Check } from 'lucide-react';
import { faqService, FaqCategory } from '@/services/FaqService';

interface CategoryManagerProps {
  tenantId: string;
  categories: FaqCategory[];
  onChange: () => void;
}

export default function CategoryManager({ tenantId, categories, onChange }: CategoryManagerProps) {
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    setCreating(true);
    try {
      await faqService.createCategory(tenantId, trimmed);
      setNewName('');
      onChange();
    } catch (err: any) {
      console.error('Failed to create category:', err);
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (cat: FaqCategory) => {
    setEditingId(cat.id);
    setEditName(cat.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  const handleUpdate = async (catId: string) => {
    const trimmed = editName.trim();
    if (!trimmed) {
      cancelEdit();
      return;
    }
    setUpdatingId(catId);
    try {
      await faqService.updateCategory(tenantId, catId, trimmed);
      setEditingId(null);
      setEditName('');
      onChange();
    } catch (err: any) {
      console.error('Failed to update category:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await faqService.deleteCategory(tenantId, id);
      onChange();
    } catch (err: any) {
      console.error('Failed to delete category:', err);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-neutral-500" />
          Manage Categories
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleCreate} className="flex gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New category name..."
            className="max-w-xs"
          />
          <Button type="submit" size="sm" disabled={creating || !newName.trim()} className="gap-1">
            {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Add
          </Button>
        </form>

        {categories.length === 0 ? (
          <p className="text-sm text-neutral-500">No categories yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <Badge
                key={cat.id}
                variant="secondary"
                className="px-2.5 py-1 gap-1.5 text-sm font-normal"
              >
                {editingId === cat.id ? (
                  <span className="flex items-center gap-1.5">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="h-6 min-w-[120px] px-1.5 py-0 text-sm"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleUpdate(cat.id);
                        }
                        if (e.key === 'Escape') {
                          cancelEdit();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => handleUpdate(cat.id)}
                      disabled={updatingId === cat.id}
                      className="inline-flex text-green-600 hover:text-green-700 transition-colors disabled:opacity-50"
                      title="Save"
                    >
                      {updatingId === cat.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Check className="w-3 h-3" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      disabled={updatingId === cat.id}
                      className="inline-flex text-neutral-400 hover:text-neutral-600 transition-colors disabled:opacity-50"
                      title="Cancel"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ) : (
                  <>
                    {cat.name}
                    <button
                      type="button"
                      onClick={() => startEdit(cat)}
                      className="inline-flex text-neutral-400 hover:text-blue-500 transition-colors"
                      title="Rename category"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(cat.id)}
                      disabled={deletingId === cat.id}
                      className="inline-flex text-neutral-400 hover:text-red-500 transition-colors disabled:opacity-50"
                      title="Delete category"
                    >
                      {deletingId === cat.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <X className="w-3 h-3" />
                      )}
                    </button>
                  </>
                )}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
