'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import Button from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';
import { InlineDetailPanel } from '@/components/ui/inline-detail-panel';
import Input from '@/components/ui/input';
import Select from '@/components/ui/select';
import { CheckCircle, XCircle, Clock, Plus, Search, Loader2, Eye, EyeOff, Printer, Pencil } from 'lucide-react';
import { showroomLabelsApi, type ShowroomLabelRequest, type CreateShowroomLabelRequestDto, type UpdateShowroomLabelRequestDto } from '@/lib/api/showroom-labels';
import { outletsApi, type Outlet } from '@/lib/api/outlets';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useThemeStore } from '@/lib/stores/theme-store';
import { usePermissions } from '@/hooks/usePermissions';
import { ProtectedPage } from '@/components/auth';
import toast from 'react-hot-toast';
import { formatSlDate } from '@/lib/sri-lanka-time';
import {
  printShowroomLabels,
  SHOWROOM_LABEL_HEIGHT_MM,
  SHOWROOM_LABEL_WIDTH_MM,
} from '@/lib/print-showroom-label';

export default function ShowroomLabelPrintingPage() {
  return (
    <ProtectedPage permission="operation:showroom-label-printing:view">
      <ShowroomLabelPrintingPageContent />
    </ProtectedPage>
  );
}

function ShowroomLabelPrintingPageContent() {
  const user = useAuthStore((s) => s.user);
  const { canAction } = usePermissions();
  const canCreate = canAction('/operation/showroom-label-printing', 'create');
  const canEdit = canAction('/operation/showroom-label-printing', 'edit');
  const canPrint = canAction('/operation/showroom-label-printing', 'print');
  const pageTheme = useThemeStore((s) => s.getPageTheme('showroom-label-printing'));

  const [requests, setRequests] = useState<ShowroomLabelRequest[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<ShowroomLabelRequest | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingRequest, setEditingRequest] = useState<ShowroomLabelRequest | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    showroomCode: '',
    labelCount: '',
  });

  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchRequests();
    fetchOutlets();
  }, [currentPage, pageSize]);

  const fetchRequests = async () => {
    try {
      setIsLoading(true);
      const response = await showroomLabelsApi.getAll(currentPage, pageSize);
      setRequests(response.requests || []);
      setTotalPages(response.totalPages || 1);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to load showroom label requests');
      setRequests([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchOutlets = async () => {
    try {
      const response = await outletsApi.getAll();
      setOutlets(response.outlets.filter(o => o.isActive));
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to load outlets');
    }
  };

  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      const matchesSearch =
        req.displayNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.outletCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.outletName.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    });
  }, [requests, searchTerm]);

  const handleSubmitForm = async () => {
    if (!formData.showroomCode) {
      toast.error('Please select a showroom');
      return;
    }
    if (!formData.labelCount || Number(formData.labelCount) < 1) {
      toast.error('Please enter a valid label count');
      return;
    }

    const selectedOutlet = outlets.find(o => o.code === formData.showroomCode);
    if (!selectedOutlet) {
      toast.error('Selected showroom not found');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload: CreateShowroomLabelRequestDto = {
        outletId: selectedOutlet.id,
        labelCount: Number(formData.labelCount),
      };
      await showroomLabelsApi.create(payload);
      toast.success(`Showroom label request created for ${formData.labelCount} label(s)`);
      setFormData({ showroomCode: '', labelCount: '' });
      setShowForm(false);
      fetchRequests();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create label request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditClick = (request: ShowroomLabelRequest) => {
    setEditingRequest(request);
    setFormData({
      showroomCode: request.outletCode,
      labelCount: request.labelCount.toString(),
    });
    setShowForm(true);
    // Scroll to form
    setTimeout(() => {
      document.getElementById('label-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleUpdateForm = async () => {
    if (!editingRequest) return;
    
    if (!formData.showroomCode) {
      toast.error('Please select a showroom');
      return;
    }
    if (!formData.labelCount || Number(formData.labelCount) < 1) {
      toast.error('Please enter a valid label count');
      return;
    }

    const selectedOutlet = outlets.find(o => o.code === formData.showroomCode);
    if (!selectedOutlet) {
      toast.error('Selected showroom not found');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload: UpdateShowroomLabelRequestDto = {
        outletId: selectedOutlet.id,
        labelCount: Number(formData.labelCount),
      };
      await showroomLabelsApi.update(editingRequest.id, payload);
      toast.success('Showroom label request updated successfully');
      setFormData({ showroomCode: '', labelCount: '' });
      setShowForm(false);
      setEditingRequest(null);
      fetchRequests();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update label request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Approved':
        return <Badge variant="success" size="sm"><CheckCircle className="w-3 h-3 mr-1" />Approved</Badge>;
      case 'Rejected':
        return <Badge variant="danger" size="sm"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      case 'Pending':
        return <Badge variant="warning" size="sm"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      default:
        return <Badge variant="neutral" size="sm">{status}</Badge>;
    }
  };

  const formatApproverCell = (item: ShowroomLabelRequest) => {
    if (item.status === 'Approved' && item.approvedByName) {
      const date = item.approvedDate ? formatSlDate(item.approvedDate) : '';
      return (
        <span className="text-sm">
          {item.approvedByName} {date && `- ${date}`}
        </span>
      );
    }
    if (item.status === 'Rejected' && item.rejectedByName) {
      const date = item.rejectedDate ? formatSlDate(item.rejectedDate) : '';
      return (
        <span className="text-sm">
          {item.rejectedByName} {date && `- ${date}`}
        </span>
      );
    }
    return <span className="text-sm">-</span>;
  };

  const columns = [
    {
      key: 'requestDate',
      label: 'Date',
      render: (item: ShowroomLabelRequest) => (
        <span className="font-medium">{formatSlDate(item.requestDate)}</span>
      ),
    },
    {
      key: 'displayNo',
      label: 'Display No',
      render: (item: ShowroomLabelRequest) => (
        <span className="font-mono font-semibold" style={{ color: pageTheme?.secondaryColor || '#C8102E' }}>
          {item.displayNo}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (item: ShowroomLabelRequest) => getStatusBadge(item.status),
    },
    {
      key: 'outletCode',
      label: 'Showroom',
      render: (item: ShowroomLabelRequest) => (
        <span className="font-mono font-semibold">{item.outletCode}</span>
      ),
    },
    {
      key: 'labelCount',
      label: 'Label Count',
      render: (item: ShowroomLabelRequest) => (
        <span className="font-semibold">{item.labelCount}</span>
      ),
    },
    {
      key: 'editUser',
      label: 'Edit User',
      render: (item: ShowroomLabelRequest) => (
        <span className="text-sm">{item.updatedByName || '-'}</span>
      ),
    },
    {
      key: 'editDate',
      label: 'Edit Date',
      render: (item: ShowroomLabelRequest) => (
        <span className="text-sm">{formatSlDate(item.updatedAt)}</span>
      ),
    },
    {
      key: 'approvedBy',
      label: 'Approved/Rejected By',
      render: (item: ShowroomLabelRequest) => formatApproverCell(item),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (item: ShowroomLabelRequest) => (
        <div className="flex items-center space-x-2">
          <button
            onClick={async () => {
              try {
                const detail = await showroomLabelsApi.getById(item.id);
                const raw = detail as unknown as { data?: ShowroomLabelRequest };
                const data = raw?.data ?? (detail as ShowroomLabelRequest);
                if (selectedRequest?.id === item.id) {
                  setSelectedRequest(null);
                  return;
                }
                setSelectedRequest(data);
              } catch (error) {
                toast.error('Failed to load request details');
              }
            }}
            className="p-1.5 rounded transition-colors"
            style={{ color: 'var(--muted-foreground)' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F9FAFB'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            title={selectedRequest?.id === item.id ? 'Hide details' : 'View details'}
          >
            {selectedRequest?.id === item.id ? (
              <Eye className="w-4 h-4" aria-hidden />
            ) : (
              <EyeOff className="w-4 h-4" aria-hidden />
            )}
          </button>
          {item.status === 'Pending' && canEdit && (
            <button
              onClick={() => handleEditClick(item)}
              className="p-1.5 rounded transition-colors"
              style={{ color: '#3B82F6' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#EFF6FF'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              title="Edit Request"
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}
          {item.status === 'Approved' && canPrint && (
            <button
              onClick={async () => {
                try {
                  await printShowroomLabels(item.outletCode, item.labelCount);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : 'Print failed');
                }
              }}
              className="p-1.5 rounded transition-colors"
              style={{ color: '#C8102E' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#FFF1F2'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              title="Print Labels"
            >
              <Printer className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>
            Showroom Label Printing
          </h1>
          <p className="mt-1" style={{ color: 'var(--muted-foreground)' }}>
            List of showroom label printing requests ({filteredRequests.length} requests)
          </p>
        </div>
        <div className="flex items-center space-x-3">
          {canCreate && !showForm && (
            <Button variant="primary" size="md" onClick={() => {
              setEditingRequest(null);
              setFormData({ showroomCode: '', labelCount: '' });
              setShowForm(true);
              setTimeout(() => {
                document.getElementById('label-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }, 100);
            }}>
              <Plus className="w-4 h-4 mr-2" />
              Add New
            </Button>
          )}
        </div>
      </div>

      {/* Inline Add/Edit Form */}
      {showForm && (
        <Card id="label-form">
          <CardHeader>
            <CardTitle>
              {editingRequest ? `Edit Showroom Label Request - ${editingRequest.displayNo}` : 'New Showroom Label Print Request'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="Showroom Code"
                  value={formData.showroomCode}
                  onChange={(e) => setFormData({ ...formData, showroomCode: e.target.value })}
                  options={outlets.map((o) => ({
                    value: o.code,
                    label: `${o.code} — ${o.name}`,
                  }))}
                  placeholder="Select showroom code"
                  fullWidth
                  required
                />

                <Input
                  label="Label Count"
                  type="number"
                  min="1"
                  value={formData.labelCount}
                  onChange={(e) => setFormData({ ...formData, labelCount: e.target.value })}
                  placeholder="Enter label count"
                  fullWidth
                  required
                />
              </div>

              {formData.showroomCode ? (
                <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--muted)', border: '1px solid var(--border)' }}>
                  <p className="text-sm font-medium mb-2" style={{ color: 'var(--muted-foreground)' }}>
                    Label preview ({SHOWROOM_LABEL_WIDTH_MM}mm × {SHOWROOM_LABEL_HEIGHT_MM}mm, centered)
                  </p>
                  <div
                    className="mx-auto flex items-center justify-center rounded border-2 border-dashed border-gray-300 bg-white px-1 text-center font-bold leading-tight"
                    style={{
                      width: `${SHOWROOM_LABEL_WIDTH_MM}mm`,
                      height: `${SHOWROOM_LABEL_HEIGHT_MM}mm`,
                      fontSize: '9pt',
                      color: 'var(--foreground)',
                    }}
                  >
                    {formData.showroomCode}
                  </div>
                </div>
              ) : null}

              <div className="flex justify-end space-x-3 pt-4">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowForm(false);
                    setEditingRequest(null);
                    setFormData({ showroomCode: '', labelCount: '' });
                  }}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={editingRequest ? handleUpdateForm : handleSubmitForm}
                  disabled={isSubmitting || !formData.showroomCode || !formData.labelCount}
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : editingRequest ? (
                    <Pencil className="w-4 h-4 mr-2" />
                  ) : (
                    <Printer className="w-4 h-4 mr-2" />
                  )}
                  {isSubmitting ? (editingRequest ? 'Updating...' : 'Submitting...') : (editingRequest ? 'Update' : 'Submit')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <CardTitle>Showroom Label Print Requests</CardTitle>
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: 'var(--muted-foreground)' }} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search requests..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoComplete="off"
                className="w-full sm:w-64 pl-10 pr-4 py-2 rounded-lg text-sm"
                style={{ border: '1px solid var(--input)' }}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--muted-foreground)' }} />
            </div>
          ) : (
            <DataTable
              data={filteredRequests}
              columns={columns}
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setCurrentPage(1);
              }}
              expandedRowKey={selectedRequest?.id ?? null}
              getRowKey={(row) => row.id}
              renderExpandedRow={(req) => (
                <InlineDetailPanel
                  title="Showroom Label Request Details"
                  open
                  onClose={() => setSelectedRequest(null)}
                  footer={
                    <Button variant="ghost" onClick={() => setSelectedRequest(null)}>
                      Close
                    </Button>
                  }
                >
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>Display No</p>
                        <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{req.displayNo}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>Status</p>
                        {getStatusBadge(req.status)}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>Request Date</p>
                      <p className="text-sm" style={{ color: 'var(--foreground)' }}>
                        {formatSlDate(req.requestDate)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>Showroom</p>
                      <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                        {req.outletCode} - {req.outletName}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>Label text</p>
                      <p className="text-sm font-semibold font-mono" style={{ color: 'var(--foreground)' }}>
                        {req.outletCode}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>Label Count</p>
                      <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{req.labelCount}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>Created / Updated</p>
                      <p className="text-sm" style={{ color: 'var(--foreground)' }}>
                        {formatSlDate(req.createdAt)} • {formatSlDate(req.updatedAt)}
                      </p>
                    </div>
                    {(req.approvedByName || req.rejectedByName) && (
                      <div>
                        <p className="text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>Approved/Rejected By</p>
                        <p className="text-sm" style={{ color: 'var(--foreground)' }}>
                          {req.status === 'Approved' && req.approvedByName &&
                            `${req.approvedByName} • ${req.approvedDate ? formatSlDate(req.approvedDate) : ''}`
                          }
                          {req.status === 'Rejected' && req.rejectedByName &&
                            `${req.rejectedByName} • ${req.rejectedDate ? formatSlDate(req.rejectedDate) : ''}`
                          }
                        </p>
                      </div>
                    )}
                  </div>
                </InlineDetailPanel>
              )}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
