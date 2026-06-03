import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import BacklogClient from '../page-client';

describe('BacklogClient', () => {
  it('shows the current customer-1 launch gates instead of stale March readiness claims', () => {
    render(<BacklogClient />);

    const pageText = document.body.textContent ?? '';

    expect(screen.getByText('Project Backlog')).toBeInTheDocument();
    expect(pageText).toContain('Last updated: 2026-06-03');
    expect(pageText).toContain('Customer-1 launch status: blocked on operator gates');
    expect(pageText).toContain('C1');
    expect(pageText).toContain('SMTP / Resend production verification');
    expect(pageText).toContain('C2');
    expect(pageText).toContain('Customer-1 organization provisioning');
    expect(pageText).toContain('C3');
    expect(pageText).toContain('Real-device walkthrough');
    expect(pageText).toContain('C4');
    expect(pageText).toContain('60-step go-live smoke');
    expect(pageText).toContain('Operator + customer IT');
    expect(pageText).toContain('Operator + reviewer');
    expect(screen.getByText('4 open')).toBeInTheDocument();

    expect(pageText).not.toContain('Production readiness: ~96%');
    expect(pageText).not.toContain('Deployed');
    expect(pageText).not.toContain('Sri');
  });

  it('marks live billing setup as deferred instead of launch-blocking for customer-1', () => {
    render(<BacklogClient />);

    const pageText = document.body.textContent ?? '';

    expect(pageText).toContain('Billing/live payments deferred past customer-1');
    expect(pageText).toContain('Customer-1 launches on free tier');
    expect(pageText).toContain('Remaining P0s are operator-only');
  });
});
