'use client';

import { Modal } from '@/components/ui';
import { Item } from '@/services/itemsDataService';
import EditItemForm from './edit/EditItemForm';

export interface EditItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: Item | null;
  onSave: (item: Item) => Promise<Item>;
  onItemUpdated?: () => void;
}

export default function EditItemModal({
  isOpen,
  onClose,
  item,
  onSave,
  onItemUpdated,
}: EditItemModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={item ? 'Edit Item' : 'Add New Item'}
      description={item ? 'Update item details' : 'Create a new item'}
      size="xl"
    >
      <EditItemForm
        isOpen={isOpen}
        onClose={onClose}
        item={item}
        onSave={onSave}
        onItemUpdated={onItemUpdated}
      />
    </Modal>
  );
}
