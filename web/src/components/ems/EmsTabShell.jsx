import { useState, useMemo } from 'react';
import AssessmentTab from './AssessmentTab';
import VitalsBodyTab from './VitalsBodyTab';
import TreatmentLogTab from './TreatmentLogTab';
import TransportTab from './TransportTab';
import HistoryTab from './HistoryTab';

const ALL_TABS = [
  { key: 'assessment', label: 'Assessment' },
  { key: 'vitals', label: 'Vitals & Body' },
  { key: 'treatment', label: 'Treatment Log' },
  { key: 'transport', label: 'Transport & MCI' },
  { key: 'history', label: 'History' },
];

function getVisibleTabs(mode) {
  const m = String(mode || 'full').trim().toLowerCase();
  if (m === 'treatment') return ALL_TABS.filter((t) => t.key !== 'transport');
  if (m === 'transport') return ALL_TABS.filter((t) => t.key === 'transport' || t.key === 'history');
  return ALL_TABS;
}

export default function EmsTabShell({ mode, analysis }) {
  const visibleTabs = useMemo(() => getVisibleTabs(mode), [mode]);
  const [activeTab, setActiveTab] = useState(visibleTabs[0]?.key || 'assessment');

  const resolvedTab = visibleTabs.find((t) => t.key === activeTab) ? activeTab : visibleTabs[0]?.key || 'assessment';

  const treatmentCount = Array.isArray(analysis.draft.treatment_log) ? analysis.draft.treatment_log.length : 0;

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex rounded-lg border border-cad-border overflow-hidden bg-cad-card">
        {visibleTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors relative ${
              resolvedTab === tab.key
                ? 'bg-cad-accent text-white'
                : 'text-cad-muted hover:text-cad-ink hover:bg-cad-surface/50'
            }`}
          >
            {tab.label}
            {tab.key === 'treatment' && treatmentCount > 0 && (
              <span className={`ml-1.5 px-1.5 py-0.5 rounded text-[11px] font-bold ${
                resolvedTab === 'treatment' ? 'bg-white/20 text-white' : 'bg-cad-accent/20 text-cad-accent-light'
              }`}>
                {treatmentCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {resolvedTab === 'assessment' && (
        <AssessmentTab
          draft={analysis.draft}
          setDraftField={analysis.setDraftField}
          updateQuestionnaire={analysis.updateQuestionnaire}
        />
      )}
      {resolvedTab === 'vitals' && (
        <VitalsBodyTab
          draft={analysis.draft}
          updateVitals={analysis.updateVitals}
          addBodyMark={analysis.addBodyMark}
          removeBodyMark={analysis.removeBodyMark}
          clearAllBodyMarks={analysis.clearAllBodyMarks}
        />
      )}
      {resolvedTab === 'treatment' && (
        <TreatmentLogTab
          draft={analysis.draft}
          addTreatmentLogItem={analysis.addTreatmentLogItem}
          updateTreatmentLogItem={analysis.updateTreatmentLogItem}
          removeTreatmentLogItem={analysis.removeTreatmentLogItem}
        />
      )}
      {resolvedTab === 'transport' && (
        <TransportTab
          draft={analysis.draft}
          setDraftField={analysis.setDraftField}
          updateTransport={analysis.updateTransport}
          mode={mode}
        />
      )}
      {resolvedTab === 'history' && (
        <HistoryTab
          history={analysis.history}
          selectedAnalysisId={analysis.selectedAnalysisId}
          loading={analysis.loading}
          loadHistoryItem={analysis.loadHistoryItem}
          startNewAnalysis={analysis.startNewAnalysis}
        />
      )}
    </div>
  );
}
