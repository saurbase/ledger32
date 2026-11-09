"use client"

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { api, type DataSourceInput } from "@/lib/api-client";
import type { NewAccount, NewJournalEntry } from "@/lib/types";

export const qk = {
  accounts: ["accounts"] as const,
  journal: ["journal"] as const,
  summary: ["summary"] as const,
  report: (type: string) => ["report", type] as const,
  status: ["status"] as const,
};

export function useAccounts() {
  return useQuery({ queryKey: qk.accounts, queryFn: api.listAccounts });
}

export function useJournal() {
  return useQuery({ queryKey: qk.journal, queryFn: api.listJournal });
}

export function useSummary() {
  return useQuery({ queryKey: qk.summary, queryFn: api.summary });
}

export function useReport<T>(type: string, enabled = true) {
  return useQuery({
    queryKey: qk.report(type),
    queryFn: () => {
      switch (type) {
        case "trial-balance":
          return api.trialBalance() as Promise<T>;
        case "general-ledger":
          return api.generalLedger() as Promise<T>;
        case "income-statement":
          return api.incomeStatement() as Promise<T>;
        case "balance-sheet":
          return api.balanceSheet() as Promise<T>;
        default:
          throw new Error("Unknown report");
      }
    },
    enabled,
  });
}

export function useStatus() {
  return useQuery({ queryKey: qk.status, queryFn: api.status });
}

export function useDataSource() {
  return useQuery({ queryKey: ["datasource"], queryFn: api.getDataSource });
}

/** Save & switch data source, then refetch everything from the new backend. */
export function useSaveDataSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: DataSourceInput) => api.saveDataSource(input),
    onSuccess: () => qc.invalidateQueries(),
  });
}

function useInvalidateAll() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: qk.accounts });
    qc.invalidateQueries({ queryKey: qk.journal });
    qc.invalidateQueries({ queryKey: qk.summary });
    qc.invalidateQueries({ queryKey: ["report"] });
  };
}

export function useCreateAccount() {
  const inv = useInvalidateAll();
  return useMutation({
    mutationFn: (input: NewAccount) => api.createAccount(input),
    onSuccess: inv,
  });
}

export function useUpdateAccount() {
  const inv = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<NewAccount> }) =>
      api.updateAccount(id, input),
    onSuccess: inv,
  });
}

export function useDeleteAccount() {
  const inv = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) => api.deleteAccount(id),
    onSuccess: inv,
  });
}

export function useImportAccounts() {
  const inv = useInvalidateAll();
  return useMutation({
    mutationFn: ({
      accounts,
      mode,
    }: {
      accounts: NewAccount[];
      mode: "update" | "skip";
    }) => api.importAccounts(accounts, mode),
    onSuccess: inv,
  });
}

export function useCreateJournal() {
  const inv = useInvalidateAll();
  return useMutation({
    mutationFn: (input: NewJournalEntry) => api.createJournal(input),
    onSuccess: inv,
  });
}

export function useDeleteJournal() {
  const inv = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) => api.deleteJournal(id),
    onSuccess: inv,
  });
}

export function useReverseJournal() {
  const inv = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) => api.reverseJournal(id),
    onSuccess: inv,
  });
}

export function useReset() {
  const inv = useInvalidateAll();
  return useMutation({ mutationFn: () => api.reset(), onSuccess: inv });
}

export function useSeed() {
  const inv = useInvalidateAll();
  return useMutation({ mutationFn: () => api.seed(), onSuccess: inv });
}
