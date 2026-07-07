import React, { useEffect } from "react";
import { Toolbar } from "@/components/ui/Toolbar";
import { Inspector } from "@/components/ui/Inspector";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { Canvas2D } from "@/components/canvas/Canvas2D";
import { Canvas3D } from "@/components/canvas/Canvas3D";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Layers } from "lucide-react";

export default function Editor() {
  const viewMode = useStore((state) => state.ui.viewMode);
  const setViewMode = useStore((state) => state.setViewMode);
  const activeLevelId = useStore((state) => state.ui.activeLevelId);
  const setActiveLevel = useStore((state) => state.setActiveLevel);
  const setTool = useStore((state) => state.setTool);
  const selectedIds = useStore((state) => state.ui.selectedIds);
  const selectObject = useStore((state) => state.selectObject);
  const removeRoom = useStore((state) => state.removeRoom);
  const removeFloor = useStore((state) => state.removeFloor);
  const rooms = useStore((state) => state.project.rooms);
  const floors = useStore((state) => state.project.floors);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore key events if user is typing in an input or textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case 'Delete':
        case 'Backspace':
          if (selectedIds.length > 0) {
             selectedIds.forEach(id => {
                if (rooms[id]) {
                   removeRoom(id);
                } else if (floors[id]) {
                   removeFloor(id);
                }
             });
             selectObject(null);
          }
          break;
      }

      switch (e.key.toLowerCase()) {
        case 's':
          setTool('select');
          break;
        case 'r':
          setTool('room');
          break;
        case 'f':
          setTool('floor');
          break;
        case 'p':
          setTool('split');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setTool, selectedIds, rooms, floors, removeRoom, removeFloor, selectObject]);

  return (
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden text-foreground">
      {/* Top Bar */}
      <div className="h-12 border-b border-border flex items-center px-4 justify-between bg-card shrink-0 z-20">
        <div className="font-semibold flex items-center gap-2">
          <Layers className="h-5 w-5" />
          <span>Foundation Decoupling Prototype</span>
        </div>
        
        <div className="flex items-center gap-4">
          <Tabs value={activeLevelId} onValueChange={setActiveLevel}>
            <TabsList>
              <TabsTrigger value="level-1">Level 1</TabsTrigger>
              <TabsTrigger value="level-2">Level 2</TabsTrigger>
            </TabsList>
          </Tabs>
          
          <div className="w-px h-6 bg-border" />

          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as '2d' | '3d' | 'split')}>
            <TabsList>
              <TabsTrigger value="2d">2D View</TabsTrigger>
              <TabsTrigger value="3d">3D View</TabsTrigger>
              <TabsTrigger value="split">Split View</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        
        <div className="w-[200px]" /> {/* Spacer for balance */}
      </div>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        <Toolbar />
        
        {/* Canvas Area */}
        <div className="flex-1 relative bg-zinc-50 dark:bg-zinc-900 overflow-hidden flex">
          {viewMode === '2d' && <Canvas2D />}
          {viewMode === '3d' && <Canvas3D />}
          {viewMode === 'split' && (
            <>
              <div className="flex-1 border-r border-border relative">
                <Canvas2D />
                <div className="absolute top-4 right-4 bg-background/80 backdrop-blur px-2 py-1 rounded text-xs font-medium pointer-events-none border shadow-sm z-10">
                  2D View
                </div>
              </div>
              <div className="flex-1 relative">
                <Canvas3D />
                <div className="absolute top-4 right-4 bg-background/80 backdrop-blur px-2 py-1 rounded text-xs font-medium pointer-events-none border shadow-sm z-10 text-white">
                  3D View
                </div>
              </div>
            </>
          )}
        </div>
        
        <Inspector />
      </div>
    </div>
  );
}
