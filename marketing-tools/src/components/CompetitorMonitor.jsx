import { useState } from 'react';
import { Plus, Search, Eye, Trash2, RefreshCw, Download, ArrowUpDown } from 'lucide-react';
import { runPerplexity } from '../services/perplexityService';

function CompetitorCard({ competitor, onDelete, onResearch, isResearching }) {
  const hasChanged = competitor.snapshots?.length > 1;

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-white">{competitor.name}</h3>
          {competitor.url && (
            <a href={competitor.url} target="_blank" rel="noopener noreferrer"
               className="text-xs text-[#06b6d4] hover:underline">{competitor.url}</a>
          )}
        </div>
        <div className="flex gap-1">
          <button onClick={() => onResearch(competitor)}
                  disabled={isResearching}
                  className="p-1.5 rounded-lg hover:bg-white/5 text-[#94a3b8] disabled:opacity-50"
                  title="Research with AI">
            <RefreshCw className={`w-4 h-4 ${isResearching ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => onDelete(competitor.id)}
                  className="p-1.5 rounded-lg hover:bg-white/5 text-[#f43f5e]"
                  title="Delete">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {competitor.description && (
        <p className="text-sm text-[#94a3b8] mb-3">{competitor.description}</p>
      )}

      {/* Pricing */}
      {competitor.pricing?.length > 0 && (
        <div className="mb-3">
          <span className="text-xs font-medium text-[#64748b] uppercase">Pricing</span>
          <div className="flex flex-wrap gap-2 mt-1">
            {competitor.pricing.map((p, i) => (
              <span key={i} className="text-xs px-2 py-1 rounded-md" style={{ background: '#0d1f2d', border: '1px solid rgba(6,182,212,0.12)' }}>
                <span className="text-white font-medium">{p.tier}</span>
                <span className="text-[#94a3b8]"> — {p.price}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Features */}
      {competitor.keyFeatures?.length > 0 && (
        <div className="mb-3">
          <span className="text-xs font-medium text-[#64748b] uppercase">Key Features</span>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {competitor.keyFeatures.map((f, i) => (
              <span key={i} className="text-xs px-2 py-0.5 rounded-full text-[#06b6d4]"
                    style={{ background: 'rgba(6,182,212,0.1)' }}>
                {f}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Strengths/Weaknesses */}
      <div className="grid grid-cols-2 gap-3 mt-3">
        {competitor.strengths && (
          <div>
            <span className="text-xs font-medium text-[#10b981]">Strengths</span>
            <p className="text-xs text-[#94a3b8] mt-0.5">{competitor.strengths}</p>
          </div>
        )}
        {competitor.weaknesses && (
          <div>
            <span className="text-xs font-medium text-[#f43f5e]">Weaknesses</span>
            <p className="text-xs text-[#94a3b8] mt-0.5">{competitor.weaknesses}</p>
          </div>
        )}
      </div>

      {hasChanged && (
        <div className="mt-3 text-xs text-[#f59e0b] flex items-center gap-1">
          <ArrowUpDown className="w-3 h-3" /> Changes detected since last snapshot
        </div>
      )}

      {competitor.lastResearched && (
        <p className="text-xs text-[#64748b] mt-2">
          Last researched: {new Date(competitor.lastResearched?.seconds ? competitor.lastResearched.seconds * 1000 : competitor.lastResearched).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}

function CompetitorForm({ onAdd, onCancel }) {
  const [form, setForm] = useState({ name: '', url: '', description: '' });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    onAdd(form);
    setForm({ name: '', url: '', description: '' });
  };

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-white mb-4">Add Competitor</h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
               placeholder="Competitor name" required
               className="w-full px-3 py-2 rounded-lg text-sm text-white placeholder-[#64748b] focus:outline-none focus:ring-1 focus:ring-[#06b6d4]"
               style={{ background: '#0d1f2d', border: '1px solid rgba(6,182,212,0.12)' }} />
        <input type="url" value={form.url} onChange={e => setForm(p => ({ ...p, url: e.target.value }))}
               placeholder="https://competitor.com"
               className="w-full px-3 py-2 rounded-lg text-sm text-white placeholder-[#64748b] focus:outline-none focus:ring-1 focus:ring-[#06b6d4]"
               style={{ background: '#0d1f2d', border: '1px solid rgba(6,182,212,0.12)' }} />
        <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Brief description (optional)" rows={2}
                  className="w-full px-3 py-2 rounded-lg text-sm text-white placeholder-[#64748b] focus:outline-none focus:ring-1 focus:ring-[#06b6d4] resize-none"
                  style={{ background: '#0d1f2d', border: '1px solid rgba(6,182,212,0.12)' }} />
        <div className="flex gap-2">
          <button type="submit" className="btn-primary text-sm">Add</button>
          <button type="button" onClick={onCancel} className="btn-secondary text-sm">Cancel</button>
        </div>
      </form>
    </div>
  );
}

function ComparisonMatrix({ competitors, businessName }) {
  if (competitors.length === 0) return null;

  const allFeatures = [...new Set(competitors.flatMap(c => c.keyFeatures || []))];

  return (
    <div className="card p-5 overflow-x-auto">
      <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
        <ArrowUpDown className="w-4 h-4 text-[#06b6d4]" />
        Feature Comparison
      </h3>
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="text-left py-2 px-3 text-[#64748b] font-medium">Feature</th>
            <th className="text-center py-2 px-3 text-[#06b6d4] font-medium">{businessName || 'Your Business'}</th>
            {competitors.map(c => (
              <th key={c.id} className="text-center py-2 px-3 text-[#94a3b8] font-medium">{c.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {allFeatures.map(feature => (
            <tr key={feature} style={{ borderTop: '1px solid rgba(6,182,212,0.08)' }}>
              <td className="py-2 px-3 text-[#94a3b8]">{feature}</td>
              <td className="py-2 px-3 text-center text-[#64748b]">—</td>
              {competitors.map(c => (
                <td key={c.id} className="py-2 px-3 text-center">
                  {(c.keyFeatures || []).includes(feature)
                    ? <span className="text-[#10b981]">✓</span>
                    : <span className="text-[#64748b]">—</span>
                  }
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function CompetitorMonitor({ competitors, businessName, apiKeys, onAdd, onUpdate, onDelete }) {
  const [showForm, setShowForm] = useState(false);
  const [researchingId, setResearchingId] = useState(null);
  const [search, setSearch] = useState('');

  const handleResearch = async (competitor) => {
    if (!apiKeys?.perplexity) {
      alert('Please add your Perplexity API key in Settings to use AI research.');
      return;
    }
    setResearchingId(competitor.id);
    try {
      const prompt = `Research the company "${competitor.name}" (${competitor.url || 'no website provided'}).

Provide a JSON response with this exact structure (no markdown, just JSON):
{
  "description": "Brief description of what they do",
  "pricing": [{"tier": "Free", "price": "$0", "features": "Basic features"}, {"tier": "Pro", "price": "$X/mo", "features": "Premium features"}],
  "keyFeatures": ["Feature 1", "Feature 2", "Feature 3"],
  "strengths": "Key strengths in 1-2 sentences",
  "weaknesses": "Key weaknesses in 1-2 sentences"
}`;

      const result = await runPerplexity(apiKeys.perplexity,
        'You are a competitive intelligence analyst. Respond only with valid JSON, no markdown formatting.',
        prompt
      );

      try {
        const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const data = JSON.parse(cleaned);
        onUpdate(competitor.id, {
          ...data,
          lastResearched: new Date().toISOString(),
          snapshots: [...(competitor.snapshots || []), { date: new Date().toISOString(), ...data }],
        });
      } catch {
        onUpdate(competitor.id, {
          description: result.slice(0, 500),
          lastResearched: new Date().toISOString(),
        });
      }
    } catch (err) {
      alert('Research failed: ' + err.message);
    } finally {
      setResearchingId(null);
    }
  };

  const handleAdd = (form) => {
    onAdd(form);
    setShowForm(false);
  };

  const filtered = competitors.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleExport = () => {
    let md = `# Competitor Analysis — ${businessName}\n\n`;
    competitors.forEach(c => {
      md += `## ${c.name}\n`;
      if (c.url) md += `- URL: ${c.url}\n`;
      if (c.description) md += `- ${c.description}\n`;
      if (c.pricing?.length) {
        md += `- Pricing:\n`;
        c.pricing.forEach(p => { md += `  - ${p.tier}: ${p.price} — ${p.features}\n`; });
      }
      if (c.keyFeatures?.length) md += `- Features: ${c.keyFeatures.join(', ')}\n`;
      if (c.strengths) md += `- Strengths: ${c.strengths}\n`;
      if (c.weaknesses) md += `- Weaknesses: ${c.weaknesses}\n`;
      md += '\n';
    });
    navigator.clipboard.writeText(md);
    alert('Competitor analysis copied to clipboard!');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Competitors</h2>
          <p className="text-sm text-[#94a3b8]">Track and analyze your competition</p>
        </div>
        <div className="flex gap-2">
          {competitors.length > 0 && (
            <button onClick={handleExport} className="btn-secondary text-sm flex items-center gap-1.5">
              <Download className="w-3.5 h-3.5" /> Export
            </button>
          )}
          <button onClick={() => setShowForm(true)} className="btn-primary text-sm flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Add Competitor
          </button>
        </div>
      </div>

      {/* Search */}
      {competitors.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748b]" />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search competitors..."
            className="w-full pl-10 pr-3 py-2.5 rounded-lg text-sm text-white placeholder-[#64748b] focus:outline-none focus:ring-1 focus:ring-[#06b6d4]"
            style={{ background: '#111d2e', border: '1px solid rgba(6,182,212,0.12)' }}
          />
        </div>
      )}

      {/* Add form */}
      {showForm && <CompetitorForm onAdd={handleAdd} onCancel={() => setShowForm(false)} />}

      {/* Grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map(c => (
            <CompetitorCard
              key={c.id}
              competitor={c}
              onDelete={onDelete}
              onResearch={handleResearch}
              isResearching={researchingId === c.id}
            />
          ))}
        </div>
      ) : !showForm && (
        <div className="card p-12 text-center">
          <Eye className="w-10 h-10 text-[#64748b] mx-auto mb-3" />
          <p className="text-[#94a3b8] mb-2">No competitors tracked yet</p>
          <p className="text-sm text-[#64748b] mb-4">Add your competitors to track their pricing, features, and changes over time.</p>
          <button onClick={() => setShowForm(true)} className="btn-primary text-sm">
            Add Your First Competitor
          </button>
        </div>
      )}

      {/* Comparison matrix */}
      {competitors.length >= 2 && (
        <ComparisonMatrix competitors={competitors} businessName={businessName} />
      )}
    </div>
  );
}
