import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Modal } from './Modal';

describe('Modal', () => {
  it('is a labelled dialog, focuses inside, and closes on Escape', () => {
    const onClose = vi.fn();
    render(
      <Modal title="Trace" onClose={onClose}>
        <button>inner</button>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Trace' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('traps Tab focus within the dialog', () => {
    render(
      <Modal title="Trap" onClose={() => {}}>
        <button>last</button>
      </Modal>,
    );
    const close = screen.getByRole('button', { name: 'Close dialog' });
    const last = screen.getByRole('button', { name: 'last' });
    last.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(close);
  });
});
