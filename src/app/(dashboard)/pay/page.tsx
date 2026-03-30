import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function PayPage() {
  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardDescription>Contributions</CardDescription>
        <CardTitle>Pay your current cycle contribution</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Use the dashboard summary to confirm your current cycle status before
          starting payment.
        </p>
        <Button asChild>
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
