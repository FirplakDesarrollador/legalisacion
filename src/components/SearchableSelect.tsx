'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Search, X, Check } from 'lucide-react';

export interface SelectOption {
  value: string | number;
  label: string;
  sublabel?: string;
}

interface SearchableSelectProps {
  options: SelectOption[];
  value: string | number | undefined | null;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
  required?: boolean;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = '-- Seleccionar --',
  searchPlaceholder = 'Buscar...',
  disabled = false,
  className = '',
  required = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((opt) => String(opt.value) === String(value));

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Focus input when opened
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchTerm('');
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const normalizeText = (text: string) =>
    (text || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

  const filteredOptions = React.useMemo(() => {
    if (!searchTerm.trim()) return options;

    const term = normalizeText(searchTerm);
    const searchWords = term.split(/\s+/).filter(Boolean);

    const matches: { opt: SelectOption; score: number }[] = [];

    for (const opt of options) {
      const normLabel = normalizeText(opt.label);
      const normSublabel = opt.sublabel ? normalizeText(opt.sublabel) : '';
      const normValue = normalizeText(String(opt.value));

      // Must match every typed word in label, sublabel, or value
      const matchesAllWords = searchWords.every(
        (word) =>
          normLabel.includes(word) ||
          normSublabel.includes(word) ||
          normValue.includes(word)
      );

      if (!matchesAllWords) continue;

      // Ranking score: lower is higher priority (appears "de primeras")
      let score = 100;

      if (normLabel.startsWith(term)) {
        score = 10; // Exact start of label (e.g. "Duvan ...")
      } else if (normValue.startsWith(term)) {
        score = 20; // Exact start of value/email
      } else if (normLabel.split(/\s+/).some((part) => part.startsWith(term))) {
        score = 30; // Word in label starts with term
      } else if (normLabel.includes(term)) {
        score = 40; // Substring in label
      } else if (normValue.includes(term)) {
        score = 50; // Substring in value/email
      } else {
        score = 60; // Substring in sublabel
      }

      matches.push({ opt, score });
    }

    matches.sort((a, b) => a.score - b.score);
    return matches.map((m) => m.opt);
  }, [options, searchTerm]);

  const handleSelect = (val: string | number) => {
    onChange(String(val));
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* Hidden input for HTML5 form validation if required */}
      {required && (
        <input
          type="text"
          value={value ? String(value) : ''}
          required={required}
          onChange={() => {}}
          className="sr-only"
          tabIndex={-1}
        />
      )}

      {/* Button trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full p-1.5 bg-white border border-slate-200 rounded-lg text-left text-xs flex items-center justify-between gap-1.5 transition-all shadow-2xs hover:border-slate-300 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-100 ${
          disabled ? 'opacity-60 cursor-not-allowed bg-slate-50' : 'cursor-pointer'
        }`}
      >
        <span
          className={`truncate font-medium ${
            selectedOption ? 'text-slate-900' : 'text-slate-400 font-normal'
          }`}
          title={selectedOption ? selectedOption.label : placeholder}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-blue-600' : ''
          }`}
        />
      </button>

      {/* Dropdown Overlay */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 min-w-[240px]">
          {/* Search box */}
          <div className="p-2 border-b border-slate-100 bg-slate-50 flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full text-xs bg-transparent border-none p-0 text-slate-900 placeholder-slate-400 focus:outline-none"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="p-0.5 text-slate-400 hover:text-slate-600 rounded"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Options List */}
          <div className="max-h-56 overflow-y-auto custom-scrollbar divide-y divide-slate-50 p-1 text-xs">
            {filteredOptions.length === 0 ? (
              <div className="p-3 text-center text-slate-400 text-[11px]">
                No se encontraron resultados para &quot;{searchTerm}&quot;
              </div>
            ) : (
              filteredOptions.map((opt, idx) => {
                const isSelected = String(opt.value) === String(value);
                return (
                  <button
                    key={`${opt.value}-${idx}`}
                    type="button"
                    onClick={() => handleSelect(opt.value)}
                    className={`w-full text-left px-2.5 py-2 rounded-lg transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50 text-blue-900 font-semibold'
                        : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs">{opt.label}</p>
                      {opt.sublabel && (
                        <p className="text-[10px] text-slate-400 truncate">{opt.sublabel}</p>
                      )}
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
