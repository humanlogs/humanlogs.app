"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useModal } from "@/components/use-modal";
import {
  addCustomShortcut,
  CustomShortcut,
  defaultShortcuts,
  deleteCustomShortcut,
  getCustomShortcuts,
} from "@/lib/shortcuts";
import { PlusIcon, TrashIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export function useShortcutsModal() {
  return useModal("shortcuts-modal");
}

export function ShortcutsDialog() {
  const { isOpen, close } = useShortcutsModal();
  const [customShortcuts, setCustomShortcuts] = useState<CustomShortcut[]>(() =>
    getCustomShortcuts(),
  );
  const [newKey, setNewKey] = useState("");
  const [newText, setNewText] = useState("");

  // Refresh shortcuts when modal opens
  useEffect(() => {
    if (isOpen) {
      // Use a timeout to avoid the setState in effect warning
      const timeoutId = setTimeout(() => {
        setCustomShortcuts(getCustomShortcuts());
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [isOpen]);

  // Predefined shortcut options
  const shortcutOptions = [
    // F1-F12
    ...Array.from({ length: 12 }, (_, i) => ({
      label: `F${i + 1}`,
      value: `f${i + 1}`,
    })),
    // Ctrl+0-9
    ...Array.from({ length: 10 }, (_, i) => ({
      label: `Ctrl+${i}`,
      value: `ctrl+${i}`,
    })),
  ];

  const handleAddShortcut = () => {
    if (!newKey || !newText) {
      toast.error("Please provide both key combination and text");
      return;
    }

    try {
      addCustomShortcut({
        key: newKey,
        text: newText,
      });
      setCustomShortcuts(getCustomShortcuts());
      setNewKey("");
      setNewText("");
      toast.success("Custom shortcut added");
    } catch (error) {
      toast.error("Failed to add shortcut");
      console.error("Add shortcut error:", error);
    }
  };

  const handleDeleteShortcut = (id: string) => {
    try {
      deleteCustomShortcut(id);
      setCustomShortcuts(getCustomShortcuts());
      toast.success("Shortcut deleted");
    } catch (error) {
      toast.error("Failed to delete shortcut");
      console.error("Delete shortcut error:", error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>
            View default shortcuts and create custom text shortcuts
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4 p-4 px-6">
          <div className="space-y-6">
            {/* Default Shortcuts */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Default Shortcuts</h3>
              {defaultShortcuts.map((category) => (
                <div key={category.category} className="mb-4">
                  <h4 className="text-xs font-medium text-muted-foreground mb-2">
                    {category.category}
                  </h4>
                  <div className="space-y-2">
                    {category.shortcuts.map((shortcut, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between py-1"
                      >
                        <span className="text-sm">{shortcut.description}</span>
                        <div className="flex gap-1">
                          {shortcut.keys.map((key, keyIdx) => (
                            <Badge
                              key={keyIdx}
                              variant="outline"
                              className="font-mono text-xs"
                            >
                              {key}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Custom Shortcuts Category */}
              {customShortcuts.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-xs font-medium text-muted-foreground mb-2">
                    Custom
                  </h4>
                  <div className="space-y-2">
                    {customShortcuts.map((shortcut) => (
                      <div
                        key={shortcut.id}
                        className="flex items-center justify-between py-1 group"
                      >
                        <span className="text-sm">
                          Insert &ldquo;{shortcut.text}&rdquo;
                        </span>
                        <div className="flex gap-2 items-center">
                          <Badge
                            variant="outline"
                            className="font-mono text-xs"
                          >
                            {shortcut.key}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleDeleteShortcut(shortcut.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive h-6 w-6"
                          >
                            <TrashIcon className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Shortcuts Management */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Shortcuts</h3>
              <p className="text-xs text-muted-foreground mb-4">
                Create custom shortcuts to insert frequently used text at the
                cursor position in edit mode.
              </p>

              {/* Add new shortcut - single line */}
              <div className="flex gap-2 items-end mb-4">
                <div className="flex-1">
                  <Select
                    size="sm"
                    options={shortcutOptions}
                    value={newKey}
                    onChange={setNewKey}
                    placeholder="Select key..."
                    searchPlaceholder="Search keys..."
                  />
                </div>
                <div className="flex-1">
                  <Input
                    value={newText}
                    onChange={(e) => setNewText(e.target.value)}
                    placeholder="Text to insert"
                  />
                </div>
                <Button onClick={handleAddShortcut} size="sm">
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Add
                </Button>
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
