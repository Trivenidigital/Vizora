import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import RegisterContent from '../register-content';
import { ApiError } from '@/lib/error-handler';

jest.mock('@/lib/api', () => ({
  apiClient: { register: jest.fn() },
}));

jest.mock('next/link', () => {
  return function MockLink({ children, href }: any) {
    return <a href={href}>{children}</a>;
  };
});

// NOTE: `@/lib/validation` is deliberately NOT mocked here. The sibling
// register-page.test.tsx stubs `registerSchema.parse`, which is why no existing
// test could have caught a client contract that disagreed with the server.
import { apiClient } from '@/lib/api';

const fillValidForm = () => {
  fireEvent.change(screen.getByLabelText('First Name'), { target: { value: 'Sri' } });
  fireEvent.change(screen.getByLabelText('Last Name'), { target: { value: 'Yalavarthi' } });
  fireEvent.change(screen.getByLabelText('Organization Name'), { target: { value: 'ABC Ltd' } });
  fireEvent.change(screen.getByLabelText('Work Email'), { target: { value: 'sri@example.com' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Abcdefg1' } });
  fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'Abcdefg1' } });
  fireEvent.click(screen.getByRole('checkbox', { name: /terms/i }));
};

const submit = () =>
  fireEvent.submit(screen.getByText('Create Account', { selector: 'button' }));

describe('register: the client refuses what the server would refuse', () => {
  beforeEach(() => jest.clearAllMocks());

  it('does NOT submit a one-character last name, and says why', async () => {
    // The reported bug. Every field showed a green tick and the server returned
    // a bare 400; the client must now catch this itself.
    render(<RegisterContent />);
    fillValidForm();
    fireEvent.change(screen.getByLabelText('Last Name'), { target: { value: 'Y' } });
    submit();

    await waitFor(() => {
      expect(screen.getByText(/Last name must be at least 2 characters/i)).toBeInTheDocument();
    });
    expect(apiClient.register).not.toHaveBeenCalled();
  });

  it('DOES submit a 60-character surname, which the server allows', async () => {
    // The other half of the defect: the client capped at 50 and refused valid input.
    (apiClient.register as jest.Mock).mockResolvedValue({});
    render(<RegisterContent />);
    fillValidForm();
    fireEvent.change(screen.getByLabelText('Last Name'), { target: { value: 'y'.repeat(60) } });
    submit();

    await waitFor(() => expect(apiClient.register).toHaveBeenCalled());
  });
});

describe('register: a failed submit never shows a bare status phrase', () => {
  beforeEach(() => jest.clearAllMocks());

  it('does not render "Bad Request", which is what production actually returns', async () => {
    /*
     * Reproduces the production response exactly. The global ValidationPipe runs
     * with `disableErrorMessages: true` there, so a DTO rejection is
     * `{ statusCode: 400, message: 'Bad Request' }` — no field detail at all. The
     * page used to render that string straight into the error banner.
     */
    (apiClient.register as jest.Mock).mockRejectedValue(
      new ApiError(400, 'Bad Request', 'Invalid request. Please check your input.', undefined, {
        statusCode: 400,
        message: 'Bad Request',
      }),
    );
    render(<RegisterContent />);
    fillValidForm();
    submit();

    await waitFor(() => expect(apiClient.register).toHaveBeenCalled());
    // Something must be shown — three absences below would pass on an empty tree.
    await waitFor(() =>
      expect(screen.getByText(/Invalid request\. Please check your input\./i)).toBeInTheDocument(),
    );
    expect(screen.queryByText(/^Bad Request$/)).not.toBeInTheDocument();
  });

  it('attaches the server field messages to their fields when it sends them', async () => {
    // What the server returns with detailed errors enabled. Each message names its
    // property, so it belongs under that input rather than in a banner.
    (apiClient.register as jest.Mock).mockRejectedValue(
      new ApiError(400, 'x', 'y', undefined, {
        statusCode: 400,
        message: [
          'lastName must be longer than or equal to 2 characters',
          'organizationName must be longer than or equal to 2 characters',
        ],
      }),
    );
    render(<RegisterContent />);
    fillValidForm();
    submit();

    await waitFor(() => expect(apiClient.register).toHaveBeenCalled());
    await waitFor(() => {
      expect(
        screen.getByText(/lastName must be longer than or equal to 2 characters/i),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByText(/organizationName must be longer than or equal to 2 characters/i),
    ).toBeInTheDocument();
  });

  it('still special-cases a duplicate account', async () => {
    (apiClient.register as jest.Mock).mockRejectedValue(
      new ApiError(409, 'User already exists', 'User already exists'),
    );
    render(<RegisterContent />);
    fillValidForm();
    submit();

    await waitFor(() =>
      expect(screen.getByText(/An account with this email already exists/i)).toBeInTheDocument(),
    );
  });
});
