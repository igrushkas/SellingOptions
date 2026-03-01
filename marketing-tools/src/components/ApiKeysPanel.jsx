import { useState, useEffect } from 'react';
import { Key, Eye, EyeOff, Save, CheckCircle2 } from 'lucide-react';

const KEY_FIELDS = [
  { id: 'openai', label: 'OpenAI API Key', placeholder: 'sk-...', description: 'Powers 18 marketing skills (copywriting, CRO, strategy)' },
  { id: 'perplexity', label: 'Perplexity API Key', placeholder: 'pplx-...', description: 'Powers SEO, competitor analysis, and research skills' },
  { id: 'gemini', label: 'Google Gemini API Key', placeholder: 'AI...', description: 'Powers video generation and image content' },
  { id: 'n8nWebhook', label: 'n8n Webhook Base URL', placeholder: 'https://your-n8n.com/webhook/...', description: 'Triggers automation workflows' },
];

export default function ApiKeysPanel({ apiKeys, onSave }) {
  const [keys, setKeys] = useState({});
  const [showKeys, setShowKeys] = useState({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setKeys(apiKeys || {});
  }, [apiKeys]);

  const handleSave = () => {
    onSave(keys);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const update = (id, value) => setKeys(prev => ({ ...prev, [id]: value }));
  const toggle = (id) => setShowKeys(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <Key className="w-5 h-5 text-[#06b6d4]" />
        <h2 className="text-lg font-semibold text-white">API Keys</h2>
      </div>
      <p className="text-sm text-[#94a3b8] -mt-4">
        Keys are stored securely in your Firebase account. They are never shared or sent to our servers.
      </p>

      <div className="space-y-4">
        {KEY_FIELDS.map((field) => (
          <div key={field.id} className="card p-4">
            <label className="block text-sm font-medium text-white mb-1">{field.label}</label>
            <p className="text-xs text-[#64748b] mb-2">{field.description}</p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showKeys[field.id] ? 'text' : 'password'}
                  value={keys[field.id] || ''}
                  onChange={(e) => update(field.id, e.target.value)}
                  placeholder={field.placeholder}
                  className="w-full px-3 py-2 pr-10 rounded-lg text-sm text-white placeholder-[#64748b] focus:outline-none focus:ring-1 focus:ring-[#06b6d4]"
                  style={{ background: '#0d1f2d', border: '1px solid rgba(6,182,212,0.12)' }}
                />
                <button
                  onClick={() => toggle(field.id)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#64748b] hover:text-[#94a3b8]"
                >
                  {showKeys[field.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {keys[field.id] && (
                <CheckCircle2 className="w-5 h-5 text-[#10b981] mt-2 shrink-0" />
              )}
            </div>
          </div>
        ))}
      </div>

      <button onClick={handleSave} className="btn-primary flex items-center gap-2">
        {saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
        {saved ? 'Saved!' : 'Save API Keys'}
      </button>
    </div>
  );
}
