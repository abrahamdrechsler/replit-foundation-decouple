import { Button } from "@/components/ui/button";
import { MousePointer2, Square, Layers, Cuboid, Scissors } from "lucide-react";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { ToolMode } from "@/lib/types";

export function Toolbar() {
  const tool = useStore((state) => state.ui.tool);
  const setTool = useStore((state) => state.setTool);

  const tools: { id: ToolMode; icon: any; label: string }[] = [
    { id: 'select', icon: MousePointer2, label: 'Select' },
    { id: 'room', icon: Square, label: 'Room' },
    { id: 'floor', icon: Layers, label: 'Floor' },
    { id: 'split', icon: Scissors, label: 'Split Edge' },
  ];

  return (
    <div className="w-14 bg-card border-r border-border flex flex-col items-center py-4 gap-2 z-10">
      {tools.map((t) => (
        <Button
          key={t.id}
          variant={tool === t.id ? "secondary" : "ghost"}
          size="icon"
          onClick={() => setTool(t.id)}
          title={t.label}
          className={cn("rounded-md", tool === t.id && "bg-secondary text-secondary-foreground")}
        >
          <t.icon className="h-5 w-5" />
        </Button>
      ))}
    </div>
  );
}
