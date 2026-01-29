/**
 * ChallengeTable component with TanStack Table v8
 *
 * Features:
 * - Advanced filtering and sorting with TanStack Table
 * - Column-based filtering for difficulty, category, and status
 * - Global search functionality with debounced input
 * - Actions column with spawn buttons and progress indicators
 * - Responsive design with mobile-friendly layout
 * - Empty state handling for no results
 */

'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  flexRender,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  type Challenge,
  type UserProgress,
  DIFFICULTY_LEVELS,
  type OnSpawnChallenge,
  type OnViewDetails
} from '@/lib/types';
import {
  Play,
  MoreHorizontal,
  ArrowUpDown,
  Clock,
  Trophy,
  Tag,
  CheckCircle,
  AlertCircle,
  Eye,
  ChevronDown
} from 'lucide-react';

interface ChallengeTableProps {
  challenges: Challenge[];
  progress?: Record<string, UserProgress>;
  onSpawn: OnSpawnChallenge;
  onViewDetails: OnViewDetails;
  isSpawning?: boolean;
  spawningChallengeId?: string;
}

export function ChallengeTable({
  challenges,
  progress = {},
  onSpawn,
  onViewDetails,
  isSpawning = false,
  spawningChallengeId
}: ChallengeTableProps) {
  // Table state
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = useState('');

  // Get difficulty variant for badge styling
  const getDifficultyVariant = useCallback((difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'default';
      case 'intermediate': return 'secondary';
      case 'advanced': return 'destructive';
      case 'expert': return 'outline';
      default: return 'default';
    }
  }, []);

  // Get progress indicator
  const getProgressIndicator = useCallback((challengeId: string) => {
    const userProgress = progress[challengeId];
    if (!userProgress || userProgress.status === 'not-started') {
      return null;
    }

    if (userProgress.status === 'completed') {
      return (
        <div className="flex items-center gap-1 text-green-600">
          <CheckCircle className="h-4 w-4" />
          <span className="text-xs">Completed</span>
        </div>
      );
    }

    if (userProgress.status === 'attempted') {
      return (
        <div className="flex items-center gap-1 text-yellow-600">
          <AlertCircle className="h-4 w-4" />
          <span className="text-xs">{userProgress.attempts} attempts</span>
        </div>
      );
    }

    return null;
  }, [progress]);

  // Define table columns
  const columns = useMemo<ColumnDef<Challenge>[]>(
    () => [
      {
        id: 'progress',
        header: '',
        cell: ({ row }) => getProgressIndicator(row.original.id),
        enableSorting: false,
        enableColumnFilter: false,
        size: 40,
      },
      {
        accessorKey: 'name',
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
              className="h-auto p-0 font-semibold hover:bg-transparent"
            >
              Challenge Name
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          );
        },
        cell: ({ row }) => (
          <div className="max-w-md">
            <div className="font-medium">{row.getValue('name')}</div>
            <div className="text-sm text-muted-foreground line-clamp-2">
              {row.original.description}
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'category',
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
              className="h-auto p-0 font-semibold hover:bg-transparent"
            >
              Category
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          );
        },
        cell: ({ row }) => (
          <Badge variant="outline" className="capitalize">
            <Tag className="h-3 w-3 mr-1" />
            {row.getValue('category')}
          </Badge>
        ),
        filterFn: 'equals',
      },
      {
        accessorKey: 'difficulty',
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
              className="h-auto p-0 font-semibold hover:bg-transparent"
            >
              Difficulty
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          );
        },
        cell: ({ row }) => {
          const difficulty = row.getValue('difficulty') as string;
          return (
            <Badge variant={getDifficultyVariant(difficulty)}>
              {DIFFICULTY_LEVELS[difficulty as keyof typeof DIFFICULTY_LEVELS]?.label || difficulty}
            </Badge>
          );
        },
        sortingFn: (rowA, rowB) => {
          const difficultyOrder = { beginner: 1, intermediate: 2, advanced: 3, expert: 4 };
          const aValue = difficultyOrder[rowA.getValue('difficulty') as keyof typeof difficultyOrder] || 0;
          const bValue = difficultyOrder[rowB.getValue('difficulty') as keyof typeof difficultyOrder] || 0;
          return aValue - bValue;
        },
        filterFn: 'equals',
      },
      {
        accessorKey: 'points',
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
              className="h-auto p-0 font-semibold hover:bg-transparent"
            >
              Points
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          );
        },
        cell: ({ row }) => (
          <div className="flex items-center gap-1 font-medium">
            <Trophy className="h-4 w-4 text-yellow-600" />
            {row.getValue('points')}
          </div>
        ),
      },
      {
        accessorKey: 'estimated_time',
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
              className="h-auto p-0 font-semibold hover:bg-transparent"
            >
              Duration
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          );
        },
        cell: ({ row }) => (
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-4 w-4" />
            {row.getValue('estimated_time')}
          </div>
        ),
      },
      {
        accessorKey: 'tags',
        header: 'Tags',
        cell: ({ row }) => {
          const tags = row.getValue('tags') as string[];
          return (
            <div className="flex flex-wrap gap-1 max-w-40">
              {tags.slice(0, 2).map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {tags.length > 2 && (
                <Badge variant="outline" className="text-xs">
                  +{tags.length - 2}
                </Badge>
              )}
            </div>
          );
        },
        enableSorting: false,
        enableColumnFilter: false,
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const challenge = row.original;
          const isCurrentlySpawning = isSpawning && spawningChallengeId === challenge.id;

          return (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => onSpawn(challenge.id)}
                disabled={isCurrentlySpawning}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white h-8"
              >
                <Play className="h-3 w-3 mr-1" />
                {isCurrentlySpawning ? 'Spawning...' : 'Start'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onViewDetails(challenge.id)}
                className="h-8"
              >
                <Eye className="h-3 w-3 mr-1" />
                Details
              </Button>
            </div>
          );
        },
        enableSorting: false,
        enableColumnFilter: false,
        size: 160,
      },
    ],
    [onSpawn, onViewDetails, isSpawning, spawningChallengeId, getDifficultyVariant, getProgressIndicator]
  );

  // Create table instance
  const table = useReactTable({
    data: challenges,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    state: {
      columnFilters,
      sorting,
      columnVisibility,
      globalFilter,
    },
    globalFilterFn: 'includesString',
  });

  // Get filtered row count
  const filteredCount = table.getFilteredRowModel().rows.length;

  return (
    <div className="space-y-4">
      {/* Results summary */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {filteredCount} of {challenges.length} challenges
        </p>

        {/* Column visibility toggle */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <ChevronDown className="h-4 w-4 mr-2" />
            Columns
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="whitespace-nowrap">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  <div className="space-y-2">
                    <p className="text-muted-foreground">No challenges found.</p>
                    <p className="text-sm text-muted-foreground">
                      Try adjusting your search or filter criteria.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination would go here if needed */}
    </div>
  );
}