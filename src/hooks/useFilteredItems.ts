import { useState, useMemo } from 'react';

interface FilteredItemsOptions<T> {
  items: T[];
  categoryKey?: keyof T;
  searchKeys?: (keyof T)[];
  defaultCategory?: string;
  allCategoryValue?: string;
}

export function useFilteredItems<T>({
  items,
  categoryKey = 'category' as keyof T,
  searchKeys = ['name'] as (keyof T)[],
  defaultCategory = 'all',
  allCategoryValue = 'all',
}: FilteredItemsOptions<T>) {
  const [selectedCategory, setSelectedCategory] = useState(defaultCategory);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      // 分类过滤
      const matchesCategory = 
        selectedCategory === allCategoryValue || 
        item[categoryKey] === selectedCategory;
      
      // 搜索过滤
      const matchesSearch = searchKeys.some(key => {
        const value = item[key];
        return typeof value === 'string' && 
          value.toLowerCase().includes(searchQuery.toLowerCase());
      });
      
      return matchesCategory && matchesSearch;
    });
  }, [items, selectedCategory, searchQuery, categoryKey, searchKeys, allCategoryValue]);

  return {
    selectedCategory,
    setSelectedCategory,
    searchQuery,
    setSearchQuery,
    filteredItems,
  };
}
