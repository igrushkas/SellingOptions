import { CheckCircle2, Circle, Clock, TrendingUp } from 'lucide-react';
import skills from '../data/marketingSkills';

const WEEKLY_PLAN = [
  { day: '1', focus: 'Foundation', skillIds: ['seo-audit', 'analytics-tracking'] },
  { day: '2', focus: 'Landing Page', skillIds: ['page-cro', 'copywriting', 'schema-markup'] },
  { day: '3', focus: 'Sign-up & Content', skillIds: ['signup-flow-cro', 'content-strategy', 'product-marketing-context'] },
  { day: '4', focus: 'Distribution', skillIds: ['social-content', 'competitor-alternatives', 'programmatic-seo'] },
  { day: '5', focus: 'Growth', skillIds: ['free-tool-strategy', 'marketing-ideas', 'email-sequence'] },
  { day: '6', focus: 'Optimization', skillIds: ['ab-test-setup', 'form-cro', 'pricing-strategy', 'marketing-psychology'] },
  { day: '7', focus: 'Scale', skillIds: ['referral-program', 'launch-strategy', 'paid-ads'] },
];

export default function ProgressTracker({ completedSkills = [] }) {
  const totalSkills = skills.length;
  const completedCount = completedSkills.length;
  const progressPct = Math.round((completedCount / totalSkills) * 100);

  return (
    <div className="space-y-6">
      {/* Overall progress bar */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#06b6d4]" />
            <span className="text-sm font-medium text-white">7-Day Growth Plan</span>
          </div>
          <span className="text-sm text-[#94a3b8]">{completedCount}/{totalSkills} skills</span>
        </div>
        <div className="w-full h-2 rounded-full" style={{ background: '#0d1f2d' }}>
          <div
            className="h-2 rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%`, background: 'linear-gradient(90deg, #06b6d4, #10b981)' }}
          />
        </div>
        <p className="text-xs text-[#64748b] mt-2">{progressPct}% complete</p>
      </div>

      {/* Daily plan */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {WEEKLY_PLAN.map((day) => {
          const dayCompleted = day.skillIds.filter(id => completedSkills.includes(id)).length;
          const dayTotal = day.skillIds.length;
          const isDone = dayCompleted === dayTotal;
          const isPartial = dayCompleted > 0 && !isDone;

          return (
            <div key={day.day} className={`card p-4 ${isDone ? 'glow-emerald' : ''}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-[#64748b] uppercase">Day {day.day}</span>
                {isDone ? (
                  <CheckCircle2 className="w-4 h-4 text-[#10b981]" />
                ) : isPartial ? (
                  <Clock className="w-4 h-4 text-[#f59e0b]" />
                ) : (
                  <Circle className="w-4 h-4 text-[#64748b]" />
                )}
              </div>
              <h3 className="text-sm font-medium text-white mb-2">{day.focus}</h3>
              <div className="space-y-1">
                {day.skillIds.map(id => {
                  const skill = skills.find(s => s.id === id);
                  const done = completedSkills.includes(id);
                  return (
                    <div key={id} className="flex items-center gap-1.5">
                      {done ? (
                        <CheckCircle2 className="w-3 h-3 text-[#10b981] shrink-0" />
                      ) : (
                        <Circle className="w-3 h-3 text-[#64748b] shrink-0" />
                      )}
                      <span className={`text-xs ${done ? 'text-[#10b981]' : 'text-[#94a3b8]'}`}>
                        {skill?.name || id}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 text-xs text-[#64748b]">{dayCompleted}/{dayTotal}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
