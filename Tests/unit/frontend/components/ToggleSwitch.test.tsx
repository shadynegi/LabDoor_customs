import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ToggleSwitch from '../../../../frontend/src/components/ToggleSwitch';

describe('ToggleSwitch', () => {
  it('renders as a switch with checked state and visible label', () => {
    render(<ToggleSwitch checked={false} onChange={() => {}} />);

    const control = screen.getByRole('switch', { name: /out of stock: off/i });
    expect(control).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText('In stock')).toBeInTheDocument();
  });

  it('shows out-of-stock label when checked', () => {
    render(<ToggleSwitch checked onChange={() => {}} />);

    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('Out of stock')).toBeInTheDocument();
  });

  it('calls onChange when clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<ToggleSwitch checked={false} onChange={onChange} />);
    await user.click(screen.getByRole('switch'));

    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('toggles on Space and Enter', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<ToggleSwitch checked={false} onChange={onChange} />);
    const control = screen.getByRole('switch');
    control.focus();

    await user.keyboard(' ');
    expect(onChange).toHaveBeenCalledWith(true);

    onChange.mockClear();
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('does not toggle when loading', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<ToggleSwitch checked={false} onChange={onChange} loading />);
    const control = screen.getByRole('switch');

    expect(control).toBeDisabled();
    expect(control).toHaveAttribute('aria-busy', 'true');

    await user.click(control);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('uses custom label text when provided', () => {
    render(<ToggleSwitch checked label="Unavailable" onChange={() => {}} />);
    expect(screen.getByText('Unavailable')).toBeInTheDocument();
  });
});
