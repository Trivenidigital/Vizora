import { vi } from 'vitest';

const toast = vi.fn();
toast.success = vi.fn();
toast.error = vi.fn();
toast.loading = vi.fn();
toast.dismiss = vi.fn();

export default toast; 