import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import RiskIndicator from '../RiskIndicator';

describe('RiskIndicator', () => {
  it('renders green risk indicator correctly', () => {
    render(
      <RiskIndicator 
        level="green" 
        label="Overall: green"
        data-testid="risk-indicator"
      />
    );
    
    const indicator = screen.getByTestId('risk-indicator');
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveTextContent('Overall: green');
    
    // Check for green styling classes
    expect(indicator).toHaveClass('bg-green-100');
    expect(indicator).toHaveClass('text-green-800');
    expect(indicator).toHaveClass('border-green-200');
  });

  it('renders amber risk indicator correctly', () => {
    render(
      <RiskIndicator 
        level="amber" 
        label="Mobility: amber"
        data-testid="risk-indicator"
      />
    );
    
    const indicator = screen.getByTestId('risk-indicator');
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveTextContent('Mobility: amber');
    
    // Check for amber styling classes
    expect(indicator).toHaveClass('bg-amber-100');
    expect(indicator).toHaveClass('text-amber-800');
    expect(indicator).toHaveClass('border-amber-200');
  });

  it('renders red risk indicator correctly', () => {
    render(
      <RiskIndicator 
        level="red" 
        label="Safety: red"
        data-testid="risk-indicator"
      />
    );
    
    const indicator = screen.getByTestId('risk-indicator');
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveTextContent('Safety: red');
    
    // Check for red styling classes
    expect(indicator).toHaveClass('bg-red-100');
    expect(indicator).toHaveClass('text-red-800');
    expect(indicator).toHaveClass('border-red-200');
  });

  it('applies small size correctly', () => {
    render(
      <RiskIndicator 
        level="green" 
        label="Test"
        size="sm"
        data-testid="risk-indicator"
      />
    );
    
    const indicator = screen.getByTestId('risk-indicator');
    expect(indicator).toHaveClass('px-2');
    expect(indicator).toHaveClass('py-1');
    expect(indicator).toHaveClass('text-xs');
  });

  it('applies medium size correctly (default)', () => {
    render(
      <RiskIndicator 
        level="green" 
        label="Test"
        data-testid="risk-indicator"
      />
    );
    
    const indicator = screen.getByTestId('risk-indicator');
    expect(indicator).toHaveClass('px-3');
    expect(indicator).toHaveClass('py-1');
    expect(indicator).toHaveClass('text-sm');
  });

  it('applies large size correctly', () => {
    render(
      <RiskIndicator 
        level="green" 
        label="Test"
        size="lg"
        data-testid="risk-indicator"
      />
    );
    
    const indicator = screen.getByTestId('risk-indicator');
    expect(indicator).toHaveClass('px-4');
    expect(indicator).toHaveClass('py-2');
    expect(indicator).toHaveClass('text-base');
  });

  it('applies custom className correctly', () => {
    render(
      <RiskIndicator 
        level="green" 
        label="Test"
        className="custom-class"
        data-testid="risk-indicator"
      />
    );
    
    const indicator = screen.getByTestId('risk-indicator');
    expect(indicator).toHaveClass('custom-class');
  });

  it('has correct accessibility attributes', () => {
    render(
      <RiskIndicator 
        level="red" 
        label="Critical: red"
        data-testid="risk-indicator"
      />
    );
    
    const indicator = screen.getByTestId('risk-indicator');
    expect(indicator).toHaveAttribute('role', 'status');
    expect(indicator).toHaveAttribute('aria-label', 'Risk level: Critical: red');
  });

  describe('Risk level color mapping', () => {
    const riskLevels = [
      { level: 'green', expectedBg: 'bg-green-100', expectedText: 'text-green-800', expectedBorder: 'border-green-200' },
      { level: 'amber', expectedBg: 'bg-amber-100', expectedText: 'text-amber-800', expectedBorder: 'border-amber-200' },
      { level: 'red', expectedBg: 'bg-red-100', expectedText: 'text-red-800', expectedBorder: 'border-red-200' }
    ] as const;

    test.each(riskLevels)(
      'maps $level level to correct colors',
      ({ level, expectedBg, expectedText, expectedBorder }) => {
        render(
          <RiskIndicator 
            level={level} 
            label={`Test ${level}`}
            data-testid="risk-indicator"
          />
        );
        
        const indicator = screen.getByTestId('risk-indicator');
        expect(indicator).toHaveClass(expectedBg);
        expect(indicator).toHaveClass(expectedText);
        expect(indicator).toHaveClass(expectedBorder);
      }
    );
  });

  describe('Size variants', () => {
    const sizeVariants = [
      { size: 'sm', expectedPx: 'px-2', expectedPy: 'py-1', expectedText: 'text-xs' },
      { size: 'md', expectedPx: 'px-3', expectedPy: 'py-1', expectedText: 'text-sm' },
      { size: 'lg', expectedPx: 'px-4', expectedPy: 'py-2', expectedText: 'text-base' }
    ] as const;

    test.each(sizeVariants)(
      'applies correct classes for $size size',
      ({ size, expectedPx, expectedPy, expectedText }) => {
        render(
          <RiskIndicator 
            level="green" 
            label="Test"
            size={size}
            data-testid="risk-indicator"
          />
        );
        
        const indicator = screen.getByTestId('risk-indicator');
        expect(indicator).toHaveClass(expectedPx);
        expect(indicator).toHaveClass(expectedPy);
        expect(indicator).toHaveClass(expectedText);
      }
    );
  });

  it('renders without size prop (uses default)', () => {
    render(
      <RiskIndicator 
        level="green" 
        label="Test"
        data-testid="risk-indicator"
      />
    );
    
    const indicator = screen.getByTestId('risk-indicator');
    // Should default to medium size
    expect(indicator).toHaveClass('px-3');
    expect(indicator).toHaveClass('py-1');
    expect(indicator).toHaveClass('text-sm');
  });

  it('handles empty label gracefully', () => {
    render(
      <RiskIndicator 
        level="green" 
        label=""
        data-testid="risk-indicator"
      />
    );
    
    const indicator = screen.getByTestId('risk-indicator');
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveTextContent('');
  });

  it('handles long labels correctly', () => {
    const longLabel = 'This is a very long risk indicator label that should still render correctly without breaking the layout';
    
    render(
      <RiskIndicator 
        level="amber" 
        label={longLabel}
        data-testid="risk-indicator"
      />
    );
    
    const indicator = screen.getByTestId('risk-indicator');
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveTextContent(longLabel);
  });

  it('maintains consistent styling across all risk levels', () => {
    const { rerender } = render(
      <RiskIndicator 
        level="green" 
        label="Test"
        data-testid="risk-indicator"
      />
    );
    
    let indicator = screen.getByTestId('risk-indicator');
    expect(indicator).toHaveClass('inline-flex');
    expect(indicator).toHaveClass('items-center');
    expect(indicator).toHaveClass('rounded-full');
    expect(indicator).toHaveClass('border');
    expect(indicator).toHaveClass('font-medium');

    // Test that consistent classes are applied regardless of risk level
    rerender(
      <RiskIndicator 
        level="red" 
        label="Test"
        data-testid="risk-indicator"
      />
    );
    
    indicator = screen.getByTestId('risk-indicator');
    expect(indicator).toHaveClass('inline-flex');
    expect(indicator).toHaveClass('items-center');
    expect(indicator).toHaveClass('rounded-full');
    expect(indicator).toHaveClass('border');
    expect(indicator).toHaveClass('font-medium');
  });
});
