import type { User } from "@prisma/client";

function parseAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminUser(user: Pick<User, "email"> | null | undefined): boolean {
  if (!user?.email) return false;
  const admins = parseAdminEmails();
  return admins.includes(user.email.trim().toLowerCase());
}
