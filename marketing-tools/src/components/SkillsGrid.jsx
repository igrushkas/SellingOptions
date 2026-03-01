import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import skills, { CATEGORIES } from '../data/marketingSkills';
import SkillCard from './SkillCard';

const PRIORITY_ORDER = { week1: 0, secondary: 1, advanced: 2 };

const CATEGORY_COLOR = {
  cro: '#10b981',
  content: '#3b82f6',
  seo: '#8b5cf6',
  strategy: '#f59e0b',
  growth: '#ec4899',
  ads: '#ef4444',
};

const allFilter = { id: 'all', label: 'All', color: '#06b6d4' };

const categoryFilters = [
  allFilter,
  ...Object.entries(CATEGORIES).map(([id, cat]) => ({
    id,
    label: cat.label,
    color: CATEGORY_COLOR[id],
  })),
];

export default function SkillsGrid({ onSelectSkill, completedSkills = [] }) {
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const completedSet = useMemo(
    () => new Set(completedSkills),
    [completedSkills],
  );

  const filteredSkills = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    return skills
      .filter((skill) => {
        if (activeCategory !== 'all' && skill.category !== activeCategory) {
          return false;
        }
        if (
          query &&
          !skill.name.toLowerCase().includes(query) &&
          !skill.description.toLowerCase().includes(query)
        ) {
          return false;
        }
        return true;
      })
      .sort(
        (a, b) =>
          (PRIORITY_ORDER[a.priority] ?? 99) -
          (PRIORITY_ORDER[b.priority] ?? 99),
      );
  }, [activeCategory, searchQuery]);

  const completedCount = skills.filter((s) => completedSet.has(s.id)).length;

  return (
    <div className="flex flex-col gap-5 w-full">
      {/* Header row: title + completion counter */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text">Marketing Skills</h2>
        <span className="text-sm text-text-secondary">
          <span className="text-accent font-semibold">{completedCount}</span>
          /{skills.length} skills completed
        </span>
      </div>

      {/* Search input */}
      <div className="relative">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search skills by name or description..."
          className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-card text-sm text-text placeholder:text-text-muted outline-none border border-border focus:border-border-hover transition-colors"
        />
      </div>

      {/* Category filter chips — horizontal scroll on mobile */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {categoryFilters.map((cat) => {
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors duration-150 cursor-pointer border"
              style={
                isActive
                  ? {
                      background: `${cat.color}20`,
                      color: cat.color,
                      borderColor: `${cat.color}40`,
                    }
                  : {
                      background: 'transparent',
                      color: '#94a3b8',
                      borderColor: 'rgba(6,182,212,0.12)',
                    }
              }
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Skills grid */}
      {filteredSkills.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSkills.map((skill) => (
            <SkillCard
              key={skill.id}
              skill={skill}
              isCompleted={completedSet.has(skill.id)}
              onClick={onSelectSkill}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-text-muted">
          <Search size={32} className="mb-3 opacity-40" />
          <p className="text-sm">No skills match your search.</p>
        </div>
      )}
    </div>
  );
}
