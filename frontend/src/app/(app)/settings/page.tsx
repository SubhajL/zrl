'use client';

import * as React from 'react';
import {
  User,
  Shield,
  Key,
  Bell,
  SlidersHorizontal,
  Palette,
  Download,
  CreditCard,
  AlertTriangle,
  Check,
  X,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

// ── Settings sidebar items ──

interface SettingsNavItem {
  readonly key: string;
  readonly label: string;
  readonly icon: React.ReactNode;
  readonly danger?: boolean;
}

const SETTINGS_NAV_ITEMS: readonly SettingsNavItem[] = [
  { key: 'profile', label: 'Profile', icon: <User className="size-4" /> },
  { key: 'security', label: 'Security', icon: <Shield className="size-4" /> },
  { key: 'api-keys', label: 'API Keys', icon: <Key className="size-4" /> },
  {
    key: 'notifications',
    label: 'Notifications',
    icon: <Bell className="size-4" />,
  },
  {
    key: 'preferences',
    label: 'Preferences',
    icon: <SlidersHorizontal className="size-4" />,
  },
  {
    key: 'appearance',
    label: 'Appearance',
    icon: <Palette className="size-4" />,
  },
  {
    key: 'data-export',
    label: 'Data Export',
    icon: <Download className="size-4" />,
  },
  { key: 'billing', label: 'Billing', icon: <CreditCard className="size-4" /> },
  { key: '__separator__', label: '', icon: null },
  {
    key: 'danger-zone',
    label: 'Danger Zone',
    icon: <AlertTriangle className="size-4" />,
    danger: true,
  },
];

// ── Removable pill tag ──

function PillTag({
  label,
  onRemove,
}: {
  readonly label: string;
  readonly onRemove: () => void;
}) {
  return (
    <Badge variant="default" className="gap-1.5 pl-3 pr-2 py-1">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label}`}
        className="rounded-full p-0.5 hover:bg-primary-foreground/20 transition-colors"
      >
        <X className="size-3" />
      </button>
    </Badge>
  );
}

// ── Page Component ──

export default function SettingsPage() {
  const [activeSection, setActiveSection] = React.useState('profile');
  const [companyName, setCompanyName] = React.useState(
    'Thai Tropical Exports Co., Ltd.',
  );
  const [taxId, setTaxId] = React.useState('0105555000001');
  const [address, setAddress] = React.useState(
    '123 Export Lane, Industrial Zone 4, Moo 5',
  );
  const [province, setProvince] = React.useState('Chachoengsao');
  const [fullName, setFullName] = React.useState('Somchai Prasert');
  const [email, setEmail] = React.useState('somchai@tte.co.th');
  const [phone, setPhone] = React.useState('+66 81 234 5678');
  const [language, setLanguage] = React.useState('English');
  const [products, setProducts] = React.useState<string[]>(['Mango', 'Durian']);
  const [markets, setMarkets] = React.useState<string[]>(['Japan', 'China']);
  const [annualVolume, setAnnualVolume] = React.useState('500');
  const [marketingConsent, setMarketingConsent] = React.useState(true);
  const [lastExportStatus, setLastExportStatus] = React.useState(
    'No portability export requested yet.',
  );
  const [privacyRequests, setPrivacyRequests] = React.useState<string[]>([
    'Access request completed in 4 days',
    'Deletion request queued for manual review',
  ]);

  const removeProduct = (product: string) => {
    setProducts((prev) => prev.filter((p) => p !== product));
  };

  const removeMarket = (market: string) => {
    setMarkets((prev) => prev.filter((m) => m !== market));
  };

  const toggleMarketingConsent = () => {
    setMarketingConsent((prev) => !prev);
  };

  const requestDataExport = () => {
    setActiveSection('data-export');
    setLastExportStatus(
      'Export requested. JSON and CSV ZIP ready in ~2 minutes.',
    );
  };

  const queueDeletionRequest = () => {
    setPrivacyRequests((prev) => [
      'Deletion request submitted under 30-day PDPA SLA',
      ...prev,
    ]);
  };

  return (
    <div className="flex gap-0 -m-6 min-h-[calc(100vh-4rem)]">
      {/* Settings Sidebar */}
      <aside
        className="w-64 shrink-0 border-r bg-muted/30 p-6"
        aria-label="Settings navigation"
      >
        <p className="mb-4 px-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Account Configuration
        </p>
        <nav className="flex flex-col gap-1">
          {SETTINGS_NAV_ITEMS.map((item) => {
            if (item.key === '__separator__') {
              return <div key="sep" className="border-t my-2 mx-3" />;
            }

            const isActive = item.key === activeSection;

            return (
              <button
                key={item.key}
                type="button"
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all text-left',
                  isActive &&
                    !item.danger &&
                    'bg-primary/10 text-primary font-semibold border-l-4 border-primary',
                  !isActive &&
                    !item.danger &&
                    'text-muted-foreground hover:bg-muted/50',
                  item.danger && 'text-destructive hover:bg-destructive/10',
                )}
                onClick={() => setActiveSection(item.key)}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-8 lg:p-12 space-y-8 max-w-4xl">
        {/* Header */}
        <header>
          <h1 className="text-3xl font-bold tracking-tight">
            Profile Settings
          </h1>
          <p className="mt-1 text-muted-foreground">
            Manage your company and contact information
          </p>
        </header>

        {/* Card 1: Company Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Company Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="company-name">Company Name</Label>
                <Input
                  id="company-name"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tax-id">Tax ID</Label>
                <Input
                  id="tax-id"
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  className="font-mono"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <textarea
                id="address"
                rows={3}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="flex w-full rounded-xl border border-input bg-background px-4 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="province">Province</Label>
                <Input
                  id="province"
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="full-name">Full Name</Label>
                <Input
                  id="full-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pr-28"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Badge variant="success" className="gap-1 text-[10px]">
                      <Check className="size-3" />
                      Verified
                    </Badge>
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="language">Language</Label>
                <Input
                  id="language"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Export Profile */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Export Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label>Primary Products</Label>
              <div className="flex flex-wrap gap-2">
                {products.map((product) => (
                  <PillTag
                    key={product}
                    label={product}
                    onRemove={() => removeProduct(product)}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <Label>Target Markets</Label>
              <div className="flex flex-wrap gap-2">
                {markets.map((market) => (
                  <PillTag
                    key={market}
                    label={market}
                    onRemove={() => removeMarket(market)}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2 max-w-xs">
              <Label htmlFor="annual-volume">Annual Volume</Label>
              <div className="relative">
                <Input
                  id="annual-volume"
                  value={annualVolume}
                  onChange={(e) => setAnnualVolume(e.target.value)}
                  className="pr-16"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                  tons
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="pdpa-card">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <CardTitle className="text-xl">PDPA Privacy Controls</CardTitle>
              <p className="text-sm text-muted-foreground">
                Manage marketing consent, portability exports, and data-subject
                requests within the 30-day Thai PDPA response window.
              </p>
            </div>
            <Badge variant={marketingConsent ? 'success' : 'warning'}>
              {marketingConsent ? 'Marketing Opt-In' : 'Marketing Opt-Out'}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-2xl border border-border/70 bg-muted/30 p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-semibold">
                    Marketing communications consent
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Current source: Settings Center. Withdraw any time without
                    affecting export evidence operations.
                  </p>
                </div>
                <Button
                  type="button"
                  variant={marketingConsent ? 'outline' : 'default'}
                  onClick={toggleMarketingConsent}
                >
                  {marketingConsent
                    ? 'Withdraw Consent'
                    : 'Enable Marketing Updates'}
                </Button>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-2xl border border-border/70 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">
                      PDPA Data Portability
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Generate a ZIP with JSON and CSV exports of your profile,
                      lanes, checkpoints, evidence metadata, notifications, and
                      consent history.
                    </p>
                  </div>
                  <Button type="button" onClick={requestDataExport}>
                    Request PDPA Export
                  </Button>
                </div>
                <p className="mt-4 text-sm text-muted-foreground">
                  {lastExportStatus}
                </p>
              </div>

              <div className="rounded-2xl border border-border/70 p-5">
                <p className="text-sm font-semibold">Rights Request Queue</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Access, correction, deletion, objection, and consent
                  withdrawal requests are tracked against a 30-day deadline.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4 w-full"
                  onClick={queueDeletionRequest}
                >
                  Create Deletion Request
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <Label>Recent privacy actions</Label>
                <Badge variant="outline">
                  72-hour breach notice runbook ready
                </Badge>
              </div>
              <div className="space-y-2">
                {privacyRequests.map((item) => (
                  <div
                    key={item}
                    className="rounded-xl border border-border/60 bg-background px-4 py-3 text-sm"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bottom Actions */}
        <div className="flex items-center justify-end gap-4 pt-4 border-t">
          <Button variant="ghost">Discard</Button>
          <Button>Save Changes</Button>
        </div>
      </div>
    </div>
  );
}
