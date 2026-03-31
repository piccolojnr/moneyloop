"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Shield, UserPlus, Users } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  momoNumber: string | null;
  momoNetwork: "MTN" | "VodafoneCash" | "AirtelTigo" | null;
  role: "MEMBER" | "ADMIN";
  createdAt: string;
  groupCount: number;
};

type PaginatedMembersResponse = {
  data: Member[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
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

async function fetchMembers(page: number) {
  const response = await fetch(`/api/members?page=${page}&pageSize=10`, {
    credentials: "include",
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(body?.error ?? "Failed to load users");
  }

  return (await response.json()) as PaginatedMembersResponse;
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
        : "Failed to create user"
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

function networkLabel(network: Member["momoNetwork"]) {
  if (!network) {
    return "—";
  }

  return network === "VodafoneCash" ? "Vodafone" : network;
}

function TableSkeleton() {
  return (
    <Card className="shadow-sm">
      <CardHeader className="space-y-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-8 w-52" />
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: 5 }).map((_, rowIndex) => (
          <div key={rowIndex} className="grid grid-cols-8 gap-3">
            {Array.from({ length: 8 }).map((__, cellIndex) => (
              <Skeleton key={cellIndex} className="h-10 w-full" />
            ))}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function AdminMembersPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [page, setPage] = useState(1);

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

  const membersQuery = useQuery({
    queryKey: ["admin-members", page],
    queryFn: () => fetchMembers(page),
  });

  const addMemberMutation = useMutation({
    mutationFn: createMember,
    onSuccess: async () => {
      toast.success("User created successfully.");
      setDialogOpen(false);
      form.reset();
      await queryClient.invalidateQueries({ queryKey: ["admin-members"] });
    },
    onError: (mutationError: Error) => {
      toast.error(mutationError.message || "Unable to create user.");
    },
  });

  const summary = useMemo(() => {
    const users = membersQuery.data?.data ?? [];
    return {
      total: users.length,
      admins: users.filter((user) => user.role === "ADMIN").length,
      groupedUsers: users.filter((user) => user.groupCount > 0).length,
    };
  }, [membersQuery.data]);

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border bg-card shadow-sm">
        <div className="flex flex-col gap-6 p-6 lg:flex-row lg:items-start lg:justify-between lg:p-8">
          <div className="space-y-3">
            <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">
              User oversight
            </Badge>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight">Platform Users</h1>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                Review who is on the platform, how widely they participate in groups,
                and create new accounts when you need to intervene manually.
              </p>
            </div>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-xl">
                <UserPlus className="mr-2 size-4" />
                Add Member
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Add member</DialogTitle>
                <DialogDescription>
                  Create a new MoneyLoop account with mobile money details.
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
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          {
            label: "Total users",
            value: summary.total,
            note: "Accounts on the platform",
            icon: Users,
          },
          {
            label: "System admins",
            value: summary.admins,
            note: "Users with platform access",
            icon: Shield,
          },
          {
            label: "Grouped members",
            value: summary.groupedUsers,
            note: "Users already attached to a group",
            icon: UserPlus,
          },
        ].map((item) => {
          const Icon = item.icon;

          return (
            <Card key={item.label} className="shadow-sm">
              <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                <div>
                  <CardDescription>{item.label}</CardDescription>
                  <CardTitle className="mt-3 text-3xl">{item.value}</CardTitle>
                </div>
                <div className="flex size-11 items-center justify-center rounded-2xl bg-muted">
                  <Icon className="size-5 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{item.note}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {membersQuery.isLoading ? (
        <TableSkeleton />
      ) : membersQuery.error || !membersQuery.data ? (
        <Card className="border-destructive/20 shadow-sm">
          <CardHeader>
            <CardTitle>Unable to load users</CardTitle>
            <CardDescription>
              {(membersQuery.error as Error | undefined)?.message ??
                "Something went wrong while loading platform users."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              type="button"
              variant="outline"
              onClick={() => membersQuery.refetch()}
              disabled={membersQuery.isRefetching}
            >
              {membersQuery.isRefetching ? "Retrying..." : "Try again"}
            </Button>
          </CardContent>
        </Card>
      ) : membersQuery.data.data.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="flex min-h-72 flex-col items-center justify-center gap-4 text-center">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">No users yet</h2>
              <p className="max-w-md text-sm leading-6 text-muted-foreground">
                The platform does not have any users yet. Add the first member to
                begin onboarding accounts and testing group operations.
              </p>
            </div>
            <Button type="button" onClick={() => setDialogOpen(true)}>
              Add your first user
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-sm">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <CardTitle>User directory</CardTitle>
              <CardDescription>
                {membersQuery.data.pagination.total} user{membersQuery.data.pagination.total === 1 ? "" : "s"} currently visible to platform admins.
              </CardDescription>
            </div>
            <Badge variant="secondary" className="w-fit">
              Updated live
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-2xl border">
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
                  {membersQuery.data.data.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">{member.name}</TableCell>
                      <TableCell>{member.email}</TableCell>
                      <TableCell>{member.phone}</TableCell>
                      <TableCell>{member.momoNumber ?? "—"}</TableCell>
                      <TableCell>{networkLabel(member.momoNetwork)}</TableCell>
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
            </div>
            <div className="mt-4 flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <span>
                Showing page {membersQuery.data.pagination.page} of{" "}
                {membersQuery.data.pagination.totalPages}
              </span>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(current - 1, 1))}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page >= membersQuery.data.pagination.totalPages}
                  onClick={() =>
                    setPage((current) =>
                      Math.min(current + 1, membersQuery.data.pagination.totalPages)
                    )
                  }
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
