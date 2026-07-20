import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Upload, FileText, CheckCircle2, AlertCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Overlay'
import { customersApi } from '../api/customers.api'
import { CUSTOMERS_KEY } from '../hooks/useCustomers'

const EXPECTED_COLUMNS = [
  'firstName', 'lastName', 'email', 'phone', 'companyName', 'industry',
  'customerType', 'status', 'city', 'country', 'tags', 'notes',
]

export function ImportCsvModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const qc = useQueryClient()

  const importMutation = useMutation({
    mutationFn: (f: File) => customersApi.importCsv(f),
    onSuccess:  () => qc.invalidateQueries({ queryKey: [CUSTOMERS_KEY] }),
  })

  const handleClose = () => {
    setFile(null)
    importMutation.reset()
    onClose()
  }

  const result = importMutation.data

  return (
    <Modal open={open} onClose={handleClose} title="Import customers from CSV">
      <div className="space-y-4">
        {!result && (
          <>
            <div>
              <p className="mb-1.5 text-sm text-text-secondary">
                First row must be column headers. Recognized columns (others are ignored):
              </p>
              <div className="flex flex-wrap gap-1">
                {EXPECTED_COLUMNS.map(col => (
                  <span key={col} className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-xs text-text-secondary">{col}</span>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-text-muted">
                For the <span className="font-mono">tags</span> column, separate multiple tags with a semicolon ( ; ) since commas already separate CSV columns.
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
            />

            {file ? (
              <div className="flex items-center justify-between rounded-md border border-border bg-surface-2 px-3 py-2">
                <div className="flex items-center gap-2 text-sm text-text-primary">
                  <FileText className="h-4 w-4 text-text-muted" />
                  {file.name}
                  <span className="text-xs text-text-muted">({(file.size / 1024).toFixed(1)} KB)</span>
                </div>
                <button onClick={() => setFile(null)} className="text-text-muted hover:text-text-primary">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border-strong py-8 text-text-secondary hover:border-primary hover:text-primary"
              >
                <Upload className="h-6 w-6" />
                <span className="text-sm font-medium">Click to choose a .csv file</span>
              </button>
            )}

            {importMutation.isError && (
              <div className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
                Import failed — check the file is a valid CSV and try again.
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={handleClose}>Cancel</Button>
              <Button
                onClick={() => file && importMutation.mutate(file)}
                loading={importMutation.isPending}
                disabled={!file}
              >
                Import
              </Button>
            </div>
          </>
        )}

        {result && (
          <>
            <div className="flex gap-3">
              <div className="flex flex-1 items-center gap-2 rounded-md bg-success/10 px-3 py-2 text-success">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span className="text-sm font-medium">{result.imported} imported</span>
              </div>
              {result.failed > 0 && (
                <div className="flex flex-1 items-center gap-2 rounded-md bg-danger/10 px-3 py-2 text-danger">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span className="text-sm font-medium">{result.failed} skipped</span>
                </div>
              )}
            </div>

            {result.errors.length > 0 && (
              <div className="max-h-56 overflow-y-auto rounded-md border border-border">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 border-b border-border bg-surface-2 text-left text-text-secondary">
                    <tr><th className="px-3 py-1.5">Row</th><th className="px-3 py-1.5">Reason</th></tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {result.errors.map((e, i) => (
                      <tr key={i}>
                        <td className="px-3 py-1.5 font-mono text-text-muted">{e.row}</td>
                        <td className="px-3 py-1.5 text-text-secondary">{e.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              {result.failed > 0 && (
                <Button variant="secondary" onClick={() => { setFile(null); importMutation.reset() }}>
                  Import another file
                </Button>
              )}
              <Button onClick={handleClose}>Done</Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
