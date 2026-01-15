// app/combo/new/page.tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import ComboInputPage from "./ComboInputPage";

export default async function ComboNewPage() {
  const user = await getCurrentUser();

  // 未ログインならログイン画面へリダイレクト
  if (!user) {
    // ログイン後に戻ってきたい場合のためにクエリを付与
    redirect("/login?from=/combo/new");
  }

  // ログイン済みなら入力画面を表示
  return <ComboInputPage />;
}
