import { NextRequest, NextResponse } from 'next/server'
import { nanoid } from 'nanoid'
import { getIntentSpec, saveGeneratedCode } from '@/lib/db'
import { generateUICode } from '@/lib/v0-client'
import type { GenerateResponse, GeneratedCode } from '@/lib/types'

export async function POST(
  request: NextRequest
): Promise<NextResponse<GenerateResponse>> {
  try {
    const { intentSpecId, stepMode } = await request.json()

    if (!intentSpecId) {
      return NextResponse.json(
        { success: false, error: 'No intentSpecId provided' },
        { status: 400 }
      )
    }

    const intentSpec = await getIntentSpec(intentSpecId)
    if (!intentSpec) {
      return NextResponse.json(
        { success: false, error: 'IntentSpec not found' },
        { status: 404 }
      )
    }

    // Build prompt from intent spec
    const prompt = buildGenerationPrompt(intentSpec)

    // Generate code
    const code = await generateUICode(prompt, stepMode || 'single')

    // Create generated code record
    const generatedCode: GeneratedCode = {
      id: nanoid(),
      intentSpecId,
      mode: stepMode || 'single',
      code,
      createdAt: Date.now(),
    }

    // Save to database
    await saveGeneratedCode(generatedCode)

    return NextResponse.json({ success: true, generatedCode })
  } catch (error) {
    console.error('Code generation error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

function buildGenerationPrompt(intentSpec: any): string {
  const { normalized } = intentSpec

  let prompt = `Create a modern, responsive React component using Tailwind CSS with the following design specifications:\n\n`

  // Color palette
  if (normalized.palette) {
    prompt += `## Color Palette\n`
    prompt += `Use these exact colors:\n`
    Object.entries(normalized.palette).forEach(([role, hex]) => {
      prompt += `- ${role}: ${hex}\n`
    })
    prompt += `\n`
  }

  // Typography
  if (normalized.typography) {
    const typo = normalized.typography
    prompt += `## Typography\n`
    if (typo.fontCandidates?.[0]) {
      prompt += `- Font Family: ${typo.fontCandidates[0].name}\n`
    }
    if (typo.scale) {
      prompt += `- Heading 1: ${typo.scale.h1}px\n`
      prompt += `- Heading 2: ${typo.scale.h2}px\n`
      prompt += `- Body: ${typo.scale.body}px\n`
      prompt += `- Caption: ${typo.scale.caption}px\n`
    }
    if (typo.lineHeight) {
      prompt += `- Line Height (body): ${typo.lineHeight.body}\n`
    }
    prompt += `\n`
  }

  // Layout
  if (normalized.layout) {
    const layout = normalized.layout
    prompt += `## Layout\n`
    prompt += `- Pattern: ${layout.pattern}\n`
    if (layout.columns) {
      prompt += `- Columns: ${layout.columns}\n`
    }
    prompt += `- Density: ${layout.density}\n`
    prompt += `\n`
  }

  // Spacing
  if (normalized.spacing) {
    const spacing = normalized.spacing
    prompt += `## Spacing\n`
    prompt += `- Base unit: ${spacing.baseUnit}px\n`
    prompt += `- Scale: ${spacing.scale.join(', ')}px\n`
    prompt += `\n`
  }

  // Component Style
  if (normalized.componentStyle) {
    const style = normalized.componentStyle
    prompt += `## Component Style\n`
    prompt += `- Border Radius: ${style.radius}\n`
    prompt += `- Shadow: ${style.shadow}\n`
    prompt += `- Border: ${style.border}\n`
    prompt += `\n`
  }

  prompt += `## Requirements\n`
  prompt += `1. Create a complete, functional React component\n`
  prompt += `2. Use Tailwind CSS classes for all styling\n`
  prompt += `3. Ensure all color combinations meet WCAG AA contrast requirements (4.5:1 minimum)\n`
  prompt += `4. Make it responsive (mobile-first approach)\n`
  prompt += `5. Include proper semantic HTML\n`
  prompt += `6. Export as default function component\n`
  prompt += `7. Component should be production-ready\n\n`

  prompt += `Generate the complete React component code now.`

  return prompt
}
