import type { ICodingScaffoldStackId } from './coding-scaffold-ids.js';
import { CODING_STACK_LABELS } from './coding-scaffold-ids.js';

export type IScaffoldOpts = {
  readonly taskId: string;
  readonly name: string;
};

export type IScaffoldFilePiece = {
  readonly rel: string;
  readonly content: string;
  readonly skipIfExists?: boolean;
};

const gitignoreStandard = [
  'node_modules/',
  'dist/',
  '.next/',
  'out/',
  '.env',
  '.env*.local',
  '.DS_Store',
  '*.tsbuildinfo',
  '',
].join('\n');

const nextFiles = (o: IScaffoldOpts): IScaffoldFilePiece[] => {
  const { name, taskId } = o;
  return [
    {
      rel: 'package.json',
      content: `${JSON.stringify(
        {
          name,
          version: '0.0.1',
          private: true,
          description: `Next.js scaffold (${taskId})`,
          scripts: {
            dev: 'next dev',
            build: 'next build',
            start: 'next start',
          },
          dependencies: {
            next: '^15.1.0',
            react: '^19.0.0',
            'react-dom': '^19.0.0',
          },
          devDependencies: {
            '@types/node': '^22.0.0',
            '@types/react': '^19.0.0',
            '@types/react-dom': '^19.0.0',
            typescript: '^5.7.0',
          },
        },
        null,
        2
      )}\n`,
      skipIfExists: true,
    },
    {
      rel: 'tsconfig.json',
      content: `${JSON.stringify(
        {
          compilerOptions: {
            target: 'ES2017',
            lib: ['dom', 'dom.iterable', 'esnext'],
            allowJs: true,
            skipLibCheck: true,
            strict: true,
            noEmit: true,
            esModuleInterop: true,
            module: 'esnext',
            moduleResolution: 'bundler',
            resolveJsonModule: true,
            isolatedModules: true,
            jsx: 'preserve',
            incremental: true,
            plugins: [{ name: 'next' }],
            paths: { '@/*': ['./*'] },
          },
          include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
          exclude: ['node_modules'],
        },
        null,
        2
      )}\n`,
      skipIfExists: true,
    },
    {
      rel: 'next.config.ts',
      content: `import type { NextConfig } from 'next';\n\nconst nextConfig: NextConfig = {\n  output: 'export',\n  images: {\n    unoptimized: true,\n  },\n};\n\nexport default nextConfig;\n`,
      skipIfExists: true,
    },
    {
      rel: 'next-env.d.ts',
      content: `/// <reference types="next" />\n/// <reference types="next/image-types/global" />\n`,
      skipIfExists: true,
    },
    {
      rel: 'app/globals.css',
      content:
        '*,\n*::before,\n*::after {\n  box-sizing: border-box;\n}\n\nhtml,\nbody {\n  margin: 0;\n}\n',
      skipIfExists: true,
    },
    {
      rel: 'app/layout.tsx',
      content: `import type { Metadata } from 'next';\nimport type { ReactNode } from 'react';\nimport './globals.css';\n\nexport const metadata: Metadata = {\n  metadataBase: new URL('https://example.com'),\n  title: {\n    default: '${name} · 个人网站',\n    template: '%s · ${name}',\n  },\n  description:\n    '个人简历与作品概要 — Next.js 静态导出站点（coding-agent 脚手架 · ${taskId}）',\n  keywords: ['${name}', '简历', '个人网站', 'Next.js', 'SEO'],\n  alternates: { canonical: '/' },\n  openGraph: {\n    type: 'website',\n    locale: 'zh_CN',\n    title: '${name} · 个人网站',\n    description:\n      '个人简历与作品概要 — Next.js 静态导出站点（coding-agent 脚手架 · ${taskId}）',\n  },\n  robots: { index: true, follow: true },\n};\n\nexport default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {\n  return (\n    <html lang="zh-CN">\n      <body>{children}</body>\n    </html>\n  );\n}\n`,
      skipIfExists: true,
    },
    {
      rel: 'app/page.tsx',
      content:
        `const siteJsonLd = {\n  '@context': 'https://schema.org',\n  '@type': 'Person',\n  name: '潘展飞',\n  jobTitle: '开发者',\n  description:\n    '个人简历主页示例正文 — 请将摘要与联系方式替换为你的真实信息（对齐 PRD）。',\n  url: 'https://example.com',\n} as const;\n\nexport default function HomePage() {\n  return (\n    <>\n      <script\n        type="application/ld+json"\n        dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }}\n      />\n      <main\n        style={{\n          maxWidth: '42rem',\n          margin: '0 auto',\n          padding: '2rem 1.25rem 4rem',\n          fontFamily: 'system-ui, sans-serif',\n          lineHeight: 1.6,\n        }}\n      >\n        <header style={{ marginBottom: '2rem' }}>\n          <p style={{ margin: 0, color: '#555', fontSize: '0.95rem' }}>个人网站</p>\n          <h1 style={{ margin: '0.35rem 0 0', fontSize: '2rem' }}>潘展飞</h1>\n          <p style={{ margin: '0.75rem 0 0', color: '#333' }}>\n            联系方式：<a href="mailto:you@example.com">you@example.com</a>（请替换）\n          </p>\n        </header>\n        <section style={{ marginBottom: '2rem' }} aria-labelledby="summary">\n          <h2 id="summary" style={{ fontSize: '1.25rem' }}>\n            简历摘要\n          </h2>\n          <p style={{ margin: '0.5rem 0 0', color: '#444' }}>\n            在此写入简短自我介绍与职业亮点（静态导出 · SEO 友好 · Task ${taskId}）。\n          </p>\n        </section>\n        <section style={{ marginBottom: '2rem' }} aria-labelledby="skills">\n          <h2 id="skills" style={{ fontSize: '1.25rem' }}>\n            技能\n          </h2>\n          <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem', color: '#444' }}>\n            <li>Next.js / React · 静态站点（SSG）</li>\n            <li>性能与 SEO 基础（meta、结构化数据）</li>\n            <li>TypeScript</li>\n          </ul>\n        </section>\n        <section aria-labelledby="projects">\n          <h2 id="projects" style={{ fontSize: '1.25rem' }}>\n            项目经历\n          </h2>\n          <article style={{ marginTop: '0.75rem' }}>\n            <h3 style={{ margin: 0, fontSize: '1.05rem' }}>示例项目</h3>\n            <p style={{ margin: '0.35rem 0 0', color: '#444' }}>\n              用两三句话描述场景、职责与结果（可链至 GitHub / Demo）。\n            </p>\n          </article>\n        </section>\n      </main>\n    </>\n  );\n}\n`,
      skipIfExists: true,
    },
    {
      rel: 'app/not-found.tsx',
      content: `import Link from 'next/link';\n\nexport default function NotFound() {\n  return (\n    <main\n      style={{\n        minHeight: '60vh',\n        display: 'flex',\n        flexDirection: 'column',\n        alignItems: 'center',\n        justifyContent: 'center',\n        padding: '2rem',\n        fontFamily: 'system-ui, sans-serif',\n        gap: '0.75rem',\n      }}\n    >\n      <h1 style={{ margin: 0 }}>404</h1>\n      <p style={{ margin: 0, color: '#555' }}>页面不存在或链接已失效。</p>\n      <Link href="/" style={{ color: '#0b57d0' }}>\n        返回首页\n      </Link>\n    </main>\n  );\n}\n`,
      skipIfExists: true,
    },
    {
      rel: 'public/.gitkeep',
      content: '',
      skipIfExists: true,
    },
    {
      rel: 'README.md',
      content: `# ${name}\n\nNext.js App Router · **静态导出（\`output: 'export'\`）**，便于托管任意静态站点/CDN。\n\n\`\`\`bash\nnpm install\nnpm run dev\nnpm run build   # 产物目录 out/\n\`\`\`\n`,
      skipIfExists: true,
    },
    {
      rel: '.gitignore',
      content: [
        'node_modules/',
        '.next/',
        'out/',
        '.env*.local',
        '.env',
        '.DS_Store',
        '*.tsbuildinfo',
        '',
      ].join('\n'),
      skipIfExists: true,
    },
  ];
};

const reactViteFiles = (o: IScaffoldOpts): IScaffoldFilePiece[] => {
  const { name, taskId } = o;
  return [
    {
      rel: 'package.json',
      content: `${JSON.stringify(
        {
          name,
          version: '0.0.1',
          private: true,
          type: 'module',
          scripts: {
            dev: 'vite',
            build: 'tsc -b && vite build',
            preview: 'vite preview',
          },
          dependencies: {
            react: '^19.0.0',
            'react-dom': '^19.0.0',
          },
          devDependencies: {
            '@types/react': '^19.0.0',
            '@types/react-dom': '^19.0.0',
            '@vitejs/plugin-react': '^4.3.4',
            typescript: '^5.7.0',
            vite: '^6.0.0',
          },
        },
        null,
        2
      )}\n`,
      skipIfExists: true,
    },
    {
      rel: 'tsconfig.json',
      content: `${JSON.stringify(
        {
          compilerOptions: {
            target: 'ES2022',
            useDefineForClassFields: true,
            lib: ['ES2022', 'DOM', 'DOM.Iterable'],
            module: 'ESNext',
            skipLibCheck: true,
            moduleResolution: 'bundler',
            allowImportingTsExtensions: true,
            resolveJsonModule: true,
            isolatedModules: true,
            noEmit: true,
            jsx: 'react-jsx',
            strict: true,
          },
          include: ['src'],
          references: [{ path: './tsconfig.node.json' }],
        },
        null,
        2
      )}\n`,
      skipIfExists: true,
    },
    {
      rel: 'tsconfig.node.json',
      content: `${JSON.stringify(
        {
          compilerOptions: {
            target: 'ES2022',
            lib: ['ES2023'],
            module: 'ESNext',
            skipLibCheck: true,
            moduleResolution: 'bundler',
          },
          include: ['vite.config.ts'],
        },
        null,
        2
      )}\n`,
      skipIfExists: true,
    },
    {
      rel: 'vite.config.ts',
      content: `import react from '@vitejs/plugin-react';\nimport { defineConfig } from 'vite';\n\nexport default defineConfig({ plugins: [react()] });\n`,
      skipIfExists: true,
    },
    {
      rel: 'index.html',
      content: `<!DOCTYPE html>\n<html lang="zh-CN">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>${name}</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.tsx"></script>\n  </body>\n</html>\n`,
      skipIfExists: true,
    },
    {
      rel: 'src/vite-env.d.ts',
      content: `/// <reference types="vite/client" />\n`,
      skipIfExists: true,
    },
    {
      rel: 'src/main.tsx',
      content: `import { StrictMode } from 'react';\nimport { createRoot } from 'react-dom/client';\nimport App from './App.tsx';\n\ncreateRoot(document.getElementById('root')!).render(\n  <StrictMode>\n    <App />\n  </StrictMode>\n);\n`,
      skipIfExists: true,
    },
    {
      rel: 'src/App.tsx',
      content: `export default function App() {\n  return (\n    <main style={{ padding: '2rem', fontFamily: 'system-ui,sans-serif' }}>\n      <h1>React + Vite</h1>\n      <p>Task: ${taskId}</p>\n    </main>\n  );\n}\n`,
      skipIfExists: true,
    },
    {
      rel: 'README.md',
      content: `# ${name}\n\n${CODING_STACK_LABELS['react-vite-spa']}\n\n\`\`\`bash\nnpm install && npm run dev\n\`\`\`\n`,
      skipIfExists: true,
    },
    { rel: '.gitignore', content: gitignoreStandard, skipIfExists: true },
  ];
};

const vueViteFiles = (o: IScaffoldOpts): IScaffoldFilePiece[] => {
  const { name, taskId } = o;
  return [
    {
      rel: 'package.json',
      content: `${JSON.stringify(
        {
          name,
          version: '0.0.1',
          private: true,
          type: 'module',
          scripts: {
            dev: 'vite',
            build: 'vue-tsc -b && vite build',
            preview: 'vite preview',
          },
          dependencies: {
            vue: '^3.5.0',
          },
          devDependencies: {
            '@vitejs/plugin-vue': '^5.2.0',
            typescript: '^5.7.0',
            vite: '^6.0.0',
            'vue-tsc': '^2.2.0',
          },
        },
        null,
        2
      )}\n`,
      skipIfExists: true,
    },
    {
      rel: 'tsconfig.json',
      content: `${JSON.stringify(
        {
          compilerOptions: {
            target: 'ES2022',
            module: 'ESNext',
            lib: ['ES2022', 'DOM', 'DOM.Iterable'],
            skipLibCheck: true,
            moduleResolution: 'bundler',
            strict: true,
            jsx: 'preserve',
            resolveJsonModule: true,
            isolatedModules: true,
            noEmit: true,
          },
          include: ['src/**/*.ts', 'src/**/*.tsx', 'src/**/*.vue'],
          references: [{ path: './tsconfig.node.json' }],
        },
        null,
        2
      )}\n`,
      skipIfExists: true,
    },
    {
      rel: 'tsconfig.node.json',
      content: `${JSON.stringify(
        {
          compilerOptions: {
            target: 'ES2022',
            lib: ['ES2023'],
            module: 'ESNext',
            skipLibCheck: true,
            moduleResolution: 'bundler',
          },
          include: ['vite.config.ts'],
        },
        null,
        2
      )}\n`,
      skipIfExists: true,
    },
    {
      rel: 'vite.config.ts',
      content: `import vue from '@vitejs/plugin-vue';\nimport { defineConfig } from 'vite';\n\nexport default defineConfig({ plugins: [vue()] });\n`,
      skipIfExists: true,
    },
    {
      rel: 'index.html',
      content: `<!DOCTYPE html>\n<html lang="zh-CN">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>${name}</title>\n  </head>\n  <body>\n    <div id="app"></div>\n    <script type="module" src="/src/main.ts"></script>\n  </body>\n</html>\n`,
      skipIfExists: true,
    },
    {
      rel: 'src/vite-env.d.ts',
      content: `/// <reference types="vite/client" />\n`,
      skipIfExists: true,
    },
    {
      rel: 'src/main.ts',
      content: `import { createApp } from 'vue';\nimport App from './App.vue';\n\ncreateApp(App).mount('#app');\n`,
      skipIfExists: true,
    },
    {
      rel: 'src/App.vue',
      content: `<script setup lang="ts">\nconst task = '${taskId}';\n</script>\n\n<template>\n  <main style="padding: 2rem; font-family: system-ui, sans-serif">\n    <h1>Vue + Vite</h1>\n    <p>Task: {{ task }}</p>\n  </main>\n</template>\n`,
      skipIfExists: true,
    },
    {
      rel: 'README.md',
      content: `# ${name}\n\n${CODING_STACK_LABELS['vue-vite-spa']}\n\n\`\`\`bash\nnpm install && npm run dev\n\`\`\`\n`,
      skipIfExists: true,
    },
    { rel: '.gitignore', content: gitignoreStandard, skipIfExists: true },
  ];
};

const nuxtFiles = (o: IScaffoldOpts): IScaffoldFilePiece[] => {
  const { name, taskId } = o;
  return [
    {
      rel: 'package.json',
      content: `${JSON.stringify(
        {
          name,
          version: '0.0.1',
          private: true,
          type: 'module',
          scripts: {
            dev: 'nuxt dev',
            build: 'nuxt build',
            generate: 'nuxt generate',
            preview: 'nuxt preview',
          },
          dependencies: {
            nuxt: '^3.15.0',
            vue: '^3.5.0',
          },
        },
        null,
        2
      )}\n`,
      skipIfExists: true,
    },
    {
      rel: 'nuxt.config.ts',
      content: `import { defineNuxtConfig } from 'nuxt/config';\n\nexport default defineNuxtConfig({\n  compatibilityDate: '2024-11-01',\n});\n`,
      skipIfExists: true,
    },
    {
      rel: 'app.vue',
      content: `<template>\n  <div style="padding: 2rem; font-family: system-ui, sans-serif">\n    <h1>Nuxt 3</h1>\n    <p>Task: ${taskId}</p>\n  </div>\n</template>\n`,
      skipIfExists: true,
    },
    {
      rel: 'README.md',
      content: `# ${name}\n\n${CODING_STACK_LABELS['nuxt3-minimal']}\n\n\`\`\`bash\nnpm install && npm run dev\n\`\`\`\n`,
      skipIfExists: true,
    },
    {
      rel: '.gitignore',
      content: [
        'node_modules/',
        '.nuxt/',
        '.output/',
        '.env',
        '.DS_Store',
        '',
      ].join('\n'),
      skipIfExists: true,
    },
  ];
};

const nodeEsmFiles = (o: IScaffoldOpts): IScaffoldFilePiece[] => {
  const { name, taskId } = o;
  return [
    {
      rel: 'package.json',
      content: `${JSON.stringify(
        {
          name,
          version: '0.0.1',
          private: true,
          type: 'module',
          description: `Node ESM (${taskId})`,
          scripts: { start: 'node src/index.js' },
        },
        null,
        2
      )}\n`,
      skipIfExists: true,
    },
    {
      rel: 'src/index.js',
      content: `/**\n * Task: ${taskId}\n */\nexport const main = () => {\n  console.log('Node ESM ready');\n};\nmain();\n`,
      skipIfExists: true,
    },
    {
      rel: 'README.md',
      content: `# ${name}\n\n${CODING_STACK_LABELS['node-esm-minimal']}\n`,
      skipIfExists: true,
    },
    {
      rel: '.gitignore',
      content: 'node_modules/\n.DS_Store\n',
      skipIfExists: true,
    },
  ];
};

const expressFiles = (o: IScaffoldOpts): IScaffoldFilePiece[] => {
  const { name, taskId } = o;
  return [
    {
      rel: 'package.json',
      content: `${JSON.stringify(
        {
          name,
          version: '0.0.1',
          private: true,
          type: 'module',
          scripts: {
            dev: 'tsx watch src/index.ts',
            build: 'tsc',
            start: 'node dist/index.js',
          },
          dependencies: {
            express: '^4.21.0',
          },
          devDependencies: {
            '@types/express': '^4.17.21',
            '@types/node': '^22.0.0',
            tsx: '^4.21.0',
            typescript: '^5.7.0',
          },
        },
        null,
        2
      )}\n`,
      skipIfExists: true,
    },
    {
      rel: 'tsconfig.json',
      content: `${JSON.stringify(
        {
          compilerOptions: {
            target: 'ES2022',
            module: 'NodeNext',
            moduleResolution: 'NodeNext',
            strict: true,
            skipLibCheck: true,
            outDir: 'dist',
            rootDir: 'src',
            esModuleInterop: true,
          },
          include: ['src/**/*.ts'],
        },
        null,
        2
      )}\n`,
      skipIfExists: true,
    },
    {
      rel: 'src/index.ts',
      content: `import express from 'express';\n\nconst app = express();\nconst port = Number(process.env.PORT ?? 3000);\n\napp.get('/', (_req, res) => {\n  res.send('OK — coding-agent express scaffold — ${taskId}');\n});\n\napp.listen(port, () => {\n  console.log(\`listening on \${port}\`);\n});\n`,
      skipIfExists: true,
    },
    {
      rel: 'README.md',
      content: `# ${name}\n\n${CODING_STACK_LABELS['express-typescript']}\n\n\`\`\`bash\nnpm install && npm run dev\n\`\`\`\n`,
      skipIfExists: true,
    },
    {
      rel: '.gitignore',
      content: ['node_modules/', 'dist/', '.env', '.DS_Store', ''].join('\n'),
      skipIfExists: true,
    },
  ];
};

export const SCAFFOLD_BY_STACK: Record<
  ICodingScaffoldStackId,
  (opts: IScaffoldOpts) => readonly IScaffoldFilePiece[]
> = {
  'next-app-router': nextFiles,
  'react-vite-spa': reactViteFiles,
  'vue-vite-spa': vueViteFiles,
  'nuxt3-minimal': nuxtFiles,
  'node-esm-minimal': nodeEsmFiles,
  'express-typescript': expressFiles,
};

export const getScaffoldPieces = (
  stackId: ICodingScaffoldStackId,
  opts: IScaffoldOpts
): readonly IScaffoldFilePiece[] => SCAFFOLD_BY_STACK[stackId](opts);
