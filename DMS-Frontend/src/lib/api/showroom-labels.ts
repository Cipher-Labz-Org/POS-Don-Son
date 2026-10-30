import api from './api-client';

export interface ShowroomLabelRequest {
  id: string;
  displayNo: string;
  requestDate: string;
  status: string;
  outletId: string;
  outletCode: string;
  outletName: string;
  text1: string;
  text2?: string;
  labelCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdById: string;
  updatedById: string;
  updatedByName?: string;
  approvedByName?: string;
  approvedDate?: string;
  rejectedByName?: string;
  rejectedDate?: string;
}

export interface CreateShowroomLabelRequestDto {
  outletId: string;
  labelCount: number;
}

export interface UpdateShowroomLabelRequestDto {
  outletId: string;
  labelCount: number;
}

const BASE_URL = '/api/showroom-label-requests';

export const showroomLabelsApi = {
  getAll: async (page = 1, pageSize = 10, outletId?: string) => {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
    });
    if (outletId) params.append('outletId', outletId);

    const response = await api.get<any>(`${BASE_URL}?${params}`);
    const data = response.data.data || response.data;
    return { 
      requests: Array.isArray(data) ? data : [], 
      totalPages: 1
    };
  },

  getById: async (id: string) => {
    const response = await api.get<any>(`${BASE_URL}/${id}`);
    return response.data.data || response.data;
  },

  create: async (data: CreateShowroomLabelRequestDto) => {
    const response = await api.post<any>(BASE_URL, data);
    return response.data.data || response.data;
  },

  update: async (id: string, data: UpdateShowroomLabelRequestDto) => {
    const response = await api.put<any>(`${BASE_URL}/${id}`, data);
    return response.data.data || response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete<any>(`${BASE_URL}/${id}`);
    return response.data.data || response.data;
  },

  approve: async (id: string) => {
    const response = await api.post<any>(`${BASE_URL}/${id}/approve`);
    return response.data.data || response.data;
  },

  reject: async (id: string) => {
    const response = await api.post<any>(`${BASE_URL}/${id}/reject`);
    return response.data.data || response.data;
  },
};
