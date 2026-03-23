import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function PartnerPortalPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Partner Portal</h1>
        <p className="text-muted-foreground mt-1">
          Lab and logistics partner data submission
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            The partner portal for lab result submission and logistics data
            management is under development.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
