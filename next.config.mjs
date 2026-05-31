import createMDX from '@next/mdx'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeSlug from 'rehype-slug'
import bundleAnalyzer from '@next/bundle-analyzer'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = dirname(fileURLToPath(import.meta.url))

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})

const withMDX = createMDX({
  extension: /\.mdx?$/,
  options: {
    remarkPlugins: [remarkMath],
    rehypePlugins: [
      [rehypeKatex, { trust: false, strict: 'warn', throwOnError: false }],
      rehypeSlug
    ]
  }
})

const isStaticExport = process.env.CF_STATIC_EXPORT === '1'

/** @type {import('next').NextConfig} */
const nextConfig = {
  pageExtensions: ['ts', 'tsx', 'mdx'],
  outputFileTracingRoot: repoRoot,
  // Account-backed platform features need normal Next.js server behavior.
  // Keep static export available for archival mirrors with CF_STATIC_EXPORT=1.
  output: isStaticExport ? 'export' : undefined,
  trailingSlash: true,
  experimental: {
    ...(process.env.CF_NEXT_BUILD_CPUS
      ? { cpus: Number(process.env.CF_NEXT_BUILD_CPUS) }
      : {}),
  },
}

export default withBundleAnalyzer(withMDX(nextConfig))
