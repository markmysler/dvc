/**
 * URL state management hooks using nuqs
 *
 * Provides URL-synchronized filter state for the discovery interface:
 * - Search query persistence
 * - Category and difficulty filters
 * - Pagination and sorting state
 * - View mode preferences
 * - Shareable and bookmarkable URLs
 */

'use client';

import { useQueryState, parseAsString, parseAsInteger, parseAsArrayOf } from 'nuqs';
import { useCallback, useMemo } from 'react';
import { type DiscoveryFilters } from '@/lib/types';

// Default filter values
const DEFAULT_FILTERS: DiscoveryFilters = {
  search: '',
  category: '',
  difficulty: '',
  completion_status: '',
  tags: [],
  sort_by: 'name',
  sort_order: 'asc',
};

/**
 * Hook for managing URL-synchronized discovery filters
 */
export function useDiscoveryFilters() {
  // URL state for search parameters
  const [search, setSearch] = useQueryState(
    'search',
    parseAsString.withDefault(DEFAULT_FILTERS.search)
  );

  const [category, setCategory] = useQueryState(
    'category',
    parseAsString.withDefault(DEFAULT_FILTERS.category)
  );

  const [difficulty, setDifficulty] = useQueryState(
    'difficulty',
    parseAsString.withDefault(DEFAULT_FILTERS.difficulty)
  );

  const [completionStatus, setCompletionStatus] = useQueryState(
    'status',
    parseAsString.withDefault(DEFAULT_FILTERS.completion_status)
  );

  const [tags, setTags] = useQueryState(
    'tags',
    parseAsArrayOf(parseAsString).withDefault(DEFAULT_FILTERS.tags)
  );

  const [sortBy, setSortBy] = useQueryState(
    'sort',
    parseAsString.withDefault(DEFAULT_FILTERS.sort_by)
  );

  const [sortOrder, setSortOrder] = useQueryState(
    'order',
    parseAsString.withDefault(DEFAULT_FILTERS.sort_order)
  );

  const [page, setPage] = useQueryState(
    'page',
    parseAsInteger.withDefault(1)
  );

  const [view, setView] = useQueryState(
    'view',
    parseAsString.withDefault('grid')
  );

  // Combine all filters into single object
  const filters: DiscoveryFilters = useMemo(() => ({
    search,
    category,
    difficulty,
    completion_status: completionStatus,
    tags,
    sort_by: sortBy,
    sort_order: sortOrder as 'asc' | 'desc',
  }), [search, category, difficulty, completionStatus, tags, sortBy, sortOrder]);

  // Update multiple filters at once
  const updateFilters = useCallback(async (newFilters: Partial<DiscoveryFilters>) => {
    const updates: Promise<any>[] = [];

    if (newFilters.search !== undefined) {
      updates.push(setSearch(newFilters.search));
    }
    if (newFilters.category !== undefined) {
      updates.push(setCategory(newFilters.category));
    }
    if (newFilters.difficulty !== undefined) {
      updates.push(setDifficulty(newFilters.difficulty));
    }
    if (newFilters.completion_status !== undefined) {
      updates.push(setCompletionStatus(newFilters.completion_status));
    }
    if (newFilters.tags !== undefined) {
      updates.push(setTags(newFilters.tags));
    }
    if (newFilters.sort_by !== undefined) {
      updates.push(setSortBy(newFilters.sort_by));
    }
    if (newFilters.sort_order !== undefined) {
      updates.push(setSortOrder(newFilters.sort_order));
    }

    // Reset page to 1 when filters change
    if (Object.keys(newFilters).some(key => key !== 'sort_by' && key !== 'sort_order')) {
      updates.push(setPage(1));
    }

    await Promise.all(updates);
  }, [
    setSearch,
    setCategory,
    setDifficulty,
    setCompletionStatus,
    setTags,
    setSortBy,
    setSortOrder,
    setPage,
  ]);

  // Clear all filters
  const clearFilters = useCallback(async () => {
    await Promise.all([
      setSearch(DEFAULT_FILTERS.search),
      setCategory(DEFAULT_FILTERS.category),
      setDifficulty(DEFAULT_FILTERS.difficulty),
      setCompletionStatus(DEFAULT_FILTERS.completion_status),
      setTags(DEFAULT_FILTERS.tags),
      setSortBy(DEFAULT_FILTERS.sort_by),
      setSortOrder(DEFAULT_FILTERS.sort_order),
      setPage(1),
    ]);
  }, [
    setSearch,
    setCategory,
    setDifficulty,
    setCompletionStatus,
    setTags,
    setSortBy,
    setSortOrder,
    setPage,
  ]);

  // Helper to check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return (
      search !== DEFAULT_FILTERS.search ||
      category !== DEFAULT_FILTERS.category ||
      difficulty !== DEFAULT_FILTERS.difficulty ||
      completionStatus !== DEFAULT_FILTERS.completion_status ||
      tags.length > 0 ||
      sortBy !== DEFAULT_FILTERS.sort_by ||
      sortOrder !== DEFAULT_FILTERS.sort_order
    );
  }, [search, category, difficulty, completionStatus, tags, sortBy, sortOrder]);

  // Get URL for current filter state (useful for sharing)
  const getShareableUrl = useCallback(() => {
    if (typeof window === 'undefined') return '';
    return window.location.href;
  }, []);

  return {
    // Individual filter states
    search,
    category,
    difficulty,
    completionStatus,
    tags,
    sortBy,
    sortOrder,
    page,
    view,

    // Individual setters
    setSearch,
    setCategory,
    setDifficulty,
    setCompletionStatus,
    setTags,
    setSortBy,
    setSortOrder,
    setPage,
    setView,

    // Combined filter object
    filters,

    // Batch operations
    updateFilters,
    clearFilters,

    // Utilities
    hasActiveFilters,
    getShareableUrl,
  };
}

/**
 * Hook for managing pagination state
 */
export function usePagination(totalItems: number, itemsPerPage: number = 20) {
  const [page, setPage] = useQueryState(
    'page',
    parseAsInteger.withDefault(1)
  );

  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (page - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);

  const canGoNext = page < totalPages;
  const canGoPrevious = page > 1;

  const goToPage = useCallback(async (newPage: number) => {
    const validPage = Math.max(1, Math.min(newPage, totalPages));
    await setPage(validPage);
  }, [setPage, totalPages]);

  const nextPage = useCallback(async () => {
    if (canGoNext) {
      await setPage(page + 1);
    }
  }, [canGoNext, page, setPage]);

  const previousPage = useCallback(async () => {
    if (canGoPrevious) {
      await setPage(page - 1);
    }
  }, [canGoPrevious, page, setPage]);

  return {
    page,
    totalPages,
    totalItems,
    itemsPerPage,
    startIndex,
    endIndex,
    canGoNext,
    canGoPrevious,
    setPage: goToPage,
    nextPage,
    previousPage,
  };
}

/**
 * Hook for view state management (grid/table)
 */
export function useViewMode() {
  const [view, setView] = useQueryState(
    'view',
    parseAsString.withDefault('grid')
  );

  const isGridView = view === 'grid';
  const isTableView = view === 'table';

  const setGridView = useCallback(() => setView('grid'), [setView]);
  const setTableView = useCallback(() => setView('table'), [setView]);

  const toggleView = useCallback(() => {
    setView(isGridView ? 'table' : 'grid');
  }, [isGridView, setView]);

  return {
    view: view as 'grid' | 'table',
    isGridView,
    isTableView,
    setView,
    setGridView,
    setTableView,
    toggleView,
  };
}

/**
 * Hook for URL-based modal state (useful for challenge details)
 */
export function useModalState(modalKey: string) {
  const [isOpen, setIsOpen] = useQueryState(
    modalKey,
    parseAsString.withDefault('')
  );

  const openModal = useCallback((id: string) => {
    setIsOpen(id);
  }, [setIsOpen]);

  const closeModal = useCallback(() => {
    setIsOpen('');
  }, [setIsOpen]);

  return {
    isOpen: Boolean(isOpen),
    modalId: isOpen,
    openModal,
    closeModal,
  };
}