# Figma Design System Pipeline

This directory contains the automated design system pipeline that synchronizes design tokens from Figma with our codebase.

## Overview

Our design system automatically extracts design tokens from Figma and generates:
- JSON design tokens (`tokens.json`)
- CSS custom properties (`apps/web/styles/tokens.css`)
- Tailwind configuration (`apps/web/tailwind.config.js`)
- React UI components (`apps/web/components/ui/`)

## Source Design File

**Figma File**: A's team library
**File Key**: `XPh9lANClKeAtHfnDT5q7l`
**URL**: https://www.figma.com/design/XPh9lANClKeAtHfnDT5q7l/A-s-team-library

## Design Tokens Structure

### Colors
- **Base Colors**: Black, white, gray scale
- **Brand Colors**: Fuschia, iris, blue palettes
- **Semantic Colors**: Text, background, accent colors

### Typography
- **Font Families**: Inter, Work Sans, Droid Sans
- **Font Sizes**: xs (11px) to 2xl (72px)
- **Font Weights**: Normal (400) to Bold (700)
- **Line Heights**: Tight (1.17) to Loose (1.6)

### Spacing
- **Scale**: 0px to 80px following 4px grid system
- **Usage**: Padding, margins, gaps

### Border Radius
- **Scale**: None (0px) to Full (1000px)
- **Usage**: Cards, buttons, form elements

### Shadows
- **Scale**: Small, medium, large
- **Usage**: Cards, modals, dropdowns

## File Structure

```
design/
├── README.md                    # This documentation
├── tokens.json                  # Generated design tokens
└── figma.depth3.json           # Cached Figma data

apps/web/
├── styles/
│   └── tokens.css              # CSS custom properties
├── components/ui/
│   ├── Button.tsx              # Button component
│   ├── Card.tsx                # Card component
│   └── index.ts                # Component exports
├── lib/
│   └── utils.ts                # Utility functions
└── tailwind.config.js          # Tailwind with design tokens

.github/workflows/
└── figma-sync.yml              # CI/CD for design drift detection
```

## Usage in Components

### Using CSS Custom Properties

```css
.my-component {
  color: var(--color-text-primary);
  background-color: var(--color-background-primary);
  padding: var(--space-4);
  border-radius: var(--radius-sm);
  font-family: var(--font-family-heading);
}
```

### Using Tailwind Classes

```jsx
<div className="bg-background-primary text-text-primary p-4 rounded-sm font-heading">
  Content
</div>
```

### Using UI Components

```jsx
import { Button, Card, CardHeader, CardContent } from '@/components/ui'

export function MyComponent() {
  return (
    <Card>
      <CardHeader>
        <h2>Card Title</h2>
      </CardHeader>
      <CardContent>
        <p>Card content goes here.</p>
        <Button variant="primary" size="md">
          Click me
        </Button>
      </CardContent>
    </Card>
  )
}
```

## Automated Sync Process

### Daily Sync
- Runs every day at 9 AM UTC
- Compares Figma file timestamps
- Creates PR if changes detected
- Notifies team via Slack/GitHub issues

### Manual Sync
1. Go to Actions tab in GitHub
2. Select "Figma Design System Sync"
3. Click "Run workflow"
4. Optionally enable "Force update"

### What Gets Updated
- `design/tokens.json` - Design tokens
- `apps/web/styles/tokens.css` - CSS variables
- `apps/web/tailwind.config.js` - Tailwind config
- Component files (if structure changes)

## Development Workflow

### Adding New Components
1. Extract component tokens from Figma
2. Update `tokens.json` with new tokens
3. Create React component in `apps/web/components/ui/`
4. Export from `apps/web/components/ui/index.ts`
5. Update documentation

### Modifying Existing Components
1. Update design in Figma
2. Wait for automated sync or trigger manually
3. Review and merge the generated PR
4. Update component implementation if needed

## GDPR Compliance

### Data Processing
- **Figma API Data**: Cached locally in `design-cache/` (gitignored)
- **Design Tokens**: Public design information only
- **No Personal Data**: Design tokens contain no user information

### Data Retention
- Cached Figma data: Retained until next sync
- Design tokens: Version controlled in Git
- CI/CD logs: Follow GitHub's retention policies

### Privacy Considerations
- Figma API key stored as GitHub secret
- No sensitive design information exposed
- All data processing for legitimate business purposes

## Troubleshooting

### Common Issues

#### Build Errors
```bash
# Install missing dependencies
pnpm install

# Regenerate design tokens
pnpm run design:sync
```

#### Style Issues
1. Check if CSS imports are correct in `globals.css`
2. Verify Tailwind config includes design tokens
3. Confirm component classes match token names

#### Sync Failures
1. Check Figma API key in GitHub secrets
2. Verify file key in workflow configuration
3. Review workflow logs for specific errors

### Manual Token Update

If automated sync fails, you can manually update tokens:

1. Extract Figma data using MCP tool
2. Update `design/tokens.json`
3. Regenerate `apps/web/styles/tokens.css`
4. Update `apps/web/tailwind.config.js`
5. Test UI components

## Contributing

### Design Changes
1. Make changes in Figma
2. Document changes in Figma comments
3. Wait for automated sync PR
4. Review and test changes
5. Merge PR after approval

### Code Changes
1. Create feature branch
2. Update components/tokens as needed
3. Test in development environment
4. Create PR with design system team review
5. Merge after approval

## Support

For issues related to the design system:
- **Design Questions**: Tag design team in Figma
- **Technical Issues**: Create GitHub issue with `design-system` label
- **Sync Problems**: Check CI/CD workflow logs
- **Component Requests**: Create issue with component specification

---

*This design system is automatically maintained through Figma sync. All manual changes to generated files will be overwritten.*
