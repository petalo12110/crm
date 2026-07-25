import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Users, Target, Ticket, CheckSquare, UserCog, X } from 'lucide-react'
import { api } from '@/lib/axios'
import { useDebounce } from '@/hooks/useDebounce'

interface SearchResult { id: string; type: string; label: string; sublabel?: string }

const TYPE_ICONS: Record<string, React.ElementType> = {
  customer: Users, lead: Target, ticket: Ticket, task: CheckSquare, employee: UserCog,
}

const TYPE_ROUTES: Record<string, string> = {
  customer: '/customers', lead: '/leads', ticket: '/tickets', task: '/tasks',
}

export function GlobalSearch({ onClose }: { onClose: () => void }) {
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate  = useNavigate()
  const debounced = useDebounce(query, 250)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    if (!debounced.trim()) { setResults([]); return }
    setLoading(true)
    api.get(`/search?q=${encodeURIComponent(debounced)}&limit=5`)
      .then(r => {
        const d = r.data.data
        const flat: SearchResult[] = [
          ...d.customers.map((c: Record<string,string>) => ({
            id: c.id, type: 'customer',
            label: [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email,
            sublabel: c.email,
          })),
          ...d.leads.map((l: Record<string,string>) => ({
            id: l.id, type: 'lead', label: l.title, sublabel: `Stage: ${l.stage}`,
          })),
          ...d.tickets.map((t: Record<string,string>) => ({
            id: t.id, type: 'ticket', label: t.title, sublabel: t.ticketNumber,
          })),
          ...d.tasks.map((t: Record<string,string>) => ({
            id: t.id, type: 'task', label: t.title, sublabel: `Status: ${t.status}`,
          })),
          ...d.employees.map((e: Record<string,string>) => ({
            id: e.id, type: 'employee',
            label: [e.firstName, e.lastName].filter(Boolean).join(' '),
            sublabel: e.email,
          })),
        ]
        setResults(flat)
        setSelected(0)
      })
      .catch(() => setResults([]))
      .finally(() => setLoading(false))
  }, [debounced])

  const handleSelect = (r: SearchResult) => {
    const base = TYPE_ROUTES[r.type]
    if (base) navigate(`${base}/${r.id}`)
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
    if (e.key === 'Enter' && results[selected]) handleSelect(results[selected])
    if (e.key === 'Escape') onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-xl rounded-xl border border-border bg-surface shadow-modal">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="h-4 w-4 shrink-0 text-text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search customers, leads, tickets..."
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-text-muted hover:text-text-primary">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {loading && (
          <div className="p-4 text-center text-sm text-text-secondary">Searching…</div>
        )}

        {!loading && results.length > 0 && (
          <ul className="max-h-72 overflow-y-auto py-2">
            {results.map((r, i) => {
              const Icon = TYPE_ICONS[r.type] ?? Search
              return (
                <li key={r.id}>
                  <button
                    onMouseEnter={() => setSelected(i)}
                    onClick={() => handleSelect(r)}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left
                      ${i === selected ? 'bg-primary/10' : 'hover:bg-surface-2'}`}
                  >
                    <Icon className="h-4 w-4 shrink-0 text-text-muted" />
                    <div>
                      <p className="text-sm font-medium text-text-primary">{r.label}</p>
                      {r.sublabel && <p className="text-xs text-text-secondary">{r.sublabel}</p>}
                    </div>
                    <span className="ml-auto text-xs text-text-muted capitalize">{r.type}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        {!loading && query && results.length === 0 && (
          <div className="p-6 text-center text-sm text-text-secondary">
            No results for "{query}"
          </div>
        )}

        {!query && (
          <div className="px-4 py-3 text-xs text-text-muted">
            Type to search · ↑↓ navigate · Enter select · Esc close
          </div>
        )}
      </div>
    </div>
  )
}
