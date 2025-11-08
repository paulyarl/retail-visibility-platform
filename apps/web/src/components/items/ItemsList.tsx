import { Badge, Button } from '@/components/ui';
import { Item } from '@/services/itemsDataService';

interface ItemsListProps {
  items: Item[];
  onEdit: (item: Item) => void;
  onDelete: (item: Item) => void;
}

/**
 * List view component for items
 * Displays items in a table format
 */
export default function ItemsList({
  items,
  onEdit,
  onDelete,
}: ItemsListProps) {
  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <svg className="w-16 h-16 mx-auto text-neutral-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
        <h3 className="text-lg font-medium text-neutral-900 dark:text-white mb-2">
          No items found
        </h3>
        <p className="text-neutral-600 dark:text-neutral-400">
          Get started by adding your first item
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden mb-6" suppressHydrationWarning>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-700">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                Item
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                SKU
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                Price
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                Stock
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                Visibility
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-900/50">
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    {item.images && item.images.length > 0 ? (
                      <img
                        src={item.images[0]}
                        alt={item.name}
                        className="w-10 h-10 rounded object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-neutral-100 dark:bg-neutral-800 rounded flex items-center justify-center">
                        <svg className="w-5 h-5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                    <div>
                      <div className="font-medium text-neutral-900 dark:text-white">
                        {item.name}
                      </div>
                      {item.categoryPath && item.categoryPath.length > 0 && (
                        <div className="text-xs text-neutral-500">
                          {item.categoryPath.join(' > ')}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 text-sm text-neutral-600 dark:text-neutral-400">
                  {item.sku}
                </td>
                <td className="px-4 py-4 text-sm font-medium text-neutral-900 dark:text-white">
                  ${(item.price / 100).toFixed(2)}
                </td>
                <td className="px-4 py-4">
                  <span className={`text-sm ${item.stock < 10 ? 'text-warning font-medium' : 'text-neutral-600 dark:text-neutral-400'}`}>
                    {item.stock}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <Badge variant={item.status === 'active' ? 'success' : 'default'}>
                    {item.status}
                  </Badge>
                </td>
                <td className="px-4 py-4">
                  <Badge variant={item.visibility === 'public' ? 'info' : 'default'}>
                    {item.visibility}
                  </Badge>
                </td>
                <td className="px-4 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button size="sm" variant="secondary" onClick={() => onEdit(item)}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (confirm(`Delete "${item.name}"?`)) {
                          onDelete(item);
                        }
                      }}
                      className="text-error hover:text-error"
                    >
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
