import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function AdminCyclesPage() {
  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardDescription>Groups / Cycles</CardDescription>
        <CardTitle>Groups and cycle tools are next</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          This section is reserved for group setup and cycle management.
        </p>
      </CardContent>
    </Card>
  );
}
