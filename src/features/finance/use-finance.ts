import { useQuery } from '@tanstack/react-query'
import { currentFx, listExpenses, listFees, listInvoices, listQuotes } from '@/data/finance'

export const useInvoices = (clientId?: string) => useQuery({ queryKey: ['invoices', { clientId }], queryFn: () => listInvoices({ clientId }) })
export const useQuotes = (clientId?: string) => useQuery({ queryKey: ['quotes', { clientId }], queryFn: () => listQuotes({ clientId }) })
export const useExpenses = () => useQuery({ queryKey: ['expenses'], queryFn: listExpenses })
export const useFees = () => useQuery({ queryKey: ['fees'], queryFn: listFees })
export const useFx = () => useQuery({ queryKey: ['fx-current'], queryFn: currentFx })
