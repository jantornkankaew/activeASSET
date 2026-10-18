import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const results: any = {}
  
  try {
    results.simpleFind = await db.productCatalog.findMany({ take: 1 })
  } catch (e: any) {
    results.simpleFindErr = { msg: e.message, meta: e.meta }
  }
  
  try {
    results.withInclude = await db.productCatalog.findMany({
      take: 1,
      include: {
        units: { select: { tagId: true, status: true, source: true } },
        requestLines: { select: { quantity: true, fulfilledQty: true } },
        waitingList: { where: { status: { in: ['Waiting', 'Notified'] } }, select: { quantity: true } },
      },
    })
  } catch (e: any) {
    results.withIncludeErr = { msg: e.message, meta: e.meta }
  }
  
  return NextResponse.json(results)
}
