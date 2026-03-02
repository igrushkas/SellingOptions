import { useState } from 'react';
import {
  LayoutDashboard,
  Sparkles,
  Binoculars,
  Zap,
  Video,
  Settings,
  HelpCircle,
  LogOut,
  Megaphone,
} from 'lucide-react';

const navSections = [
  {
    label: 'MAIN',
    items: [
      { key: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
      { key: 'skills', name: 'Marketing Skills', icon: Sparkles },
    ],
  },
  {
    label: 'TOOLS',
    items: [
      { key: 'competitors', name: 'Competitors', icon: Binoculars },
      { key: 'automation', name: 'Automation', icon: Zap },
      { key: 'video', name: 'Video Studio', icon: Video },
    ],
  },
  {
    label: 'SUPPORT',
    items: [
      { key: 'settings', name: 'Settings', icon: Settings },
      { key: 'help', name: 'Help', icon: HelpCircle },
    ],
  },
];

export default function Sidebar({ activePage, onNavigate, user, onSignOut }) {
  return (
    <aside
      className="w-64 shrink-0 h-screen flex flex-col bg-sidebar overflow-y-auto"
      style={{ borderRight: '1px solid rgba(6,182,212,0.12)' }}
    >
      {/* ── Logo ── */}
      <div className="flex items-center gap-3 px-5 py-5">
        <div
          className="flex items-center justify-center w-9 h-9 rounded-lg"
          style={{ background: 'linear-gradient(135deg, #0891b2, #06b6d4)' }}
        >
          <Megaphone size={18} className="text-white" />
        </div>
        <span className="text-text font-semibold text-base tracking-tight">
          Marketing Tools
        </span>
      </div>

      {/* ── Navigation sections ── */}
      <nav className="flex-1 px-3 mt-2 space-y-6">
        {navSections.map((section) => (
          <div key={section.label}>
            <p className="section-label px-3 mb-2">{section.label}</p>

            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = activePage === item.key;
                const Icon = item.icon;

                return (
                  <li key={item.key}>
                    <button
                      onClick={() => onNavigate(item.key)}
                      className={`
                        flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium
                        transition-colors duration-150 cursor-pointer
                        ${
                          isActive
                            ? 'sidebar-active text-accent'
                            : 'text-text-secondary hover:bg-[rgba(6,182,212,0.05)] hover:text-text'
                        }
                      `}
                    >
                      <Icon size={18} strokeWidth={isActive ? 2 : 1.5} />
                      <span>{item.name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* ── User footer ── */}
      <div
        className="mt-auto px-4 py-4"
        style={{ borderTop: '1px solid rgba(6,182,212,0.12)' }}
      >
        <div className="flex items-center gap-3">
          {user?.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName || 'User'}
              className="w-8 h-8 rounded-full object-cover ring-2 ring-accent/20"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent text-xs font-bold">
              {(user?.displayName || user?.email || '?').charAt(0).toUpperCase()}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text truncate">
              {user?.displayName || 'User'}
            </p>
            <p className="text-xs text-text-muted truncate">
              {user?.email || ''}
            </p>
          </div>

          <button
            onClick={onSignOut}
            title="Sign out"
            className="p-1.5 rounded-md text-text-muted hover:text-rose hover:bg-rose/10 transition-colors cursor-pointer"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
