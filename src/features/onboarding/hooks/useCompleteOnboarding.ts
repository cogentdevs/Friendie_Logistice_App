import { useEffect, useRef, useState } from 'react';
import { useUIStore } from '../../../store/uiStore';
export function useCompleteOnboarding() {
  const flight = useRef(false),
    mounted = useRef(true);
  const [loading, setLoading] = useState(false),
    [error, setError] = useState<string | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const complete = async () => {
    if (flight.current) return;
    flight.current = true;
    setLoading(true);
    setError(null);
    try {
      await useUIStore.getState().completeOnboarding();
      // Root replaces the onboarding group with public MainApp after durable storage succeeds.
    } catch {
      if (mounted.current)
        setError(
          'Could not save your preference. Check device storage and retry.',
        );
    } finally {
      flight.current = false;
      if (mounted.current) setLoading(false);
    }
  };
  return { complete, loading, error };
}
