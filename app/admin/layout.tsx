import Link from "next/link"
import { Leaf, LayoutDashboard, LogOut } from "lucide-react"
import { signOut } from "@/lib/actions/auth"
import { Button } from "@/components/ui/button"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Leaf className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm font-bold leading-none">NutriFlow</p>
              <p className="text-[10px] text-muted-foreground">Painel Super Admin</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin">
              <Button variant="ghost" size="sm" className="gap-1.5">
                <LayoutDashboard className="h-4 w-4" />
                Início
              </Button>
            </Link>
            <form action={signOut}>
              <Button type="submit" variant="outline" size="sm" className="gap-1.5">
                <LogOut className="h-4 w-4" />
                Sair
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      <footer className="border-t py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Ivan Mbalame — NutriFlow
      </footer>
    </div>
  )
}
