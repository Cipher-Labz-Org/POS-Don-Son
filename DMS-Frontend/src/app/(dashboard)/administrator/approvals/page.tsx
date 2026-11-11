'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import Button from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { Modal, ModalFooter } from '@/components/ui/modal';
import Input from '@/components/ui/input';
import { CheckCircle, XCircle, Search, Check, X, Loader2, Clock, ChevronDown, CheckCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  operationApprovalsApi,
  type OperationApprovalItem,
  type OperationApprovalsSummary,
} from '@/lib/api/operation-approvals';
import { deliveriesApi, type Delivery } from '@/lib/api/deliveries';
import { transfersApi, type Transfer } from '@/lib/api/transfers';
import { disposalsApi, type Disposal } from '@/lib/api/disposals';
import { cancellationsApi, type Cancellation } from '@/lib/api/cancellations';
import { labelPrintingApi } from '@/lib/api/label-printing';
import { stockBfApi } from '@/lib/api/stock-bf';
import { deliveryReturnsApi } from '@/lib/api/delivery-returns';
import { posSalesApi, type PosSale } from '@/lib/api/pos-sales';
import { dailyProductionsApi, type DailyProduction } from '@/lib/api/daily-productions';
import { productionCancelsApi } from '@/lib/api/production-cancels';
import { stockAdjustmentsApi } from '@/lib/api/stock-adjustments';
import { productionPlansApi } from '@/lib/api/production-plans';
import { immediateOrdersApi, type ImmediateOrder } from '@/lib/api/immediate-orders';
import { approvalsApi, type ApproveApprovalDto, type RejectApprovalDto } from '@/lib/api/approvals';
import { usePermissions } from '@/hooks/usePermissions';
import { ProtectedPage } from '@/components/auth';
import toast from 'react-hot-toast';
import { appConfirm } from '@/lib/app-notify';
import { formatSlDate, formatSlDateSlashMon, formatSlDateTime } from '@/lib/sri-lanka-time';

// ─── Section / subsection config ──────────────────────────────────────────────

type SubsectionKey =
  | 'deliveries' | 'transfers' | 'disposals' | 'cancellations' | 'labelPrintRequests'
  | 'stockBFs' | 'deliveryReturns' | 'posSales' | 'posCancellationRequests' | 'showroomLabelRequests'
  | 'dailyProductions' | 'productionCancels' | 'stockAdjustments' | 'dailyProductionPlans'
  | 'immediateOrders' | 'cashierBalances' | 'priceChanges' | 'adminApprovals';

interface Subsection {
  key: SubsectionKey;
  label: string;
  approvalType: string;
}

interface Section {
  id: string;
  label: string;
  subsections: Subsection[];
}

const SECTIONS: Section[] = [
  {
    id: 'operation',
    label: 'Operation',
    subsections: [
      { key: 'deliveries',           label: 'Deliveries',           approvalType: 'Delivery' },
      { key: 'transfers',            label: 'Transfers',            approvalType: 'Transfer' },
      { key: 'disposals',            label: 'Disposals',            approvalType: 'Disposal' },
      { key: 'cancellations',        label: 'Cancellations',        approvalType: 'Cancellation' },
      { key: 'labelPrintRequests',   label: 'Label Print Requests', approvalType: 'Label Print' },
      { key: 'stockBFs',             label: 'Stock BF',             approvalType: 'Stock BF' },
      { key: 'deliveryReturns',      label: 'Delivery Returns',     approvalType: 'Delivery Return' },
      { key: 'posSales',             label: 'POS Sales',            approvalType: 'POS Sale' },
      { key: 'posCancellationRequests', label: 'POS Cancellation Request', approvalType: 'POS Cancellation Request' },
      { key: 'showroomLabelRequests',label: 'Showroom Labels',      approvalType: 'Showroom Label' },
    ],
  },
  {
    id: 'production',
    label: 'Production',
    subsections: [
      { key: 'dailyProductions',    label: 'Daily Production',  approvalType: 'Daily Production' },
      { key: 'productionCancels',   label: 'Production Cancel', approvalType: 'Production Cancel' },
      { key: 'stockAdjustments',    label: 'Stock Adjustment',  approvalType: 'Stock Adjustment' },
      { key: 'dailyProductionPlans',label: 'Production Plan',   approvalType: 'Production Plan' },
    ],
  },
  {
    id: 'dms',
    label: 'DMS',
    subsections: [
      { key: 'immediateOrders', label: 'Immediate Orders', approvalType: 'Immediate Order' },
    ],
  },
  {
    id: 'administrator',
    label: 'Administrator',
    subsections: [
      { key: 'cashierBalances', label: 'Cash Submission', approvalType: 'Cashier Balance' },
      { key: 'priceChanges', label: 'Price Change', approvalType: 'Price Change' },
      { key: 'adminApprovals', label: 'Admin / Generic', approvalType: 'Generic' },
    ],
  },
];

const APPROVAL_TYPE_PERMISSIONS: Record<string, { approve: string; reject?: string }> = {
  Delivery:          { approve: 'operation:delivery:approve',        reject: 'operation:delivery:reject' },
  Transfer:          { approve: 'operation:transfer:approve',        reject: 'operation:transfer:reject' },
  Disposal:          { approve: 'operation:disposal:approve',        reject: 'operation:disposal:reject' },
  Cancellation:      { approve: 'operation:cancellation:approve',    reject: 'operation:cancellation:reject' },
  'Label Print':     { approve: 'operation:label-printing:approve',  reject: 'operation:label-printing:reject' },
  'Stock BF':        { approve: 'operation:stock-bf:approve',        reject: 'operation:stock-bf:reject' },
  'Delivery Return': { approve: 'operation:delivery-return:approve', reject: 'operation:delivery-return:reject' },
  'POS Sale':        { approve: 'pos:sale:approve',                  reject: 'pos:sale:reject' },
  'POS Cancellation Request': { approve: 'approval:approve',         reject: 'approval:reject' },
  'Showroom Label':  { approve: 'operation:approvals:approve',       reject: 'operation:approvals:approve' },
  'Daily Production':  { approve: 'production:daily:approve',           reject: 'production:daily:reject' },
  'Production Cancel': { approve: 'production:cancel:approve',          reject: 'production:cancel:reject' },
  'Stock Adjustment':  { approve: 'production:stock-adjustment:approve',reject: 'production:stock-adjustment:reject' },
  'Production Plan':   { approve: 'production:plan:approve' },
  'Immediate Order':   { approve: 'order:approve',                      reject: 'order:reject' },
  'Cashier Balance':   { approve: 'approval:approve',                   reject: 'approval:reject' },
  'Price Change':      { approve: 'approval:approve',                 reject: 'approval:reject' },
  Generic:             { approve: 'approval:approve',                    reject: 'approval:reject' },
};

function userCanApprove(
  type: string,
  can: (code: string) => boolean,
  canAny: (codes: string[]) => boolean,
): boolean {
  if (type === 'POS Cancellation Request') return canAny(['approval:approve', 'pos:sale:approve']);
  if (type === 'Price Change') return canAny(['pricing:approve', 'approval:approve']);
  const perms = APPROVAL_TYPE_PERMISSIONS[type];
  return perms ? can(perms.approve) : false;
}

function userCanReject(
  type: string,
  can: (code: string) => boolean,
  canAny: (codes: string[]) => boolean,
): boolean {
  if (type === 'Production Plan') return false;
  if (type === 'POS Cancellation Request') return canAny(['approval:reject', 'pos:sale:reject']);
  if (type === 'Price Change') return canAny(['pricing:reject', 'approval:reject']);
  const perms = APPROVAL_TYPE_PERMISSIONS[type];
  return perms?.reject ? can(perms.reject) : false;
}

// Helper – sum counts for a section
function sectionCount(summary: OperationApprovalsSummary | null, section: Section) {
  if (!summary) return 0;
  return section.subsections.reduce((acc, s) => acc + (summary[s.key]?.length ?? 0), 0);
}

// Helper – all items across every section
function allItems(summary: OperationApprovalsSummary | null): OperationApprovalItem[] {
  if (!summary) return [];
  return SECTIONS.flatMap(sec => sec.subsections.flatMap(s => summary[s.key] ?? []));
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ApprovalsPage() {
  const { can, canAny } = usePermissions();
  const [summary, setSummary] = useState<OperationApprovalsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Section / subsection selection. null sectionId = "All"
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectedSubsectionKey, setSelectedSubsectionKey] = useState<SubsectionKey | null>(null);
  const [openSectionId, setOpenSectionId] = useState<string | null>(null);
  const [approvingAllKey, setApprovingAllKey] = useState<string | null>(null);

  // Search filter
  const [searchTerm, setSearchTerm] = useState('');

  // Expanded detail row
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [selectedApproval, setSelectedApproval] = useState<OperationApprovalItem | null>(null);
  const [detailsData, setDetailsData] = useState<any>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Submitting
  const [submittingIds, setSubmittingIds] = useState<Set<string>>(new Set());

  // POS reject modal
  const [posRejectOpen, setPosRejectOpen] = useState(false);
  const [posRejectSaleId, setPosRejectSaleId] = useState<string | null>(null);
  const [posRejectReason, setPosRejectReason] = useState('');

  // Admin-queue approve/reject modals
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [modalApproval, setModalApproval] = useState<OperationApprovalItem | null>(null);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      setIsLoading(true);
      const data = await operationApprovalsApi.getPending();
      setSummary(data);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to load approvals');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Derived data ──────────────────────────────────────────────────────────

  const currentSection = SECTIONS.find(s => s.id === selectedSectionId) ?? null;

  // Items shown in the table
  const tableItems = (() => {
    let items: OperationApprovalItem[];
    if (!selectedSectionId) {
      items = allItems(summary);
    } else if (!selectedSubsectionKey) {
      // whole section
      items = currentSection
        ? currentSection.subsections.flatMap(s => summary?.[s.key] ?? [])
        : [];
    } else {
      items = summary?.[selectedSubsectionKey] ?? [];
    }

    // Apply search filter
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      items = items.filter(
        i =>
          i.referenceNo?.toLowerCase().includes(q) ||
          i.outletName?.toLowerCase().includes(q) ||
          i.requestedByName?.toLowerCase().includes(q) ||
          i.approvalType?.toLowerCase().includes(q),
      );
    }

    return items;
  })();

  const totalPending = summary
    ? SECTIONS.flatMap(s => s.subsections).reduce((acc, s) => acc + (summary[s.key]?.length ?? 0), 0)
    : 0;

  // ── Navigation helpers ────────────────────────────────────────────────────

  const selectSection = (sectionId: string | null) => {
    setSelectedSectionId(sectionId);
    setSelectedSubsectionKey(null);
    setOpenSectionId(sectionId);
    setExpandedItemId(null);
    setSelectedApproval(null);
    setDetailsData(null);
    setSearchTerm('');
  };

  const toggleSectionBar = (sectionId: string) => {
    if (openSectionId === sectionId) {
      setOpenSectionId(null);
      setSelectedSectionId(null);
      setSelectedSubsectionKey(null);
      setExpandedItemId(null);
      setSelectedApproval(null);
      setDetailsData(null);
      return;
    }
    setOpenSectionId(sectionId);
    setSelectedSectionId(sectionId);
    setSelectedSubsectionKey(null);
    setExpandedItemId(null);
    setSelectedApproval(null);
    setDetailsData(null);
  };

  const selectSubsection = (key: SubsectionKey) => {
    setSelectedSubsectionKey(key);
    setExpandedItemId(null);
    setSelectedApproval(null);
    setDetailsData(null);
  };

  // ── Detail row ────────────────────────────────────────────────────────────

  const handleViewDetails = async (item: OperationApprovalItem) => {
    if (expandedItemId === item.id) {
      setExpandedItemId(null);
      setSelectedApproval(null);
      setDetailsData(null);
      return;
    }
    try {
      setIsLoadingDetails(true);
      setExpandedItemId(item.id);
      setSelectedApproval(item);
      setDetailsData(null);
      let data: any;
      switch (item.approvalType) {
        case 'Delivery':          data = await deliveriesApi.getById(item.id); break;
        case 'Transfer':          data = await transfersApi.getById(item.id); break;
        case 'Disposal':          data = await disposalsApi.getById(item.id); break;
        case 'Cancellation':      data = await cancellationsApi.getById(item.id); break;
        case 'Label Print':       data = await labelPrintingApi.getById(item.id); break;
        case 'Stock BF':
          // Fetch all items in the group by BFNo (referenceNo contains BFNo)
          const stockBFItems = await stockBfApi.getAllByBFNo(item.referenceNo);
          data = { items: stockBFItems };
          break;
        case 'Delivery Return':   data = await deliveryReturnsApi.getById(item.id); break;
        case 'POS Sale':          data = await posSalesApi.getById(item.id); break;
        case 'POS Cancellation Request': {
          const approval = await approvalsApi.getById(item.id);
          let sale: PosSale | null = null;
          if (approval.entityId) {
            try {
              sale = await posSalesApi.getById(approval.entityId);
            } catch {
              sale = null;
            }
          }
          data = { approval, sale };
          break;
        }
        case 'Immediate Order':   data = await immediateOrdersApi.getById(item.id); break;
        case 'Daily Production':  data = await dailyProductionsApi.getById(item.id); break;
        case 'Production Cancel': data = await productionCancelsApi.getById(item.id); break;
        case 'Stock Adjustment':  data = await stockAdjustmentsApi.getById(item.id); break;
        case 'Production Plan':   data = await productionPlansApi.getById(item.id); break;
        case 'Generic':
        case 'Admin':
        case 'Cashier Balance':
        case 'Price Change':
          data = await approvalsApi.getById(item.id); break;
        case 'Showroom Label':
          setDetailsData(item);
          setIsLoadingDetails(false);
          return;
        default:
          toast.error('Details view not available for this approval type');
          setExpandedItemId(null);
          setSelectedApproval(null);
          return;
      }
      setDetailsData(data);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to load approval details');
      setExpandedItemId(null);
      setSelectedApproval(null);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  // ── Approve / Reject ──────────────────────────────────────────────────────

  const executeApprove = async (type: string, id: string) => {
    switch (type) {
      case 'Delivery':          await deliveriesApi.approve(id); break;
      case 'Transfer':          await transfersApi.approve(id); break;
      case 'Disposal':          await disposalsApi.approve(id); break;
      case 'Cancellation':      await cancellationsApi.approve(id); break;
      case 'Label Print':       await labelPrintingApi.approve(id); break;
      case 'Stock BF':          await stockBfApi.approve(id); break;
      case 'Delivery Return':   await deliveryReturnsApi.approve(id); break;
      case 'POS Sale':          await posSalesApi.approve(id); break;
      case 'POS Cancellation Request':
        if (can('approval:approve')) {
          await approvalsApi.approve(id, { notes: '' });
        } else {
          await posSalesApi.approveCancelRequest(id);
        }
        break;
      case 'Showroom Label':    await operationApprovalsApi.approveShowroomLabel(id); break;
      case 'Immediate Order':   await immediateOrdersApi.approve(id); break;
      case 'Daily Production':  await dailyProductionsApi.approve(id); break;
      case 'Production Cancel': await productionCancelsApi.approve(id); break;
      case 'Stock Adjustment':  await stockAdjustmentsApi.approve(id); break;
      case 'Production Plan':   await productionPlansApi.approve(id); break;
      case 'Generic':
      case 'Admin':
      case 'Cashier Balance':
      case 'Price Change':
        await approvalsApi.approve(id, { notes: '' });
        break;
      default:
        throw new Error('Unknown approval type');
    }
  };

  const handleApprove = async (type: string, id: string) => {
    try {
      setSubmittingIds(prev => new Set(prev).add(id));
      await executeApprove(type, id);
      toast.success(`${type} approved`);
      clearDetail();
      fetchAll();
    } catch (error: any) {
      toast.error(approvalApiError(error, `Failed to approve ${type.toLowerCase()}`));
    } finally {
      setSubmittingIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    }
  };

  const handleApproveAll = async (items: OperationApprovalItem[], label: string, bulkKey: string) => {
    const eligible = items.filter((i) => userCanApprove(i.approvalType, can, canAny));
    if (eligible.length === 0) {
      toast.error(`No ${label} items you can approve.`);
      return;
    }
    if (!(await appConfirm(
      `Approve ${eligible.length} ${label} request${eligible.length === 1 ? '' : 's'}?`,
      { confirmLabel: 'Approve', variant: 'primary' },
    ))) return;
    setApprovingAllKey(bulkKey);
    let ok = 0;
    let fail = 0;
    for (const item of eligible) {
      try {
        setSubmittingIds(prev => new Set(prev).add(item.id));
        await executeApprove(item.approvalType, item.id);
        ok += 1;
      } catch {
        fail += 1;
      } finally {
        setSubmittingIds(prev => { const n = new Set(prev); n.delete(item.id); return n; });
      }
    }
    setApprovingAllKey(null);
    if (ok) toast.success(`Approved ${ok} ${label} request${ok === 1 ? '' : 's'}`);
    if (fail) toast.error(`${fail} ${label} request${fail === 1 ? '' : 's'} failed`);
    clearDetail();
    fetchAll();
  };

  const submitAdminApprove = async () => {
    if (!modalApproval) return;
    try {
      setSubmittingIds(prev => new Set(prev).add(modalApproval.id));
      const dto: ApproveApprovalDto = { notes: approvalNotes };
      await approvalsApi.approve(modalApproval.id, dto);
      toast.success('Approval granted successfully');
      setShowApproveModal(false);
      setApprovalNotes('');
      setModalApproval(null);
      clearDetail();
      fetchAll();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to approve');
    } finally {
      setSubmittingIds(prev => { const n = new Set(prev); if (modalApproval) n.delete(modalApproval.id); return n; });
    }
  };

  const handleReject = async (type: string, id: string) => {
    if (type === 'Production Plan') {
      toast.error('Reject is not available for production plans.');
      return;
    }
    if (type === 'POS Sale') {
      setPosRejectSaleId(id);
      setPosRejectReason('');
      setPosRejectOpen(true);
      return;
    }
    if (type === 'Generic' || type === 'Admin' || type === 'POS Cancellation Request' || type === 'Cashier Balance' || type === 'Price Change') {
      setModalApproval(selectedApproval);
      setShowRejectModal(true);
      return;
    }
    if (!(await appConfirm(`Are you sure you want to reject this ${type.toLowerCase()}?`))) return;
    try {
      setSubmittingIds(prev => new Set(prev).add(id));
      switch (type) {
        case 'Delivery':          await deliveriesApi.reject(id); break;
        case 'Transfer':          await transfersApi.reject(id); break;
        case 'Disposal':          await disposalsApi.reject(id); break;
        case 'Cancellation':      await cancellationsApi.reject(id); break;
        case 'Label Print':       await labelPrintingApi.reject(id); break;
        case 'Stock BF':          await stockBfApi.reject(id); break;
        case 'Delivery Return':   await deliveryReturnsApi.reject(id); break;
        case 'Showroom Label':    await operationApprovalsApi.rejectShowroomLabel(id); break;
        case 'Immediate Order':   await immediateOrdersApi.reject(id, 'Rejected'); break;
        case 'Daily Production':  await dailyProductionsApi.reject(id); break;
        case 'Production Cancel': await productionCancelsApi.reject(id); break;
        case 'Stock Adjustment':  await stockAdjustmentsApi.reject(id); break;
        default:                  throw new Error('Unknown approval type');
      }
      toast.success(`${type} rejected`);
      clearDetail();
      fetchAll();
    } catch (error: any) {
      toast.error(approvalApiError(error, `Failed to reject ${type.toLowerCase()}`));
    } finally {
      setSubmittingIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    }
  };

  const submitAdminReject = async () => {
    if (!modalApproval || !rejectionReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }
    try {
      setSubmittingIds(prev => new Set(prev).add(modalApproval.id));
      const dto: RejectApprovalDto = { rejectionReason, notes: approvalNotes };
      if (modalApproval.approvalType === 'POS Cancellation Request' && !can('approval:reject')) {
        await posSalesApi.rejectCancelRequest(modalApproval.id, rejectionReason);
      } else {
        await approvalsApi.reject(modalApproval.id, dto);
      }
      toast.success('Approval rejected');
      setShowRejectModal(false);
      setRejectionReason('');
      setApprovalNotes('');
      setModalApproval(null);
      clearDetail();
      fetchAll();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to reject');
    } finally {
      setSubmittingIds(prev => { const n = new Set(prev); if (modalApproval) n.delete(modalApproval.id); return n; });
    }
  };

  const submitPosReject = async () => {
    const id = posRejectSaleId;
    if (!id) return;
    try {
      setSubmittingIds(prev => new Set(prev).add(id));
      await posSalesApi.reject(id, posRejectReason.trim() || undefined);
      toast.success('POS Sale rejected');
      setPosRejectOpen(false);
      setPosRejectSaleId(null);
      setPosRejectReason('');
      clearDetail();
      fetchAll();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to reject POS sale');
    } finally {
      setSubmittingIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    }
  };

  const clearDetail = () => {
    setExpandedItemId(null);
    setSelectedApproval(null);
    setDetailsData(null);
  };

  // ── Table columns ─────────────────────────────────────────────────────────

  const columns = [
    {
      key: 'approvalType',
      label: 'Type',
      render: (item: OperationApprovalItem) => (
        <Badge variant="neutral" size="sm">{item.approvalType}</Badge>
      ),
    },
    {
      key: 'referenceNo',
      label: 'Reference',
      render: (item: OperationApprovalItem) => {
        const isExpanded = expandedItemId === item.id;
        return (
          <span
            className="font-mono font-semibold inline-flex items-center gap-2"
            style={{ color: isExpanded ? '#dc2626' : '#C8102E' }}
          >
            <ChevronDown
              className={`w-4 h-4 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : '-rotate-90'}`}
            />
            {item.referenceNo}
          </span>
        );
      },
    },
    {
      key: 'requestDate',
      label: 'Date',
      render: (item: OperationApprovalItem) => (
        <span className="text-sm">{formatSlDate(item.requestDate)}</span>
      ),
    },
    {
      key: 'outletName',
      label: 'Outlet / Details',
      render: (item: OperationApprovalItem) => (
        <div>
          <span className="font-medium">{item.outletName || '-'}</span>
          {item.description && (
            <div className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>{item.description}</div>
          )}
        </div>
      ),
    },
    {
      key: 'requestedBy',
      label: 'Requested By',
      render: (item: OperationApprovalItem) => (
        <span className="text-sm">{item.requestedByName || '-'}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (item: OperationApprovalItem) => (
        <Badge variant="warning" size="sm">
          <Clock className="w-3 h-3 mr-1" />
          {item.status}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (item: OperationApprovalItem) => {
        const busy = submittingIds.has(item.id);
        const allowApprove = userCanApprove(item.approvalType, can, canAny);
        const allowReject = userCanReject(item.approvalType, can, canAny);
        return (
          <div className="flex items-center gap-1.5" data-no-row-click>
            {allowReject && (
              <button
                type="button"
                title="Reject"
                disabled={busy}
                onClick={(e) => {
                  e.stopPropagation();
                  void handleReject(item.approvalType, item.id);
                }}
                className="inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold disabled:opacity-50"
                style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}
              >
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
              </button>
            )}
            {allowApprove && (
              <button
                type="button"
                title="Approve"
                disabled={busy}
                onClick={(e) => {
                  e.stopPropagation();
                  void handleApprove(item.approvalType, item.id);
                }}
                className="inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: '#16a34a' }}
              >
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        );
      },
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <ProtectedPage
      permission={['approval:view', 'operation:approvals:view', 'production:approvals:view']}
      mode="any"
      deniedMessage="You need Approval (Administrator), Operation Approvals, or Production Approvals view permission to open the unified approval queue."
    >
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>
            <CheckCircle className="w-8 h-8 inline-block mr-3" style={{ color: '#C8102E' }} />
            Approvals
          </h1>
          <p className="mt-1" style={{ color: 'var(--muted-foreground)' }}>
            Click a category to open it. Approve from the list, or Approve All for the whole group.
          </p>
        </div>
        {totalPending > 0 && (
          <span
            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold"
            style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}
          >
            <Clock className="w-4 h-4" />
            {totalPending} pending
          </span>
        )}
      </div>

      {/* Category accordion */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => selectSection(null)}
          className="flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors"
          style={{
            borderColor: selectedSectionId === null && openSectionId === null ? '#C8102E' : 'var(--border)',
            backgroundColor: selectedSectionId === null && openSectionId === null ? '#FEF2F2' : 'var(--card)',
          }}
        >
          <span className="flex-1 text-sm font-bold" style={{ color: 'var(--foreground)' }}>
            All pending
          </span>
          <span
            className="rounded-full px-2 py-0.5 text-[11px] font-bold"
            style={{ backgroundColor: '#C8102E', color: 'white' }}
          >
            {totalPending}
          </span>
        </button>

        {SECTIONS.map((section) => {
          const isOpen = openSectionId === section.id;
          const count = sectionCount(summary, section);
          if (count === 0) return null;
          const sectionItems = section.subsections.flatMap((s) => summary?.[s.key] ?? []);
          const canBulk = sectionItems.some((i) => userCanApprove(i.approvalType, can, canAny));
          const bulkBusy = approvingAllKey === section.id;
          const visibleSubs = section.subsections.filter((sub) => (summary?.[sub.key]?.length ?? 0) > 0);
          return (
            <div
              key={section.id}
              className="overflow-hidden rounded-xl border"
              style={{ borderColor: isOpen ? '#C8102E' : 'var(--border)', backgroundColor: 'var(--card)' }}
            >
              <div
                role="button"
                tabIndex={0}
                onClick={() => toggleSectionBar(section.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleSectionBar(section.id);
                  }
                }}
                className="flex w-full cursor-pointer items-center gap-3 px-4 py-3"
              >
                <ChevronDown
                  className={`h-5 w-5 shrink-0 transition-transform ${isOpen ? 'rotate-0' : '-rotate-90'}`}
                  style={{ color: isOpen ? '#C8102E' : 'var(--muted-foreground)' }}
                />
                <span className="flex-1 text-sm font-bold" style={{ color: 'var(--foreground)' }}>
                  {section.label}
                </span>
                <span
                  className="rounded-full px-2 py-0.5 text-[11px] font-bold"
                  style={{
                    backgroundColor: count > 0 ? '#C8102E' : 'var(--muted)',
                    color: count > 0 ? 'white' : 'var(--muted-foreground)',
                  }}
                >
                  {count}
                </span>
                {count > 0 && canBulk && (
                  <button
                    type="button"
                    disabled={bulkBusy}
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleApproveAll(sectionItems, section.label, section.id);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                    style={{ backgroundColor: '#16a34a' }}
                  >
                    {bulkBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
                    Approve All
                  </button>
                )}
              </div>
              {isOpen && (
                <div
                  className="space-y-1 border-t px-3 py-2"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--muted)' }}
                >
                  {visibleSubs.map((sub) => {
                    const subItems = summary?.[sub.key] ?? [];
                    const subCount = subItems.length;
                    const isActive = selectedSubsectionKey === sub.key;
                    const subCanBulk = subItems.some((i) => userCanApprove(i.approvalType, can, canAny));
                    const subBusy = approvingAllKey === sub.key;
                    return (
                      <div
                        key={sub.key}
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          setSelectedSectionId(section.id);
                          selectSubsection(sub.key);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedSectionId(section.id);
                            selectSubsection(sub.key);
                          }
                        }}
                        className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2"
                        style={{
                          backgroundColor: isActive ? 'var(--card)' : 'transparent',
                          boxShadow: isActive ? 'inset 3px 0 0 #C8102E' : undefined,
                        }}
                      >
                        <span className="flex-1 text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                          {sub.label}
                        </span>
                        <span className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>
                          {subCount}
                        </span>
                        {subCount > 0 && subCanBulk && (
                          <button
                            type="button"
                            disabled={subBusy}
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleApproveAll(subItems, sub.label, sub.key);
                            }}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
                            style={{ backgroundColor: '#16a34a' }}
                          >
                            {subBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCheck className="h-3 w-3" />}
                            Approve All
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Main card */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <CardTitle>
                  {selectedSectionId === null
                    ? 'All Approval Requests'
                    : selectedSubsectionKey
                      ? `${currentSection?.subsections.find(s => s.key === selectedSubsectionKey)?.label} Requests`
                      : `${currentSection?.label} Requests`}
                </CardTitle>
                {tableItems.length > 0 && !searchTerm && (
                  <Badge variant="warning" size="sm">
                    <Clock className="w-3 h-3 mr-1" />
                    {tableItems.length} Pending
                  </Badge>
                )}
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                {tableItems.length > 0 && tableItems.some((i) => userCanApprove(i.approvalType, can, canAny)) && (
                  <button
                    type="button"
                    disabled={approvingAllKey === 'list'}
                    onClick={() =>
                      void handleApproveAll(
                        tableItems,
                        selectedSubsectionKey
                          ? currentSection?.subsections.find((s) => s.key === selectedSubsectionKey)?.label || 'requests'
                          : currentSection?.label || 'pending',
                        'list',
                      )
                    }
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                    style={{ backgroundColor: '#16a34a' }}
                  >
                    {approvingAllKey === 'list' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CheckCheck className="h-3.5 w-3.5" />
                    )}
                    Approve All on this list
                  </button>
                )}
                <div className="relative w-full sm:w-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--muted-foreground)' }} />
                <input
                  type="text"
                  placeholder="Search approvals..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  autoComplete="off"
                  className="w-full sm:w-64 pl-10 pr-4 py-2 rounded-lg text-sm"
                  style={{ border: '1px solid var(--input)' }}
                />
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#C8102E' }} />
            </div>
          ) : tableItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <CheckCircle className="w-16 h-16 mb-4" style={{ color: 'var(--muted-foreground)' }} />
              <p className="text-lg font-medium" style={{ color: 'var(--foreground)' }}>
                {searchTerm ? 'No results found' : 'No pending approvals'}
              </p>
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                {searchTerm ? 'Try a different search term' : 'All requests have been processed'}
              </p>
            </div>
          ) : (
            <DataTable
              data={tableItems}
              columns={columns}
              currentPage={1}
              totalPages={1}
              pageSize={tableItems.length}
              onPageChange={() => {}}
              onPageSizeChange={() => {}}
              hideRowsPerPage
              embedded
              expandedRowKey={expandedItemId}
              getRowKey={row => row.id}
              onRowClick={(item) => void handleViewDetails(item)}
              renderExpandedRow={item =>
                expandedItemId === item.id ? (
                  <div
                    className="rounded-xl p-1 sm:p-1.5"
                    style={{
                      backgroundColor: 'color-mix(in srgb, var(--foreground) 8%, var(--border))',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5)',
                    }}
                  >
                    <Card className="rounded-[10px] border-0 shadow-md" padding="md">
                    <CardHeader>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <CardTitle>
                          {selectedApproval
                            ? `${selectedApproval.approvalType} — ${selectedApproval.referenceNo}`
                            : 'Details'}
                        </CardTitle>
                        {selectedApproval && !isLoadingDetails && (
                          <div className="flex flex-wrap items-center gap-2">
                            {userCanReject(selectedApproval.approvalType, can, canAny) && (
                              <Button
                                variant="danger"
                                onClick={() => void handleReject(selectedApproval.approvalType, selectedApproval.id)}
                                disabled={submittingIds.has(selectedApproval.id)}
                              >
                                {submittingIds.has(selectedApproval.id)
                                  ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  : <XCircle className="w-4 h-4 mr-2" />}
                                Reject
                              </Button>
                            )}
                            {userCanApprove(selectedApproval.approvalType, can, canAny) && (
                              <button
                                type="button"
                                onClick={() => void handleApprove(selectedApproval.approvalType, selectedApproval.id)}
                                disabled={submittingIds.has(selectedApproval.id)}
                                className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed text-white hover:opacity-90"
                                style={{ backgroundColor: '#16a34a' }}
                              >
                                {submittingIds.has(selectedApproval.id)
                                  ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  : <CheckCircle className="w-4 h-4 mr-2" />}
                                Approve
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={clearDetail}
                              className="text-sm px-3 py-1 rounded hover:bg-gray-100"
                              style={{ color: 'var(--muted-foreground)' }}
                            >
                              Close
                            </button>
                          </div>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      {isLoadingDetails ? (
                        <div className="flex items-center justify-center py-12">
                          <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#C8102E' }} />
                        </div>
                      ) : detailsData && selectedApproval ? (
                        <>
                          <div className="space-y-6">
                            {selectedApproval.approvalType === 'Delivery' && (
                              <DeliveryDetailsView delivery={detailsData as Delivery} />
                            )}
                            {selectedApproval.approvalType === 'Transfer' && (
                              <TransferDetailsView transfer={detailsData as Transfer} />
                            )}
                            {selectedApproval.approvalType === 'Disposal' && (
                              <DisposalDetailsView disposal={detailsData as Disposal} />
                            )}
                            {selectedApproval.approvalType === 'Cancellation' && (
                              <CancellationDetailsView cancellation={detailsData as Cancellation} />
                            )}
                            {(selectedApproval.approvalType === 'Label Print' ||
                              selectedApproval.approvalType === 'Stock BF' ||
                              selectedApproval.approvalType === 'Delivery Return' ||
                              selectedApproval.approvalType === 'Production Cancel' ||
                              selectedApproval.approvalType === 'Stock Adjustment' ||
                              selectedApproval.approvalType === 'Production Plan') && (
                              <GenericDetailsView item={selectedApproval} details={detailsData} />
                            )}
                            {selectedApproval.approvalType === 'POS Sale' && (
                              <PosSaleDetailsView sale={detailsData as PosSale} />
                            )}
                            {selectedApproval.approvalType === 'POS Cancellation Request' && (
                              <PosCancellationRequestDetailsView data={detailsData} />
                            )}
                            {selectedApproval.approvalType === 'Showroom Label' && (
                              <ShowroomLabelDetailsView item={selectedApproval} />
                            )}
                            {selectedApproval.approvalType === 'Immediate Order' && (
                              <ImmediateOrderDetailsView order={detailsData as ImmediateOrder} />
                            )}
                            {selectedApproval.approvalType === 'Daily Production' && (
                              <ProductionDetailsView production={detailsData as DailyProduction} />
                            )}
                            {(selectedApproval.approvalType === 'Generic' ||
                              selectedApproval.approvalType === 'Admin' ||
                              selectedApproval.approvalType === 'Cashier Balance') && (
                              <AdminApprovalDetailsView approval={detailsData} />
                            )}
                            {selectedApproval.approvalType === 'Price Change' && (
                              <PriceChangeApprovalDetailsView approval={detailsData} />
                            )}
                          </div>
                        </>
                      ) : null}
                    </CardContent>
                  </Card>
                  </div>
                ) : null
              }
            />
          )}
        </CardContent>
      </Card>

      {/* POS reject modal */}
      <Modal
        isOpen={posRejectOpen}
        onClose={() => {
          if (posRejectSaleId && submittingIds.has(posRejectSaleId)) return;
          setPosRejectOpen(false);
          setPosRejectSaleId(null);
          setPosRejectReason('');
        }}
        title="Reject POS Sale"
        size="sm"
      >
        <p className="text-sm mb-2" style={{ color: 'var(--muted-foreground)' }}>
          Optional note stored with the sale for audit and showroom feedback.
        </p>
        <textarea
          value={posRejectReason}
          onChange={e => setPosRejectReason(e.target.value)}
          className="w-full min-h-[100px] rounded-md border px-3 py-2 text-sm"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)' }}
          placeholder="Reason for rejection"
          maxLength={500}
        />
        <ModalFooter>
          <Button variant="secondary" type="button"
            disabled={Boolean(posRejectSaleId && submittingIds.has(posRejectSaleId))}
            onClick={() => { setPosRejectOpen(false); setPosRejectSaleId(null); setPosRejectReason(''); }}>
            Cancel
          </Button>
          <Button variant="danger" type="button"
            disabled={!posRejectSaleId || Boolean(posRejectSaleId && submittingIds.has(posRejectSaleId))}
            onClick={() => void submitPosReject()}>
            Reject sale
          </Button>
        </ModalFooter>
      </Modal>

      {/* Admin approve modal */}
      <Modal
        isOpen={showApproveModal}
        onClose={() => { setShowApproveModal(false); setModalApproval(null); setApprovalNotes(''); }}
        title="Approve Request"
        size="md"
      >
        {modalApproval && (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                Type: {modalApproval.approvalType}
              </p>
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                Reference: {modalApproval.referenceNo}
              </p>
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                Requested by: {modalApproval.requestedByName}
              </p>
            </div>
            <Input label="Notes (Optional)" value={approvalNotes}
              onChange={e => setApprovalNotes(e.target.value)}
              placeholder="Add any notes..." fullWidth />
          </div>
        )}
        <ModalFooter>
          <Button variant="ghost" onClick={() => { setShowApproveModal(false); setModalApproval(null); setApprovalNotes(''); }}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void submitAdminApprove()}>
            <Check className="w-4 h-4 mr-2" />
            Approve
          </Button>
        </ModalFooter>
      </Modal>

      {/* Admin reject modal */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => { setShowRejectModal(false); setModalApproval(null); setRejectionReason(''); setApprovalNotes(''); }}
        title="Reject Request"
        size="md"
      >
        {modalApproval && (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                Type: {modalApproval.approvalType}
              </p>
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                Reference: {modalApproval.referenceNo}
              </p>
            </div>
            <Input label="Rejection Reason" value={rejectionReason}
              onChange={e => setRejectionReason(e.target.value)}
              placeholder="Please provide a reason..." fullWidth required />
            <Input label="Additional Notes (Optional)" value={approvalNotes}
              onChange={e => setApprovalNotes(e.target.value)}
              placeholder="Add any notes..." fullWidth />
          </div>
        )}
        <ModalFooter>
          <Button variant="ghost" onClick={() => { setShowRejectModal(false); setModalApproval(null); setRejectionReason(''); setApprovalNotes(''); }}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => void submitAdminReject()}>
            <X className="w-4 h-4 mr-2" />
            Reject
          </Button>
        </ModalFooter>
      </Modal>
    </div>
    </ProtectedPage>
  );
}

function approvalApiError(error: unknown, fallback: string): string {
  const data = (error as { response?: { data?: Record<string, unknown> } })?.response?.data;
  if (!data) return fallback;
  const nested = (data.error ?? data.Error) as { message?: string; Message?: string } | undefined;
  const msg = nested?.message ?? nested?.Message ?? data.message ?? data.Message;
  return typeof msg === 'string' && msg.trim() ? msg : fallback;
}

/** Shared shell for approval detail bodies (matches transfer-style panel). */
function DetailPanel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`space-y-6 rounded-xl border p-4 sm:p-5 shadow-sm ${className}`}
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)' }}
    >
      {children}
    </div>
  );
}

/** Grouped fields on a slightly tinted surface so they read as one block. */
function DetailSectionTint({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
        {title}
      </p>
      {subtitle ? (
        <p className="mb-3 text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
          {subtitle}
        </p>
      ) : null}
      <div
        className="rounded-lg border p-4 sm:p-5"
        style={{
          borderColor: 'var(--border)',
          backgroundColor: 'color-mix(in srgb, var(--foreground) 4%, var(--card))',
        }}
      >
        {children}
      </div>
    </div>
  );
}

function InfoGrid({ children, plain }: { children: React.ReactNode; plain?: boolean }) {
  return (
    <div
      className={
        plain
          ? 'grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-x-6 lg:gap-x-8'
          : 'grid grid-cols-1 gap-4 rounded-lg p-4 md:grid-cols-3 md:gap-x-6 lg:gap-x-8'
      }
      style={plain ? undefined : { backgroundColor: 'var(--muted)' }}
    >
      {children}
    </div>
  );
}

function InfoField({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: boolean }) {
  return (
    <div>
      <p className="text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>{label}</p>
      <p className="text-sm font-semibold" style={{ color: highlight ? '#C8102E' : 'var(--foreground)' }}>{value}</p>
    </div>
  );
}

function ItemsTable({ headers, rows }: { headers: string[]; rows: (string | number | React.ReactNode)[][] }) {
  return (
    <div
      className="w-full max-w-5xl overflow-x-auto rounded-lg border"
      style={{ borderColor: 'var(--border)' }}
    >
      <table className="w-full border-collapse text-sm">
        <thead style={{ backgroundColor: 'var(--muted)' }}>
          <tr>
            {headers.map((h, i) => (
              <th
                key={i}
                className={`px-4 py-3 text-left text-xs font-semibold ${i > 0 ? 'whitespace-nowrap text-right' : ''}`}
                style={{
                  color: 'var(--foreground)',
                  ...(i > 0 ? { width: '1%', whiteSpace: 'nowrap' as const } : {}),
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-t" style={{ borderColor: 'var(--border)' }}>
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className={`align-top px-4 py-3 text-sm leading-relaxed ${ci > 0 ? 'whitespace-nowrap text-right font-medium' : 'min-w-[12rem]'}`}
                  style={{
                    color: 'var(--foreground)',
                    ...(ci > 0 ? { width: '1%', whiteSpace: 'nowrap' as const } : {}),
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DeliveryDetailsView({ delivery }: { delivery: Delivery }) {
  return (
    <DetailPanel>
      <div className="space-y-6">
        <DetailSectionTint title="Delivery overview">
          <InfoGrid plain>
            <InfoField label="Delivery No" value={delivery.deliveryNo} highlight />
            <InfoField label="Date" value={formatSlDate(delivery.deliveryDate)} />
            <InfoField label="Showroom" value={delivery.outletName || delivery.outlet?.name || '-'} />
          </InfoGrid>
        </DetailSectionTint>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-x-6">
          <InfoField label="Total Items" value={delivery.totalItems || 0} />
          <InfoField label="Total Value" value={`Rs. ${(delivery.totalValue || 0).toLocaleString()}`} highlight />
        </div>
        <InfoField label="Requested By" value={`${delivery.createdByName} • ${formatSlDateTime(delivery.createdAt)}`} />
        {delivery.notes && <InfoField label="Notes" value={delivery.notes} />}
        {delivery.items?.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
              Delivery items
            </p>
            <ItemsTable
              headers={['Product', 'Qty', 'Unit Price', 'Total']}
              rows={delivery.items.map((item: any) => [
                <div key={item.id}>
                  <p className="font-medium">{item.productName || item.product?.name || 'Unknown'}</p>
                  {item.product?.code && <p className="text-xs text-muted-foreground">{item.product.code}</p>}
                </div>,
                Number(item.quantity).toLocaleString(),
                `Rs. ${Number(item.unitPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                `Rs. ${Number(item.total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              ])}
            />
          </div>
        )}
      </div>
    </DetailPanel>
  );
}

function transferItemProductName(item: Record<string, unknown>): string {
  return (
    (item.productName as string) ||
    (item.ProductName as string) ||
    (item.product as { name?: string } | undefined)?.name ||
    (item.Product as { Name?: string } | undefined)?.Name ||
    '—'
  );
}

function transferItemProductCode(item: Record<string, unknown>): string {
  return (
    (item.productCode as string) ||
    (item.ProductCode as string) ||
    (item.product as { code?: string } | undefined)?.code ||
    (item.Product as { Code?: string } | undefined)?.Code ||
    ''
  );
}

function transferItemQuantity(item: Record<string, unknown>): number {
  const q = item.quantity ?? item.Quantity;
  return typeof q === 'number' ? q : Number(q) || 0;
}

function approvalStatusBadgeVariant(status: string | undefined): 'warning' | 'success' | 'danger' | 'neutral' {
  const s = (status || '').toLowerCase();
  if (s === 'pending') return 'warning';
  if (s === 'approved') return 'success';
  if (s === 'rejected') return 'danger';
  return 'neutral';
}

function transferPick(raw: Record<string, unknown>, camel: string, pascal: string): string {
  const v = raw[camel] ?? raw[pascal];
  if (v == null) return '';
  return String(v).trim();
}

function showroomLabel(code: string, name: string): string {
  if (code && name) return `${code} - ${name}`;
  return name || code || '—';
}

function TransferDetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      className="flex flex-col gap-1 border-b border-dashed py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
      style={{ borderColor: 'var(--border)' }}
    >
      <p className="shrink-0 text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>
        {label}
      </p>
      <p className="text-sm font-semibold sm:text-right" style={{ color: 'var(--foreground)' }}>
        {value}
      </p>
    </div>
  );
}

function TransferDetailsView({ transfer }: { transfer: Transfer }) {
  const raw = transfer as unknown as Record<string, unknown>;
  const fromName = transfer.fromOutletName || transfer.fromOutlet?.name || transferPick(raw, 'fromOutletName', 'FromOutletName');
  const toName = transfer.toOutletName || transfer.toOutlet?.name || transferPick(raw, 'toOutletName', 'ToOutletName');
  const fromCode = transfer.fromOutletCode || transfer.fromOutlet?.code || transferPick(raw, 'fromOutletCode', 'FromOutletCode');
  const toCode = transfer.toOutletCode || transfer.toOutlet?.code || transferPick(raw, 'toOutletCode', 'ToOutletCode');
  const fromCashier = transfer.createdByName || transferPick(raw, 'createdByName', 'CreatedByName') || '—';
  const receivedByCashier = transfer.receivedByName || transferPick(raw, 'receivedByName', 'ReceivedByName') || '—';
  const receivedAt = transfer.receivedAt || transferPick(raw, 'receivedAt', 'ReceivedAt');
  const comment = (transfer.notes || transferPick(raw, 'notes', 'Notes')).trim() || '-';
  const items = Array.isArray(transfer.items)
    ? transfer.items
    : Array.isArray(raw.items)
      ? (raw.items as Transfer['items'])
      : Array.isArray(raw.Items)
        ? (raw.Items as Transfer['items'])
        : [];
  const status = transfer.status || transferPick(raw, 'status', 'Status') || '';
  const transferNo = transfer.transferNo || transferPick(raw, 'transferNo', 'TransferNo') || '—';
  const createdAt = transfer.createdAt || transferPick(raw, 'createdAt', 'CreatedAt');
  const transferDate = transfer.transferDate || transferPick(raw, 'transferDate', 'TransferDate');

  return (
    <DetailPanel>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-lg font-bold tracking-tight" style={{ color: 'var(--foreground)' }}>
            Transfer {transferNo}
          </p>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Review the submitted information before taking action.
          </p>
        </div>
        <Badge variant={approvalStatusBadgeVariant(status)} size="md">
          {status || '—'}
        </Badge>
      </div>

      <div>
        <TransferDetailRow
          label="Transfer Date & Time"
          value={formatSlDateTime(createdAt || transferDate, { dateStyle: 'short', timeStyle: 'short' })}
        />
        <TransferDetailRow label="Showroom From" value={showroomLabel(fromCode, fromName)} />
        <TransferDetailRow label="Showroom To" value={showroomLabel(toCode, toName)} />
        <TransferDetailRow label="From Cashier" value={fromCashier} />
        <TransferDetailRow
          label="Received By Cashier"
          value={
            receivedByCashier !== '—'
              ? receivedAt
                ? `${receivedByCashier} · ${formatSlDateTime(receivedAt, { dateStyle: 'short', timeStyle: 'short' })}`
                : receivedByCashier
              : 'Not received yet — not required to approve'
          }
        />
        <TransferDetailRow label="Comment" value={comment} />
        <TransferDetailRow label="Requested By" value={fromCashier} />
        <TransferDetailRow
          label="Requested At"
          value={createdAt ? formatSlDateTime(createdAt, { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
        />
      </div>

      <div>
        <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
              Items
            </p>
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              Check SKU, name, and quantities before approving.
            </p>
          </div>
        </div>
        {items.length > 0 ? (
          <div
            className="w-full max-w-5xl overflow-x-auto rounded-lg border"
            style={{ borderColor: 'var(--border)' }}
          >
            <table className="w-full border-collapse text-sm">
              <colgroup>
                <col style={{ width: '2.75rem' }} />
                <col style={{ width: '1%' }} />
                <col />
                <col style={{ width: '1%' }} />
              </colgroup>
              <thead style={{ backgroundColor: 'var(--muted)' }}>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
                    #
                  </th>
                  <th
                    className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold"
                    style={{ color: 'var(--foreground)', width: '1%' }}
                  >
                    SKU
                  </th>
                  <th className="min-w-[12rem] px-4 py-3 text-left text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
                    Product
                  </th>
                  <th
                    className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold"
                    style={{ color: 'var(--foreground)', width: '1%' }}
                  >
                    Quantity
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((row, idx) => {
                  const r = row as unknown as Record<string, unknown>;
                  const code = transferItemProductCode(r);
                  const name = transferItemProductName(r);
                  const qty = transferItemQuantity(r);
                  const key = (r.id as string) || (r.Id as string) || `row-${idx}`;
                  return (
                    <tr key={key} className="border-t" style={{ borderColor: 'var(--border)' }}>
                      <td
                        className="px-4 py-3 tabular-nums text-sm leading-relaxed"
                        style={{ color: 'var(--muted-foreground)' }}
                      >
                        {idx + 1}
                      </td>
                      <td
                        className="whitespace-nowrap px-4 py-3 font-mono text-sm font-medium leading-relaxed"
                        style={{ color: 'var(--foreground)', width: '1%' }}
                      >
                        {code || '—'}
                      </td>
                      <td className="min-w-[12rem] px-4 py-3 leading-relaxed" style={{ color: 'var(--foreground)' }}>
                        <span className="font-medium">{name}</span>
                      </td>
                      <td
                        className="whitespace-nowrap px-4 py-3 text-right text-sm font-semibold tabular-nums leading-relaxed"
                        style={{ color: 'var(--foreground)', width: '1%' }}
                      >
                        {qty.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm" style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}>
            No line items were returned for this transfer. If this looks wrong, reload or contact support.
          </div>
        )}
      </div>

      <p className="text-xs leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
        Approving confirms that the listed quantities may move from <strong style={{ color: 'var(--foreground)' }}>{fromName}</strong> to{' '}
        <strong style={{ color: 'var(--foreground)' }}>{toName}</strong> according to your stock policies.
      </p>
    </DetailPanel>
  );
}

function DisposalDetailsView({ disposal }: { disposal: Disposal }) {
  return (
    <DetailPanel>
      <div className="space-y-6">
      <DetailSectionTint title="Disposal overview">
      <InfoGrid plain>
        <InfoField label="Disposal No" value={disposal.disposalNo} highlight />
        <InfoField label="Date" value={formatSlDate(disposal.disposalDate)} />
        <InfoField label="Outlet" value={disposal.outletName || disposal.outlet?.name || '-'} />
      </InfoGrid>
      </DetailSectionTint>
      <InfoField label="Requested By" value={`${disposal.createdByName} • ${formatSlDateTime(disposal.createdAt)}`} />
      {disposal.notes && <InfoField label="Notes" value={disposal.notes} />}
      {disposal.items?.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
            Disposal items
          </p>
          <ItemsTable
            headers={['Product', 'Qty', 'Reason']}
            rows={disposal.items.map((item: any) => [
              <div key={item.id}>
                <p className="font-medium">{item.productName || item.product?.name || 'Unknown'}</p>
              </div>,
              Number(item.quantity).toLocaleString(),
              item.reason || '-',
            ])}
          />
        </div>
      )}
      </div>
    </DetailPanel>
  );
}

function CancellationDetailsView({ cancellation }: { cancellation: Cancellation }) {
  return (
    <DetailPanel>
      <div className="space-y-6">
      <DetailSectionTint title="Cancellation overview">
      <InfoGrid plain>
        <InfoField label="Cancellation No" value={cancellation.cancellationNo} highlight />
        <InfoField label="Date" value={formatSlDate(cancellation.cancellationDate)} />
        <InfoField label="Outlet" value={cancellation.outletName || cancellation.outlet?.name || '-'} />
      </InfoGrid>
      </DetailSectionTint>
      <InfoField label="Requested By" value={`${cancellation.createdByName} • ${formatSlDateTime(cancellation.createdAt)}`} />
      <InfoField label="Reason" value={cancellation.reason || '-'} />
      </div>
    </DetailPanel>
  );
}

function PosSaleDetailsView({ sale }: { sale: PosSale }) {
  return (
    <DetailPanel>
      <div className="space-y-6">
      <DetailSectionTint title="Sale overview">
      <InfoGrid plain>
        <InfoField label="Sale No" value={sale.saleNo} highlight />
        <InfoField label="Sold At" value={sale.soldAt ? formatSlDateTime(sale.soldAt) : '—'} />
        <InfoField label="Outlet" value={sale.outletName || sale.outlet?.name || '—'} />
      </InfoGrid>
      </DetailSectionTint>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-x-6">
        <InfoField label="Payment" value={sale.paymentMethod} />
        <InfoField label="Total" value={`Rs. ${Number(sale.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} highlight />
      </div>
      {sale.lines?.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
            Line items
          </p>
          <ItemsTable
            headers={['Product', 'Qty', 'Line Total']}
            rows={sale.lines.map((line: any) => [
              <div key={line.id}>
                <p className="font-medium">{line.productName || '—'}</p>
                {line.productCode && <p className="text-xs text-muted-foreground">{line.productCode}</p>}
              </div>,
              Number(line.quantity).toLocaleString(),
              `Rs. ${Number(line.lineTotal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            ])}
          />
        </div>
      )}
      </div>
    </DetailPanel>
  );
}

function PosCancellationRequestDetailsView({
  data,
}: {
  data: { approval?: any; sale?: PosSale | null } | null;
}) {
  if (!data) return null;
  const approval = data.approval;
  const sale = data.sale;
  return (
    <DetailPanel>
      <div className="space-y-6">
        <DetailSectionTint title="POS Cancellation Request">
          <InfoGrid plain>
            <InfoField label="Type" value="POS Cancellation Request" highlight />
            <InfoField
              label="Bill No"
              value={approval?.entityReference || sale?.saleNo || '—'}
            />
            <InfoField
              label="Requested At"
              value={approval?.requestedAt ? formatSlDateTime(approval.requestedAt) : '—'}
            />
          </InfoGrid>
        </DetailSectionTint>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-x-6">
          <InfoField label="Requested By" value={approval?.requestedByName || '—'} />
          <InfoField label="Showroom" value={sale?.outletName || sale?.outlet?.name || '—'} />
          {sale ? (
            <InfoField
              label="Sale Total"
              value={`Rs. ${Number(sale.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              highlight
            />
          ) : null}
          <InfoField label="Sale Status" value={sale?.status || '—'} />
        </div>
        {approval?.notes && (
          <div className="rounded-lg border border-dashed p-3" style={{ borderColor: 'var(--border)' }}>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
              Cancellation reason
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed" style={{ color: 'var(--foreground)' }}>
              {approval.notes}
            </p>
          </div>
        )}
        {sale?.lines && sale.lines.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
              Line items
            </p>
            <ItemsTable
              headers={['Product', 'Qty', 'Line Total']}
              rows={sale.lines.map((line: any) => [
                <div key={line.id}>
                  <p className="font-medium">{line.productName || '—'}</p>
                  {line.productCode && <p className="text-xs text-muted-foreground">{line.productCode}</p>}
                </div>,
                Number(line.quantity).toLocaleString(),
                `Rs. ${Number(line.lineTotal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              ])}
            />
          </div>
        )}
      </div>
    </DetailPanel>
  );
}

function ShowroomLabelDetailsView({ item }: { item: OperationApprovalItem }) {
  return (
    <DetailPanel>
      <div className="space-y-6">
      <DetailSectionTint title="Label request">
      <InfoGrid plain>
        <InfoField label="Label Text" value={item.referenceNo} highlight />
        <InfoField label="Request Date" value={formatSlDate(item.requestDate)} />
        <InfoField label="Label Count" value={item.itemCount ?? '-'} />
      </InfoGrid>
      </DetailSectionTint>
      <InfoField label="Showroom" value={item.outletName || '-'} />
      {item.description && <InfoField label="Description" value={item.description} />}
      </div>
    </DetailPanel>
  );
}

function ImmediateOrderDetailsView({ order }: { order: ImmediateOrder }) {
  if (!order) return null;
  const fmtDate = (v?: string) => (v ? formatSlDate(v) : '—');
  const status = order.status || '';
  const fullQty = Number(order.fullQuantity ?? order.quantity ?? 0);
  const miniQty = Number(order.miniQuantity ?? 0);

  return (
    <DetailPanel>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
            Immediate order
          </p>
          <p className="mt-1 text-lg font-bold tracking-tight" style={{ color: '#C8102E' }}>
            {order.orderNo}
          </p>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--muted-foreground)' }}>
            {formatSlDate(order.orderDate, {
              weekday: 'short',
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <Badge variant={approvalStatusBadgeVariant(status)} size="md">
            {status || '—'}
          </Badge>
        </div>
      </div>

      <DetailSectionTint
        title="Schedule & logistics"
        subtitle="Production window, delivery, and showroom details."
      >
        <InfoGrid plain>
          <InfoField label="Order Bill No." value={order.orderBillNo || '—'} highlight />
          <InfoField label="System ref" value={order.orderNo} />
          <InfoField label="Order Date" value={formatSlDate(order.orderDate)} />
          <InfoField label="Need by" value={`${fmtDate(order.needByDate)} ${order.needByTime ?? ''}`.trim() || '—'} />
          <InfoField label="Delivery date" value={fmtDate(order.deliveryDate)} />
          <InfoField label="Delivery time" value={order.deliveryTime || '—'} />
          <InfoField
            label="Production start"
            value={`${fmtDate(order.productionStartingDate)} ${order.productionStartingTime ?? ''}`.trim() || '—'}
          />
          <InfoField label="Recipe request no." value={order.recipeRequestNumber || '—'} />
          <InfoField label="Showroom" value={order.outletName} />
          <InfoField label="Delivery Turn" value={order.deliveryTurnName} />
        </InfoGrid>
      </DetailSectionTint>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
          Product & quantities
        </p>
        <ItemsTable
          headers={['Product', 'Full (F)', 'Mini (M)']}
          rows={[
            [
              <span key="name" className="font-medium">
                {order.productName}
              </span>,
              fullQty.toLocaleString(),
              miniQty.toLocaleString(),
            ],
          ]}
        />
      </div>

      {order.reason ? (
        <div className="rounded-lg border border-dashed p-3" style={{ borderColor: 'var(--border)' }}>
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
            Reason
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm font-medium leading-relaxed" style={{ color: 'var(--foreground)' }}>
            {order.reason}
          </p>
        </div>
      ) : null}

      {order.isCustomized ? (
        <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
            Customization
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed" style={{ color: 'var(--foreground)' }}>
            {order.notes || '—'}
          </p>
        </div>
      ) : null}
    </DetailPanel>
  );
}

function ProductionDetailsView({ production }: { production: DailyProduction }) {
  if (!production) return null;
  return (
    <DetailPanel>
      <div className="space-y-6">
        <DetailSectionTint title="Production overview">
          <InfoGrid plain>
            <InfoField label="Production No" value={production.productionNo} highlight />
            <InfoField label="Date" value={formatSlDate(production.productionDate)} />
            <InfoField label="Shift" value={production.shiftName} />
          </InfoGrid>
        </DetailSectionTint>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-x-6">
          <InfoField label="Product" value={production.productName || production.product?.name || '-'} />
          <InfoField label="Requested By" value={production.createdByName} />
        </div>
        <DetailSectionTint title="Quantities" subtitle="Planned vs produced for this run.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border px-5 py-6 text-center sm:py-7" style={{ borderColor: 'var(--border)' }}>
              <p className="mb-2 text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
                Planned
              </p>
              <p className="text-2xl font-bold tabular-nums">{production.plannedQty}</p>
            </div>
            <div className="rounded-lg border px-5 py-6 text-center sm:py-7" style={{ borderColor: '#C8102E' }}>
              <p className="mb-2 text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
                Produced
              </p>
              <p className="text-2xl font-bold tabular-nums" style={{ color: '#C8102E' }}>
                {production.producedQty}
              </p>
            </div>
          </div>
        </DetailSectionTint>
        {production.notes && <InfoField label="Notes" value={production.notes} />}
      </div>
    </DetailPanel>
  );
}

function parseApprovalJson(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw !== 'string' || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function jsonPick(obj: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null) return obj[key];
  }
  return undefined;
}

function jsonMoney(obj: Record<string, unknown>, ...keys: string[]): number | null {
  const v = jsonPick(obj, ...keys);
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function formatApprovalRs(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `Rs. ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function AdminApprovalDetailsView({ approval }: { approval: any }) {
  if (!approval) return null;
  const type = String(approval.approvalType ?? approval.ApprovalType ?? '');
  if (type === 'Cashier Balance') {
    return <CashierBalanceApprovalDetailsView approval={approval} />;
  }
  if (type === 'Price Change') {
    return <PriceChangeApprovalDetailsView approval={approval} />;
  }
  return (
    <DetailPanel>
      <div className="space-y-6">
        <DetailSectionTint title="Admin approval">
          <InfoGrid plain>
            <InfoField label="Type" value={approval.approvalType} highlight />
            <InfoField label="Reference" value={approval.entityReference || approval.entityId} />
            <InfoField label="Requested At" value={formatSlDateTime(approval.requestedAt)} />
          </InfoGrid>
        </DetailSectionTint>
        <InfoField label="Requested By" value={approval.requestedByName} />
        {approval.notes && (
          <div className="rounded-lg border border-dashed p-3" style={{ borderColor: 'var(--border)' }}>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
              Notes / data
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed" style={{ color: 'var(--foreground)' }}>
              {approval.notes}
            </p>
          </div>
        )}
      </div>
    </DetailPanel>
  );
}

function PriceChangeApprovalDetailsView({ approval }: { approval: any }) {
  if (!approval) return null;
  const data = parseApprovalJson(approval.requestData ?? approval.RequestData);
  const comment = String(jsonPick(data, 'comment', 'Comment') ?? approval.notes ?? '').trim();
  const effectiveFromRaw = String(jsonPick(data, 'effectiveFrom', 'EffectiveFrom') ?? '').trim();
  const rawItems = jsonPick(data, 'items', 'Items');
  const items = Array.isArray(rawItems)
    ? rawItems.map((row) => {
        const item = (row && typeof row === 'object' ? row : {}) as Record<string, unknown>;
        return {
          code: String(jsonPick(item, 'productCode', 'ProductCode') ?? ''),
          name: String(jsonPick(item, 'productName', 'ProductName') ?? ''),
          previous: jsonMoney(item, 'previousPrice', 'PreviousPrice') ?? 0,
          next: jsonMoney(item, 'newPrice', 'NewPrice') ?? 0,
        };
      })
    : [];

  return (
    <DetailPanel>
      <div className="space-y-6">
        <DetailSectionTint title="Price change">
          <InfoGrid plain>
            <InfoField label="Reference" value={approval.entityReference || approval.entityId} highlight />
            <InfoField
              label="Effective Date"
              value={
                effectiveFromRaw
                  ? formatSlDateSlashMon(effectiveFromRaw)
                  : formatSlDateTime(approval.requestedAt)
              }
            />
            <InfoField label="Requested By" value={approval.requestedByName || approval.RequestedByName || '—'} />
          </InfoGrid>
        </DetailSectionTint>
        {comment && (
          <div className="rounded-lg border border-dashed p-3" style={{ borderColor: 'var(--border)' }}>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
              Comment
            </p>
            <p className="mt-1 text-sm leading-relaxed" style={{ color: 'var(--foreground)' }}>
              {comment}
            </p>
          </div>
        )}
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
            Previous price vs new price
          </p>
          {items.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              No line items in this request.
            </p>
          ) : (
            <div className="space-y-2">
              {items.map((item, idx) => {
                const up = item.next > item.previous;
                const down = item.next < item.previous;
                const delta = item.next - item.previous;
                return (
                  <div
                    key={`${item.code}-${idx}`}
                    className="rounded-xl border p-3"
                    style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)' }}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold" style={{ color: 'var(--foreground)' }}>
                          {item.name || '—'}
                        </p>
                        <p className="font-mono text-xs" style={{ color: 'var(--muted-foreground)' }}>
                          {item.code}
                        </p>
                      </div>
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-semibold"
                        style={{
                          backgroundColor: up ? '#DCFCE7' : down ? '#FEE2E2' : 'var(--muted)',
                          color: up ? '#166534' : down ? '#991B1B' : 'var(--muted-foreground)',
                        }}
                      >
                        {up ? 'Increase' : down ? 'Decrease' : 'No change'}{' '}
                        {delta === 0 ? '' : `(${delta > 0 ? '+' : ''}${formatApprovalRs(delta)})`}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div className="rounded-lg px-3 py-2" style={{ backgroundColor: 'var(--muted)' }}>
                        <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
                          Previous Price
                        </p>
                        <p className="mt-1 text-lg font-bold line-through decoration-1" style={{ color: 'var(--muted-foreground)' }}>
                          {formatApprovalRs(item.previous)}
                        </p>
                      </div>
                      <div className="rounded-lg px-3 py-2" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
                        <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#991B1B' }}>
                          New Price
                        </p>
                        <p className="mt-1 text-lg font-bold" style={{ color: '#C8102E' }}>
                          {formatApprovalRs(item.next)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </DetailPanel>
  );
}

function CashierBalanceApprovalDetailsView({ approval }: { approval: any }) {
  const data = parseApprovalJson(approval.requestData ?? approval.RequestData);
  const closed = Boolean(jsonPick(data, 'isShowroomClosed', 'IsShowroomClosed'));
  const cash = jsonMoney(data, 'balanceCash', 'BalanceCash');
  const card = jsonMoney(data, 'balanceCard', 'BalanceCard');
  const uber = jsonMoney(data, 'balanceUber', 'BalanceUber');
  const pickme = jsonMoney(data, 'balancePickme', 'BalancePickme');
  const total =
    jsonMoney(data, 'total', 'Total') ??
    (cash ?? 0) + (card ?? 0) + (uber ?? 0) + (pickme ?? 0);
  const cashierName = String(jsonPick(data, 'cashierName', 'CashierName') ?? '').trim();
  const outletName = String(jsonPick(data, 'outletName', 'OutletName') ?? approval.entityReference ?? '').trim();
  const outletCode = String(jsonPick(data, 'outletCode', 'OutletCode') ?? '').trim();
  const processDateRaw = String(jsonPick(data, 'processDate', 'ProcessDate') ?? '').trim();

  return (
    <DetailPanel>
      <div className="space-y-6">
        <DetailSectionTint title="Cash submission">
          <InfoGrid plain>
            <InfoField
              label="Showroom"
              value={outletCode ? `${outletCode} — ${outletName || 'Showroom'}` : outletName || '—'}
              highlight
            />
            <InfoField
              label="Date"
              value={processDateRaw ? formatSlDateSlashMon(processDateRaw) : formatSlDateTime(approval.requestedAt)}
            />
            <InfoField label="Requested By" value={approval.requestedByName || approval.RequestedByName || '—'} />
          </InfoGrid>
        </DetailSectionTint>
        <InfoField label="Cashier" value={cashierName || '—'} />
        {closed ? (
          <p className="text-sm font-semibold" style={{ color: '#92400E' }}>
            Showroom marked closed for this date.
          </p>
        ) : (
          <DetailSectionTint title="Amounts">
            <InfoGrid plain>
              <InfoField label="Cash" value={formatApprovalRs(cash)} />
              <InfoField label="Card" value={formatApprovalRs(card)} />
              <InfoField label="Uber" value={formatApprovalRs(uber)} />
              <InfoField label="PickMe" value={formatApprovalRs(pickme)} />
            </InfoGrid>
            <div className="mt-4">
              <InfoField label="Total" value={formatApprovalRs(total)} highlight />
            </div>
          </DetailSectionTint>
        )}
      </div>
    </DetailPanel>
  );
}

function GenericDetailsView({ item, details }: { item: OperationApprovalItem; details: any }) {
  const core = details?.data ?? details;
  const rawItems = core?.items;
  const lineItems = Array.isArray(rawItems) ? rawItems : [];

  return (
    <DetailPanel>
      <div className="space-y-6">
        <DetailSectionTint title="Request overview">
          <InfoGrid plain>
            <InfoField label="Reference" value={item.referenceNo} highlight />
            <InfoField label="Date" value={formatSlDate(item.requestDate)} />
            <InfoField label="Type" value={item.approvalType} />
          </InfoGrid>
        </DetailSectionTint>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-x-6">
          <InfoField label="Outlet / Product" value={item.outletName || '-'} />
          <InfoField label="Requested By" value={item.requestedByName || '-'} />
        </div>
        {item.approvalType === 'Delivery Return' && core?.deliveryNo != null && core.deliveryNo !== '' && (
          <InfoField label="Delivery No" value={String(core.deliveryNo)} />
        )}
        {item.description && <InfoField label="Description" value={item.description} />}
        {core?.notes != null && core.notes !== '' && (
          <div className="rounded-lg border border-dashed p-3" style={{ borderColor: 'var(--border)' }}>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
              Notes
            </p>
            <p className="mt-1 text-sm italic leading-relaxed" style={{ color: 'var(--foreground)' }}>
              {String(core.notes)}
            </p>
          </div>
        )}
        {lineItems.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
              {item.approvalType === 'Delivery Return' ? 'Returned items' : 'Line items'}
            </p>
            <ItemsTable
              headers={['Product', 'Quantity']}
              rows={lineItems.map((row: any, idx: number) => {
                const name =
                  row.productName ??
                  row.product?.name ??
                  row.ProductName ??
                  row.Product?.Name ??
                  'Unknown';
                const code = row.product?.code ?? row.Product?.Code;
                const qty = row.quantity ?? row.Quantity;
                return [
                  <div key={row.id ?? row.Id ?? idx}>
                    <p className="font-medium">{name}</p>
                    {code ? <p className="text-xs text-muted-foreground">{code}</p> : null}
                  </div>,
                  typeof qty === 'number' ? qty.toLocaleString() : String(qty ?? '-'),
                ];
              })}
            />
          </div>
        )}
      </div>
    </DetailPanel>
  );
}
