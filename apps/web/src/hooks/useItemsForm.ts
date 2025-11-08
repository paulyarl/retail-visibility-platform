import { useState, useCallback } from 'react';

interface ItemFormData {
  sku: string;
  name: string;
  price: string;
  stock: string;
  description?: string;
}

interface UseItemsFormReturn {
  formData: ItemFormData;
  setFormData: (data: ItemFormData) => void;
  updateField: (field: keyof ItemFormData, value: string) => void;
  resetForm: () => void;
  isValid: boolean;
  showForm: boolean;
  openForm: () => void;
  closeForm: () => void;
  toggleForm: () => void;
}

const initialFormData: ItemFormData = {
  sku: '',
  name: '',
  price: '',
  stock: '',
  description: '',
};

/**
 * Hook for managing item creation form
 * Handles form state and validation
 */
export function useItemsForm(): UseItemsFormReturn {
  const [formData, setFormData] = useState<ItemFormData>(initialFormData);
  const [showForm, setShowForm] = useState(false);

  const updateField = useCallback((field: keyof ItemFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const resetForm = useCallback(() => {
    setFormData(initialFormData);
  }, []);

  const openForm = useCallback(() => {
    setShowForm(true);
  }, []);

  const closeForm = useCallback(() => {
    setShowForm(false);
    resetForm();
  }, [resetForm]);

  const toggleForm = useCallback(() => {
    setShowForm(prev => !prev);
  }, []);

  // Basic validation
  const isValid = 
    formData.sku.trim() !== '' &&
    formData.name.trim() !== '' &&
    formData.price.trim() !== '' &&
    !isNaN(parseFloat(formData.price)) &&
    formData.stock.trim() !== '' &&
    !isNaN(parseInt(formData.stock));

  return {
    formData,
    setFormData,
    updateField,
    resetForm,
    isValid,
    showForm,
    openForm,
    closeForm,
    toggleForm,
  };
}
