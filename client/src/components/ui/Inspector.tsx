import { useStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export function Inspector() {
  const selectedIds = useStore((state) => state.ui.selectedIds);
  const selectedEdge = useStore((state) => state.ui.selectedEdge);
  const rooms = useStore((state) => state.project.rooms);
  const floors = useStore((state) => state.project.floors);
  const foundations = useStore((state) => state.project.foundations);
  const updateRoom = useStore((state) => state.updateRoom);
  const removeRoom = useStore((state) => state.removeRoom);
  const updateFoundation = useStore((state) => state.updateFoundation);
  const selectObject = useStore((state) => state.selectObject);
  const selectEdge = useStore((state) => state.selectEdge);

  if (selectedIds.length === 0) {
    return (
      <div className="w-80 bg-card border-l border-border p-4 text-muted-foreground text-sm z-10">
        No selection
      </div>
    );
  }

  const selectedId = selectedIds[0]; // MVP: Single select
  
  // Check if it's a room or a floor
  const room = rooms[selectedId];
  const floor = floors[selectedId];

  if (room) {
      // Find selected room edge properties if any
      const selectedRoomEdgeSettings = selectedEdge && selectedEdge.itemType === 'room' && room.edges
        ? room.edges[selectedEdge.edgeIndex]
        : null;

      return (
        <div className="w-80 bg-card border-l border-border flex flex-col z-10 overflow-y-auto">
          <CardHeader>
            <CardTitle className="text-lg font-medium">Room Properties</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="room-name">Name</Label>
              <Input 
                id="room-name" 
                value={room.name} 
                onChange={(e) => updateRoom(room.id, { name: e.target.value })} 
              />
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="room-width">Width (in)</Label>
                <Input 
                  id="room-width" 
                  type="number"
                  value={room.width} 
                  onChange={(e) => updateRoom(room.id, { width: parseFloat(e.target.value) || 0 })} 
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="room-height">Height (in)</Label>
                <Input 
                  id="room-height" 
                  type="number"
                  value={room.height} 
                  onChange={(e) => updateRoom(room.id, { height: parseFloat(e.target.value) || 0 })} 
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="room-x">X (in)</Label>
                <Input 
                  id="room-x" 
                  type="number"
                  value={room.x} 
                  onChange={(e) => updateRoom(room.id, { x: parseFloat(e.target.value) || 0 })} 
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="room-y">Y (in)</Label>
                <Input 
                  id="room-y" 
                  type="number"
                  value={room.y} 
                  onChange={(e) => updateRoom(room.id, { y: parseFloat(e.target.value) || 0 })} 
                />
              </div>
            </div>

            <Separator />

            {selectedEdge && selectedEdge.itemType === 'room' ? (
                <div className="space-y-4 border rounded p-3 bg-muted/20">
                    <div className="flex items-center justify-between">
                        <Label className="font-semibold text-primary">Edge {selectedEdge.edgeIndex} Selected</Label>
                    </div>
                    
                    {selectedRoomEdgeSettings ? (
                        <div className="flex items-center space-x-2">
                            <input 
                                type="checkbox"
                                id="clipByFoundation"
                                checked={selectedRoomEdgeSettings.clipByFoundation}
                                onChange={(e) => {
                                    // Update room edge settings
                                    const newEdges = { ...room.edges };
                                    if (newEdges[selectedEdge.edgeIndex]) {
                                        newEdges[selectedEdge.edgeIndex] = {
                                            ...newEdges[selectedEdge.edgeIndex],
                                            clipByFoundation: e.target.checked
                                        };
                                        updateRoom(room.id, { edges: newEdges });
                                    }
                                }}
                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                            />
                            <Label htmlFor="clipByFoundation">Clip by Foundation</Label>
                        </div>
                    ) : (
                        <div className="text-sm text-muted-foreground">No settings for this edge.</div>
                    )}
                </div>
            ) : (
                <div className="text-sm text-muted-foreground italic">
                    Select a room edge in the viewport to edit edge properties.
                </div>
            )}

            <Separator />

            <Button 
              variant="destructive" 
              className="w-full"
              onClick={() => {
                selectObject(null);
                removeRoom(room.id);
              }}
            >
              Delete Room
            </Button>
          </CardContent>
        </div>
      );
  }

  if (floor) {
      // Find selected foundation edge if any
      const selectedFoundation = selectedEdge && selectedEdge.itemType === 'floor'
          ? Object.values(foundations).find(f => f.floorId === floor.id && f.edgeIndex === selectedEdge.edgeIndex)
          : null;

      return (
        <div className="w-80 bg-card border-l border-border flex flex-col z-10 overflow-y-auto">
          <CardHeader>
            <CardTitle className="text-lg font-medium">Floor Properties</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Width (in)</Label>
                <div className="p-2 border rounded text-sm bg-muted">{floor.width}</div>
              </div>
              <div className="grid gap-2">
                <Label>Height (in)</Label>
                <div className="p-2 border rounded text-sm bg-muted">{floor.height}</div>
              </div>
            </div>

            <Separator />
            
            {selectedEdge && selectedEdge.itemType === 'floor' ? (
                <div className="space-y-4 border rounded p-3 bg-muted/20">
                    <div className="flex items-center justify-between">
                        <Label className="font-semibold text-primary">Edge {selectedEdge.edgeIndex} Selected</Label>
                    </div>
                    
                    {selectedFoundation ? (
                        <>
                            <div className="grid gap-2">
                                <Label>Top Offset (in)</Label>
                                <Input 
                                  type="number" 
                                  value={selectedFoundation.topOffset} 
                                  onChange={(e) => updateFoundation(selectedFoundation.id, { topOffset: parseFloat(e.target.value) || 0 })}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>Bottom Offset (in)</Label>
                                <Input 
                                  type="number" 
                                  value={selectedFoundation.bottomOffset} 
                                  onChange={(e) => updateFoundation(selectedFoundation.id, { bottomOffset: parseFloat(e.target.value) || 0 })}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>Foundation Depth (in)</Label>
                                <Input 
                                  type="number" 
                                  value={selectedFoundation.depth} 
                                  onChange={(e) => updateFoundation(selectedFoundation.id, { depth: parseFloat(e.target.value) || 0 })}
                                />
                            </div>
                        </>
                    ) : (
                        <div className="text-sm text-muted-foreground">No foundation on this edge.</div>
                    )}
                </div>
            ) : (
                <div className="text-sm text-muted-foreground italic">
                    Select an edge in the viewport to edit foundation properties.
                </div>
            )}
          </CardContent>
        </div>
      );
  }

  return (
      <div className="w-80 bg-card border-l border-border p-4 text-muted-foreground text-sm z-10">
        Unknown Item Selection
      </div>
  );
}
