import { Card, CardContent } from "@/components/ui/card";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-muted/40 flex flex-col items-center justify-center px-4">
      <div className="mb-6 text-center">
        <span className="text-2xl font-semibold tracking-tight text-foreground">
          Money<span className="text-primary">Loop</span>
        </span>
      </div>
      <Card className="w-full max-w-sm">
        <CardContent className="pt-2 pb-6">{children}</CardContent>
      </Card>
    </div>
  );
}
