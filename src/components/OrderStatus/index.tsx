import { OrderStatus as StatusOptions } from '@/payload-types'
import { cn } from '@/utilities/cn'

type Props = {
  status: StatusOptions
  className?: string
}

/**
 * Orders are created as `processing` and are settled on delivery (COD), so the
 * shopper-facing wording is about the delivery, not about payment capture.
 */
const labels: Record<string, string> = {
  processing: 'En préparation',
  completed: 'Livrée',
  cancelled: 'Annulée',
  refunded: 'Remboursée',
}

export const OrderStatus: React.FC<Props> = ({ status, className }) => {
  if (!status) return null

  return (
    <span
      className={cn(
        'inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-medium',
        className,
        {
          'bg-primary/15 text-primary-ink': status === 'processing',
          'bg-accent/20 text-accent-800': status === 'completed',
          'bg-secondary/50 text-muted': status === 'cancelled' || status === 'refunded',
        },
      )}
    >
      {labels[status] ?? status}
    </span>
  )
}
