import { db } from '@/lib/db'

async function test() {
  // Test one failing catalog — get the FULL data
  console.log('Test: get one failing catalog with ALL fields')
  const failing = await db.productCatalog.findUnique({
    where: { id: 'cmvd6sb0c2aq419oz3hflua7dh' },
  })
  console.log('Catalog:', JSON.stringify(failing, null, 2))

  console.log('\nTest: get units of failing catalog')
  try {
    const r = await db.productCatalog.findUnique({
      where: { id: 'cmvd6sb0c2aq419oz3hflua7dh' },
      include: { units: true },
    })
    console.log('OK with units:', r?.units.length)
  } catch (e: any) {
    console.log('FAIL with units:', e.message)
  }

  console.log('\nTest: get requestLines of failing catalog')
  try {
    const r = await db.productCatalog.findUnique({
      where: { id: 'cmvd6sb0c2aq419oz3hflua7dh' },
      include: { requestLines: true },
    })
    console.log('OK with requestLines:', r?.requestLines.length)
  } catch (e: any) {
    console.log('FAIL with requestLines:', e.message)
  }

  console.log('\nTest: get waitingList of failing catalog')
  try {
    const r = await db.productCatalog.findUnique({
      where: { id: 'cmvd6sb0c2aq419oz3hflua7dh' },
      include: { waitingList: true },
    })
    console.log('OK with waitingList:', r?.waitingList.length)
  } catch (e: any) {
    console.log('FAIL with waitingList:', e.message)
  }

  // Check the AssetUnit rows for this catalog
  console.log('\nAssetUnits for this catalog:')
  const units = await db.assetUnit.findMany({ where: { catalogId: 'cmvd6sb0c2aq419oz3hflua7dh' } })
  console.log('Count:', units.length)
  if (units[0]) console.log('First unit:', JSON.stringify(units[0], null, 2))

  await db.$disconnect()
}

test()
