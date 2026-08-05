import { useState, useEffect } from 'react';
import { invoiceRepository } from '../repositories/InvoiceRepository';
import { Invoice } from '../types/finance.types';

export function useInvoices(schoolId?: string) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unmounted = false;
    async function loadData() {
      setLoading(true);
      try {
        const list = await invoiceRepository.findAll(schoolId);
        if (!unmounted) setInvoices(list);
      } catch (err) {
        console.error('Error loading invoices:', err);
      } finally {
        if (!unmounted) setLoading(false);
      }
    }

    loadData();
    return () => { unmounted = true; };
  }, [schoolId]);

  return { invoices, loading, invoiceRepository };
}
