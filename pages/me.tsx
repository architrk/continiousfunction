import Head from 'next/head'
import AccountMemoryPreview from '@/components/account/AccountMemoryPreview'

export default function AccountMemoryPage() {
  return (
    <>
      <Head>
        <title>Continuous Function — Study Memory</title>
        <meta
          name="description"
          content="Preview how Continuous Function will preserve learner route snapshots, selected objects, predictions, and observations as account-backed study memory."
        />
      </Head>
      <AccountMemoryPreview />
    </>
  )
}
