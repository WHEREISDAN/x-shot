import type { AppPreferences } from '../../../shared/ipc-types';
import type { UpdatePreferences } from '../../hooks/use-preferences';
import { Select, Switch } from '../../design-system';
import SettingsCard from './SettingsCard';
import SettingsRow, { descriptionId } from './SettingsRow';
import controls from './PreferenceControls.module.css';
import styles from './PrivacySection.module.css';

type DetectorKey = keyof AppPreferences['pii']['detectors'];

const DETECTORS: ReadonlyArray<[DetectorKey, string]> = [
  ['email', 'Email addresses'],
  ['phone', 'Phone numbers'],
  ['address', 'Street addresses'],
  ['ipv4', 'IPv4 addresses'],
  ['url', 'URLs and domains'],
  ['ssn', 'US SSN'],
  ['creditCard', 'Credit card numbers'],
  ['dob', 'Dates of birth (label-aware)'],
  ['postalUS', 'US ZIP codes'],
  ['postalCA', 'Canada postal codes'],
  ['postalUK', 'UK postcodes'],
  ['uuid', 'UUIDs'],
  ['mac', 'MAC addresses'],
  ['iban', 'IBANs'],
  ['poBox', 'PO Boxes'],
  ['tokens', 'API keys and tokens'],
];

const STYLE_OPTIONS = [
  { value: 'black', label: 'Black Box (Complete Hiding)' },
  { value: 'blur', label: 'Blur (Partial Obscuring)' },
];

interface PrivacySectionProps {
  preferences: AppPreferences;
  onUpdate: UpdatePreferences;
}

export default function PrivacySection({
  preferences,
  onUpdate,
}: PrivacySectionProps) {
  const { pii } = preferences;

  return (
    <>
      <SettingsCard
        label="PII Detection"
        note={
          pii.autoDetect &&
          'Privacy notice: PII detection runs locally on your device. No screenshot data is sent to external servers for analysis.'
        }
      >
        <SettingsRow
          labelId="auto-detect-pii-label"
          label="Automatically detect and hide potentially sensitive information"
          description="Scans screenshots for email addresses, phone numbers and other personal data, and suggests masking them."
        >
          <Switch
            aria-labelledby="auto-detect-pii-label"
            aria-describedby={descriptionId('auto-detect-pii-label')}
            checked={pii.autoDetect}
            onChange={(autoDetect) => onUpdate({ pii: { autoDetect } })}
          />
        </SettingsRow>
      </SettingsCard>

      <SettingsCard
        label="Default Masking Style"
        note="Tip: you can always add or adjust PII masks by hand with the rectangle tool in PII mode in the editor."
      >
        <SettingsRow
          labelId="masking-method-label"
          label="Masking Method"
          description="How sensitive information is hidden by default"
        >
          <Select
            aria-labelledby="masking-method-label"
            value={pii.defaultStyle}
            onChange={(e) =>
              onUpdate({
                pii: { defaultStyle: e.target.value as 'blur' | 'black' },
              })
            }
            options={STYLE_OPTIONS}
            className={controls.select}
          />
        </SettingsRow>
      </SettingsCard>

      <SettingsCard
        label="PII Types to Detect"
        note="Choose which patterns to auto-detect when masking is enabled."
      >
        {DETECTORS.map(([key, label]) => (
          <SettingsRow
            key={key}
            labelId={`pii-detector-${key}-label`}
            label={label}
          >
            <Switch
              aria-labelledby={`pii-detector-${key}-label`}
              checked={pii.detectors?.[key] ?? false}
              onChange={(enabled) =>
                onUpdate({ pii: { detectors: { [key]: enabled } } })
              }
            />
          </SettingsRow>
        ))}
      </SettingsCard>

      <SettingsCard label="Data Handling">
        <div className={styles.dataHandling}>
          <p>X-Shot is designed with privacy in mind:</p>
          <ul>
            <li>All screenshot processing happens locally on your device</li>
            <li>No screenshot data is uploaded to external servers</li>
            <li>PII detection uses local text recognition (OCR)</li>
            <li>Screenshots are only saved where you choose to save them</li>
            <li>No telemetry or usage data is collected</li>
          </ul>
        </div>
      </SettingsCard>
    </>
  );
}
