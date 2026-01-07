import type { AppProps } from 'next/app'
import { Crimson_Pro, IBM_Plex_Sans, JetBrains_Mono } from 'next/font/google'
import 'katex/dist/katex.min.css'
import '../styles/globals.css'
import Layout from '../components/Layout'

// Self-hosted fonts via next/font (build-time optimization, no runtime fetch)
const crimsonPro = Crimson_Pro({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-display',
})

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--font-body',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--font-mono',
})

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <div className={`${crimsonPro.variable} ${ibmPlexSans.variable} ${jetbrainsMono.variable}`}>
      <Layout>
        <Component {...pageProps} />
      </Layout>
    </div>
  )
}
