# Internationalization Development Guide

## 1. Library Overview & Core Concepts

Intee is a lightweight, type-safe, lazy-loading TypeScript internationalization
(i18n) library. It consists of two core packages:

- **`@intee/core`**: Handles core logic, including resource loading, locale
  matching (based on a scoring system), and type inference.
- **`@intee/react`**: Provides React bindings, integrating
  `@tanstack/react-query` for data fetching and caching, and supplying Context
  and Hooks.

## 2. Installation

When using Intee, the following dependencies must be installed:

```bash
npm install @intee/core @intee/react @tanstack/react-query
```

Note: `@tanstack/react-query` is a required peer dependency.

## 3. Standard Implementation Patterns (Step-by-Step)

### Step 1: Define Translation Resources (Type Safety)

You must first define a "Fallback Language" to serve as the source of truth for
types. Other languages must strictly satisfy this type.

- **Best Practice**: Use the `satisfies` keyword to ensure strict type matching.
- **Recommended Structure**: `src/languages/*.ts`

```typescript
// src/languages/en-US.ts (Fallback Language)
export default {
    hello: "Hello",
    nested: {
        title: "Title",
    },
};

// src/languages/zh-CN.ts (Other Language)
import type EnUS from "./en-US";

export default {
    hello: "你好",
    nested: {
        title: "标题",
    },
} satisfies typeof EnUS;
```

### Step 1.5: Handling Dynamic Content (Interpolation)

Since `intee` relies on standard TypeScript objects, it does **not** use custom
string placeholders (like `{{name}}`). Instead, **use functions that return
template strings**. This provides strict type safety for arguments.

**Define in Language Files:**

```typescript
// src/languages/en-US.ts
export default {
    // Bad: "Hello {name}" (No built-in support for placeholders)

    // Good: Use a function for dynamic values
    welcomeUser: (name: string) => `Welcome back, ${name}!`,

    // You can also handle simple logic (e.g., plurals) inside the function
    itemsCount: (count: number) =>
        `You have ${count} item${count === 1 ? "" : "s"}.`,
};
```

**Usage in Components:**

```tsx
const [t] = useTranslation();
// Type-checked: 'name' argument must be a string
console.log(t.welcomeUser("Alice"));
```

### Step 2: Initialize Instances (Global Configuration)

You must instantiate `Internationalization` and `InternationalizationReact`
outside of components (typically in `src/i18n.ts` or at the top of
`src/App.tsx`).

**Key Rules**:

1. **Fallback Must Be Synchronous**: The first argument of
   `Internationalization` is the fallback. Its `loader` must directly return the
   object; it cannot be a Promise.
2. **Async Loading for Others**: Subsequent arguments should use `import()` for
   lazy loading, often combined with the `pick` helper to extract the `default`
   export.
3. **Matchers**: Use functions like `mean`, `startsWith`, and `is` to define
   locale matching logic.

```typescript
import { Internationalization } from "@intee/core";
import { InternationalizationReact } from "@intee/react";
import { mean, startsWith } from "@intee/core/helpers/match";
import { pick } from "@intee/core/helpers/load";
import en_US from "./languages/en-US"; // Synchronous import for fallback

// 1. Create Core Instance
const i18n = new Internationalization(
    // Fallback Config (Must be synchronous)
    {
        tag: "en-US",
        predicate: mean(startsWith("en"), startsWith("en-US")),
        loader: () => en_US,
    },
    // Lazy Load Config (Async)
    {
        tag: "zh-CN",
        predicate: mean(startsWith("zh"), startsWith("zh-CN")),
        loader: pick("default", () => import("./languages/zh-CN")),
    },
);

// 2. Create React Bindings and Export
// Destructure Provider, useTranslation, context for global use
export const { Provider, useTranslation, context } =
    new InternationalizationReact(i18n);
```

### Step 3: Integrate into React App

Wrap the application root with the `Provider`.

```tsx
// src/App.tsx
import { Provider } from "./i18n"; // Import from Step 2
import { Main } from "./Main";

export default function App() {
    return (
        <Provider>
            <Main />
        </Provider>
    );
}
```

### Step 4: Use in Components (Hooks)

Use `useTranslation` to retrieve the translation object.

```tsx
import { useTranslation } from "./i18n";

export function Greeting() {
    // t is the type-safe translation object
    // The second element contains react-query state (isLoading, error, etc.)
    const [t, { isLoading }] = useTranslation();

    if (isLoading) return <div>Loading...</div>;

    return (
        <div>
            <h1>{t.hello}</h1>
            <p>{t.itemsCount(5)}</p>
        </div>
    );
}
```

### Step 5: Switching Languages

Use `useContext` to access the `setLanguages` method.

```tsx
import { useContext } from "react";
import { context } from "./i18n"; // Import context exported in Step 2

export function LanguageSwitcher() {
    // context returns a tuple: [languages, setLanguages, currentTag]
    // - languages: string[] (Current preferred languages list)
    // - setLanguages: (langs: string[]) => void
    // - currentTag: string (The actual active locale Tag)
    const [, setLanguages, currentTag] = useContext(context)!;

    return (
        <select
            value={currentTag}
            onChange={(e) => setLanguages([e.target.value])}
        >
            <option value="en-US">English</option>
            <option value="zh-CN">中文</option>
        </select>
    );
}
```

## 4. Common Pitfalls & Notes for LLMs

1. **Accessing the Tag**: If you need to get the specific locale Tag associated
   with the current translation object, do not use Context (which reflects user
   preference), but access it via the Symbol on the object:

```typescript
import { Internationalization } from "@intee/core";
// ...
const [t] = useTranslation();
console.log(t[Internationalization.Tag]); // Outputs "en-US" or "zh-CN"
```

2. **Helper Import Paths**:

- Matchers: `@intee/core/helpers/match`
- Loaders: `@intee/core/helpers/load`

3. **Do Not Instantiate Inside Components**: `new Internationalization(...)` and
   `new InternationalizationReact(...)` must be executed outside of components;
   otherwise, it will cause infinite re-renders or state loss.
4. **TanStack Query Integration**: `useTranslation` internally uses `useQuery`.
   The second return value contains standard properties like `data`,
   `isLoading`, and `error` from react-query.
5. **Type Definition**: `InternationalizationReact` automatically infers the
   translation object type `T`. No manual generics are needed as long as a typed
   loader is passed to the core instance in the constructor.
