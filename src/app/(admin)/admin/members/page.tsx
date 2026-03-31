"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { z } from "zod";
import { toast } from "sonner";

import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Member = {
  id: string;
  name: string;
  email: string;
  phone: string;
  momoNumber: string;
  momoNetwork: "MTN" | "VodafoneCash" | "AirtelTigo";
  role: "MEMBER" | "ADMIN";
  createdAt: string;
  groupCount: number;
};

const addMemberSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Enter a valid email address"),
  phone: z.string().min(10, "Enter a valid phone number"),
  momoNumber: z.string().min(10, "Enter a valid MoMo number"),
  momoNetwork: z.enum(["MTN", "VodafoneCash", "AirtelTigo"]),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type AddMemberValues = z.infer<typeof addMemberSchema>;

async function fetchMembers() {
  const response = await fetch("/api/members", {
    credentials: "include",
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(body?.error ?? "Failed to load members");
  }

  return (await response.json()) as Member[];
}

async function createMember(values: AddMemberValues) {
  const response = await fetch("/api/members", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(values),
  });

  const body = (await response.json().catch(() => null)) as
    | { error?: string }
    | Member
    | null;

  if (!response.ok) {
    throw new Error(
      typeof body === "object" && body !== null && "error" in body && typeof body.error === "string"
        ? body.error
        : "Failed to create member"
    );
  }

  return body as Member;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function roleBadgeClass(role: Member["role"]) {
  return role === "ADMIN"
    ? "bg-violet-100 text-violet-700 hover:bg-violet-100"
    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-100";
}

function TableSkeleton() {
  return (
    <div className="rounded-xl border bg-card">
      <div className="border-b px-4 py-3">
        <Skeleton className="h-5 w-48" />
      </div>
      <div className="space-y-3 p-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="grid grid-cols-8 gap-3">
            {Array.from({ length: 8 }).map((__, cellIndex) => (
              <Skeleton key={cellIndex} className="h-8 w-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminMembersPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  const form = useForm<AddMemberValues>({
    resolver: standardSchemaResolver(addMemberSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      momoNumber: "",
      momoNetwork: undefined,
      password: "",
    },
  });

  const { data, error, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["admin-members"],
    queryFn: fetchMembers,
  });

  const addMemberMutation = useMutation({
    mutationFn: createMember,
    onSuccess: async () => {
      toast.success("Member created successfully.");
      setDialogOpen(false);
      form.reset();
      await queryClient.invalidateQueries({ queryKey: ["admin-members"] });
    },
    onError: (mutationError: Error) => {
      toast.error(mutationError.message || "Unable to create member.");
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Platform Users</h1>
          <p className="text-sm text-muted-foreground">
            Manage platform users and onboard new participants.
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>Add Member</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Add member</DialogTitle>
              <DialogDescription>
                Create a new member account for MoneyLoop.
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form
                onSubmit={form.handleSubmit((values) =>
                  addMemberMutation.mutate(values)
                )}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full name</FormLabel>
                      <FormControl>
                        <Input placeholder="Kwame Mensah" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="you@example.com"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input placeholder="0241234567" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="momoNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>MoMo number</FormLabel>
                        <FormControl>
                          <Input placeholder="0241234567" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="momoNetwork"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Network</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select network" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="MTN">MTN</SelectItem>
                            <SelectItem value="VodafoneCash">Vodafone</SelectItem>
                            <SelectItem value="AirtelTigo">AirtelTigo</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="••••••••" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={addMemberMutation.isPending}>
                    {addMemberMutation.isPending ? (
                      <span className="flex items-center gap-2">
                        <LoadingSpinner />
                        Creating...
                      </span>
                    ) : (
                      "Create member"
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <TableSkeleton />
      ) : error || !data ? (
        <Card className="border-destructive/20">
          <CardHeader>
            <CardTitle>Unable to load members</CardTitle>
            <CardDescription>
              {(error as Error | undefined)?.message ??
                "Something went wrong while loading member records."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              type="button"
              variant="outline"
              onClick={() => refetch()}
              disabled={isRefetching}
            >
              {isRefetching ? "Retrying..." : "Try again"}
            </Button>
          </CardContent>
        </Card>
      ) : data.length === 0 ? (
        <Card>
          <CardHeader className="items-center text-center">
            <CardTitle>No users yet</CardTitle>
            <CardDescription>
              Add the first user to start onboarding people to the platform.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button type="button" onClick={() => setDialogOpen(true)}>
              Add your first user
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Platform users</CardTitle>
            <CardDescription>
              {data.length} user{data.length === 1 ? "" : "s"} registered
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>MoMo Number</TableHead>
                  <TableHead>Network</TableHead>
                  <TableHead>Groups</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">{member.name}</TableCell>
                    <TableCell>{member.email}</TableCell>
                    <TableCell>{member.phone}</TableCell>
                    <TableCell>{member.momoNumber}</TableCell>
                    <TableCell>
                      {member.momoNetwork === "VodafoneCash"
                        ? "Vodafone"
                        : member.momoNetwork}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{member.groupCount}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={roleBadgeClass(member.role)}>
                        {member.role}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(member.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
