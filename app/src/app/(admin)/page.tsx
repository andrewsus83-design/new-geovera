import { redirect } from "next/navigation";

// Admin root → Start page (first page after login)
export default function AdminRootPage() {
  redirect("/getting-started");
}
