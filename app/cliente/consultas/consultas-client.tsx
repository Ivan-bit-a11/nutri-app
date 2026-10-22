"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { requestConsultation } from "@/lib/actions/consultations"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"

type Nutritionist = {
  id: string
  full_name: string | null
  clinic_name: string | null
  payment_phone: string | null
  payment_instructions: string | null
  phone: string | null
}

type RequestRow = {
  id: string
  status: string
  reason: string | null
  preferred_date: string | null
  notes: string | null
  created_at: string
  nutritionist?: { full_name: string | null; clinic_name: string | null } | null
}

const STATUS: Record<string, string> = {
  pending: "Pendente (sem pagamento)",
  awaiting_payment: "Comprovativo enviado",
  paid: "Pagamento confirmado",
  approved: "Consulta aprovada",
  rejected: "Rejeitado",
  cancelled: "Cancelado",
}

export function ConsultasClient({
  nutritionists,
  requests,
}: {
  nutritionists: Nutritionist[]
  requests: RequestRow[]
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [nutritionistId, setNutritionistId] = useState("")
  const [reason, setReason] = useState("")
  const [preferredDate, setPreferredDate] = useState("")
  const [notes, setNotes] = useState("")

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!nutritionistId) {
      toast.error("Seleccione um nutricionista.")
      return
    }

    setLoading(true)
    try {
      const fd = new FormData()
      fd.set("nutritionist_id", nutritionistId)
      if (reason) fd.set("reason", reason)
      if (preferredDate) fd.set("preferred_date", preferredDate)
      if (notes) fd.set("notes", notes)

      const result = await requestConsultation(fd)

      if (!result.success) {
        toast.error(result.error.message)
        return
      }

      toast.success("Pedido enviado. Fica pendente até o pagamento ser confirmado.")
      setNutritionistId("")
      setReason("")
      setPreferredDate("")
      setNotes("")
      router.refresh()
    } catch {
      toast.error("Não foi possível enviar o pedido. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  const selected = nutritionists.find((n) => n.id === nutritionistId)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Solicitar consulta</h1>
        <p className="text-muted-foreground">
          Pode pedir consulta sem pagar. No painel do nutricionista aparece como{" "}
          <strong>pendente</strong> até confirmar o pagamento.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Novo pedido</CardTitle>
          <CardDescription>
            Escolha o nutricionista. Depois poderá ver o número para transferência e enviar o SMS
            na área de Pagamentos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nutricionista</Label>
              <Select value={nutritionistId} onValueChange={setNutritionistId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  {nutritionists.map((n) => (
                    <SelectItem key={n.id} value={n.id}>
                      {n.full_name || n.clinic_name || n.id.slice(0, 8)}
                      {n.clinic_name ? ` — ${n.clinic_name}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selected && (selected.payment_phone || selected.payment_instructions) && (
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                <p className="font-medium">Dados para pagamento</p>
                {selected.payment_phone && (
                  <p>
                    Número: <strong>{selected.payment_phone}</strong>
                  </p>
                )}
                {selected.payment_instructions && (
                  <p className="mt-1 text-muted-foreground whitespace-pre-wrap">
                    {selected.payment_instructions}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="reason">Motivo / objectivo</Label>
              <Input
                id="reason"
                placeholder="Ex.: Plano para emagrecimento"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="preferred_date">Data preferida (opcional)</Label>
              <Input
                id="preferred_date"
                type="date"
                value={preferredDate}
                onChange={(e) => setPreferredDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notas</Label>
              <Textarea
                id="notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <Button type="submit" disabled={loading}>
              {loading ? "A enviar..." : "Solicitar consulta"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Os meus pedidos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {requests.length === 0 && (
            <p className="text-sm text-muted-foreground">Ainda não há pedidos.</p>
          )}
          {requests.map((r) => (
            <div
              key={r.id}
              className="flex flex-col gap-1 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium">
                  {r.nutritionist?.full_name || "Nutricionista"}
                  {r.reason ? ` — ${r.reason}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleString("pt-PT")}
                </p>
              </div>
              <Badge variant="secondary">{STATUS[r.status] || r.status}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}