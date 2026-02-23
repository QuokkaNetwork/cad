import EmsPatientWorkflowPage from './EmsPatientWorkflowPage';

export default function EmsTransportTracker() {
  return (
    <EmsPatientWorkflowPage
      mode="transport"
      title="Hospital Transport Tracker"
      subtitle="Focused EMS workflow for destination, ETA, transport status, and handover updates."
    />
  );
}
