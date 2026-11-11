'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import Button from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { FolderTree, Plus, Search, Edit, X, Check, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { categoriesApi, Category, type CreateCategoryDto } from '@/lib/api/categories';
import { ProtectedPage } from '@/components/auth';
import { usePermissions } from '@/hooks/usePermissions';
import toast from 'react-hot-toast';
import CsvBulkUploadBar from '@/components/dms/CsvBulkUploadBar';
import type { CsvRowRecord } from '@/lib/csv-utils';
import { parseBool, parseIntField, req } from '@/lib/bulk-csv-field-parsers';
import { useInitialListLoading } from '@/hooks/use-initial-list-loading';

export default function CategoryPage() {
  return (
    <ProtectedPage permission="categories:view">
      <CategoryPageContent />
    </ProtectedPage>
  );
}

function CategoryPageContent() {
  const router = useRouter();
  const { canAction } = usePermissions();
  const canCreate = canAction('/inventory/category', 'create');
  const canEditCategory = canAction('/inventory/category', 'edit');
  const canBulk = canAction('/inventory/category', 'import') || canCreate;

  const mapCategoryRow = useCallback(
    async (
      row: CsvRowRecord,
      _excelRow: number,
    ): Promise<{ ok: true; value: CreateCategoryDto } | { ok: false; error: string }> => {
      try {
        const dto: CreateCategoryDto = {
          code: req(row, 'code'),
          name: req(row, 'name'),
          description: row.description?.trim() || undefined,
          sortOrder: parseIntField(row, 'sortOrder', 0),
          displayInPOS: parseBool(row, 'displayInPOS', true),
          isActive: parseBool(row, 'isActive', true),
        };
        return { ok: true, value: dto };
      } catch (e: unknown) {
        return { ok: false, error: e instanceof Error ? e.message : 'Invalid row' };
      }
    },
    [],
  );
  const [categories, setCategories] = useState<Category[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const { loading, beginListLoad, endListLoad } = useInitialListLoading(true);
  
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    loadCategories();
  }, [currentPage, pageSize, searchTerm]);

  const loadCategories = async () => {
    const keepSearchFocus = document.activeElement === searchInputRef.current;
    try {
      beginListLoad();
      const response = await categoriesApi.getAll(currentPage, pageSize, searchTerm, undefined);
      setCategories(response.categories);
      setTotalCount(response.totalCount);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to load categories');
    } finally {
      endListLoad();
      if (keepSearchFocus) requestAnimationFrame(() => searchInputRef.current?.focus());
    }
  };

  const handleToggleActive = async (category: Category) => {
    try {
      const updated = await categoriesApi.update(category.id, {
        ...category,
        isActive: !category.isActive,
      });
      toast.success(`Category ${updated.isActive ? 'activated' : 'deactivated'}`);
      loadCategories();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update category');
    }
  };

  const columns = [
    {
      key: 'code',
      label: 'Category Code',
      render: (item: Category) => (
        <span className="font-mono font-semibold" style={{ color: '#C8102E' }}>
          {item.code}
        </span>
      ),
    },
    {
      key: 'name',
      label: 'Category Name',
      render: (item: Category) => (
        <span className="font-medium">{item.name}</span>
      ),
    },
    {
      key: 'sortOrder',
      label: 'POS sort',
      render: (item: Category) => (
        <span className="font-mono tabular-nums">{item.sortOrder ?? 0}</span>
      ),
    },
    {
      key: 'productCount',
      label: 'Products',
      render: (item: Category) => (
        <Badge variant="neutral" size="sm">{item.productCount}</Badge>
      ),
    },
    {
      key: 'displayInPOS',
      label: 'Display in POS',
      render: (item: Category) => (
        item.displayInPOS ? (
          <Badge variant="success" size="sm">Yes</Badge>
        ) : (
          <Badge variant="neutral" size="sm">No</Badge>
        )
      ),
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (item: Category) => (
        item.isActive ? (
          <Badge variant="success" size="sm">Active</Badge>
        ) : (
          <Badge variant="danger" size="sm">Inactive</Badge>
        )
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (item: Category) => (
        <div className="flex items-center space-x-2">
          {canEditCategory && (
            <button
              onClick={() => router.push(`/inventory/category/edit/${item.id}`)}
              className="p-1.5 rounded transition-colors"
              style={{ color: 'var(--muted-foreground)' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F9FAFB'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              title="Edit"
            >
              <Edit className="w-4 h-4" />
            </button>
          )}
          {canEditCategory && (
            <button
              onClick={() => handleToggleActive(item)}
              className="p-1.5 rounded transition-colors"
              style={{ color: item.isActive ? '#DC2626' : '#10B981' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = item.isActive ? '#FEF2F2' : '#F0FDF4'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              title={item.isActive ? 'Deactivate' : 'Activate'}
            >
              {item.isActive ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
            </button>
          )}
        </div>
      ),
    },
  ];

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>Categories</h1>
          <p className="mt-1" style={{ color: 'var(--muted-foreground)' }}>
            Manage product categories ({totalCount} categories)
          </p>
        </div>
        {canCreate && (
          <div className="flex flex-wrap gap-2 justify-end">
            <Button variant="primary" size="md" onClick={() => router.push('/inventory/category/add')}>
              <Plus className="w-4 h-4 mr-2" />
              Add Category
            </Button>
          </div>
        )}
      </div>

      {canBulk && (
        <div className="w-full min-w-0 max-w-full">
          <CsvBulkUploadBar<CreateCategoryDto>
            entityLabel="categories"
            templateFilename="categories-import-template.csv"
            permission={['categories:import', 'categories:create']}
            permissionMode="any"
            columns={[
              { header: 'code' },
              { header: 'name' },
              { header: 'description' },
              { header: 'sortOrder' },
              { header: 'displayInPOS' },
              { header: 'isActive' },
            ]}
            exampleRows={[['CAT01', 'Bakery', '', '0', 'true', 'true']]}
            mapRow={mapCategoryRow}
            importRow={(dto) => categoriesApi.create(dto)}
            onImportComplete={() => loadCategories()}
          />
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <CardTitle>Category List</CardTitle>
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: 'var(--muted-foreground)' }} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search categories..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                autoComplete="off"
                className="w-full sm:w-64 pl-10 pr-4 py-2 rounded-lg text-sm"
                style={{ border: '1px solid var(--input)' }}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#C8102E' }} />
            </div>
          ) : (
            <DataTable
              data={categories}
              columns={columns}
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setCurrentPage(1);
              }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
