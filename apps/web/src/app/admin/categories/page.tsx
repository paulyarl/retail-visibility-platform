'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button, Badge, Modal, ModalFooter, Input } from '@/components/ui';
import PageHeader, { Icons } from '@/components/PageHeader';

interface Category {
  id: string;
  name: string;
  createdAt?: string;
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState('');

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      const data = await res.json();
      setCategories(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!categoryName.trim()) return;
    
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: categoryName }),
      });
      
      if (res.ok) {
        await loadCategories();
        setShowCreateModal(false);
        setCategoryName('');
      }
    } catch (error) {
      console.error('Failed to create category:', error);
    }
  };

  const handleEdit = async () => {
    if (!selectedCategory || !categoryName.trim()) return;
    
    try {
      const res = await fetch(`/api/categories/${selectedCategory.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: categoryName }),
      });
      
      if (res.ok) {
        await loadCategories();
        setShowEditModal(false);
        setSelectedCategory(null);
        setCategoryName('');
      }
    } catch (error) {
      console.error('Failed to update category:', error);
    }
  };

  const handleDelete = async () => {
    if (!selectedCategory) return;
    
    try {
      const res = await fetch(`/api/categories/${selectedCategory.id}`, {
        method: 'DELETE',
      });
      
      if (res.ok || res.status === 204) {
        await loadCategories();
        setShowDeleteModal(false);
        setSelectedCategory(null);
      }
    } catch (error) {
      console.error('Failed to delete category:', error);
    }
  };

  const openEditModal = (category: Category) => {
    setSelectedCategory(category);
    setCategoryName(category.name);
    setShowEditModal(true);
  };

  const openDeleteModal = (category: Category) => {
    setSelectedCategory(category);
    setShowDeleteModal(true);
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <PageHeader
          title="Category Management"
          description="Loading..."
          icon={Icons.Settings}
          backLink={{ href: '/settings/admin', label: 'Back to Admin' }}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <PageHeader
        title="Category Management"
        description="Manage product categories and hierarchies"
        icon={Icons.Settings}
        backLink={{ href: '/settings/admin', label: 'Back to Admin' }}
      />

      <div className="mt-6 space-y-6">
        {/* Header with Create Button */}
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-neutral-700">
            {categories.length} {categories.length === 1 ? 'category' : 'categories'}
          </p>
          <Button
            variant="primary"
            onClick={() => setShowCreateModal(true)}
          >
            + Create Category
          </Button>
        </div>

        {/* Categories List */}
        <Card>
          <CardHeader>
            <CardTitle>All Categories</CardTitle>
          </CardHeader>
          <CardContent>
            {categories.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-neutral-500">No categories yet</p>
                <p className="text-sm text-neutral-400 mt-2">
                  Create your first category to get started
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {categories.map((category) => (
                  <div
                    key={category.id}
                    className="flex items-center justify-between p-4 bg-neutral-50 rounded-lg hover:bg-neutral-100 transition-colors"
                  >
                    <div className="flex-1">
                      <h3 className="font-semibold text-neutral-900">{category.name}</h3>
                      <p className="text-sm text-neutral-600">ID: {category.id}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => openEditModal(category)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openDeleteModal(category)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setCategoryName('');
        }}
        title="Create Category"
        description="Add a new product category"
      >
        <div className="space-y-4">
          <Input
            label="Category Name"
            placeholder="Enter category name"
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleCreate()}
          />
        </div>
        <ModalFooter>
          <Button
            variant="ghost"
            onClick={() => {
              setShowCreateModal(false);
              setCategoryName('');
            }}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleCreate}
            disabled={!categoryName.trim()}
          >
            Create
          </Button>
        </ModalFooter>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedCategory(null);
          setCategoryName('');
        }}
        title="Edit Category"
        description={selectedCategory ? `Update ${selectedCategory.name}` : ''}
      >
        <div className="space-y-4">
          <Input
            label="Category Name"
            placeholder="Enter category name"
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleEdit()}
          />
        </div>
        <ModalFooter>
          <Button
            variant="ghost"
            onClick={() => {
              setShowEditModal(false);
              setSelectedCategory(null);
              setCategoryName('');
            }}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleEdit}
            disabled={!categoryName.trim()}
          >
            Save Changes
          </Button>
        </ModalFooter>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedCategory(null);
        }}
        title="Delete Category"
        description="Are you sure you want to delete this category?"
      >
        {selectedCategory && (
          <div className="py-4">
            <p className="text-neutral-700">
              Category: <strong>{selectedCategory.name}</strong>
            </p>
            <p className="text-sm text-neutral-600 mt-2">
              This action cannot be undone.
            </p>
          </div>
        )}
        <ModalFooter>
          <Button
            variant="ghost"
            onClick={() => {
              setShowDeleteModal(false);
              setSelectedCategory(null);
            }}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleDelete}
          >
            Delete Category
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
