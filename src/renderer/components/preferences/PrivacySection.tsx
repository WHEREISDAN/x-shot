import React, { useCallback } from 'react';
import type { AppPreferences } from '../../../shared/ipc-types';
import { Select } from '../../design-system';
import { colors, spacing, typography } from '../../design-system/tokens';

interface PrivacySectionProps {
  preferences: AppPreferences;
  onUpdate: (updates: Partial<AppPreferences>) => Promise<boolean>;
}

export default function PrivacySection({
  preferences,
  onUpdate,
}: PrivacySectionProps) {
  const sectionStyles: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing[6],
  };

  const groupStyles: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing[3],
  };

  const labelStyles: React.CSSProperties = {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing[2],
  };

  const descriptionStyles: React.CSSProperties = {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing[3],
  };

  const checkboxContainerStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[2],
  };

  const checkboxStyles: React.CSSProperties = {
    accentColor: colors.primary.DEFAULT,
  };

  const warningStyles: React.CSSProperties = {
    padding: spacing[3],
    background: colors.warning,
    color: colors.black,
    borderRadius: '4px',
    fontSize: typography.fontSize.sm,
    marginTop: spacing[2],
  };

  const infoStyles: React.CSSProperties = {
    padding: spacing[3],
    background: colors.info,
    color: colors.white,
    borderRadius: '4px',
    fontSize: typography.fontSize.sm,
    marginTop: spacing[2],
  };

  const handleAutoDetectChange = useCallback(
    async (autoDetect: boolean) => {
      await onUpdate({
        pii: {
          ...preferences.pii,
          autoDetect,
        },
      });
    },
    [preferences.pii, onUpdate],
  );

  const handleDefaultStyleChange = useCallback(
    async (defaultStyle: 'blur' | 'black') => {
      await onUpdate({
        pii: {
          ...preferences.pii,
          defaultStyle,
        },
      });
    },
    [preferences.pii, onUpdate],
  );

  const handleDetectorToggle = useCallback(
    async (key: keyof AppPreferences['pii']['detectors'], enabled: boolean) => {
      await onUpdate({
        pii: {
          ...preferences.pii,
          detectors: {
            ...preferences.pii.detectors,
            [key]: enabled,
          },
        },
      });
    },
    [preferences.pii, onUpdate],
  );

  const styleOptions = [
    { value: 'black', label: 'Black Box (Complete Hiding)' },
    { value: 'blur', label: 'Blur (Partial Obscuring)' },
  ];

  return (
    <div style={sectionStyles}>
      {/* PII Detection */}
      <div style={groupStyles}>
        <h3 style={labelStyles}>PII Detection</h3>

        <label htmlFor="auto-detect-pii" style={checkboxContainerStyles}>
          <input
            type="checkbox"
            id="auto-detect-pii"
            checked={preferences.pii.autoDetect}
            onChange={(e) => handleAutoDetectChange(e.target.checked)}
            style={checkboxStyles}
          />
          <span
            style={{
              fontSize: typography.fontSize.base,
              color: colors.text.primary,
            }}
          >
            Automatically detect and hide potentially sensitive information
          </span>
        </label>

        <p style={descriptionStyles}>
          When enabled, X-Shot will automatically scan screenshots for
          potentially sensitive information like email addresses, phone numbers,
          and other personal data, and suggest masking them.
        </p>

        {preferences.pii.autoDetect && (
          <div style={warningStyles}>
            ⚠️ <strong>Privacy Notice:</strong> PII detection is performed
            locally on your device. No screenshot data is sent to external
            servers for analysis.
          </div>
        )}
      </div>

      {/* Masking Style */}
      <div style={groupStyles}>
        <h3 style={labelStyles}>Default Masking Style</h3>

        <div>
          <div style={labelStyles} id="masking-method-label">
            Masking Method
          </div>
          <p style={descriptionStyles}>
            How sensitive information should be hidden by default
          </p>
          <Select
            aria-labelledby="masking-method-label"
            value={preferences.pii.defaultStyle}
            onChange={(e) =>
              handleDefaultStyleChange(e.target.value as 'blur' | 'black')
            }
            options={styleOptions}
            variant="filled"
            size="md"
            style={{ maxWidth: '300px' }}
          />
        </div>

        <div style={infoStyles}>
          💡 <strong>Tip:</strong> You can always manually add or adjust PII
          masks using the rectangle tool with PII mode enabled in the editor.
        </div>
      </div>

      {/* Detectors */}
      <div style={groupStyles}>
        <h3 style={labelStyles}>PII Types to Detect</h3>
        <p style={descriptionStyles}>
          Choose which patterns to auto-detect when masking is enabled.
        </p>

        {(
          [
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
          ] as Array<[keyof AppPreferences['pii']['detectors'], string]>
        ).map(([key, label]) => (
          <label
            htmlFor={`pii-detector-${key}`}
            key={key}
            style={checkboxContainerStyles}
          >
            <input
              type="checkbox"
              id={`pii-detector-${key}`}
              checked={preferences.pii.detectors?.[key] ?? false}
              onChange={(e) => handleDetectorToggle(key, e.target.checked)}
              style={checkboxStyles}
            />
            <span
              style={{
                fontSize: typography.fontSize.base,
                color: colors.text.primary,
              }}
            >
              {label}
            </span>
          </label>
        ))}
      </div>

      {/* Data Handling */}
      <div style={groupStyles}>
        <h3 style={labelStyles}>Data Handling</h3>

        <p style={descriptionStyles}>
          X-Shot is designed with privacy in mind:
        </p>

        <ul
          style={{
            margin: 0,
            paddingLeft: spacing[4],
            color: colors.text.secondary,
            fontSize: typography.fontSize.sm,
            lineHeight: 1.6,
          }}
        >
          <li>All screenshot processing happens locally on your device</li>
          <li>No screenshot data is uploaded to external servers</li>
          <li>PII detection uses local text recognition (OCR)</li>
          <li>Screenshots are only saved where you choose to save them</li>
          <li>No telemetry or usage data is collected</li>
        </ul>
      </div>
    </div>
  );
}
