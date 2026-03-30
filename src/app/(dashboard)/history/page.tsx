import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function HistoryPage() {
  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardDescription>History</CardDescription>
        <CardTitle>Contribution and payout history</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          History views have not been built yet for this project.
        </p>
      </CardContent>
    </Card>
  );
}
