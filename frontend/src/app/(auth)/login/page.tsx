'use client';

import { useState, useRef, type FormEvent, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, Eye, EyeOff, Globe, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const LANGUAGES = ['EN', 'TH', 'JP', 'ZH'] as const;
type Language = (typeof LANGUAGES)[number];

export default function LoginPage() {
  const router = useRouter();

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // MFA state
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaCode, setMfaCode] = useState<string[]>(['', '', '', '', '', '']);
  const mfaInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeLang, setActiveLang] = useState<Language>('EN');

  // Validation
  const [validationErrors, setValidationErrors] = useState<{
    email?: string;
    password?: string;
  }>({});

  function validateForm(): boolean {
    const errors: { email?: string; password?: string } = {};

    if (!email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!password.trim()) {
      errors.password = 'Password is required';
    } else if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!validateForm()) return;

    setIsLoading(true);

    try {
      // Mock authentication -- replace with real API call
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Simulate MFA requirement for admin accounts
      if (!mfaRequired && email.includes('admin')) {
        setMfaRequired(true);
        setIsLoading(false);
        return;
      }

      // Mock successful login
      router.push('/dashboard');
    } catch {
      setError('Authentication failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  }

  function handleMfaInput(index: number, value: string) {
    if (!/^\d*$/.test(value)) return;

    const newCode = [...mfaCode];
    newCode[index] = value.slice(-1);
    setMfaCode(newCode);

    // Auto-advance to next input
    if (value && index < 5) {
      mfaInputRefs.current[index + 1]?.focus();
    }
  }

  function handleMfaKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !mfaCode[index] && index > 0) {
      mfaInputRefs.current[index - 1]?.focus();
    }
  }

  return (
    <>
      {/* Language Switcher — top-right */}
      <nav
        className="fixed top-0 right-0 z-50 flex items-center px-8 py-4"
        aria-label="Language switcher"
      >
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <div
            className="flex rounded-full bg-secondary p-1"
            role="radiogroup"
            aria-label="Select language"
          >
            {LANGUAGES.map((lang) => (
              <button
                key={lang}
                type="button"
                role="radio"
                aria-checked={activeLang === lang}
                className={cn(
                  'rounded-full px-4 py-2.5 text-xs font-medium transition-colors',
                  activeLang === lang
                    ? 'font-semibold text-primary'
                    : 'text-muted-foreground hover:text-primary',
                )}
                onClick={() => setActiveLang(lang)}
              >
                {lang}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Login Card */}
      <Card className="w-full max-w-md rounded-2xl p-8 shadow-lg">
        <div className="flex flex-col gap-8">
          {/* Branding */}
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-white shadow-lg shadow-primary/20">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-7 w-7"
                aria-hidden="true"
              >
                <path d="M17 8C8 10 5.9 16.17 3.82 21.34l1.89.66.95-2.3c.48.17.98.3 1.34.3C19 20 22 3 22 3c-1 2-8 2.25-13 3.25S2 11.5 2 13.5s1.75 3.75 1.75 3.75C7 8 17 8 17 8z" />
              </svg>
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight">
                Zero-Reject Export Lane
              </h1>
              <p className="mx-auto max-w-[280px] text-sm leading-relaxed text-muted-foreground">
                Audit-grade evidence platform for Thai fresh fruit exports
              </p>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div
              role="alert"
              className="rounded-xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
            >
              {error}
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* Email */}
            <div className="space-y-1.5">
              <Label
                htmlFor="email"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Email Address
              </Label>
              <div className="relative flex items-center">
                <Mail
                  className="absolute left-3.5 h-4 w-4 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (validationErrors.email) {
                      setValidationErrors((prev) => ({
                        ...prev,
                        email: undefined,
                      }));
                    }
                  }}
                  className="h-11 pl-11 pr-4"
                  aria-invalid={!!validationErrors.email}
                  aria-describedby={
                    validationErrors.email ? 'email-error' : undefined
                  }
                  autoComplete="email"
                  disabled={isLoading}
                />
              </div>
              {validationErrors.email && (
                <p
                  id="email-error"
                  className="text-xs text-destructive"
                  role="alert"
                >
                  {validationErrors.email}
                </p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label
                htmlFor="password"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Password
              </Label>
              <div className="relative flex items-center">
                <Lock
                  className="absolute left-3.5 h-4 w-4 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (validationErrors.password) {
                      setValidationErrors((prev) => ({
                        ...prev,
                        password: undefined,
                      }));
                    }
                  }}
                  className="h-11 pl-11 pr-11"
                  aria-invalid={!!validationErrors.password}
                  aria-describedby={
                    validationErrors.password ? 'password-error' : undefined
                  }
                  autoComplete="current-password"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="absolute right-3.5 flex min-h-[44px] min-w-[44px] items-center justify-center text-muted-foreground transition-colors hover:text-primary"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {validationErrors.password && (
                <p
                  id="password-error"
                  className="text-xs text-destructive"
                  role="alert"
                >
                  {validationErrors.password}
                </p>
              )}
            </div>

            {/* Remember me & Forgot password */}
            <div className="flex items-center justify-between">
              <label className="group flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-muted-foreground text-primary focus:ring-primary"
                />
                <span className="text-xs font-medium text-muted-foreground transition-colors group-hover:text-primary">
                  Remember me
                </span>
              </label>
              <a
                href="#"
                className="text-xs font-semibold text-primary transition-colors hover:text-primary/80"
              >
                Forgot password?
              </a>
            </div>

            {/* MFA Section */}
            {mfaRequired && (
              <div className="space-y-3 pb-2 pt-2" data-testid="mfa-section">
                <div className="flex items-center gap-2">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Security Check
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <p className="text-center text-[11px] font-medium text-muted-foreground">
                  Enter 6-digit verification code
                </p>
                <div
                  className="flex justify-between gap-2"
                  role="group"
                  aria-label="MFA verification code"
                >
                  {mfaCode.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => {
                        mfaInputRefs.current[index] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleMfaInput(index, e.target.value)}
                      onKeyDown={(e) => handleMfaKeyDown(index, e)}
                      className="h-11 w-11 rounded-lg border border-input bg-background text-center font-mono text-lg outline-none focus:ring-2 focus:ring-primary"
                      aria-label={`Digit ${index + 1}`}
                      disabled={isLoading}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              className="h-12 w-full bg-gradient-to-br from-primary to-primary/80 font-semibold shadow-lg shadow-primary/20 transition-transform duration-200 hover:scale-[0.98]"
              disabled={isLoading}
              size="lg"
            >
              {isLoading ? (
                <>
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>

          {/* Footer note */}
          <p className="text-center text-xs leading-relaxed text-muted-foreground">
            Don&apos;t have an account?{' '}
            <a
              href="#"
              className="font-semibold text-foreground underline underline-offset-4 decoration-muted-foreground/30 transition-colors hover:text-primary"
            >
              Contact your administrator
            </a>
          </p>
        </div>
      </Card>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 flex w-full items-center justify-center pb-8 text-xs uppercase tracking-wider">
        <div className="flex items-center gap-6 opacity-80 transition-opacity hover:opacity-100">
          <span className="text-muted-foreground">Powered by ZRL</span>
          <div className="h-1 w-1 rounded-full bg-muted-foreground" />
          <a
            href="#"
            className="text-muted-foreground transition-colors hover:text-primary"
          >
            Terms
          </a>
          <div className="h-1 w-1 rounded-full bg-muted-foreground" />
          <a
            href="#"
            className="text-muted-foreground transition-colors hover:text-primary"
          >
            Privacy
          </a>
        </div>
      </footer>
    </>
  );
}
