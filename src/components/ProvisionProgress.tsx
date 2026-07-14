import Spacings from '@commercetools-uikit/spacings';
import Text from '@commercetools-uikit/text';
import LoadingSpinner from '@commercetools-uikit/loading-spinner';
import { CheckBoldIcon, CloseBoldIcon } from '@commercetools-uikit/icons';
import type { ProvStep } from '../lib/ctWrites';

function StatusIcon({ status }: { status: ProvStep['status'] }) {
  if (status === 'running') return <LoadingSpinner scale="s" />;
  if (status === 'done')
    return (
      <span style={{ color: '#0b8043', display: 'flex' }}>
        <CheckBoldIcon size="medium" />
      </span>
    );
  if (status === 'error')
    return (
      <span style={{ color: '#d21c1c', display: 'flex' }}>
        <CloseBoldIcon size="medium" />
      </span>
    );
  return (
    <span
      style={{
        width: 16,
        height: 16,
        borderRadius: '50%',
        border: '2px solid #d4d9e2',
        display: 'inline-block',
      }}
    />
  );
}

/**
 * The live provisioning checklist — the emotional peak of the demo. Each real write
 * against the shared project ticks over in real time.
 */
export default function ProvisionProgress({ steps }: { steps: ProvStep[] }) {
  return (
    <Spacings.Stack scale="s">
      {steps.map((step) => {
        const active = step.status === 'running';
        const done = step.status === 'done';
        return (
          <div
            key={step.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 14px',
              borderRadius: 8,
              border: '1px solid',
              borderColor: active ? '#7ea6ff' : done ? '#b3e0c4' : '#e3e7ee',
              background: active ? '#f2f6ff' : done ? '#f5fbf7' : '#fff',
              transition: 'all 160ms ease',
            }}
          >
            <div style={{ width: 24, display: 'flex', justifyContent: 'center' }}>
              <StatusIcon status={step.status} />
            </div>
            <div style={{ flex: 1 }}>
              <Text.Body isBold={active || done}>{step.label}</Text.Body>
            </div>
            {step.detail && (
              <Text.Detail tone={step.status === 'error' ? 'critical' : 'secondary'}>
                {step.detail}
              </Text.Detail>
            )}
          </div>
        );
      })}
    </Spacings.Stack>
  );
}
