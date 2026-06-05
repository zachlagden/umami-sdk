# umami-sdk React Adapter (`umami-sdk/react`) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add a React entry point `umami-sdk/react` with `<UmamiProvider>` and `useUmami()`, a thin layer over the core `createUmami`.

**Architecture:** `src/react/index.tsx`. The provider creates the core instance in a **mount effect** (side effects out of render — StrictMode-safe) and calls `instance.destroy()` on unmount (no leaked history patches/listeners). A module-level no-op instance is supplied before the effect runs so `useUmami()` always returns a valid object. React relies on the core's History-API auto-tracking for SPA pageviews; the Next adapter (separate plan) will override with router hooks.

**Tech Stack:** TypeScript (strict), tsup multi-entry with JSX, vitest + happy-dom + @testing-library/react. `react` is an optional peer dependency (externalized in the build).

**Spec:** `docs/superpowers/specs/2026-06-04-umami-sdk-design.md` §8.

**Depends on:** merged core (`createUmami` + `UmamiInstance.destroy()` on `main`).

---

## File Structure

```
src/react/index.tsx       # UmamiProvider + useUmami
test/react.test.tsx       # adapter tests (@testing-library/react)
package.json              # ./react export, react peerDep, devDeps
tsconfig.json             # jsx: react-jsx
tsup.config.ts            # react entry
.size-limit.json          # react budget
README.md / CHANGELOG.md  # docs
```

---

## Task 1: Build wiring for `/react`

**Files:** Modify `package.json`, `tsconfig.json`, `tsup.config.ts`, `.size-limit.json`; Create placeholder `src/react/index.tsx`

- [ ] **Step 1: Install dev dependencies**

Run: `pnpm add -D react react-dom @testing-library/react @types/react @types/react-dom`
Expected: installs succeed (React 18 or 19 is fine).

- [ ] **Step 2: Add `react` as an optional peer dependency** — add to `package.json` (top level, sibling of `devDependencies`):

```json
  "peerDependencies": {
    "react": ">=18"
  },
  "peerDependenciesMeta": {
    "react": { "optional": true }
  },
```

- [ ] **Step 3: Add the `./react` subpath to `package.json` `exports`** (after the `"./node"` entry):

```json
    "./react": {
      "types": "./dist/react.d.ts",
      "import": "./dist/react.js",
      "require": "./dist/react.cjs"
    },
```

- [ ] **Step 4: Enable JSX in `tsconfig.json`** — add to `compilerOptions`:

```json
    "jsx": "react-jsx",
```

- [ ] **Step 5: Add the react entry to `tsup.config.ts`** — update `entry`:

```ts
  entry: { index: 'src/index.ts', node: 'src/node/index.ts', react: 'src/react/index.tsx' },
```

- [ ] **Step 6: Add a react budget to `.size-limit.json`** (new array element):

```json
  {
    "name": "umami-sdk/react",
    "path": "dist/react.js",
    "limit": "2 KB",
    "gzip": true,
    "ignore": ["react", "react-dom"]
  }
```

- [ ] **Step 7: Create placeholder `src/react/index.tsx`**

```tsx
export const REACT_ENTRY = true;
```

- [ ] **Step 8: Build + typecheck**

Run: `pnpm build && pnpm typecheck`
Expected: emits `dist/react.js`, `dist/react.cjs`, `dist/react.d.ts`; no type errors; `react` is NOT bundled (externalized).

- [ ] **Step 9: Commit**

```bash
git add package.json tsconfig.json tsup.config.ts .size-limit.json src/react/index.tsx pnpm-lock.yaml
git commit -m "build: add umami-sdk/react entry point"
```

---

## Task 2: Implement the React adapter (TDD)

**Files:** Modify `src/react/index.tsx`; Test `test/react.test.tsx`

- [ ] **Step 1: Write `test/react.test.tsx`**

```tsx
// @vitest-environment-options { "url": "https://example.com/" }
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { UmamiProvider, useUmami } from '../src/react/index';

const fetchMock = vi.fn(async () => ({ json: async () => ({}) }));

beforeEach(() => {
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
  window.localStorage.clear();
  window.history.replaceState(null, '', 'https://example.com/');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function TrackButton() {
  const umami = useUmami();
  return <button onClick={() => umami.track('clicked', { a: 1 })}>go</button>;
}

describe('UmamiProvider / useUmami', () => {
  it('fires the initial pageview on mount', () => {
    render(
      <UmamiProvider config={{ websiteId: 'abc', hostUrl: 'https://a.test' }}>
        <span>ok</span>
      </UmamiProvider>,
    );
    expect(fetchMock).toHaveBeenCalled();
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as { body: string }).body);
    expect(body.type).toBe('event');
    expect(body.payload.website).toBe('abc');
  });

  it('provides a working instance; track reaches the network', async () => {
    render(
      <UmamiProvider config={{ websiteId: 'abc', hostUrl: 'https://a.test' }}>
        <TrackButton />
      </UmamiProvider>,
    );
    fetchMock.mockClear();
    await act(async () => {
      fireEvent.click(screen.getByText('go'));
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as { body: string }).body);
    expect(body.payload.name).toBe('clicked');
    expect(body.payload.data).toEqual({ a: 1 });
  });

  it('useUmami throws when used outside a provider', () => {
    function Lonely() {
      useUmami();
      return null;
    }
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Lonely />)).toThrow(/UmamiProvider/);
    spy.mockRestore();
  });

  it('tears down the instance on unmount (no pageview after unmount navigation)', () => {
    const { unmount } = render(
      <UmamiProvider config={{ websiteId: 'abc', hostUrl: 'https://a.test' }}>
        <span>ok</span>
      </UmamiProvider>,
    );
    unmount();
    fetchMock.mockClear();
    window.history.pushState(null, '', '/after-unmount');
    // core uses a 300ms delayed pageview; even immediately, the patch should be removed
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test → expect FAIL** (no `UmamiProvider`/`useUmami` exports)

Run: `pnpm vitest run test/react.test.tsx`
Expected: FAIL — exports not found.

- [ ] **Step 3: Replace `src/react/index.tsx`**

```tsx
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { createUmami } from '../index';
import type { UmamiConfig, UmamiInstance } from '../core/types';

const noopInstance: UmamiInstance = {
  track: (..._args: unknown[]) => Promise.resolve(),
  identify: (..._args: unknown[]) => Promise.resolve(),
  enable: () => {},
  disable: () => {},
  disabled: false,
  destroy: () => {},
} as UmamiInstance;

const UmamiContext = createContext<UmamiInstance | undefined>(undefined);

export interface UmamiProviderProps {
  config: UmamiConfig;
  children: ReactNode;
}

export function UmamiProvider({ config, children }: UmamiProviderProps): JSX.Element {
  const [instance, setInstance] = useState<UmamiInstance | null>(null);

  useEffect(() => {
    const inst = createUmami(config);
    setInstance(inst);
    return () => inst.destroy();
    // config is expected to be stable; the instance is created once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <UmamiContext.Provider value={instance ?? noopInstance}>{children}</UmamiContext.Provider>
  );
}

export function useUmami(): UmamiInstance {
  const ctx = useContext(UmamiContext);
  if (ctx === undefined) {
    throw new Error('useUmami must be used within a <UmamiProvider>.');
  }
  return ctx;
}
```

Note on the `noopInstance` cast: the `(...args: unknown[]) => Promise<void>` shape doesn't structurally match the overloaded `track`/`identify` signatures, so the object is cast `as UmamiInstance` (same casting pattern used in `src/index.ts`). If `pnpm typecheck` still complains, widen to `as unknown as UmamiInstance`. Also confirm `JSX.Element` resolves under `react-jsx`; if not, return type can be dropped (inferred).

- [ ] **Step 4: Run the test → expect PASS**

Run: `pnpm vitest run test/react.test.tsx`
Expected: PASS (4 cases).

- [ ] **Step 5: Full suite + typecheck**

Run: `pnpm test && pnpm typecheck`
Expected: all green (core 49 + node 10 + react 4).

- [ ] **Step 6: Commit**

```bash
git add src/react/index.tsx test/react.test.tsx
git commit -m "feat: add React adapter (UmamiProvider + useUmami)"
```

---

## Task 3: Docs + final verification

**Files:** Modify `README.md`, `CHANGELOG.md`

- [ ] **Step 1: Add a React section to `README.md`** — insert before `## Server-side`:

````markdown
## React (`umami-sdk/react`)

```tsx
import { UmamiProvider, useUmami } from 'umami-sdk/react';

function App() {
  return (
    <UmamiProvider config={{ websiteId: '...', hostUrl: 'https://analytics.example.com' }}>
      <Page />
    </UmamiProvider>
  );
}

function Page() {
  const umami = useUmami();
  return <button onClick={() => umami.track('signup', { plan: 'pro' })}>Sign up</button>;
}
```

`<UmamiProvider>` creates the tracker on mount (auto-tracking SPA pageviews) and tears it down on unmount. `react` is an optional peer dependency.
````

- [ ] **Step 2: Update `CHANGELOG.md`** — under `## [Unreleased]` `### Added`:

```markdown
- `umami-sdk/react` — `<UmamiProvider>` + `useUmami()` hook; creates the tracker on mount and destroys it on unmount.
```

- [ ] **Step 3: Final verification**

Run: `pnpm test && pnpm typecheck && pnpm build && pnpm size`
Expected: all green; react entry under 2 KB gzip (excluding react). Record the react gzip number.

- [ ] **Step 4: Commit**

```bash
git add README.md CHANGELOG.md
git commit -m "docs: document umami-sdk/react usage"
```

---

## Self-Review (plan author)

- **Spec §8 React coverage:** `<UmamiProvider config>` + `useUmami()` → Task 2. Thin layer over `createUmami`; transport/payload delegated to core.
- **StrictMode safety:** instance created in mount effect (not render); `destroy()` on unmount cleans history patches + listeners (relies on the core teardown fix already merged).
- **Placeholder scan:** none — full code/tests/commands provided.
- **Type consistency:** reuses `UmamiConfig`/`UmamiInstance` from core; the noop/cast pattern matches `src/index.ts`. Build externalizes `react` via peerDependencies.
- **Known risk:** `JSX.Element` return annotation under the React 17+ automatic runtime — drop if it doesn't resolve. Tests use `@testing-library/react` against the global happy-dom environment.
