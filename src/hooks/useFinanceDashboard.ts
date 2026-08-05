import { useState, useEffect } from 'react';
import { EnterpriseFinanceService } from '../services/EnterpriseFinanceService';
import { FinancialSummary } from '../types/finance.types';

export function useFinanceDashboard(schoolId?: string) {
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unmounted = false;
    async function loadSummary() {
      setLoading(true);
      try {
        const data = await EnterpriseFinanceService.getDashboardSummary(schoolId);
        if (!unmounted) setSummary(data);
      } catch (err) {
        console.error('Error loading finance summary:', err);
      } finally {
        if (!unmounted) setLoading(false);
      }
    }

    loadSummary();
    return () => { unmounted = true; };
  }, [schoolId]);

  return { summary, loading };
}
