import { useState, useRef, useEffect } from 'react';
import {
  Search,
  ChevronDown,
  Building2,
  Plus,
  Globe,
} from 'lucide-react';

export default function TopBar({
  user,
  activeBusiness,
  businesses = [],
  onSwitchBusiness,
  onAddBusiness,
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  return (
    <header
      className="h-16 flex items-center gap-4 px-6"
      style={{ borderBottom: '1px solid rgba(6,182,212,0.08)' }}
    >
      {/* ── Left: Welcome message ── */}
      <div className="flex-shrink-0">
        <h1 className="text-lg font-semibold text-text">
          Welcome{user?.displayName ? `, ${user.displayName.split(' ')[0]}` : ''}
        </h1>
      </div>

      {/* ── Center: Search ── */}
      <div className="flex-1 max-w-md mx-auto">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
          />
          <input
            type="text"
            placeholder="Search skills, competitors..."
            className="w-full h-9 pl-9 pr-4 rounded-lg bg-card text-sm text-text placeholder-text-muted
                       outline-none transition-colors duration-150
                       border border-border focus:border-accent/40 focus:ring-1 focus:ring-accent/20"
          />
        </div>
      </div>

      {/* ── Right: Business switcher + avatar ── */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {/* Business switcher */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen((prev) => !prev)}
            className="flex items-center gap-2 h-9 px-3 rounded-lg text-sm font-medium
                       bg-card border border-border text-text-secondary
                       hover:border-border-hover hover:text-text transition-colors cursor-pointer"
          >
            <Building2 size={15} className="text-accent" />
            <span className="max-w-[140px] truncate">
              {activeBusiness?.name || 'Select Business'}
            </span>
            <ChevronDown
              size={14}
              className={`text-text-muted transition-transform duration-200 ${
                dropdownOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {dropdownOpen && (
            <div
              className="absolute right-0 top-full mt-1.5 w-60 rounded-xl bg-card border border-border
                         shadow-lg shadow-black/30 py-1.5 z-50"
            >
              {businesses.length > 0 ? (
                businesses.map((biz) => {
                  const isActive = activeBusiness?.name === biz.name;
                  return (
                    <button
                      key={biz.id || biz.name}
                      onClick={() => {
                        onSwitchBusiness(biz.id || biz.name);
                        setDropdownOpen(false);
                      }}
                      className={`
                        flex items-center gap-3 w-full px-3.5 py-2.5 text-sm text-left
                        transition-colors cursor-pointer
                        ${
                          isActive
                            ? 'text-accent bg-accent/10'
                            : 'text-text-secondary hover:bg-[rgba(6,182,212,0.05)] hover:text-text'
                        }
                      `}
                    >
                      <Globe size={14} className={isActive ? 'text-accent' : 'text-text-muted'} />
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-medium">{biz.name}</p>
                        {biz.url && (
                          <p className="text-xs text-text-muted truncate">{biz.url}</p>
                        )}
                      </div>
                    </button>
                  );
                })
              ) : (
                <p className="px-3.5 py-2 text-xs text-text-muted">No businesses yet</p>
              )}

              {/* Divider */}
              <div className="my-1.5 border-t border-border" />

              <button
                onClick={() => {
                  onAddBusiness();
                  setDropdownOpen(false);
                }}
                className="flex items-center gap-3 w-full px-3.5 py-2.5 text-sm text-accent
                           hover:bg-accent/10 transition-colors cursor-pointer"
              >
                <Plus size={14} />
                <span className="font-medium">Add Business</span>
              </button>
            </div>
          )}
        </div>

        {/* User avatar */}
        {user?.photoURL ? (
          <img
            src={user.photoURL}
            alt={user.displayName || 'User'}
            className="w-8 h-8 rounded-full object-cover ring-2 ring-accent/20"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent text-xs font-bold">
            {(user?.displayName || '?').charAt(0).toUpperCase()}
          </div>
        )}
      </div>
    </header>
  );
}
