# How It Works — Next.js server-first refactor

This refactor keeps the original visual structure, SVG geometry, Tailwind classes, animation timings, colors, spacing, and final image.

## Files

- `HowItWorks.tsx` — Server Component. Renders the visual/HTML/SVG on the server.
- `LazyHowItWorksMotion.tsx` — tiny Client Component. Waits until the section is near the viewport before downloading the animation code.
- `HowItWorksMotion.tsx` — Client animation island. GSAP and ScrollTrigger are dynamically imported only when needed.
- `geometry-data.ts` — architectural data and accent color.
- `geometry.ts` — pure axonometric projection helpers.
- `types.ts` — TypeScript models.
- `workflow.ts` — workflow labels/descriptions.

## Usage

Place these files in `components/how-it-works/`, then in `app/page.tsx`:

```tsx
import HowItWorks from "@/components/how-it-works/HowItWorks";

export default function Page() {
  return (
    <main>
      {/* existing hero */}
      <HowItWorks />
      {/* existing sections */}
    </main>
  );
}
```

## Dependencies

This version removes Framer Motion from this section. The three tiny decorative motions are CSS keyframes.

GSAP is not imported at module scope. It is loaded dynamically inside `HowItWorksMotion`.

## Important

Run the performance test against a production build:

```bash
npm run build
npm run start
```

The refactor deliberately does not change the GSAP animation values or the SVG geometry. The next performance pass can optimize blur/filter/stroke animations only after measuring the production build.
