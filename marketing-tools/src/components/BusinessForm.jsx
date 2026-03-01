import { useState, useEffect } from 'react';
import { Building2, X } from 'lucide-react';

export default function BusinessForm({ business, onSave, onCancel, isNew }) {
  const [form, setForm] = useState({
    name: '',
    url: '',
    description: '',
    audience: '',
    goals: '',
  });

  useEffect(() => {
    if (business) {
      setForm({
        name: business.name || '',
        url: business.url || '',
        description: business.description || '',
        audience: business.audience || '',
        goals: business.goals || '',
      });
    }
  }, [business]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSave(form);
  };

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Building2 className="w-5 h-5 text-[#06b6d4]" />
          <h2 className="text-lg font-semibold text-white">
            {isNew ? 'Add New Business' : 'Edit Business'}
          </h2>
        </div>
        {onCancel && (
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-white/5 text-[#94a3b8]">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-[#94a3b8] mb-1.5">Business Name *</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder="e.g. AI Answer Now"
            className="w-full px-3 py-2.5 rounded-lg text-white placeholder-[#64748b] focus:outline-none focus:ring-1 focus:ring-[#06b6d4]"
            style={{ background: '#0d1f2d', border: '1px solid rgba(6,182,212,0.12)' }}
            required
          />
        </div>

        <div>
          <label className="block text-sm text-[#94a3b8] mb-1.5">Website URL</label>
          <input
            type="url"
            value={form.url}
            onChange={(e) => update('url', e.target.value)}
            placeholder="https://example.com"
            className="w-full px-3 py-2.5 rounded-lg text-white placeholder-[#64748b] focus:outline-none focus:ring-1 focus:ring-[#06b6d4]"
            style={{ background: '#0d1f2d', border: '1px solid rgba(6,182,212,0.12)' }}
          />
        </div>

        <div>
          <label className="block text-sm text-[#94a3b8] mb-1.5">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            placeholder="What does your business do? What problem does it solve?"
            rows={3}
            className="w-full px-3 py-2.5 rounded-lg text-white placeholder-[#64748b] focus:outline-none focus:ring-1 focus:ring-[#06b6d4] resize-none"
            style={{ background: '#0d1f2d', border: '1px solid rgba(6,182,212,0.12)' }}
          />
        </div>

        <div>
          <label className="block text-sm text-[#94a3b8] mb-1.5">Target Audience</label>
          <input
            type="text"
            value={form.audience}
            onChange={(e) => update('audience', e.target.value)}
            placeholder="e.g. Students, professionals, small business owners"
            className="w-full px-3 py-2.5 rounded-lg text-white placeholder-[#64748b] focus:outline-none focus:ring-1 focus:ring-[#06b6d4]"
            style={{ background: '#0d1f2d', border: '1px solid rgba(6,182,212,0.12)' }}
          />
        </div>

        <div>
          <label className="block text-sm text-[#94a3b8] mb-1.5">Business Goals</label>
          <input
            type="text"
            value={form.goals}
            onChange={(e) => update('goals', e.target.value)}
            placeholder="e.g. Grow signups, increase revenue, brand awareness"
            className="w-full px-3 py-2.5 rounded-lg text-white placeholder-[#64748b] focus:outline-none focus:ring-1 focus:ring-[#06b6d4]"
            style={{ background: '#0d1f2d', border: '1px solid rgba(6,182,212,0.12)' }}
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" className="btn-primary flex-1">
            {isNew ? 'Add Business' : 'Save Changes'}
          </button>
          {onCancel && (
            <button type="button" onClick={onCancel} className="btn-secondary">
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
