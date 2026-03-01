import {
  Target,
  UserPlus,
  ClipboardList,
  Rocket,
  MessageSquare,
  CreditCard,
  PenTool,
  Edit3,
  Mail,
  Share2,
  BookOpen,
  Search,
  Code,
  Database,
  BarChart3,
  Eye,
  Lightbulb,
  Brain,
  DollarSign,
  Package,
  Wrench,
  Users,
  FlaskConical,
  Megaphone,
  Video,
  Zap,
  Settings,
  HelpCircle,
  CheckCircle2,
} from 'lucide-react';
import { CATEGORIES, PRIORITIES } from '../data/marketingSkills';

const ICON_MAP = {
  Target,
  UserPlus,
  ClipboardList,
  Rocket,
  MessageSquare,
  CreditCard,
  PenTool,
  Edit3,
  Mail,
  Share2,
  BookOpen,
  Search,
  Code,
  Database,
  BarChart3,
  Eye,
  Lightbulb,
  Brain,
  DollarSign,
  Package,
  Wrench,
  Users,
  FlaskConical,
  Megaphone,
  Video,
  Zap,
  Settings,
  HelpCircle,
};

const CATEGORY_BORDER_CLASS = {
  cro: 'cat-cro',
  content: 'cat-content',
  seo: 'cat-seo',
  strategy: 'cat-strategy',
  growth: 'cat-growth',
  ads: 'cat-ads',
};

const CATEGORY_COLOR = {
  cro: '#10b981',
  content: '#3b82f6',
  seo: '#8b5cf6',
  strategy: '#f59e0b',
  growth: '#ec4899',
  ads: '#ef4444',
};

const PRIORITY_DOT_COLOR = {
  week1: '#10b981',
  secondary: '#f59e0b',
  advanced: '#8b5cf6',
};

const ENGINE_LABELS = {
  openai: 'OpenAI',
  perplexity: 'Perplexity',
  gemini: 'Gemini',
};

const ENGINE_COLORS = {
  openai: { bg: 'rgba(16,185,129,0.12)', text: '#10b981' },
  perplexity: { bg: 'rgba(59,130,246,0.12)', text: '#3b82f6' },
  gemini: { bg: 'rgba(139,92,246,0.12)', text: '#8b5cf6' },
};

export default function SkillCard({ skill, isCompleted, onClick }) {
  const Icon = ICON_MAP[skill.icon] || HelpCircle;
  const category = CATEGORIES[skill.category];
  const priority = PRIORITIES[skill.priority];
  const borderClass = CATEGORY_BORDER_CLASS[skill.category] || '';
  const catColor = CATEGORY_COLOR[skill.category] || '#64748b';
  const priorityDot = PRIORITY_DOT_COLOR[skill.priority] || '#64748b';
  const engine = ENGINE_COLORS[skill.aiEngine] || ENGINE_COLORS.openai;
  const engineLabel = ENGINE_LABELS[skill.aiEngine] || skill.aiEngine;

  return (
    <button
      onClick={() => onClick?.(skill)}
      className={`card ${borderClass} relative flex flex-col gap-3 p-4 text-left w-full cursor-pointer transition-all duration-200 hover:scale-[1.01]`}
    >
      {/* Completed overlay badge */}
      {isCompleted && (
        <div className="absolute top-3 right-3 z-10">
          <CheckCircle2 size={20} className="text-emerald" />
        </div>
      )}

      {/* Top row: Icon + Priority */}
      <div className="flex items-center justify-between">
        <div
          className="flex items-center justify-center w-9 h-9 rounded-lg"
          style={{ background: `${catColor}15` }}
        >
          <Icon size={18} style={{ color: catColor }} />
        </div>

        {!isCompleted && (
          <span
            className="flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full"
            style={{
              background: `${priorityDot}15`,
              color: priorityDot,
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: priorityDot }}
            />
            {priority?.label}
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="text-sm font-semibold text-text leading-snug">
        {skill.name}
      </h3>

      {/* Description — 2 line clamp */}
      <p className="text-xs text-text-secondary leading-relaxed line-clamp-2">
        {skill.description}
      </p>

      {/* Bottom row: Category badge + AI engine badge */}
      <div className="flex items-center gap-2 mt-auto pt-1">
        <span
          className="text-[0.65rem] font-semibold uppercase tracking-wide px-2 py-0.5 rounded"
          style={{
            background: `${catColor}15`,
            color: catColor,
          }}
        >
          {category?.label}
        </span>

        <span
          className="text-[0.65rem] font-medium px-2 py-0.5 rounded"
          style={{
            background: engine.bg,
            color: engine.text,
          }}
        >
          {engineLabel}
        </span>
      </div>
    </button>
  );
}
