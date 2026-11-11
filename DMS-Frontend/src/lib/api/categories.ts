import apiClient, { type ApiEnvelope } from './api-client';

export interface Category {
  id: string;
  code: string;
  name: string;
  description?: string;
  sortOrder: number;
  displayInPOS: boolean;
  isActive: boolean;
  productCount: number;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateCategoryDto {
  code: string;
  name: string;
  description?: string;
  sortOrder: number;
  displayInPOS: boolean;
  isActive: boolean;
}

export interface UpdateCategoryDto {
  code: string;
  name: string;
  description?: string;
  sortOrder: number;
  displayInPOS: boolean;
  isActive: boolean;
}

export interface CategoriesResponse {
  categories: Category[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

function normalizeCategory(raw: Record<string, unknown>): Category {
  return {
    id: String(raw.id ?? raw.Id ?? ''),
    code: String(raw.code ?? raw.Code ?? ''),
    name: String(raw.name ?? raw.Name ?? ''),
    description: raw.description != null ? String(raw.description) : raw.Description != null ? String(raw.Description) : undefined,
    sortOrder: Number(raw.sortOrder ?? raw.SortOrder ?? 0),
    displayInPOS: Boolean(raw.displayInPOS ?? raw.DisplayInPOS ?? true),
    isActive: Boolean(raw.isActive ?? raw.IsActive ?? true),
    productCount: Number(raw.productCount ?? raw.ProductCount ?? 0),
    createdAt: String(raw.createdAt ?? raw.CreatedAt ?? ''),
    updatedAt: raw.updatedAt != null ? String(raw.updatedAt) : raw.UpdatedAt != null ? String(raw.UpdatedAt) : undefined,
  };
}

export const categoriesApi = {
  async getAll(
    page: number = 1,
    pageSize: number = 50,
    search?: string,
    activeOnly?: boolean
  ): Promise<CategoriesResponse> {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('pageSize', pageSize.toString());
    if (search) params.append('search', search);
    if (activeOnly !== undefined) params.append('activeOnly', activeOnly.toString());

    const response = await apiClient.get<ApiEnvelope<CategoriesResponse>>(`/api/Categories?${params}`);
    const data = response.data.data;
    return {
      ...data,
      categories: (data.categories ?? []).map((c) =>
        normalizeCategory(c as unknown as Record<string, unknown>),
      ),
    };
  },

  async getById(id: string): Promise<Category> {
    const response = await apiClient.get<ApiEnvelope<Category>>(`/api/Categories/${id}`);
    return normalizeCategory(response.data.data as unknown as Record<string, unknown>);
  },

  async create(data: CreateCategoryDto): Promise<Category> {
    const response = await apiClient.post<ApiEnvelope<Category>>('/api/Categories', data);
    return normalizeCategory(response.data.data as unknown as Record<string, unknown>);
  },

  async update(id: string, data: UpdateCategoryDto): Promise<Category> {
    const response = await apiClient.put<ApiEnvelope<Category>>(`/api/Categories/${id}`, data);
    return normalizeCategory(response.data.data as unknown as Record<string, unknown>);
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api/Categories/${id}`);
  },
};
