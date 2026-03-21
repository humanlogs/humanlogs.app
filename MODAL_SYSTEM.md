# Reusable Modal System

This project uses a simple, lightweight modal management system inspired by libraries like `sonner` (for toasts). No provider needed!

## How it works

The modal manager uses a module-level store with React hooks, allowing you to trigger modals from anywhere without importing components or providers.

## Usage

### 1. Define your modal data type (optional, but recommended for type safety)

```typescript
// In components/use-modal.tsx
export type YourModalData = {
  someField: string;
  onSuccess?: () => void;
};
```

### 2. Create a convenience hook (optional)

```typescript
// In components/use-modal.tsx
export function useYourModal() {
  const modal = useModal<YourModalData>("your-modal-id");

  return {
    ...modal,
    // Add convenience methods if needed
    openWithData: (someField: string, onSuccess?: () => void) => {
      modal.open({ someField, onSuccess });
    },
  };
}
```

### 3. Create your modal component

```typescript
export function YourModal() {
  const { isOpen, data, close } = useYourModal();

  return (
    <Dialog open={isOpen} onOpenChange={close}>
      {/* Your modal content */}
      <DialogContent>
        <p>{data?.someField}</p>
      </DialogContent>
    </Dialog>
  );
}
```

### 4. Render the modal component once at the app level

Add it to your layout or root component:

```typescript
// app/(app)/layout.tsx
import { YourModal } from "@/components/your-modal";

export default function Layout() {
  return (
    <>
      {/* Your app content */}
      <YourModal />
    </>
  );
}
```

### 5. Open the modal from anywhere!

```typescript
import { useYourModal } from "@/components/use-modal";

function SomeComponent() {
  const { openWithData } = useYourModal();

  return (
    <button onClick={() => openWithData("Hello!", () => console.log("Success!"))}>
      Open Modal
    </button>
  );
}
```

Or use the imperative API (no hooks needed):

```typescript
import { modals } from "@/components/use-modal";

// Can be called from anywhere, even outside React components
modals.open("your-modal-id", { someField: "Hello!" });
```

## Example: Project Modal

See `components/use-modal.tsx` and `components/project-create-modal.tsx` for a complete example of create/rename functionality.

## Benefits

- ✅ No provider needed
- ✅ Call from anywhere (event handlers, utilities, etc.)
- ✅ Type-safe with TypeScript
- ✅ Minimal boilerplate
- ✅ Easy to extend for new modals
- ✅ Lightweight implementation
