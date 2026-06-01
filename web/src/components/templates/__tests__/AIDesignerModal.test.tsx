import { render, screen } from '@testing-library/react';
import AIDesignerModal from '../AIDesignerModal';

const mockAiGenerateTemplate = jest.fn();

jest.mock('@/lib/api', () => ({
  apiClient: {
    aiGenerateTemplate: (...args: any[]) => mockAiGenerateTemplate(...args),
  },
}));

describe('AIDesignerModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('opens in an honest unavailable state instead of a fake generation form', () => {
    render(<AIDesignerModal onClose={jest.fn()} />);

    expect(screen.getByRole('heading', { name: /ai designer is launching soon/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /generate template/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/ai is designing your template/i)).not.toBeInTheDocument();
    expect(mockAiGenerateTemplate).not.toHaveBeenCalled();
  });
});
