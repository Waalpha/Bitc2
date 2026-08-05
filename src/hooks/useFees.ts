import { useState, useEffect } from 'react';
import { feeRepository, FeeStructure } from '../repositories/FeeRepository';
import { paymentRepository, PaymentTransaction } from '../repositories/PaymentRepository';

export function useFees(schoolId?: string) {
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [payments, setPayments] = useState<PaymentTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unmounted = false;
    async function loadData() {
      setLoading(true);
      try {
        const [feeData, payData] = await Promise.all([
          feeRepository.findAll(schoolId),
          paymentRepository.findAll(schoolId),
        ]);
        if (!unmounted) {
          setStructures(feeData);
          setPayments(payData);
        }
      } catch (err) {
        console.error('Failed to load fee data:', err);
      } finally {
        if (!unmounted) setLoading(false);
      }
    }

    loadData();
    return () => { unmounted = true; };
  }, [schoolId]);

  return { structures, payments, loading, feeRepository, paymentRepository };
}
