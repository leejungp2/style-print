import { promises as fs } from 'fs'
import path from 'path'
import type { GeneratedCodeFile } from '@style-print-jung/shared'

type PreviewInput = {
  id: string
  code: string
  files?: GeneratedCodeFile[]
  entryFile?: string
}

type PreviewFileMap = Map<string, string>

const workspaceRoot = process.cwd()
const sourcePreviewRoot = path.join(workspaceRoot, '.styleprint-preview')
const publicPreviewRoot = path.join(
  workspaceRoot,
  'apps',
  'web',
  'public',
  'generated-previews'
)

export async function writePreviewArtifact(input: PreviewInput): Promise<string> {
  const previewId = sanitizePreviewId(input.id)
  const sourceDir = path.join(sourcePreviewRoot, previewId)
  const publicDir = path.join(publicPreviewRoot, previewId)
  const files = buildPreviewFiles(input)

  await fs.rm(sourceDir, { recursive: true, force: true })
  await fs.rm(publicDir, { recursive: true, force: true })
  await fs.mkdir(sourceDir, { recursive: true })
  await fs.mkdir(publicDir, { recursive: true })

  for (const [previewPath, code] of files) {
    await writePreviewFile(sourceDir, previewPath, code)
  }

  const cacheKey = Date.now()
  const entryPath = toViteFsPath(path.join(sourceDir, 'main.tsx'))
  await fs.writeFile(
    path.join(publicDir, 'index.html'),
    buildPreviewHtml(entryPath, cacheKey),
    'utf8'
  )

  return `/generated-previews/${previewId}/index.html?t=${cacheKey}`
}

function buildPreviewFiles(input: PreviewInput): PreviewFileMap {
  const generatedFiles = normalizeGeneratedFiles(input.files || [])
  const entryPath =
    resolveEntryPath(input.entryFile, generatedFiles) || '/GeneratedComponent.tsx'
  const availablePaths = new Set([
    ...generatedFiles.map((file) => file.path),
    entryPath,
    '/styles.css',
  ])
  const previewFiles: PreviewFileMap = new Map()

  addMissingAliasStubs(generatedFiles, availablePaths, previewFiles)
  addCommonRuntimeStubs(previewFiles)

  generatedFiles.forEach((file) => {
    if (isCssFile(file.path)) {
      previewFiles.set(file.path, sanitizeGeneratedCss(file.code))
      return
    }

    previewFiles.set(
      file.path,
      rewritePreviewImports(file.code, file.path, availablePaths)
    )
  })

  if (!previewFiles.has(entryPath)) {
    previewFiles.set(
      entryPath,
      rewritePreviewImports(input.code, entryPath, availablePaths)
    )
  }

  previewFiles.set('/main.tsx', buildMain(entryPath))
  previewFiles.set('/styles.css', buildCss(generatedFiles))

  return previewFiles
}

function normalizeGeneratedFiles(files: GeneratedCodeFile[]): GeneratedCodeFile[] {
  const seen = new Set<string>()

  return files.flatMap((file) => {
    const normalized = normalizePath(file.path)

    if (!normalized || !file.code || seen.has(normalized)) {
      return []
    }

    seen.add(normalized)
    return [{ path: normalized, code: file.code }]
  })
}

function resolveEntryPath(
  entryFile: string | undefined,
  files: GeneratedCodeFile[]
): string | null {
  const normalized = normalizePath(entryFile)

  if (normalized && files.some((file) => file.path === normalized)) {
    return normalized
  }

  return null
}

function buildMain(entryPath: string): string {
  const entryImport = toImportSpecifier('/main.tsx', entryPath)

  return `
import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import GeneratedComponent from '${entryImport}';

class PreviewErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <main className="preview-error">
          <h1>Preview failed</h1>
          <pre>{this.state.error.message}</pre>
        </main>
      );
    }

    return this.props.children;
  }
}

const root = document.getElementById('root');

if (!root) {
  throw new Error('Preview root element not found');
}

createRoot(root).render(
  <React.StrictMode>
    <PreviewErrorBoundary>
      <GeneratedComponent />
    </PreviewErrorBoundary>
  </React.StrictMode>
);
`
}

function buildCss(files: GeneratedCodeFile[]): string {
  const generatedCss = files
    .filter((file) => isCssFile(file.path))
    .map((file) => sanitizeGeneratedCss(file.code))
    .filter(Boolean)
    .join('\n\n')

  return `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+KR:wght@400;500;600;700&display=swap');

:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --card: 0 0% 100%;
  --card-foreground: 222.2 84% 4.9%;
  --primary: 222.2 47.4% 11.2%;
  --primary-foreground: 210 40% 98%;
  --secondary: 210 40% 96.1%;
  --secondary-foreground: 222.2 47.4% 11.2%;
  --muted: 210 40% 96.1%;
  --muted-foreground: 215.4 16.3% 46.9%;
  --accent: 210 40% 96.1%;
  --accent-foreground: 222.2 47.4% 11.2%;
  --border: 214.3 31.8% 91.4%;
  --radius: 0.5rem;
}

* {
  box-sizing: border-box;
  border-color: hsl(var(--border));
}

html,
body,
#root {
  min-height: 100%;
  margin: 0;
}

body {
  font-family: 'Inter', 'Noto Sans KR', system-ui, sans-serif;
  background: hsl(var(--background));
  color: hsl(var(--foreground));
}

button,
input,
textarea,
select {
  font: inherit;
}

button {
  cursor: pointer;
}

.preview-error {
  padding: 24px;
  color: #991b1b;
  background: #fef2f2;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.min-h-screen { min-height: 100vh; }
.w-full { width: 100%; }
.h-full { height: 100%; }
.flex { display: flex; }
.inline-flex { display: inline-flex; }
.block { display: block; }
.inline-block { display: inline-block; }
.grid { display: grid; }
.hidden { display: none; }
.flex-col { flex-direction: column; }
.flex-row { flex-direction: row; }
.flex-wrap { flex-wrap: wrap; }
.items-start { align-items: flex-start; }
.items-center { align-items: center; }
.items-end { align-items: flex-end; }
.justify-start { justify-content: flex-start; }
.justify-center { justify-content: center; }
.justify-between { justify-content: space-between; }
.text-center { text-align: center; }
.font-sans { font-family: 'Inter', 'Noto Sans KR', system-ui, sans-serif; }
.font-medium { font-weight: 500; }
.font-semibold { font-weight: 600; }
.font-bold { font-weight: 700; }
.uppercase { text-transform: uppercase; }
.rounded-full { border-radius: 9999px; }
.rounded-lg { border-radius: var(--radius); }
.rounded-md { border-radius: calc(var(--radius) - 2px); }
.border { border-width: 1px; border-style: solid; }
.shadow-sm { box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05); }
.shadow-md { box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1); }
.transition-all { transition-property: all; }
.transition-colors { transition-property: color, background-color, border-color, text-decoration-color, fill, stroke; }
.duration-150 { transition-duration: 150ms; }
.duration-200 { transition-duration: 200ms; }
.bg-background { background-color: hsl(var(--background)); }
.bg-card { background-color: hsl(var(--card)); }
.bg-primary { background-color: hsl(var(--primary)); }
.bg-secondary { background-color: hsl(var(--secondary)); }
.bg-muted { background-color: hsl(var(--muted)); }
.text-primary { color: hsl(var(--primary)); }
.text-secondary { color: hsl(var(--secondary)); }
.text-muted-foreground { color: hsl(var(--muted-foreground)); }
.text-card-foreground { color: hsl(var(--card-foreground)); }

${generatedCss}
`
}

function addMissingAliasStubs(
  files: GeneratedCodeFile[],
  availablePaths: Set<string>,
  previewFiles: PreviewFileMap
) {
  for (const file of files) {
    for (const specifier of extractImportSpecifiers(file.code)) {
      if (!specifier.startsWith('@/')) continue
      if (resolveAliasPath(specifier, availablePaths)) continue

      const target = normalizePath(specifier.replace(/^@\//, '/'))
      if (!target) continue

      const stubPath = `${target}.tsx`

      if (/^\/components\/ui\//.test(target)) {
        availablePaths.add(stubPath)
        previewFiles.set(stubPath, buildUiStub(target))
      }

      if (target === '/lib/utils') {
        const utilsPath = '/lib/utils.ts'
        availablePaths.add(utilsPath)
        previewFiles.set(utilsPath, buildUtilsStub())
      }
    }
  }
}

function addCommonRuntimeStubs(previewFiles: PreviewFileMap) {
  previewFiles.set('/__stubs__/next-image.tsx', buildNextImageStub())
  previewFiles.set('/__stubs__/next-link.tsx', buildNextLinkStub())
  previewFiles.set('/__stubs__/next-font-google.ts', buildNextFontStub())
}

function buildUiStub(target: string): string {
  const moduleName = path.basename(target)
  const exportsByModule: Record<string, string[]> = {
    button: ['Button'],
    card: ['Card', 'CardHeader', 'CardFooter', 'CardTitle', 'CardDescription', 'CardContent'],
    badge: ['Badge'],
    input: ['Input'],
    label: ['Label'],
    separator: ['Separator'],
    progress: ['Progress'],
    tabs: ['Tabs', 'TabsList', 'TabsTrigger', 'TabsContent'],
    dialog: [
      'Dialog',
      'DialogTrigger',
      'DialogContent',
      'DialogHeader',
      'DialogFooter',
      'DialogTitle',
      'DialogDescription',
    ],
    select: ['Select', 'SelectTrigger', 'SelectValue', 'SelectContent', 'SelectItem'],
    'scroll-area': ['ScrollArea'],
    textarea: ['Textarea'],
    avatar: ['Avatar', 'AvatarImage', 'AvatarFallback'],
    'dropdown-menu': [
      'DropdownMenu',
      'DropdownMenuTrigger',
      'DropdownMenuContent',
      'DropdownMenuItem',
      'DropdownMenuLabel',
      'DropdownMenuSeparator',
    ],
  }
  const exportNames = exportsByModule[moduleName] || ['Stub']

  return `
import * as React from 'react';

type Props = React.HTMLAttributes<HTMLElement> & {
  value?: string;
  asChild?: boolean;
};

function Primitive({ children, className, ...props }: Props) {
  return <div className={className} {...props}>{children}</div>;
}

${exportNames
  .map((name) => `export const ${name} = Primitive;`)
  .join('\n')}
`
}

function buildUtilsStub(): string {
  return `
export function cn(...inputs: unknown[]) {
  return inputs.flat(Infinity).filter(Boolean).join(' ');
}
`
}

function buildNextImageStub(): string {
  return `
import * as React from 'react';

type ImageProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  fill?: boolean;
  priority?: boolean;
};

export default function Image({ fill, priority, alt = '', style, ...props }: ImageProps) {
  return (
    <img
      alt={alt}
      style={{ objectFit: props.objectFit as string | undefined, ...(fill ? { width: '100%', height: '100%' } : null), ...style }}
      {...props}
    />
  );
}
`
}

function buildNextLinkStub(): string {
  return `
import * as React from 'react';

type LinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
};

export default function Link({ href, children, ...props }: LinkProps) {
  return <a href={href} {...props}>{children}</a>;
}
`
}

function buildNextFontStub(): string {
  return `
const font = { className: '', variable: '', style: {} };
export const Inter = () => font;
export const Geist = () => font;
export const Geist_Mono = () => font;
export const Noto_Sans_KR = () => font;
export default () => font;
`
}

function rewritePreviewImports(
  code: string,
  filePath: string,
  availablePaths: Set<string>
): string {
  return code
    .replace(
      /(from\s+['"]|import\s+['"]|import\(\s*['"])(@\/[^'"]+)(['"])/g,
      (match, prefix: string, specifier: string, suffix: string) => {
        const resolvedPath = resolveAliasPath(specifier, availablePaths)

        if (!resolvedPath) {
          return match
        }

        return `${prefix}${toImportSpecifier(filePath, resolvedPath)}${suffix}`
      }
    )
    .replace(
      /(from\s+['"])next\/image(['"])/g,
      `$1${toImportSpecifier(filePath, '/__stubs__/next-image.tsx')}$2`
    )
    .replace(
      /(from\s+['"])next\/link(['"])/g,
      `$1${toImportSpecifier(filePath, '/__stubs__/next-link.tsx')}$2`
    )
    .replace(
      /(from\s+['"])next\/font\/google(['"])/g,
      `$1${toImportSpecifier(filePath, '/__stubs__/next-font-google.ts')}$2`
    )
}

function extractImportSpecifiers(code: string): string[] {
  return [
    ...code.matchAll(
      /(?:from\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"])/g
    ),
  ].map((match) => match[1] || match[2] || match[3])
}

function resolveAliasPath(
  specifier: string,
  availablePaths: Set<string>
): string | null {
  const target = normalizePath(specifier.replace(/^@\//, '/'))

  if (!target) {
    return null
  }

  for (const availablePath of availablePaths) {
    if (
      availablePath === target ||
      stripJsExtension(availablePath) === target ||
      stripJsExtension(availablePath) === `${target}/index`
    ) {
      return availablePath
    }
  }

  return null
}

function toImportSpecifier(fromPath: string, targetPath: string): string {
  const fromParts = dirname(fromPath).split('/').filter(Boolean)
  const targetParts = stripJsExtension(targetPath).split('/').filter(Boolean)
  let shared = 0

  while (
    shared < fromParts.length &&
    shared < targetParts.length &&
    fromParts[shared] === targetParts[shared]
  ) {
    shared += 1
  }

  const relativeParts = [
    ...fromParts.slice(shared).map(() => '..'),
    ...targetParts.slice(shared),
  ]
  const relativePath = relativeParts.join('/') || '.'

  return relativePath.startsWith('.') ? relativePath : `./${relativePath}`
}

function normalizePath(filePath?: string): string | null {
  const normalized = filePath?.trim().replace(/\\/g, '/').replace(/^\/+/, '')

  if (!normalized || normalized.includes('\0')) {
    return null
  }

  return `/${normalized}`
}

function stripJsExtension(filePath: string): string {
  return filePath.replace(/\.(tsx|jsx|ts|js)$/, '')
}

function dirname(filePath: string): string {
  const index = filePath.lastIndexOf('/')
  return index <= 0 ? '/' : filePath.slice(0, index)
}

function isCssFile(filePath: string): boolean {
  return /\.css$/.test(filePath)
}

function sanitizeGeneratedCss(code: string): string {
  return removeCssAtRuleBlock(
    code
      .replace(/@import\s+['"](tailwindcss|tw-animate-css)['"];\s*/g, '')
      .replace(/@custom-variant[^\n]*\n/g, '')
      .replace(/^\s*@apply[^\n;]*;?\s*$/gm, ''),
    ['@theme', '@layer']
  ).trim()
}

function removeCssAtRuleBlock(code: string, atRules: string[]): string {
  let output = code

  atRules.forEach((atRule) => {
    let index = output.indexOf(atRule)

    while (index >= 0) {
      const openBrace = output.indexOf('{', index)

      if (openBrace < 0) {
        break
      }

      let depth = 0
      let end = openBrace

      for (; end < output.length; end += 1) {
        if (output[end] === '{') depth += 1
        if (output[end] === '}') depth -= 1
        if (depth === 0) {
          end += 1
          break
        }
      }

      output = `${output.slice(0, index)}${output.slice(end)}`
      index = output.indexOf(atRule)
    }
  })

  return output
}

async function writePreviewFile(
  rootDir: string,
  previewPath: string,
  code: string
) {
  const normalized = normalizePath(previewPath)

  if (!normalized) {
    return
  }

  const filePath = path.join(rootDir, normalized)

  if (!filePath.startsWith(rootDir)) {
    throw new Error(`Invalid preview file path: ${previewPath}`)
  }

  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, code, 'utf8')
}

function buildPreviewHtml(entryPath: string, cacheKey: number): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <script src="https://cdn.tailwindcss.com"></script>
    <title>StylePrint Preview</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="${entryPath}?t=${cacheKey}"></script>
  </body>
</html>
`
}

function toViteFsPath(filePath: string): string {
  return encodeURI(`/@fs${path.resolve(filePath).replace(/\\/g, '/')}`)
}

function sanitizePreviewId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '_')
}
