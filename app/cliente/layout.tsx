import Link from "next/link"
import { Leaf, Home, CalendarPlus, CreditCard, FileText, LogOut } from "lucide-react"
import { signOut } from "@/lib/actions/auth"
import { Button } from "@/components/ui/button"

const NAV = [
  { href: "/cliente", label: "Início", icon: Home },
  { href: "/cliente/consultas", label: "Consultas", icon: CalendarPlus },
  { href: "/cliente/pagamentos", label: "Pagamentos", icon: CreditCard },
  { href: "/cliente/planos", label: "Meus planos", icon: FileText },
]

export default function ClienteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Leaf className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm font-bold leading-none">NutriFlow</p>
              <p className="text-[10px] text-muted-foreground">Área do Cliente</p>
            </div>
          </div>
          <nav className="hidden items-center gap-1 sm:flex">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href}>
                <Button variant="ghost" size="sm" className="gap-1.5">
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Button>
              </Link>
            ))}
            <form action={signOut}>
              <Button type="submit" variant="outline" size="sm" className="gap-1.5 ml-2">
                <LogOut className="h-4 w-4" />
                Sair
              </Button>
            </form>
          </nav>
        </div>
      </header>
      <nav className="flex gap-1 overflow-x-auto border-b px-2 py-2 sm:hidden">
        {NAV.map((item) => (
          <Link key={item.href} href={item.href}>
            <Button variant="ghost" size="sm" className="gap-1 shrink-0">
              <item.icon className="h-4 w-4" />
              {item.label}
            </Button>
          </Link>
        ))}
      </nav>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      <footer className="border-t py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Ivan Mbalame — NutriFlow
      </footer>
    </div>
  )
}
