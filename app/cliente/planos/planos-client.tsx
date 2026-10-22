"use client"

import { FileDown, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

type MealItem = {
  food_name: string
  quantity: string | null
  unit: string | null
  kcal: number | null
}

type Meal = {
  name: string
  time_of_day: string | null
  meal_items: MealItem[]
}

type Plan = {
  id: string
  title: string
  description: string | null
  daily_kcal: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  notes: string | null
  created_at: string
  meals: Meal[]
  nutritionist?: { full_name: string | null; clinic_name: string | null } | null
}

function downloadPdf(plan: Plan) {
  const lines: string[] = []
  lines.push(`PLANO ALIMENTAR — ${plan.title}`)
  lines.push(`Nutricionista: ${plan.nutritionist?.full_name || "—"}`)
  if (plan.nutritionist?.clinic_name) lines.push(`Clínica: ${plan.nutritionist.clinic_name}`)
  lines.push(`Data: ${new Date(plan.created_at).toLocaleDateString("pt-PT")}`)
  lines.push("")
  if (plan.description) {
    lines.push(plan.description)
    lines.push("")
  }
  lines.push(
    `Metas diárias: ${plan.daily_kcal ?? "—"} kcal | P ${plan.protein_g ?? "—"}g | C ${plan.carbs_g ?? "—"}g | G ${plan.fat_g ?? "—"}g`,
  )
  lines.push("")
  for (const meal of plan.meals || []) {
    lines.push(`▸ ${meal.name}${meal.time_of_day ? ` (${meal.time_of_day})` : ""}`)
    for (const item of meal.meal_items || []) {
      const qty = [item.quantity, item.unit].filter(Boolean).join(" ")
      lines.push(`  • ${item.food_name}${qty ? ` — ${qty}` : ""}${item.kcal != null ? ` (${item.kcal} kcal)` : ""}`)
    }
    lines.push("")
  }
  if (plan.notes) {
    lines.push("Notas:")
    lines.push(plan.notes)
  }
  lines.push("")
  lines.push("— NutriFlow · © Ivan Mbalame")

  const text = lines.join("\n")
  // Simple printable HTML → user can Save as PDF from browser
  const html = `<!DOCTYPE html><html lang="pt"><head><meta charset="utf-8"/><title>${plan.title}</title>
  <style>
    body{font-family:system-ui,sans-serif;max-width:720px;margin:40px auto;padding:0 16px;color:#111;line-height:1.5}
    h1{font-size:1.4rem;margin-bottom:0.25rem}
    .meta{color:#555;font-size:0.9rem;margin-bottom:1.5rem}
    .meal{margin:1rem 0}
    .meal h2{font-size:1.05rem;margin:0 0 0.35rem;border-bottom:1px solid #ddd;padding-bottom:0.2rem}
    ul{margin:0;padding-left:1.2rem}
    footer{margin-top:2rem;font-size:0.75rem;color:#888;border-top:1px solid #eee;padding-top:0.75rem}
    @media print{body{margin:0}}
  </style></head><body>
  <h1>${escapeHtml(plan.title)}</h1>
  <div class="meta">
    Nutricionista: ${escapeHtml(plan.nutritionist?.full_name || "—")}<br/>
    ${plan.nutritionist?.clinic_name ? `Clínica: ${escapeHtml(plan.nutritionist.clinic_name)}<br/>` : ""}
    Data: ${new Date(plan.created_at).toLocaleDateString("pt-PT")}<br/>
    Metas: ${plan.daily_kcal ?? "—"} kcal · P ${plan.protein_g ?? "—"}g · C ${plan.carbs_g ?? "—"}g · G ${plan.fat_g ?? "—"}g
  </div>
  ${plan.description ? `<p>${escapeHtml(plan.description)}</p>` : ""}
  ${(plan.meals || [])
    .map(
      (m) => `<div class="meal"><h2>${escapeHtml(m.name)}${m.time_of_day ? ` <small>(${escapeHtml(m.time_of_day)})</small>` : ""}</h2>
    <ul>${(m.meal_items || [])
      .map((i) => {
        const q = [i.quantity, i.unit].filter(Boolean).join(" ")
        return `<li>${escapeHtml(i.food_name)}${q ? ` — ${escapeHtml(q)}` : ""}${i.kcal != null ? ` (${i.kcal} kcal)` : ""}</li>`
      })
      .join("")}</ul></div>`,
    )
    .join("")}
  ${plan.notes ? `<p><strong>Notas:</strong> ${escapeHtml(plan.notes)}</p>` : ""}
  <footer>NutriFlow · © Ivan Mbalame<br/><small>Texto exportado: ${escapeHtml(text.slice(0, 80))}…</small></footer>
  <script>window.onload=function(){window.print()}</script>
  </body></html>`

  const w = window.open("", "_blank")
  if (w) {
    w.document.write(html)
    w.document.close()
  }
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export function PlanosClient({ plans }: { plans: Plan[] }) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Meus planos alimentares</h1>
        <p className="text-muted-foreground">
          Planos atribuídos pelo seu nutricionista. Use &quot;Descarregar PDF&quot; para imprimir
          ou guardar como PDF no navegador.
        </p>
      </div>

      {plans.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <FileText className="mx-auto mb-3 h-10 w-10 opacity-40" />
            <p>Ainda não há planos enviados para si.</p>
            <p className="text-sm mt-1">
              Quando o nutricionista confirmar o seu pagamento e enviar o plano, ele aparece aqui
              para descarregar em PDF. Cada plano é individual — só a sua conta o vê.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {plans.map((plan) => (
          <Card key={plan.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>{plan.title}</CardTitle>
                <CardDescription>
                  {plan.nutritionist?.full_name || "Nutricionista"}
                  {plan.daily_kcal != null ? ` · ${plan.daily_kcal} kcal/dia` : ""}
                </CardDescription>
              </div>
              <Button size="sm" className="gap-1.5 shrink-0" onClick={() => downloadPdf(plan)}>
                <FileDown className="h-4 w-4" />
                Descarregar PDF
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {plan.description && (
                <p className="text-sm text-muted-foreground">{plan.description}</p>
              )}
              <div className="flex flex-wrap gap-2">
                {plan.protein_g != null && <Badge variant="secondary">P {plan.protein_g}g</Badge>}
                {plan.carbs_g != null && <Badge variant="secondary">C {plan.carbs_g}g</Badge>}
                {plan.fat_g != null && <Badge variant="secondary">G {plan.fat_g}g</Badge>}
                <Badge variant="outline">
                  {(plan.meals || []).length} refeições
                </Badge>
              </div>
              <ul className="text-sm space-y-1">
                {(plan.meals || []).map((m, i) => (
                  <li key={i}>
                    <span className="font-medium">{m.name}</span>
                    {m.time_of_day ? ` · ${m.time_of_day}` : ""} —{" "}
                    {(m.meal_items || []).length} itens
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
