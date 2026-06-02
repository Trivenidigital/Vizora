import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function settingsSource(): string {
  return readFileSync(join(process.cwd(), 'src/app/dashboard/settings/page.tsx'), 'utf8');
}

function sourceBetween(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  expect(startIndex).toBeGreaterThanOrEqual(0);

  const endIndex = source.indexOf(end, startIndex);
  expect(endIndex).toBeGreaterThan(startIndex);

  return source.slice(startIndex, endIndex);
}

describe('SettingsPage source guards', () => {
  it('renders account email as a read-only account identity field', () => {
    const source = settingsSource();
    const accountEmailBlock = sourceBetween(source, 'Account Email', 'Region');

    expect(source).not.toContain("email: 'admin@vizora.com'");
    expect(source).toContain('htmlFor="settings-account-email"');
    expect(accountEmailBlock).toContain('id="settings-account-email"');
    expect(accountEmailBlock).toContain('readOnly');
    expect(accountEmailBlock).toContain('aria-describedby="settings-account-email-help"');
    expect(accountEmailBlock).toContain('Signed-in account email');
    expect(accountEmailBlock).not.toContain('Admin Email');
    expect(accountEmailBlock).not.toContain('onChange');
  });

  it('keeps organization saves scoped to organization fields', () => {
    const source = settingsSource();
    const saveBlock = sourceBetween(
      source,
      'await apiClient.updateOrganization(settings.organizationId',
      'toast.success',
    );

    expect(saveBlock).toContain('name: settings.organizationName');
    expect(saveBlock).toContain('country: settings.country');
    expect(saveBlock).toContain('defaultDuration: settings.defaultDuration');
    expect(saveBlock).not.toContain('email');
  });
});
