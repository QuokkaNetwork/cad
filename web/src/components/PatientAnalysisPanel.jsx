import usePatientAnalysis from './ems/usePatientAnalysis';
import PatientStatusBar from './ems/PatientStatusBar';
import EmsTabShell from './ems/EmsTabShell';

export default function PatientAnalysisPanel({ person, activeDepartmentId, mode = 'full' }) {
  const analysis = usePatientAnalysis(person, activeDepartmentId);

  return (
    <div className="space-y-4">
      <PatientStatusBar
        person={person}
        draft={analysis.draft}
        selectedAnalysisId={analysis.selectedAnalysisId}
        saving={analysis.saving}
        onSave={analysis.saveAnalysis}
        mode={mode}
      />

      {analysis.error && (
        <div className="px-3 py-2 rounded-lg border border-red-500/40 bg-red-500/10 text-red-200 text-sm">
          {analysis.error}
        </div>
      )}
      {analysis.message && (
        <div className="px-3 py-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-200 text-sm">
          {analysis.message}
        </div>
      )}

      <EmsTabShell mode={mode} analysis={analysis} />
    </div>
  );
}
