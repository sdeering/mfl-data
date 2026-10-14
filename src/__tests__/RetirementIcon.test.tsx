import React from 'react';
import { render, screen } from '@testing-library/react';
import RetirementIcon from '../components/RetirementIcon';

describe('RetirementIcon', () => {
  it.each([
    [1, 'Retiring at the end of this season', 'text-red-500'],
    [2, 'Retiring in 2 seasons', 'text-orange-500'],
    [3, 'Retiring in 3 seasons', 'text-yellow-400'],
  ])('shows retirementYears %i as "%s" in %s', (retirementYears, label, colour) => {
    render(<RetirementIcon retirementYears={retirementYears} />);

    const icon = screen.getByRole('img', { name: label });
    expect(icon).toHaveAttribute('title', label);
    expect(icon).toHaveClass(colour);
  });

  it.each([undefined, 0, 4, 5])('renders nothing for retirementYears %p', (retirementYears) => {
    const { container } = render(<RetirementIcon retirementYears={retirementYears} />);
    expect(container).toBeEmptyDOMElement();
  });
});
