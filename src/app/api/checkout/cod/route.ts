import { getPayload } from 'payload'
import config from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const body = await request.json()

    const { cartId, customerEmail, billingAddress, shippingAddress, userId } = body

    if (!cartId) {
      return NextResponse.json({ error: 'Cart ID is required' }, { status: 400 })
    }

    if (!billingAddress) {
      return NextResponse.json({ error: 'Billing address is required' }, { status: 400 })
    }

    // Get the cart
    const cart = await payload.findByID({
      collection: 'carts',
      id: cartId,
      depth: 2,
    })

    if (!cart || !cart.items || cart.items.length === 0) {
      return NextResponse.json({ error: 'Cart is empty or not found' }, { status: 400 })
    }

    // Check inventory for all items
    for (const item of cart.items) {
      const product = typeof item.product === 'object' ? item.product : null
      const variant = typeof item.variant === 'object' ? item.variant : null

      if (variant) {
        if (variant.inventory !== null && variant.inventory < item.quantity) {
          return NextResponse.json(
            { error: `Not enough stock for ${product?.title || 'item'}` },
            { status: 400 },
          )
        }
      } else if (product) {
        if (product.inventory !== null && product.inventory < item.quantity) {
          return NextResponse.json(
            { error: `Not enough stock for ${product.title}` },
            { status: 400 },
          )
        }
      }
    }

    // Calculate total
    let total = 0
    const orderItems = cart.items.map((item) => {
      const product = typeof item.product === 'object' ? item.product : null
      const variant = typeof item.variant === 'object' ? item.variant : null

      const price = variant?.priceInUSD ?? product?.priceInUSD ?? 0
      total += price * item.quantity

      return {
        product: typeof item.product === 'object' ? item.product?.id : item.product,
        variant: typeof item.variant === 'object' ? item.variant?.id : item.variant,
        quantity: item.quantity,
      }
    })

    // Create the order
    const order = await payload.create({
      collection: 'orders',
      data: {
        items: orderItems,
        shippingAddress: shippingAddress || billingAddress,
        customer: userId || null,
        customerEmail: customerEmail || null,
        status: 'processing',
        amount: total,
        currency: 'USD',
      },
    })

    // Update inventory
    for (const item of cart.items) {
      const product = typeof item.product === 'object' ? item.product : null
      const variant = typeof item.variant === 'object' ? item.variant : null

      if (variant && variant.inventory !== null) {
        await payload.update({
          collection: 'variants',
          id: variant.id,
          data: {
            inventory: variant.inventory - item.quantity,
          },
        })
      } else if (product && product.inventory !== null) {
        await payload.update({
          collection: 'products',
          id: product.id,
          data: {
            inventory: product.inventory - item.quantity,
          },
        })
      }
    }

    // Mark cart as purchased
    await payload.update({
      collection: 'carts',
      id: cartId,
      data: {
        status: 'purchased',
        purchasedAt: new Date().toISOString(),
      },
    })

    return NextResponse.json({
      success: true,
      orderId: order.id,
      message: 'Order placed successfully. Pay on delivery.',
    })
  } catch (error) {
    console.error('COD checkout error:', error)
    return NextResponse.json(
      { error: 'An error occurred while processing your order' },
      { status: 500 },
    )
  }
}
