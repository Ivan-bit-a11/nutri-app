"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { submitPaymentProof } from "@/lib/actions/consultations"
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
  payment_phone: string | null
  payment_instructions: string | null
}

type RequestRow = {
  id: string
  status: string
  nutritionist_id: string
  reason: string | null
  created_at?: string
  nutritionist?: { full_name: string | null } | null
}

type PaymentRow = {
  id: string
  status: string
  amount: number | null
  proof_text: string
  created_at: string
  nutritionist?: { full_name: string | null } | null
}

const PAY_STATUS: Record<string, string> = {
  submitted: "Enviado — aguarda confirmação",
  confirmed: "Confirmado",
  rejected: "Rejeitado",
}

const REQ_STATUS: Record<string, string> = {
  pending: "Pendente",
  awaiting_payment: "Aguarda pagamento",
  paid: "Pago",
  approved: "Aprovado",
  rejected: "Rejeitado",
  cancelled: "Cancelado",
}

export function PagamentosClient({
  nutritionists,
  requests,
  payments,
}: {
  nutritionists: Nutritionist[]
  requests: RequestRow[]
  payments: PaymentRow[]
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [nutritionistId, setNutritionistId] = useState("")
  const [consultId, setConsultId] = useState("")
  const [amount, setAmount] = useState("")
  const [paymentPhone, setPaymentPhone] = useState("")
  const [proofText, setProofText] = useState("")

  const selected = useMemo(
    () => nutritionists.find((n) => n.id === nutritionistId),
    [nutritionists, nutritionistId],
  )

  const linkedRequests = useMemo(
    () =>
      requests.filter(
        (r) =>
          r.nutritionist_id === nutritionistId &&
          ["pending", "awaiting_payment"].includes(r.status),
      ),
    [requests, nutritionistId],
  )

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!nutritionistId) {
      toast.error("Seleccione o nutricionista.")
      return
    }
    if (!proofText.trim() || proofText.trim().length < 10) {
      toast.error("Cole o SMS / texto de confirmação (mínimo 10 caracteres).")
      return
    }

    setLoading(true)
    try {
      const fd = new FormData()
      fd.set("nutritionist_id", nutritionistId)
      if (consultId) fd.set("consultation_request_id", consultId)
      if (amount) fd.set("amount", amount)
      if (paymentPhone) fd.set("payment_phone", paymentPhone)
      fd.set("proof_text", proofText.trim())

      const result = await submitPaymentProof(fd)

      if (!result.success) {
        toast.error(result.error.message)
        return
      }

      toast.success("Comprovativo enviado ao nutricionista.")

      // NÃO usar e.currentTarget.reset() — limpar só o estado
      setConsultId("")
      setAmount("")
      setPaymentPhone("")
      setProofText("")
      router.refresh()
    } catch {
      toast.error("Não foi possível enviar. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Pagamentos</h1>
        <p className="text-muted-foreground">
          1) Escolha o nutricionista e veja o número · 2) Transfira fora da app · 3) Copie o SMS ·
          4) Cole abaixo e envie.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pedidos de consulta</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{requests.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Comprovativos enviados</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{payments.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Enviar comprovativo</CardTitle>
          <CardDescription>
            A transferência é feita fora da aplicação. Só o texto do SMS é guardado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nutricionista</Label>
              <Select
                value={nutritionistId}
                onValueChange={(v) => {
                  setNutritionistId(v)
                  setConsultId("")
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  {nutritionists.map((n) => (
                    <SelectItem key={n.id} value={n.id}>
                      {n.full_name || n.id.slice(0, 8)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selected && (
              <div className="rounded-md border border-primary/30 bg-primary/5 p-4 text-sm space-y-1">
                <p className="font-semibold">Número para transferência</p>
                <p className="text-lg font-mono font-bold">
                  {selected.payment_phone?.trim()
                    ? selected.payment_phone
                    : "Sem número — peça para preencher payment_phone no perfil"}
                </p>
                {selected.payment_instructions && (
                  <p className="text-muted-foreground whitespace-pre-wrap pt-1">
                    {selected.payment_instructions}
                  </p>
                )}
              </div>
            )}

            {linkedRequests.length > 0 && (
              <div className="space-y-2">
                <Label>Associar ao pedido de consulta</Label>
                <Select value={consultId} onValueChange={setConsultId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar pedido" />
                  </SelectTrigger>
                  <SelectContent>
                    {linkedRequests.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {(r.reason || "Consulta") + " — " + (REQ_STATUS[r.status] || r.status)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="amount">Valor (opcional)</Label>
              <Input
                id="amount"
                placeholder="Ex.: 1500"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment_phone">O seu número da transferência (opcional)</Label>
              <Input
                id="payment_phone"
                placeholder="84XXXXXXX"
                value={paymentPhone}
                onChange={(e) => setPaymentPhone(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="proof_text">SMS / confirmação *</Label>
              <Textarea
                id="proof_text"
                required
                minLength={10}
                rows={5}
                placeholder="Cole aqui o SMS completo..."
                value={proofText}
                onChange={(e) => setProofText(e.target.value)}
              />
            </div>

            <Button type="submit" disabled={loading}>
              {loading ? "A enviar..." : "Enviar comprovativo ao nutricionista"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de comprovativos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {payments.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum envio ainda.</p>
          )}
          {payments.map((p) => (
            <div key={p.id} className="rounded-lg border p-3 space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">
                  {p.nutritionist?.full_name || "Nutricionista"}
                  {p.amount != null ? ` — ${p.amount} MZN` : ""}
                </p>
                <Badge variant="secondary">{PAY_STATUS[p.status] || p.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {new Date(p.created_at).toLocaleString("pt-PT")}
              </p>
              <pre className="mt-2 max-h-24 overflow-auto rounded bg-muted p-2 text-xs whitespace-pre-wrap">
                {p.proof_text}
              </pre>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}