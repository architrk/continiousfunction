import type { AppProps } from 'next/app'
import 'katex/dist/katex.min.css'
import '../styles/globals.css'
import Layout from '@/components/app/Layout'

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <div>
      <Layout>
        <Component {...pageProps} />
      </Layout>
    </div>
  )
}
