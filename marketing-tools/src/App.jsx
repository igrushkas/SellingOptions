import { useState, useEffect } from 'react';
import { onAuthChange, signOutUser } from './services/authService';
import {
  saveApiKeys, getApiKeys,
  subscribeBusinesses, addBusiness, updateBusiness, deleteBusiness,
  saveSkillOutput, getAllSkillOutputs,
  subscribeCompetitors, addCompetitor, updateCompetitor, deleteCompetitor,
} from './services/firestoreService';

import LoginPage from './components/LoginPage';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import BusinessForm from './components/BusinessForm';
import ProgressTracker from './components/ProgressTracker';
import ApiKeysPanel from './components/ApiKeysPanel';
import SkillsGrid from './components/SkillsGrid';
import SkillWorkspace from './components/SkillWorkspace';
import CompetitorMonitor from './components/CompetitorMonitor';
import AutomationPanel from './components/AutomationPanel';
import VideoGenerator from './components/VideoGenerator';
import skills from './data/marketingSkills';

export default function App() {
  // Auth
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Navigation
  const [activePage, setActivePage] = useState('dashboard');
  const [selectedSkill, setSelectedSkill] = useState(null);

  // Data
  const [apiKeys, setApiKeys] = useState({});
  const [businesses, setBusinesses] = useState([]);
  const [activeBizId, setActiveBizId] = useState(null);
  const [skillOutputs, setSkillOutputs] = useState({});
  const [competitors, setCompetitors] = useState([]);

  // UI
  const [showBusinessForm, setShowBusinessForm] = useState(false);
  const [editingBusiness, setEditingBusiness] = useState(false);

  // Auth listener
  useEffect(() => {
    return onAuthChange((u) => {
      setUser(u);
      setAuthLoading(false);
    });
  }, []);

  // Load API keys
  useEffect(() => {
    if (!user) return;
    getApiKeys(user.uid).then(setApiKeys);
  }, [user]);

  // Subscribe businesses
  useEffect(() => {
    if (!user) return;
    return subscribeBusinesses(user.uid, (biz) => {
      setBusinesses(biz);
      if (biz.length > 0 && !activeBizId) {
        setActiveBizId(biz[0].id);
      }
    });
  }, [user]);

  // Load skill outputs for active business
  useEffect(() => {
    if (!user || !activeBizId) return;
    getAllSkillOutputs(user.uid, activeBizId).then(setSkillOutputs);
  }, [user, activeBizId]);

  // Subscribe competitors for active business
  useEffect(() => {
    if (!user || !activeBizId) return;
    return subscribeCompetitors(user.uid, activeBizId, setCompetitors);
  }, [user, activeBizId]);

  // Derived
  const activeBiz = businesses.find(b => b.id === activeBizId);
  const completedSkills = activeBiz?.completedSkills || [];
  const businessContext = activeBiz ? {
    name: activeBiz.name,
    url: activeBiz.url,
    description: activeBiz.description,
    audience: activeBiz.audience,
    goals: activeBiz.goals,
  } : null;

  // Handlers
  const handleSaveApiKeys = async (keys) => {
    if (!user) return;
    await saveApiKeys(user.uid, keys);
    setApiKeys(keys);
  };

  const handleAddBusiness = async (data) => {
    if (!user) return;
    const id = await addBusiness(user.uid, data);
    setActiveBizId(id);
    setShowBusinessForm(false);
  };

  const handleUpdateBusiness = async (data) => {
    if (!user || !activeBizId) return;
    await updateBusiness(user.uid, activeBizId, data);
    setEditingBusiness(false);
  };

  const handleDeleteBusiness = async (bizId) => {
    if (!user) return;
    if (!confirm('Delete this business and all its data?')) return;
    await deleteBusiness(user.uid, bizId);
    if (activeBizId === bizId) {
      setActiveBizId(businesses.find(b => b.id !== bizId)?.id || null);
    }
  };

  const handleSaveSkillOutput = async (skillId, output) => {
    if (!user || !activeBizId) return;
    await saveSkillOutput(user.uid, activeBizId, skillId, output);
    setSkillOutputs(prev => ({ ...prev, [skillId]: { output } }));
    // Mark as completed
    const updated = [...new Set([...completedSkills, skillId])];
    await updateBusiness(user.uid, activeBizId, { completedSkills: updated });
  };

  const handleSelectSkill = (skill) => {
    setSelectedSkill(skill);
    setActivePage('skills');
  };

  const handleSelectRelated = (skillId) => {
    const skill = skills.find(s => s.id === skillId);
    if (skill) setSelectedSkill(skill);
  };

  const handleSignOut = async () => {
    await signOutUser();
    setUser(null);
    setBusinesses([]);
    setApiKeys({});
  };

  // Loading
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a1628' }}>
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#06b6d4] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-[#94a3b8] text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return <LoginPage />;
  }

  // KPI data for dashboard
  const kpis = [
    { label: 'Skills Completed', value: completedSkills.length, total: skills.length, color: '#06b6d4' },
    { label: 'Businesses', value: businesses.length, color: '#8b5cf6' },
    { label: 'Competitors', value: competitors.length, color: '#f59e0b' },
    { label: 'Progress', value: `${Math.round((completedSkills.length / skills.length) * 100)}%`, color: '#10b981' },
  ];

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#0a1628' }}>
      {/* Sidebar */}
      <Sidebar
        activePage={activePage}
        onNavigate={(page) => { setActivePage(page); setSelectedSkill(null); }}
        user={user}
        onSignOut={handleSignOut}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden ml-64">
        <TopBar
          user={user}
          activeBusiness={activeBiz}
          businesses={businesses}
          onSwitchBusiness={setActiveBizId}
          onAddBusiness={() => setShowBusinessForm(true)}
        />

        <main className="flex-1 overflow-y-auto p-6">
          {/* Dashboard */}
          {activePage === 'dashboard' && (
            <div className="space-y-6 max-w-6xl">
              {/* Welcome banner */}
              <div className="banner-gradient p-6 flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-white">
                    Welcome back, {user.displayName?.split(' ')[0] || 'there'}
                  </h1>
                  <p className="text-white/70 mt-1">
                    {activeBiz
                      ? `Working on ${activeBiz.name} — ${completedSkills.length}/${skills.length} skills completed`
                      : 'Add a business to get started with your 7-day growth plan'}
                  </p>
                </div>
              </div>

              {/* KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {kpis.map(kpi => (
                  <div key={kpi.label} className="card p-4">
                    <p className="text-xs text-[#64748b] uppercase tracking-wider">{kpi.label}</p>
                    <p className="text-2xl font-bold mt-1" style={{ color: kpi.color }}>
                      {kpi.value}{kpi.total ? <span className="text-sm text-[#64748b] font-normal">/{kpi.total}</span> : ''}
                    </p>
                  </div>
                ))}
              </div>

              {/* Business form */}
              {showBusinessForm && (
                <BusinessForm
                  isNew
                  onSave={handleAddBusiness}
                  onCancel={() => setShowBusinessForm(false)}
                />
              )}

              {/* No business yet */}
              {businesses.length === 0 && !showBusinessForm && (
                <div className="card p-8 text-center">
                  <p className="text-[#94a3b8] mb-4">Add your first business to start the 7-day growth plan</p>
                  <button onClick={() => setShowBusinessForm(true)} className="btn-primary">
                    Add Business
                  </button>
                </div>
              )}

              {/* Active business edit */}
              {activeBiz && editingBusiness && (
                <BusinessForm
                  business={activeBiz}
                  onSave={handleUpdateBusiness}
                  onCancel={() => setEditingBusiness(false)}
                />
              )}

              {activeBiz && !editingBusiness && (
                <div className="card p-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-white">{activeBiz.name}</h3>
                    <p className="text-sm text-[#94a3b8]">{activeBiz.url || 'No URL set'}</p>
                  </div>
                  <button onClick={() => setEditingBusiness(true)} className="btn-secondary text-sm">
                    Edit
                  </button>
                </div>
              )}

              {/* Progress tracker */}
              {activeBiz && <ProgressTracker completedSkills={completedSkills} />}
            </div>
          )}

          {/* Skills */}
          {activePage === 'skills' && !selectedSkill && (
            <SkillsGrid
              onSelectSkill={handleSelectSkill}
              completedSkills={completedSkills}
            />
          )}

          {activePage === 'skills' && selectedSkill && (
            <SkillWorkspace
              skill={selectedSkill}
              businessContext={businessContext}
              apiKeys={apiKeys}
              savedOutput={skillOutputs[selectedSkill.id]?.output || null}
              onSave={handleSaveSkillOutput}
              onBack={() => setSelectedSkill(null)}
              onSelectRelated={handleSelectRelated}
              allSkills={skills}
            />
          )}

          {/* Competitors */}
          {activePage === 'competitors' && activeBiz && (
            <CompetitorMonitor
              competitors={competitors}
              businessName={activeBiz.name}
              apiKeys={apiKeys}
              onAdd={(data) => addCompetitor(user.uid, activeBizId, data)}
              onUpdate={(id, data) => updateCompetitor(user.uid, activeBizId, id, data)}
              onDelete={(id) => {
                if (confirm('Delete this competitor?')) {
                  deleteCompetitor(user.uid, activeBizId, id);
                }
              }}
            />
          )}

          {activePage === 'competitors' && !activeBiz && (
            <div className="card p-8 text-center">
              <p className="text-[#94a3b8]">Add a business first to track competitors</p>
            </div>
          )}

          {/* Automation */}
          {activePage === 'automation' && (
            <AutomationPanel
              webhookBaseUrl={apiKeys?.n8nWebhook}
              businessContext={businessContext}
            />
          )}

          {/* Video */}
          {activePage === 'video' && (
            <VideoGenerator
              apiKeys={apiKeys}
              businessContext={businessContext}
            />
          )}

          {/* Settings */}
          {activePage === 'settings' && (
            <div className="max-w-2xl space-y-8">
              <ApiKeysPanel apiKeys={apiKeys} onSave={handleSaveApiKeys} />

              {/* Danger zone */}
              {businesses.length > 0 && (
                <div className="card p-5" style={{ borderColor: 'rgba(244,63,94,0.2)' }}>
                  <h3 className="text-sm font-semibold text-[#f43f5e] mb-3">Manage Businesses</h3>
                  <div className="space-y-2">
                    {businesses.map(biz => (
                      <div key={biz.id} className="flex items-center justify-between py-2" style={{ borderTop: '1px solid rgba(244,63,94,0.1)' }}>
                        <span className="text-sm text-[#94a3b8]">{biz.name}</span>
                        <button
                          onClick={() => handleDeleteBusiness(biz.id)}
                          className="text-xs text-[#f43f5e] hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Help */}
          {activePage === 'help' && (
            <div className="max-w-2xl space-y-6">
              <h2 className="text-xl font-bold text-white">Help & Guide</h2>
              <div className="card p-5 space-y-4">
                <h3 className="font-medium text-white">Getting Started</h3>
                <ol className="text-sm text-[#94a3b8] space-y-2 list-decimal list-inside">
                  <li>Add your business on the Dashboard (name, URL, description, audience, goals)</li>
                  <li>Go to Settings and add your API keys (OpenAI is required, others are optional)</li>
                  <li>Follow the 7-Day Growth Plan — start with Day 1 skills</li>
                  <li>Click any skill to run it against your business</li>
                  <li>Add competitors in the Competitors tab to track the competition</li>
                  <li>Set up n8n webhooks in Settings to enable automation recipes</li>
                </ol>
              </div>
              <div className="card p-5 space-y-3">
                <h3 className="font-medium text-white">AI Engines</h3>
                <div className="text-sm text-[#94a3b8] space-y-2">
                  <p><strong className="text-white">OpenAI (gpt-4o)</strong> — Powers 18 skills: copywriting, CRO, strategy, and more</p>
                  <p><strong className="text-white">Perplexity (sonar-pro)</strong> — Powers 6 skills: SEO, competitors, content strategy (includes real-time web search)</p>
                  <p><strong className="text-white">Gemini + Veo3</strong> — Powers video generation for social content</p>
                  <p><strong className="text-white">n8n</strong> — Workflow automation for social posting, emails, and monitoring</p>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
