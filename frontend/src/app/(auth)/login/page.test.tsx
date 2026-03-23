import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginPage from './page';

// Mock next/navigation
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  }),
}));

describe('LoginPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders email and password inputs', () => {
    render(<LoginPage />);

    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(
      screen.getByLabelText(/password/i, { selector: 'input' }),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText('name@company.com')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /sign in/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Audit-grade evidence platform for Thai fresh fruit exports',
      ),
    ).toBeInTheDocument();
  });

  it('toggles password visibility', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    const passwordInput = screen.getByLabelText(/password/i, {
      selector: 'input',
    });
    expect(passwordInput).toHaveAttribute('type', 'password');

    const toggleButton = screen.getByRole('button', { name: /show password/i });
    await user.click(toggleButton);

    expect(passwordInput).toHaveAttribute('type', 'text');

    const hideButton = screen.getByRole('button', { name: /hide password/i });
    await user.click(hideButton);

    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('shows validation error for empty fields', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    const submitButton = screen.getByRole('button', { name: /sign in/i });
    await user.click(submitButton);

    expect(await screen.findByText('Email is required')).toBeInTheDocument();
    expect(await screen.findByText('Password is required')).toBeInTheDocument();
  });

  it('shows validation error for invalid email format', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText(/email address/i), 'notanemail');
    await user.type(
      screen.getByLabelText(/password/i, { selector: 'input' }),
      'password123',
    );
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(
      await screen.findByText('Please enter a valid email address'),
    ).toBeInTheDocument();
  });

  it('shows validation error for short password', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(
      screen.getByLabelText(/email address/i),
      'test@example.com',
    );
    await user.type(
      screen.getByLabelText(/password/i, { selector: 'input' }),
      'short',
    );
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(
      await screen.findByText('Password must be at least 8 characters'),
    ).toBeInTheDocument();
  });

  it('shows loading state on submit', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(
      screen.getByLabelText(/email address/i),
      'test@example.com',
    );
    await user.type(
      screen.getByLabelText(/password/i, { selector: 'input' }),
      'password123',
    );
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/signing in/i)).toBeInTheDocument();

    // Wait for the mock auth to complete
    await waitFor(
      () => {
        expect(mockPush).toHaveBeenCalledWith('/dashboard');
      },
      { timeout: 3000 },
    );
  });

  it('renders MFA input section when triggered', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    // MFA section should not be visible initially
    expect(screen.queryByTestId('mfa-section')).not.toBeInTheDocument();

    // Submit with admin email to trigger MFA
    await user.type(
      screen.getByLabelText(/email address/i),
      'admin@example.com',
    );
    await user.type(
      screen.getByLabelText(/password/i, { selector: 'input' }),
      'password123',
    );
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    // Wait for MFA section to appear
    await waitFor(
      () => {
        expect(screen.getByTestId('mfa-section')).toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    expect(screen.getByText('Security Check')).toBeInTheDocument();
    expect(
      screen.getByText('Enter 6-digit verification code'),
    ).toBeInTheDocument();

    // Should have 6 digit inputs
    const digitInputs = screen.getAllByRole('textbox', { name: /digit/i });
    expect(digitInputs).toHaveLength(6);
  });

  it('renders language switcher', () => {
    render(<LoginPage />);

    const langGroup = screen.getByRole('radiogroup', {
      name: /select language/i,
    });
    expect(langGroup).toBeInTheDocument();

    expect(screen.getByRole('radio', { name: 'EN' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'TH' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'JP' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'ZH' })).toBeInTheDocument();

    // EN should be selected by default
    expect(screen.getByRole('radio', { name: 'EN' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('switches active language on click', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    const thButton = screen.getByRole('radio', { name: 'TH' });
    await user.click(thButton);

    expect(thButton).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'EN' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('has accessible form structure', () => {
    render(<LoginPage />);

    // Check heading
    expect(
      screen.getByRole('heading', { name: /zero-reject export lane/i }),
    ).toBeInTheDocument();

    // Check navigation landmark
    expect(
      screen.getByRole('navigation', { name: /language switcher/i }),
    ).toBeInTheDocument();

    // Check email input is properly labelled
    const emailInput = screen.getByLabelText(/email address/i);
    expect(emailInput).toHaveAttribute('type', 'email');
    expect(emailInput).toHaveAttribute('autocomplete', 'email');

    // Check password input is properly labelled
    const passwordInput = screen.getByLabelText(/password/i, {
      selector: 'input',
    });
    expect(passwordInput).toHaveAttribute('autocomplete', 'current-password');
  });
});
