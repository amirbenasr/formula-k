import { Grid } from '@/components/Grid'
import React from 'react'

export default function Loading() {
  return (
    <Grid className="grid-cols-2 lg:grid-cols-3">
      {Array(12)
        .fill(0)
        .map((_, index) => {
          return <div className="animate-pulse bg-secondary dark:bg-secondary" key={index} />
        })}
    </Grid>
  )
}
