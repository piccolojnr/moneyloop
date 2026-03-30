import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function AdminPayoutsPage() {
  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardDescription>Payouts</CardDescription>
        <CardTitle>Payout management is next</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          This section will show transfer activity and payout controls.
        </p>
      </CardContent>
    </Card>
  );
}
