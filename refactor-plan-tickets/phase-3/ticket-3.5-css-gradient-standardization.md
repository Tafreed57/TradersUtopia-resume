# Ticket 3.5: CSS Gradient Standardization
**Priority:** LOW | **Effort:** 1 day | **Risk:** LOW

## Description
Create standardized CSS utility classes for the 150+ repeated gradient patterns throughout the application.

## Current Problem
Gradient patterns repeated 150+ times:
- `bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700` (20+ times)
- `bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600` (15+ times)
- `bg-gradient-to-r from-gray-800/90 via-gray-800/70 to-gray-900/90` (25+ times)

## Implementation

### Tailwind Configuration
```typescript
// tailwind.config.ts
module.exports = {
  theme: {
    extend: {
      // Custom gradient utilities
      backgroundImage: {
        // Primary gradients
        'gradient-primary': 'linear-gradient(to right, rgb(234 179 8), rgb(245 158 11))',
        'gradient-primary-hover': 'linear-gradient(to right, rgb(245 158 11), rgb(251 146 60))',
        
        // Brand gradients
        'gradient-brand': 'linear-gradient(to right, rgb(37 99 235), rgb(147 51 234), rgb(79 70 229))',
        'gradient-brand-dark': 'linear-gradient(to right, rgb(30 58 138), rgb(109 40 217), rgb(67 56 202))',
        
        // Background gradients
        'gradient-bg': 'linear-gradient(to right, rgba(31, 41, 55, 0.9), rgba(31, 41, 55, 0.7), rgba(17, 24, 39, 0.9))',
        'gradient-bg-light': 'linear-gradient(to right, rgba(249, 250, 251, 0.95), rgba(243, 244, 246, 0.9))',
        
        // Status gradients
        'gradient-success': 'linear-gradient(to right, rgb(34 197 94), rgb(22 163 74))',
        'gradient-success-hover': 'linear-gradient(to right, rgb(22 163 74), rgb(21 128 61))',
        'gradient-danger': 'linear-gradient(to right, rgb(239 68 68), rgb(220 38 38))',
        'gradient-danger-hover': 'linear-gradient(to right, rgb(220 38 38), rgb(185 28 28))',
        
        // Text gradients
        'gradient-text': 'linear-gradient(to right, rgb(255, 255, 255), rgb(229, 231, 235))',
        'gradient-text-brand': 'linear-gradient(to right, rgb(37 99 235), rgb(147 51 234))',
      },
      
      // Animation utilities
      animation: {
        'gradient-shift': 'gradient-shift 3s ease infinite',
      },
      
      keyframes: {
        'gradient-shift': {
          '0%, 100%': { 'background-position': '0% 50%' },
          '50%': { 'background-position': '100% 50%' },
        },
      },
    },
  },
  plugins: [
    // Custom gradient plugin
    function({ addUtilities }) {
      const newUtilities = {
        // Interactive gradient buttons
        '.btn-gradient-primary': {
          'background-image': 'linear-gradient(to right, rgb(234 179 8), rgb(245 158 11))',
          'transition': 'all 0.2s ease-in-out',
          '&:hover': {
            'background-image': 'linear-gradient(to right, rgb(245 158 11), rgb(251 146 60))',
            'transform': 'translateY(-1px)',
          },
        },
        
        '.btn-gradient-brand': {
          'background-image': 'linear-gradient(to right, rgb(37 99 235), rgb(147 51 234), rgb(79 70 229))',
          'transition': 'all 0.2s ease-in-out',
          '&:hover': {
            'background-image': 'linear-gradient(to right, rgb(30 58 138), rgb(109 40 217), rgb(67 56 202))',
            'transform': 'translateY(-1px)',
          },
        },
        
        '.btn-gradient-success': {
          'background-image': 'linear-gradient(to right, rgb(34 197 94), rgb(22 163 74))',
          'transition': 'all 0.2s ease-in-out',
          '&:hover': {
            'background-image': 'linear-gradient(to right, rgb(22 163 74), rgb(21 128 61))',
            'transform': 'translateY(-1px)',
          },
        },
        
        '.btn-gradient-danger': {
          'background-image': 'linear-gradient(to right, rgb(239 68 68), rgb(220 38 38))',
          'transition': 'all 0.2s ease-in-out',
          '&:hover': {
            'background-image': 'linear-gradient(to right, rgb(220 38 38), rgb(185 28 28))',
            'transform': 'translateY(-1px)',
          },
        },
        
        // Text gradients
        '.text-gradient-brand': {
          'background-image': 'linear-gradient(to right, rgb(37 99 235), rgb(147 51 234))',
          'background-clip': 'text',
          '-webkit-background-clip': 'text',
          'color': 'transparent',
        },
        
        '.text-gradient-primary': {
          'background-image': 'linear-gradient(to right, rgb(234 179 8), rgb(245 158 11))',
          'background-clip': 'text',
          '-webkit-background-clip': 'text',
          'color': 'transparent',
        },
        
        // Background overlays
        '.bg-overlay-dark': {
          'background-image': 'linear-gradient(to right, rgba(31, 41, 55, 0.9), rgba(31, 41, 55, 0.7), rgba(17, 24, 39, 0.9))',
        },
        
        '.bg-overlay-light': {
          'background-image': 'linear-gradient(to right, rgba(249, 250, 251, 0.95), rgba(243, 244, 246, 0.9))',
        },
        
        // Animated gradients
        '.bg-gradient-animated': {
          'background': 'linear-gradient(-45deg, #ff6b6b, #4ecdc4, #45b7d1, #96ceb4)',
          'background-size': '400% 400%',
          'animation': 'gradient-shift 3s ease infinite',
        },
      };
      
      addUtilities(newUtilities);
    },
  ],
};
```

### Component Button Variants
```tsx
// src/components/ui/gradient-button.tsx
import { cn } from '@/lib/utils';

interface GradientButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'brand' | 'success' | 'danger' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export const GradientButton = ({ 
  variant = 'primary', 
  size = 'md', 
  className, 
  children, 
  ...props 
}: GradientButtonProps) => {
  const baseClasses = 'font-bold text-center rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2';
  
  const variantClasses = {
    primary: 'btn-gradient-primary text-black focus:ring-yellow-500',
    brand: 'btn-gradient-brand text-white focus:ring-blue-500',
    success: 'btn-gradient-success text-white focus:ring-green-500',
    danger: 'btn-gradient-danger text-white focus:ring-red-500',
    secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-800 focus:ring-gray-500',
  };
  
  const sizeClasses = {
    sm: 'px-4 py-2 text-sm min-h-[36px]',
    md: 'px-6 py-3 text-base min-h-[44px]',
    lg: 'px-8 py-4 text-lg min-h-[52px]',
  };
  
  return (
    <button
      className={cn(
        baseClasses,
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};

// Usage examples:
// <GradientButton variant="primary">Save Changes</GradientButton>
// <GradientButton variant="danger" size="sm">Delete</GradientButton>
// <GradientButton variant="brand" size="lg">Get Started</GradientButton>
```

### Migration Utility
```typescript
// scripts/migrate-gradients.ts
import { promises as fs } from 'fs';
import path from 'path';

const gradientMappings = {
  // Primary yellow gradient
  'bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700': 'btn-gradient-primary',
  'bg-gradient-to-r from-yellow-500 to-yellow-600': 'bg-gradient-primary',
  
  // Brand gradient
  'bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600': 'bg-gradient-brand',
  
  // Background overlays
  'bg-gradient-to-r from-gray-800/90 via-gray-800/70 to-gray-900/90': 'bg-overlay-dark',
  
  // Success gradient
  'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700': 'btn-gradient-success',
  
  // Text gradients
  'bg-gradient-to-r from-white to-gray-200 bg-clip-text text-transparent': 'text-gradient-primary',
};

async function migrateGradients() {
  const srcDir = path.join(process.cwd(), 'src');
  const files = await getFiles(srcDir, ['.tsx', '.ts']);
  
  let totalReplacements = 0;
  
  for (const file of files) {
    const content = await fs.readFile(file, 'utf-8');
    let newContent = content;
    let fileReplacements = 0;
    
    for (const [oldGradient, newClass] of Object.entries(gradientMappings)) {
      const regex = new RegExp(oldGradient.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      const matches = newContent.match(regex);
      
      if (matches) {
        newContent = newContent.replace(regex, newClass);
        fileReplacements += matches.length;
      }
    }
    
    if (fileReplacements > 0) {
      await fs.writeFile(file, newContent);
      console.log(`✅ ${file}: ${fileReplacements} gradients replaced`);
      totalReplacements += fileReplacements;
    }
  }
  
  console.log(`🎨 Migration complete: ${totalReplacements} total gradient replacements`);
}

async function getFiles(dir: string, extensions: string[]): Promise<string[]> {
  const files: string[] = [];
  const items = await fs.readdir(dir, { withFileTypes: true });
  
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    
    if (item.isDirectory()) {
      files.push(...await getFiles(fullPath, extensions));
    } else if (extensions.some(ext => item.name.endsWith(ext))) {
      files.push(fullPath);
    }
  }
  
  return files;
}

// Run migration
migrateGradients().catch(console.error);
```

## Acceptance Criteria
- [ ] Create comprehensive Tailwind gradient utilities
- [ ] Implement GradientButton component with all variants
- [ ] Create migration script to replace existing gradient classes
- [ ] Migrate 50+ components to use new gradient utilities
- [ ] Reduce CSS gradient duplication by 80%+
- [ ] Maintain exact same visual appearance
- [ ] Add hover effects and transitions to gradient buttons

## Files to Create/Modify
- `tailwind.config.ts` (update with gradient utilities)
- `src/components/ui/gradient-button.tsx` (new)
- `scripts/migrate-gradients.ts` (new migration script)
- Update these high-usage files:
  - `src/app/page.tsx`
  - `src/components/comprehensive-pricing-section.tsx`
  - `src/components/modals/cancellation-flow-modal.tsx`
  - `src/app/pricing/page.tsx`
  - `src/components/subscription/subscription-manager.tsx`

### Documentation Requirements
- [ ] Create CSS design system documentation showing all gradient utilities
- [ ] Document gradient usage patterns in `docs/developers/styling-guide.md`
- [ ] Add visual style guide with gradient examples

### Testing Requirements
- [ ] **Unit Tests**: GradientButton component functionality
- [ ] **Visual Tests**: Gradient rendering consistency across browsers
- [ ] **UI Tests**: Component styling and interaction states
- [ ] **Performance Tests**: CSS bundle size impact and rendering performance
- [ ] **Cross-browser Tests**: Gradient compatibility across different browsers

## Dependencies
None - can be implemented independently 