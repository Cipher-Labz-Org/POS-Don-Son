'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Select from '@/components/ui/select';
import { ArrowLeft, Save, Loader2, Clock } from 'lucide-react';
import { stockBfApi } from '@/lib/api/stock-bf';
import { outletsApi, type Outlet } from '@/lib/api/outlets';
import { productsApi, type Product } from '@/lib/api/products';
import { useAuthStore } from '@/lib/stores/auth-store';
import { getDateBounds } from '@/lib/date-restrictions';
import { Badge } from '@/components/ui/badge';
import toast from 'react-hot-toast';

export default function EditStockBFPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const user = useAuthStore((s) => s.user);
  const _hasHydrated = useAuthStore((s) => s._hasHydrated);
  const dateBounds = getDateBounds('back-3-no-future', user as any, {
    allowBackDatePermission: 'operation:stock-bf:allow-back-date',
    allowFutureDatePermission: 'operation:stock-bf:allow-future-date',
  });

  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const [formData, setFormData] = useState({
    bfDate: '',
    showroomId: '',
    productId: '',
    quantity: '',
  });

  const [recordStatus, setRecordStatus] = useState<string>('');

  const isFormValid = () => {
    return formData.bfDate && formData.showroomId && formData.productId && formData.quantity;
  };

  useEffect(() => {
    if (!_hasHydrated) return;
    void (async () => {
      await fetchOutlets();
      try {
        setIsLoading(true);
        const response = await stockBfApi.getById(id);
        
        // Check if the record is pending
        if (response.status !== 'Pending') {
          toast.error('Only pending stock BF records can be edited');
          router.push('/operation/stock-bf');
          return;
        }
        
        setRecordStatus(response.status);
        setFormData({
          bfDate: response.bfDate,
          showroomId: response.outletId,
          productId: response.productId,
          quantity: String(response.quantity),
        });
        await fetchProducts(response.productId);
      } catch (error: any) {
        toast.error(error.response?.data?.message || 'Failed to load stock BF');
        router.push('/operation/stock-bf');
      } finally {
        setIsLoading(false);
      }
    })();
  }, [id, _hasHydrated, router]);

  const fetchOutlets = async () => {
    try {
      const response = await outletsApi.getAll(1, 1000);
      const list = Array.isArray(response.outlets) ? response.outlets : [];
      setOutlets(list.filter((o) => o.isActive !== false));
    } catch (error: any) {
      const msg =
        error.response?.data?.error?.message ||
        error.response?.data?.message ||
        error.message ||
        'Failed to load showrooms';
      toast.error(msg);
    }
  };

  const fetchProducts = async (includeProductId?: string) => {
    try {
      const response = await productsApi.getAll(1, 1000, undefined, undefined, true, formData.bfDate || undefined);
      const list = Array.isArray(response.products) ? response.products : [];
      setProducts(
        list.filter(
          (p) =>
            p.isActive !== false &&
            p.requireOpenStock === true &&
            (p.displayInPOS !== false || (!!includeProductId && p.id === includeProductId)),
        ),
      );
    } catch (error: any) {
      const msg =
        error.response?.data?.error?.message ||
        error.response?.data?.message ||
        error.message ||
        'Failed to load products';
      toast.error(msg);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    try {
      setIsSubmitting(true);
      await stockBfApi.update(id, {
        bfDate: formData.bfDate,
        outletId: formData.showroomId,
        productId: formData.productId,
        quantity: Number(formData.quantity),
      });
      toast.success('Stock BF updated successfully');
      router.push('/operation/stock-bf');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update stock BF');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--muted-foreground)' }} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>Edit Stock BF</h1>
            {recordStatus === 'Pending' && (
              <Badge variant="warning" size="sm">
                <Clock className="mr-1 h-3 w-3" />
                Pending
              </Badge>
            )}
          </div>
          <p className="mt-1" style={{ color: 'var(--muted-foreground)' }}>
            Update opening stock balance record (only pending records can be edited)
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Stock BF Information</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="BF Date"
              type="date"
              value={formData.bfDate}
              onChange={(e) => setFormData({ ...formData, bfDate: e.target.value })}
              min={dateBounds.min}
              max={dateBounds.max}
              fullWidth
              required
            />
            
            <Select
              label="Showroom"
              value={formData.showroomId}
              onChange={(e) => setFormData({ ...formData, showroomId: e.target.value })}
              options={outlets.map(o => ({ value: o.id, label: `${o.code} - ${o.name}` }))}
              fullWidth
              required
            />
            
            <Select
              label="Product"
              value={formData.productId}
              onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
              options={products.map(p => ({ value: p.id, label: `${p.code} - ${p.name}` }))}
              fullWidth
              required
            />
            
            <Input
              label="Quantity"
              type="number"
              min="0"
              step="0.01"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
              fullWidth
              required
            />

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.back()}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={isSubmitting || !isFormValid()}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
