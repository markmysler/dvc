/**
 * ChallengeFilters component for advanced filtering controls
 *
 * Features:
 * - Global search with debounced input
 * - Difficulty and category faceted filters
 * - Completion status filtering
 * - Progressive disclosure with "More filters" toggle
 * - Tag-based filtering
 * - Sort options for different columns
 */

'use client';

import { useState, useCallback, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  type Challenge,
  type DiscoveryFilters,
  CHALLENGE_CATEGORIES,
  DIFFICULTY_LEVELS
} from '@/lib/types';
import {
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  X,
  SortAsc,
  SortDesc
} from 'lucide-react';

interface ChallengeFiltersProps {
  challenges: Challenge[];
  filters: DiscoveryFilters;
  onFiltersChange: (filters: DiscoveryFilters) => void;
  onClearFilters: () => void;
  className?: string;
}

export function ChallengeFilters({
  challenges,
  filters,
  onFiltersChange,
  onClearFilters,
  className = ''
}: ChallengeFiltersProps) {
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Get unique categories and tags from challenges for filter options
  const { availableCategories, availableTags } = useMemo(() => {
    const categories = [...new Set(challenges.map(c => c.category))].sort();
    const tags = [...new Set(challenges.flatMap(c => c.tags))].sort();

    return {
      availableCategories: categories,
      availableTags: tags
    };
  }, [challenges]);

  // Update individual filter values
  const updateFilter = useCallback((key: keyof DiscoveryFilters, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  }, [filters, onFiltersChange]);

  // Handle tag toggle
  const toggleTag = useCallback((tag: string) => {
    const newTags = filters.tags.includes(tag)
      ? filters.tags.filter(t => t !== tag)
      : [...filters.tags, tag];

    updateFilter('tags', newTags);
  }, [filters.tags, updateFilter]);

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return (
      filters.search !== '' ||
      filters.category !== '' ||
      filters.difficulty !== '' ||
      filters.completion_status !== '' ||
      filters.tags.length > 0
    );
  }, [filters]);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Primary filters - always visible */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Global search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search challenges by name, description, or tags..."
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Category filter */}
        <Select
          value={filters.category}
          onValueChange={(value) => updateFilter('category', value)}
        >
          <SelectTrigger className="w-full lg:w-[180px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Categories</SelectItem>
            {availableCategories.map((category) => (
              <SelectItem key={category} value={category}>
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Difficulty filter */}
        <Select
          value={filters.difficulty}
          onValueChange={(value) => updateFilter('difficulty', value)}
        >
          <SelectTrigger className="w-full lg:w-[180px]">
            <SelectValue placeholder="Difficulty" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Difficulties</SelectItem>
            {Object.entries(DIFFICULTY_LEVELS).map(([key, config]) => (
              <SelectItem key={key} value={key}>
                {config.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Sort options */}
        <Select
          value={`${filters.sort_by}-${filters.sort_order}`}
          onValueChange={(value) => {
            const [sortBy, sortOrder] = value.split('-');
            updateFilter('sort_by', sortBy);
            updateFilter('sort_order', sortOrder);
          }}
        >
          <SelectTrigger className="w-full lg:w-[180px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name-asc">
              <div className="flex items-center gap-2">
                <SortAsc className="h-4 w-4" />
                Name A-Z
              </div>
            </SelectItem>
            <SelectItem value="name-desc">
              <div className="flex items-center gap-2">
                <SortDesc className="h-4 w-4" />
                Name Z-A
              </div>
            </SelectItem>
            <SelectItem value="difficulty-asc">
              <div className="flex items-center gap-2">
                <SortAsc className="h-4 w-4" />
                Difficulty ↑
              </div>
            </SelectItem>
            <SelectItem value="difficulty-desc">
              <div className="flex items-center gap-2">
                <SortDesc className="h-4 w-4" />
                Difficulty ↓
              </div>
            </SelectItem>
            <SelectItem value="points-asc">
              <div className="flex items-center gap-2">
                <SortAsc className="h-4 w-4" />
                Points ↑
              </div>
            </SelectItem>
            <SelectItem value="points-desc">
              <div className="flex items-center gap-2">
                <SortDesc className="h-4 w-4" />
                Points ↓
              </div>
            </SelectItem>
            <SelectItem value="estimated_time-asc">
              <div className="flex items-center gap-2">
                <SortAsc className="h-4 w-4" />
                Time ↑
              </div>
            </SelectItem>
            <SelectItem value="estimated_time-desc">
              <div className="flex items-center gap-2">
                <SortDesc className="h-4 w-4" />
                Time ↓
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Advanced filters toggle */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
          className="text-muted-foreground"
        >
          <Filter className="h-4 w-4 mr-2" />
          More filters
          {showAdvancedFilters ? (
            <ChevronUp className="h-4 w-4 ml-2" />
          ) : (
            <ChevronDown className="h-4 w-4 ml-2" />
          )}
        </Button>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="text-muted-foreground"
          >
            <X className="h-4 w-4 mr-2" />
            Clear filters
          </Button>
        )}
      </div>

      {/* Advanced filters - collapsible */}
      {showAdvancedFilters && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {/* Completion status filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Completion Status</label>
                <Select
                  value={filters.completion_status}
                  onValueChange={(value) => updateFilter('completion_status', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Statuses</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="attempted">Attempted</SelectItem>
                    <SelectItem value="not-started">Not Started</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Tag filters */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Tags</label>
                <div className="flex flex-wrap gap-2">
                  {availableTags.slice(0, 20).map((tag) => (
                    <Badge
                      key={tag}
                      variant={filters.tags.includes(tag) ? "default" : "outline"}
                      className="cursor-pointer hover:bg-primary/80"
                      onClick={() => toggleTag(tag)}
                    >
                      {tag}
                      {filters.tags.includes(tag) && (
                        <X className="h-3 w-3 ml-1" />
                      )}
                    </Badge>
                  ))}
                  {availableTags.length > 20 && (
                    <Badge variant="outline" className="cursor-default">
                      +{availableTags.length - 20} more
                    </Badge>
                  )}
                </div>
                {filters.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-2 border-t">
                    <span className="text-xs text-muted-foreground">Selected:</span>
                    {filters.tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="text-xs cursor-pointer"
                        onClick={() => toggleTag(tag)}
                      >
                        {tag}
                        <X className="h-3 w-3 ml-1" />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active filters summary */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2 items-center text-sm text-muted-foreground">
          <span>Active filters:</span>
          {filters.search && (
            <Badge variant="outline" className="text-xs">
              Search: "{filters.search}"
              <X
                className="h-3 w-3 ml-1 cursor-pointer"
                onClick={() => updateFilter('search', '')}
              />
            </Badge>
          )}
          {filters.category && (
            <Badge variant="outline" className="text-xs">
              Category: {filters.category}
              <X
                className="h-3 w-3 ml-1 cursor-pointer"
                onClick={() => updateFilter('category', '')}
              />
            </Badge>
          )}
          {filters.difficulty && (
            <Badge variant="outline" className="text-xs">
              Difficulty: {DIFFICULTY_LEVELS[filters.difficulty as keyof typeof DIFFICULTY_LEVELS]?.label}
              <X
                className="h-3 w-3 ml-1 cursor-pointer"
                onClick={() => updateFilter('difficulty', '')}
              />
            </Badge>
          )}
          {filters.completion_status && (
            <Badge variant="outline" className="text-xs">
              Status: {filters.completion_status}
              <X
                className="h-3 w-3 ml-1 cursor-pointer"
                onClick={() => updateFilter('completion_status', '')}
              />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}