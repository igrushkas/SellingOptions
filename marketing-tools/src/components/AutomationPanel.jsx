import { useState } from 'react';
import { Zap, Play, CheckCircle2, AlertCircle, ExternalLink, Clock } from 'lucide-react';
import { triggerWebhook, testWebhook } from '../services/n8nService';

const RECIPES = [
  {
    id: 'social-auto-post',
    name: 'Social Auto-Post',
    description: 'AI generates a post → n8n publishes to LinkedIn/X',
    trigger: 'Button',
    icon: '📱',
    webhookPath: '/social-post',
  },
  {
    id: 'email-welcome',
    name: 'Email Welcome Sequence',
    description: 'New signup triggers welcome email series via n8n',
    trigger: 'Webhook',
    icon: '✉️',
    webhookPath: '/email-welcome',
  },
  {
    id: 'lead-capture',
    name: 'Lead Capture Pipeline',
    description: 'Form submission → Firestore + email notification',
    trigger: 'Webhook',
    icon: '🎯',
    webhookPath: '/lead-capture',
  },
  {
    id: 'weekly-content',
    name: 'Weekly Content Ideas',
    description: 'Every Monday → AI generates content ideas for the week',
    trigger: 'Schedule',
    icon: '📝',
    webhookPath: '/weekly-content',
  },
  {
    id: 'seo-report',
    name: 'SEO Report',
    description: 'Weekly → check rankings and generate report',
    trigger: 'Schedule',
    icon: '📊',
    webhookPath: '/seo-report',
  },
  {
    id: 'video-pipeline',
    name: 'Video Pipeline',
    description: 'Script → video generation → upload to YouTube',
    trigger: 'Button',
    icon: '🎬',
    webhookPath: '/video-pipeline',
  },
  {
    id: 'competitor-watch',
    name: 'Competitor Watch',
    description: 'Weekly → AI researches competitor changes → alerts',
    trigger: 'Schedule',
    icon: '👁️',
    webhookPath: '/competitor-watch',
  },
];

export default function AutomationPanel({ webhookBaseUrl, businessContext }) {
  const [statuses, setStatuses] = useState({});

  const handleTrigger = async (recipe) => {
    if (!webhookBaseUrl) {
      alert('Please add your n8n webhook base URL in Settings first.');
      return;
    }

    setStatuses(prev => ({ ...prev, [recipe.id]: 'running' }));
    try {
      const url = webhookBaseUrl.replace(/\/+$/, '') + recipe.webhookPath;
      await triggerWebhook(url, {
        recipe: recipe.id,
        business: businessContext,
        timestamp: new Date().toISOString(),
      });
      setStatuses(prev => ({ ...prev, [recipe.id]: 'success' }));
      setTimeout(() => setStatuses(prev => ({ ...prev, [recipe.id]: null })), 3000);
    } catch {
      setStatuses(prev => ({ ...prev, [recipe.id]: 'error' }));
      setTimeout(() => setStatuses(prev => ({ ...prev, [recipe.id]: null })), 3000);
    }
  };

  const handleTest = async () => {
    if (!webhookBaseUrl) {
      alert('Please add your n8n webhook base URL in Settings first.');
      return;
    }
    try {
      await testWebhook(webhookBaseUrl);
      alert('Webhook is reachable!');
    } catch (err) {
      alert('Webhook test failed: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Automation</h2>
          <p className="text-sm text-[#94a3b8]">Trigger n8n workflows to automate your marketing</p>
        </div>
        <button onClick={handleTest} className="btn-secondary text-sm flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5" /> Test Connection
        </button>
      </div>

      {!webhookBaseUrl && (
        <div className="card p-4 flex items-start gap-3" style={{ borderColor: 'rgba(245,158,11,0.3)' }}>
          <AlertCircle className="w-5 h-5 text-[#f59e0b] shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-[#f59e0b] font-medium">n8n webhook URL not configured</p>
            <p className="text-xs text-[#94a3b8] mt-1">Go to Settings and add your n8n webhook base URL to enable automation recipes.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {RECIPES.map((recipe) => {
          const status = statuses[recipe.id];
          return (
            <div key={recipe.id} className="card p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{recipe.icon}</span>
                  <div>
                    <h3 className="font-medium text-white">{recipe.name}</h3>
                    <p className="text-xs text-[#94a3b8] mt-0.5">{recipe.description}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between mt-4">
                <span className="text-xs px-2 py-0.5 rounded-full text-[#64748b]"
                      style={{ background: '#0d1f2d', border: '1px solid rgba(6,182,212,0.12)' }}>
                  {recipe.trigger === 'Button' && <><Play className="w-3 h-3 inline mr-1" />Manual</>}
                  {recipe.trigger === 'Webhook' && <><Zap className="w-3 h-3 inline mr-1" />Webhook</>}
                  {recipe.trigger === 'Schedule' && <><Clock className="w-3 h-3 inline mr-1" />Scheduled</>}
                </span>

                <button
                  onClick={() => handleTrigger(recipe)}
                  disabled={!webhookBaseUrl || status === 'running'}
                  className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {status === 'running' && <><Zap className="w-3 h-3 animate-pulse" /> Running...</>}
                  {status === 'success' && <><CheckCircle2 className="w-3 h-3" /> Done!</>}
                  {status === 'error' && <><AlertCircle className="w-3 h-3" /> Failed</>}
                  {!status && <><Play className="w-3 h-3" /> Trigger</>}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
          <ExternalLink className="w-4 h-4 text-[#06b6d4]" />
          Setting Up n8n Workflows
        </h3>
        <ol className="text-sm text-[#94a3b8] space-y-1.5 list-decimal list-inside">
          <li>Create workflows in your n8n instance for each recipe</li>
          <li>Add a Webhook trigger node to each workflow</li>
          <li>Copy the base webhook URL and paste it in Settings</li>
          <li>Each recipe appends its path (e.g., /social-post) to your base URL</li>
          <li>Click &quot;Test Connection&quot; to verify the setup works</li>
        </ol>
      </div>
    </div>
  );
}
