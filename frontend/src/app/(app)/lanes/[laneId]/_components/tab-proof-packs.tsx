import { FileCheck, Package, Shield } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';

/* ── Pack definitions ── */

interface PackDefinition {
  readonly name: string;
  readonly icon: React.ComponentType<{ className?: string }>;
  readonly tint: string;
  readonly iconBg: string;
  readonly description: string;
}

const PACK_DEFINITIONS: readonly PackDefinition[] = [
  {
    name: 'Regulator Pack',
    icon: FileCheck,
    tint: 'blue',
    iconBg: 'bg-info/10',
    description:
      'All MRL results, phyto cert, VHT cert, customs forms (Thai+English)',
  },
  {
    name: 'Buyer Pack',
    icon: Package,
    tint: 'emerald',
    iconBg: 'bg-success/10',
    description:
      'MRL summary, phyto, VHT, temp SLA, checkpoint photos (English+Japanese)',
  },
  {
    name: 'Defense Pack',
    icon: Shield,
    tint: 'amber',
    iconBg: 'bg-warning/10',
    description:
      'Full chain-of-custody, temp graphs, excursion analysis, audit trail',
  },
] as const;

/* ── Component ── */

export interface TabProofPacksProps {
  readonly laneId: string;
  readonly completeness: number;
}

export function TabProofPacks({ laneId, completeness }: TabProofPacksProps) {
  const isGenerateDisabled = completeness < 95;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {PACK_DEFINITIONS.map((pack) => {
        const Icon = pack.icon;

        return (
          <Card key={pack.name} className="flex flex-col">
            <CardHeader>
              <div className={cn('p-3 rounded-lg w-fit', pack.iconBg)}>
                <Icon className="size-6" />
              </div>
              <CardTitle className="text-base mt-3">{pack.name}</CardTitle>
              <CardDescription>{pack.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1" />
            <CardFooter className="flex flex-col items-stretch gap-3">
              <div className="relative group">
                <Button
                  className="w-full"
                  disabled={isGenerateDisabled}
                  aria-label={`Generate ${pack.name}`}
                >
                  Generate
                </Button>
                {isGenerateDisabled && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-foreground text-background text-xs rounded pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    Requires at least 95% completeness to generate
                  </div>
                )}
              </div>
              <p className="text-xs text-center text-muted-foreground">
                Not yet generated
              </p>
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}
