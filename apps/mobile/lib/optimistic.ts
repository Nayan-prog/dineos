import type { QueryClient, QueryKey } from '@tanstack/react-query';

/**
 * Optimistic update for a mutation: the screen changes the moment the button is pressed, and is rolled back if the server says no.
 * Spread the result into useMutation({ ..., ...optimistic(qc, key, update) }).
 */
export function optimistic<Vars>(qc: QueryClient, key: QueryKey, update: (old: any, vars: Vars) => any, onFail?: (e: Error) => void) {
  return {
    onMutate: async (vars: Vars) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData(key);
      if (prev) qc.setQueryData(key, update(prev, vars));
      return { prev };
    },
    onError: (e: Error, _vars: Vars, ctx?: { prev: unknown }) => { if (ctx?.prev) qc.setQueryData(key, ctx.prev); onFail?.(e); },
    onSettled: () => { qc.invalidateQueries({ queryKey: key }); },
  };
}
