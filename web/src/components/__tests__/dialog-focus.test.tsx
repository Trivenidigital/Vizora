import { render, screen, fireEvent } from '@testing-library/react';
import ConfirmDialog from '../ConfirmDialog';
import Modal from '../Modal';

/**
 * Behaviour tests for what `role="dialog" aria-modal="true"` actually promises.
 *
 * Both shells already declared those attributes, and an existing test asserts
 * they are present ("exposes modal dialog semantics to assistive technology").
 * Attributes were never the problem: ConfirmDialog had no Escape handler, no
 * scroll lock and no focus handling at all, so the page behind it stayed
 * scrollable and tabbable while AT had been told it was inert.
 */

describe('dialog focus management', () => {
  afterEach(() => {
    document.body.style.overflow = 'unset';
  });

  describe('ConfirmDialog', () => {
    const props = {
      isOpen: true,
      onClose: jest.fn(),
      onConfirm: jest.fn(),
      title: 'Delete display',
      message: 'This cannot be undone.',
    };

    beforeEach(() => jest.clearAllMocks());

    it('closes on Escape', () => {
      const onClose = jest.fn();
      render(<ConfirmDialog {...props} onClose={onClose} />);

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('focuses Cancel, not the destructive action', () => {
      render(<ConfirmDialog {...props} />);

      // The safe option must be the one sitting under Enter.
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }));
    });

    it('locks page scroll while open and releases it on unmount', () => {
      const { unmount } = render(<ConfirmDialog {...props} />);
      expect(document.body.style.overflow).toBe('hidden');

      unmount();

      expect(document.body.style.overflow).toBe('unset');
    });

    it('restores focus to whatever opened it', () => {
      const trigger = document.createElement('button');
      document.body.appendChild(trigger);
      trigger.focus();
      expect(document.activeElement).toBe(trigger);

      const { unmount } = render(<ConfirmDialog {...props} />);
      expect(document.activeElement).not.toBe(trigger);

      unmount();

      expect(document.activeElement).toBe(trigger);
      trigger.remove();
    });

    it('keeps Tab inside the dialog', () => {
      render(<ConfirmDialog {...props} />);
      const confirm = screen.getByRole('button', { name: 'Confirm' });
      confirm.focus();

      // Tab from the last focusable element wraps to the first, rather than
      // escaping into the page behind.
      fireEvent.keyDown(document, { key: 'Tab' });

      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }));
    });
  });

  describe('Modal', () => {
    const props = {
      isOpen: true,
      onClose: jest.fn(),
      title: 'Edit playlist',
      children: <button type="button">Save</button>,
    };

    beforeEach(() => jest.clearAllMocks());

    it('moves focus into the dialog on open', () => {
      render(<Modal {...props} />);

      // closeButtonRef existed and was wired to the button, but nothing focused it.
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close modal' }));
    });

    it('gives each instance a unique title id', () => {
      const { unmount } = render(<Modal {...props} />);
      const first = screen.getByRole('dialog').getAttribute('aria-labelledby');
      unmount();

      render(<Modal {...props} title="Another" />);
      const second = screen.getByRole('dialog').getAttribute('aria-labelledby');

      expect(first).toBeTruthy();
      expect(second).not.toBe('modal-title');
      expect(first).not.toBe(second);
    });

    it('restores focus on close', () => {
      const trigger = document.createElement('button');
      document.body.appendChild(trigger);
      trigger.focus();

      const { unmount } = render(<Modal {...props} />);
      unmount();

      expect(document.activeElement).toBe(trigger);
      trigger.remove();
    });
  });
});
