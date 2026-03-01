import { useState } from 'react';
import {
  ArrowLeft,
  AlertTriangle,
  Sparkles,
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
} from 'lucide-react';
import { runOpenAI } from '../services/openaiService';
import { runPerplexity } from '../services/perplexityService';
import { runGemini } from '../services/geminiService';
import { CATEGORIES } from '../data/marketingSkills';
import OutputPanel from './OutputPanel';

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
  Sparkles,
};

const ENGINE_LABELS = {
  openai: 'GPT-4o',
  perplexity: 'Perplexity',
  gemini: 'Gemini',
};

const CATEGORY_COLORS = {
  emerald: 'bg-emerald/15 text-emerald',
  blue: 'bg-blue-400/15 text-blue-400',
  purple: 'bg-purple-400/15 text-purple-400',
  amber: 'bg-amber/15 text-amber',
  pink: 'bg-pink-400/15 text-pink-400',
  red: 'bg-rose/15 text-rose',
};

export default function SkillWorkspace({
  skill,
  businessContext,
  apiKeys,
  savedOutput,
  onSave,
  onBack,
  onSelectRelated,
  allSkills,
}) {
  const [answers, setAnswers] = useState({});
  const [output, setOutput] = useState(savedOutput || null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const Icon = ICON_MAP[skill.icon] || Sparkles;
  const category = CATEGORIES[skill.category];
  const categoryColorClass = CATEGORY_COLORS[category?.color] || 'bg-accent/15 text-accent';

  const handleAnswerChange = (questionId, value) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const buildUserMessage = () => {
    const ctx = businessContext || {};
    let message = `## Business Context\n`;
    message += `- Business: ${ctx.name || 'N/A'}\n`;
    message += `- Website: ${ctx.url || 'N/A'}\n`;
    message += `- Description: ${ctx.description || 'N/A'}\n`;
    message += `- Target Audience: ${ctx.audience || 'N/A'}\n`;
    message += `- Goals: ${ctx.goals || 'N/A'}\n`;

    if (skill.questions && skill.questions.length > 0) {
      message += `\n## Specific Inputs\n`;
      for (const q of skill.questions) {
        message += `- ${q.label}: ${answers[q.id] || 'Not provided'}\n`;
      }
    }

    return message;
  };

  const getRequiredApiKey = () => {
    const engine = skill.aiEngine;
    if (engine === 'openai') return apiKeys?.openai;
    if (engine === 'perplexity') return apiKeys?.perplexity;
    if (engine === 'gemini') return apiKeys?.gemini;
    return null;
  };

  const handleGenerate = async () => {
    const apiKey = getRequiredApiKey();
    if (!apiKey) {
      setError(
        `API key for ${ENGINE_LABELS[skill.aiEngine] || skill.aiEngine} is missing. Please add it in Settings.`
      );
      return;
    }

    setIsLoading(true);
    setError(null);
    setOutput(null);

    try {
      const userMessage = buildUserMessage();
      let result;

      if (skill.aiEngine === 'openai') {
        result = await runOpenAI(apiKey, skill.systemPrompt, userMessage);
      } else if (skill.aiEngine === 'perplexity') {
        result = await runPerplexity(apiKey, skill.systemPrompt, userMessage);
      } else if (skill.aiEngine === 'gemini') {
        // Gemini takes a single prompt, so combine system prompt and user message
        const combinedPrompt = `${skill.systemPrompt}\n\n---\n\n${userMessage}`;
        result = await runGemini(apiKey, combinedPrompt);
      } else {
        throw new Error(`Unknown AI engine: ${skill.aiEngine}`);
      }

      setOutput(result);
      if (onSave) onSave(skill.id, result);
    } catch (err) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const resolveRelatedSkill = (skillId) => {
    if (!allSkills) return null;
    return allSkills.find((s) => s.id === skillId) || null;
  };

  const renderFormField = (question) => {
    const value = answers[question.id] || '';
    const baseInputClass =
      'w-full bg-[#0a1628] border border-border rounded-lg px-3 py-2.5 text-sm text-text placeholder-text-muted focus:outline-none focus:border-accent transition-colors';

    switch (question.type) {
      case 'textarea':
        return (
          <textarea
            value={value}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            placeholder={question.placeholder || ''}
            rows={3}
            className={`${baseInputClass} resize-y`}
          />
        );
      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            className={baseInputClass}
          >
            <option value="">Select an option...</option>
            {question.options?.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        );
      case 'url':
        return (
          <input
            type="url"
            value={value}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            placeholder={question.placeholder || 'https://'}
            className={baseInputClass}
          />
        );
      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            placeholder={question.placeholder || ''}
            className={baseInputClass}
          />
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-text-secondary hover:text-accent transition-colors cursor-pointer"
      >
        <ArrowLeft size={16} />
        <span>Back to Skills</span>
      </button>

      {/* Skill header */}
      <div className="card p-6">
        <div className="flex items-start gap-4">
          <div
            className="flex items-center justify-center w-12 h-12 rounded-xl shrink-0"
            style={{ background: 'linear-gradient(135deg, #0891b2, #06b6d4)' }}
          >
            <Icon size={22} className="text-white" />
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-semibold text-text">{skill.name}</h2>
            <p className="text-sm text-text-secondary mt-1">{skill.description}</p>

            <div className="flex items-center gap-2 mt-3">
              {category && (
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${categoryColorClass}`}>
                  {category.label}
                </span>
              )}
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-accent/15 text-accent">
                {ENGINE_LABELS[skill.aiEngine] || skill.aiEngine}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Question form */}
      {skill.questions && skill.questions.length > 0 && (
        <div className="card p-6">
          <h3 className="text-sm font-semibold text-text mb-4">Skill Inputs</h3>
          <div className="space-y-4">
            {skill.questions.map((question) => (
              <div key={question.id}>
                <label className="block text-sm text-text-secondary mb-1.5">{question.label}</label>
                {renderFormField(question)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* API key warning */}
      {!getRequiredApiKey() && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-lg border border-amber/30"
          style={{ background: 'rgba(245,158,11,0.08)' }}
        >
          <AlertTriangle size={18} className="text-amber shrink-0" />
          <p className="text-sm text-amber">
            {ENGINE_LABELS[skill.aiEngine] || skill.aiEngine} API key is missing. Add it in Settings to use this
            skill.
          </p>
        </div>
      )}

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={isLoading || !getRequiredApiKey()}
        className="btn-primary w-full py-3 text-sm font-semibold flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            <span>Generating...</span>
          </>
        ) : (
          <>
            <Sparkles size={16} />
            <span>Generate Recommendations</span>
          </>
        )}
      </button>

      {/* Error display */}
      {error && (
        <div
          className="px-4 py-3 rounded-lg border border-rose/30"
          style={{ background: 'rgba(244,63,94,0.08)' }}
        >
          <p className="text-sm text-rose">{error}</p>
        </div>
      )}

      {/* Output panel */}
      {(output || isLoading) && (
        <OutputPanel
          content={output}
          isLoading={isLoading}
          skillName={skill.name}
          onRunAgain={handleGenerate}
        />
      )}

      {/* Related skills */}
      {skill.relatedSkills && skill.relatedSkills.length > 0 && (
        <div className="card p-6">
          <h3 className="text-sm font-semibold text-text mb-3">Related Skills</h3>
          <div className="flex flex-wrap gap-2">
            {skill.relatedSkills.map((relatedId) => {
              const related = resolveRelatedSkill(relatedId);
              if (!related) return null;

              const RelatedIcon = ICON_MAP[related.icon] || Sparkles;
              return (
                <button
                  key={relatedId}
                  onClick={() => onSelectRelated && onSelectRelated(relatedId)}
                  className="btn-secondary flex items-center gap-2 text-sm cursor-pointer hover:border-accent/40 transition-colors"
                >
                  <RelatedIcon size={14} className="text-accent" />
                  <span>{related.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
