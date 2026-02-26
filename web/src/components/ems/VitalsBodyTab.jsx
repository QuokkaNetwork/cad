import VitalCard from './VitalCard';
import BodyDiagramSvg from './BodyDiagramSvg';

const VITAL_FIELDS = [
  { key: 'pulse', label: 'Pulse', unit: 'bpm', placeholder: 'Pulse (bpm)', normalRange: { min: 60, max: 100 } },
  { key: 'blood_pressure', label: 'Blood Pressure', unit: 'mmHg', placeholder: 'Blood Pressure (mmHg)', normalRange: null },
  { key: 'respiratory_rate', label: 'Respiratory Rate', unit: '/min', placeholder: 'Resp Rate', normalRange: { min: 12, max: 20 } },
  { key: 'spo2', label: 'SpO2', unit: '%', placeholder: 'SpO2 (%)', normalRange: { min: 94, max: 100, warnMin: 94, warnMax: 97 } },
  { key: 'temperature', label: 'Temperature', unit: '\u00B0C', placeholder: 'Temp (\u00B0C)', normalRange: { min: 35, max: 38.5 } },
  { key: 'glucose', label: 'Glucose', unit: 'mmol/L', placeholder: 'Glucose (mmol/L)', normalRange: { min: 4, max: 10 } },
];

export default function VitalsBodyTab({ draft, updateVitals, addBodyMark, removeBodyMark, clearAllBodyMarks }) {
  return (
    <div className="space-y-4">
      <div className="bg-cad-surface border border-cad-border rounded-lg p-4 space-y-3">
        <h4 className="text-sm font-semibold text-cad-muted uppercase tracking-wider">Vitals</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {VITAL_FIELDS.map((field) => (
            <VitalCard
              key={field.key}
              label={field.label}
              value={draft.vitals?.[field.key] || ''}
              unit={field.unit}
              placeholder={field.placeholder}
              onChange={(val) => updateVitals(field.key, val)}
              normalRange={field.normalRange}
            />
          ))}
        </div>
      </div>

      <BodyDiagramSvg
        marks={draft.body_marks}
        onAddMark={addBodyMark}
        onRemoveMark={removeBodyMark}
        onClearAll={clearAllBodyMarks}
      />
    </div>
  );
}
