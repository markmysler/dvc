# Phase 3: Discovery Interface - Research

**Researched:** 2026-01-28
**Domain:** React Frontend with Discovery/Search Interface
**Confidence:** HIGH

## Summary

Researched implementing a discovery interface for browsing, filtering, and tracking cybersecurity challenges using modern React patterns. The phase requires building a Next.js frontend that integrates with the existing Flask API to fulfill requirements CHAL-01, CHAL-05, CHAL-06, DISC-01 through DISC-05.

The standard approach in 2026 is Next.js 15 with App Router using Server Components for initial data and Client Components for interactivity. shadcn/ui provides the required component library (per UI-01 requirement), with TanStack Table for advanced filtering/search and TanStack Query for optimized API integration.

The research identified that discovery interfaces require sophisticated search, filtering, pagination, and progress tracking capabilities. Modern best practices emphasize URL state management for shareable/bookmarkable filters, progressive disclosure to avoid overwhelming users, and performance optimization through server-first rendering.

**Primary recommendation:** Use Next.js 15 App Router with shadcn/ui Data Table, TanStack Query for API integration, and nuqs for URL state management to build a performant discovery interface with advanced filtering capabilities.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 15.x | React framework with App Router | Server-first architecture, performance optimizations, industry standard |
| shadcn/ui | latest | UI component library | Required by UI-01, copy-paste components, Tailwind integration |
| @tanstack/react-table | 8.21.3 | Data table with filtering/sorting | Headless, powerful filtering, industry standard for complex tables |
| @tanstack/react-query | 5.x | Server state management | Optimized caching, mutations, DevTools, perfect for REST APIs |
| Recharts | 3.6.0 | Chart library for analytics | Integrated with shadcn/ui charts, battle-tested, declarative |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| nuqs | latest | URL state management | For shareable filters, pagination, search state |
| cmdk | latest | Command palette | Global search, keyboard shortcuts (bundled with shadcn/ui) |
| Tailwind CSS | 4.x | Utility-first styling | Required by shadcn/ui, modern CSS patterns |
| TypeScript | 5.x | Type safety | Industry standard for production React apps |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| TanStack Query | SWR | SWR is simpler but lacks mutations, DevTools, and advanced caching |
| TanStack Table | React Data Grid | Commercial solutions offer more features but cost money and vendor lock-in |
| nuqs | Manual URLSearchParams | Manual approach requires more boilerplate and type safety |

**Installation:**
```bash
# Create Next.js app with shadcn/ui
npx create-next-app@latest discovery-interface --typescript --tailwind --app
cd discovery-interface
npx shadcn@latest init

# Add required shadcn/ui components
npx shadcn@latest add button table data-table input select badge card chart command

# Add core dependencies
npm install @tanstack/react-table @tanstack/react-query recharts nuqs
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/                 # Next.js App Router pages
│   ├── layout.tsx      # Root layout with QueryProvider
│   ├── page.tsx        # Main discovery interface
│   └── challenges/     # Challenge detail pages
├── components/
│   ├── ui/             # shadcn/ui components
│   ├── discovery/      # Discovery-specific components
│   ├── filters/        # Filter components
│   └── charts/         # Progress tracking charts
├── lib/
│   ├── api.ts          # API client with TanStack Query
│   ├── types.ts        # TypeScript interfaces
│   └── utils.ts        # Helper functions
└── hooks/
    ├── useFilters.ts   # URL state management with nuqs
    └── useChallenges.ts # API queries with TanStack Query
```

### Pattern 1: Server-First with Client Islands
**What:** Server Components handle initial data fetch, Client Components manage interactivity
**When to use:** Default pattern for all pages
**Example:**
```typescript
// Source: Next.js 15 official documentation
// app/page.tsx (Server Component)
import { ChallengeDiscovery } from '@/components/discovery/ChallengeDiscovery'

export default async function DiscoveryPage() {
  const initialChallenges = await fetch('http://localhost:5000/api/challenges').then(r => r.json())

  return (
    <div>
      <h1>Challenge Discovery</h1>
      <ChallengeDiscovery initialData={initialChallenges} />
    </div>
  )
}

// components/discovery/ChallengeDiscovery.tsx (Client Component)
'use client'
import { useQuery } from '@tanstack/react-query'
import { DataTable } from '@/components/ui/data-table'

export function ChallengeDiscovery({ initialData }) {
  const { data } = useQuery({
    queryKey: ['challenges'],
    queryFn: fetchChallenges,
    initialData
  })

  return <DataTable data={data.challenges} columns={challengeColumns} />
}
```

### Pattern 2: URL State Management with nuqs
**What:** Sync filter/search state with URL for shareable/bookmarkable interface
**When to use:** For all search, filter, and pagination state
**Example:**
```typescript
// Source: nuqs official documentation
import { useQueryState, parseAsString, parseAsInteger } from 'nuqs'

export function useDiscoveryFilters() {
  const [search, setSearch] = useQueryState('search', parseAsString.withDefault(''))
  const [category, setCategory] = useQueryState('category', parseAsString.withDefault(''))
  const [difficulty, setDifficulty] = useQueryState('difficulty', parseAsString.withDefault(''))
  const [page, setPage] = useQueryState('page', parseAsInteger.withDefault(1))

  return {
    search, setSearch,
    category, setCategory,
    difficulty, setDifficulty,
    page, setPage
  }
}
```

### Pattern 3: Progressive Disclosure with TanStack Table
**What:** Start with simple view, progressively reveal advanced filters
**When to use:** To avoid overwhelming users with too many filter options
**Example:**
```typescript
// Source: TanStack Table official documentation
const [columnFilters, setColumnFilters] = useState([])
const [globalFilter, setGlobalFilter] = useState('')

const table = useReactTable({
  data: challenges,
  columns: challengeColumns,
  getCoreRowModel: getCoreRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  getFacetedRowModel: getFacetedRowModel(),
  getFacetedUniqueValues: getFacetedUniqueValues(),
  onColumnFiltersChange: setColumnFilters,
  onGlobalFilterChange: setGlobalFilter,
  state: {
    columnFilters,
    globalFilter,
  },
})
```

### Anti-Patterns to Avoid
- **Filtering on filtered data:** Don't use filtered results as the source for new filters - always filter from original dataset
- **Client-only rendering:** Avoid full client-side rendering when you could use Server Components for initial load
- **Overwhelming filter UI:** Don't expose all 20+ filter options at once - use progressive disclosure
- **Missing empty states:** Always handle zero results gracefully with helpful messaging

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Data table filtering | Custom filter logic | TanStack Table with faceted filters | Handles edge cases, performance, accessibility |
| Search with debouncing | Manual debounce + useState | TanStack Query with enabled: !!debouncedSearch | Built-in request deduplication, caching |
| URL state management | Manual URLSearchParams handling | nuqs library | Type safety, parsing, Next.js integration |
| Progress charts | Custom SVG charts | Recharts via shadcn/ui charts | Battle-tested, responsive, accessible |
| Command palette | Custom search modal | shadcn/ui Command (cmdk) | Fuzzy search, keyboard nav, proven UX patterns |

**Key insight:** Discovery interfaces have complex state management (search, filters, pagination, sorting) that benefits enormously from battle-tested libraries rather than custom implementations.

## Common Pitfalls

### Pitfall 1: Filter State Management Chaos
**What goes wrong:** Using component state for filters causes loss of state on navigation, non-shareable URLs, and difficulty managing complex filter combinations
**Why it happens:** Developers default to useState without considering URL state or navigation requirements
**How to avoid:** Use nuqs for all filter state that should persist across navigation
**Warning signs:** Users complain about losing filters on page refresh or inability to share filtered views

### Pitfall 2: Table Performance Degradation
**What goes wrong:** Large datasets (>100 challenges) cause UI lag during filtering/sorting operations
**Why it happens:** Not implementing proper memoization, filtering entire dataset on every keystroke
**How to avoid:** Use TanStack Table's built-in optimization, implement debounced search, consider server-side filtering for large datasets
**Warning signs:** UI freezes during typing, poor mobile performance

### Pitfall 3: Overwhelming Filter UI
**What goes wrong:** Showing all filter options upfront overwhelms users and makes interface unusable
**Why it happens:** Designer/developer perspective differs from user perspective - experts know what they want, beginners get paralyzed
**How to avoid:** Progressive disclosure pattern - show 3-5 main filters, hide advanced options behind "More filters" toggle
**Warning signs:** Low engagement metrics, users not utilizing filters

### Pitfall 4: Poor Empty States
**What goes wrong:** Zero search results show empty table with no guidance on what to do next
**Why it happens:** Developers focus on success states, neglect edge cases
**How to avoid:** Design helpful empty states with suggestions, clear filters button, alternative actions
**Warning signs:** Users complain about "getting stuck" or not knowing how to proceed

### Pitfall 5: Server/Client State Mismatch
**What goes wrong:** Hydration errors, flickering UI, stale data display during initial load
**Why it happens:** Not properly handling the server/client boundary in Next.js App Router
**How to avoid:** Use initialData pattern with TanStack Query, ensure consistent server/client rendering
**Warning signs:** Console hydration warnings, flickering content on page load

## Code Examples

Verified patterns from official sources:

### Challenge Discovery Data Table
```typescript
// Source: shadcn/ui Data Table documentation
'use client'

import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  useReactTable,
} from '@tanstack/react-table'
import { useState } from 'react'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'

export function ChallengeDataTable({ data, columns }) {
  const [columnFilters, setColumnFilters] = useState([])
  const [globalFilter, setGlobalFilter] = useState('')

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    state: {
      columnFilters,
      globalFilter,
    },
  })

  return (
    <div>
      <Input
        placeholder="Search challenges..."
        value={globalFilter ?? ''}
        onChange={(event) => setGlobalFilter(String(event.target.value))}
        className="max-w-sm"
      />
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
```

### TanStack Query API Integration
```typescript
// Source: TanStack Query Next.js documentation
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// API functions
const fetchChallenges = () =>
  fetch('http://localhost:5000/api/challenges').then(res => res.json())

const spawnChallenge = (data: { challenge_id: string; user_id: string }) =>
  fetch('http://localhost:5000/api/challenges', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(res => res.json())

// Custom hooks
export function useChallenges() {
  return useQuery({
    queryKey: ['challenges'],
    queryFn: fetchChallenges,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

export function useSpawnChallenge() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: spawnChallenge,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['challenges'] })
      queryClient.invalidateQueries({ queryKey: ['running-challenges'] })
    },
  })
}
```

### Progress Tracking with Charts
```typescript
// Source: shadcn/ui Chart documentation
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'

const chartConfig = {
  completed: {
    label: "Completed",
    color: "hsl(var(--chart-1))",
  },
  attempted: {
    label: "Attempted",
    color: "hsl(var(--chart-2))",
  },
}

export function ProgressChart({ progressData }) {
  return (
    <ChartContainer config={chartConfig}>
      <BarChart data={progressData}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="category" />
        <YAxis />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="completed" />
        <Bar dataKey="attempted" />
      </BarChart>
    </ChartContainer>
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Client-only React SPA | Server Components + Client Islands | Next.js 13+ (2022) | 40-70% faster initial loads, better SEO |
| Manual filter state | URL state management | 2024+ with nuqs | Shareable URLs, better UX |
| Custom data tables | TanStack Table v8 | 2022+ rewrite | Better performance, accessibility, features |
| Manual API state | TanStack Query v5 | 2023+ | Optimistic updates, caching, DevTools |
| React Query | TanStack Query | Rebrand in 2022 | Same library, better ecosystem integration |

**Deprecated/outdated:**
- React Table v7: Replaced by TanStack Table v8 with better TypeScript support
- Pages Router: App Router is now standard for new Next.js projects
- Manual URLSearchParams: nuqs provides type-safe abstraction

## Open Questions

Things that couldn't be fully resolved:

1. **Progress Data Storage Strategy**
   - What we know: Can use localStorage for client-side persistence or extend Flask API
   - What's unclear: Whether progress should be persisted server-side vs client-side
   - Recommendation: Start with localStorage for MVP, design API endpoints for future server persistence

2. **Search Performance Threshold**
   - What we know: TanStack Table handles hundreds of rows well
   - What's unclear: At what point we need server-side search/filtering
   - Recommendation: Implement client-side filtering initially, add server-side if >500 challenges

3. **Real-time Updates Integration**
   - What we know: TanStack Query supports polling and WebSocket integration
   - What's unclear: Whether real-time challenge status updates are needed
   - Recommendation: Use standard polling (30s) for challenge status, implement WebSockets only if needed

## Sources

### Primary (HIGH confidence)
- shadcn/ui official documentation - Data Table, Chart, Command components
- TanStack Table v8 documentation - Filtering, faceting, examples
- TanStack Query v5 documentation - Next.js integration, server rendering
- Next.js 15 official documentation - App Router, Server Components

### Secondary (MEDIUM confidence)
- nuqs documentation - URL state management patterns
- Recharts v3 documentation - Chart integration patterns
- Multiple 2026 blog posts on React patterns verified with official sources

### Tertiary (LOW confidence)
- WebSearch results on UX best practices (marked for validation)
- Community discussions on implementation patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified through official documentation
- Architecture: HIGH - Patterns confirmed via Next.js 15 and shadcn/ui docs
- Pitfalls: MEDIUM - Based on community patterns and UX research, some unverified

**Research date:** 2026-01-28
**Valid until:** 2026-03-01 (30 days - stable ecosystem)