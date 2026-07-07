import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { v4 as uuidv4 } from 'uuid';
import { ProjectState, UIState, Room, Wall, Floor, Foundation, Level, ToolMode, ViewMode, RoomEdgeSettings } from './types';

interface StoreState {
  project: ProjectState;
  ui: UIState;
  
  // Actions
  setTool: (tool: ToolMode) => void;
  setViewMode: (mode: ViewMode) => void;
  setActiveLevel: (levelId: string) => void;
  selectObject: (id: string | null, multi?: boolean) => void;
  selectEdge: (itemId: string | null, itemType: 'floor' | 'room' | null, edgeIndex: number | null) => void;
  setHovered: (id: string | null) => void;
  
  addRoom: (x: number, y: number, width: number, height: number) => void;
  addFloor: (x: number, y: number, width: number, height: number) => void;
  splitEdge: (itemId: string, itemType: 'room' | 'floor', edgeIndex: number) => void;
  updateRoom: (id: string, updates: Partial<Room>) => void;
  updateFloor: (id: string, updates: Partial<Floor>) => void;
  removeRoom: (id: string) => void;
  removeFloor: (id: string) => void;
  updateFoundation: (id: string, updates: Partial<Foundation>) => void;

  // Computed helpers (internal usage mostly)
  regenerateWalls: (roomId: string) => void;
  regenerateFloor: (roomId: string) => void;
}

const DEFAULT_WALL_THICKNESS = 3.5;
const DEFAULT_WALL_HEIGHT = 108; // 9 feet
const DEFAULT_FLOOR_THICKNESS = 12;

const INITIAL_LEVELS: Record<string, Level> = {
  'level-1': { id: 'level-1', name: 'Level 1', elevation: 0, height: 120 },
  'level-2': { id: 'level-2', name: 'Level 2', elevation: 120, height: 120 },
};

export const useStore = create<StoreState>()(
  immer((set, get) => ({
    project: {
      levels: INITIAL_LEVELS,
      rooms: {},
      walls: {},
      floors: {},
      foundations: {},
    },
    ui: {
      viewMode: '2d',
      activeLevelId: 'level-1',
      selectedIds: [],
      selectedEdge: null,
      tool: 'select',
      hoveredId: null,
      gridSize: 12,
    },

    setTool: (tool) => set((state) => { state.ui.tool = tool; }),
    setViewMode: (mode) => set((state) => { state.ui.viewMode = mode; }),
    setActiveLevel: (levelId) => set((state) => { state.ui.activeLevelId = levelId; }),
    
    selectObject: (id, multi = false) => set((state) => {
      // Clear edge selection when changing object selection
      state.ui.selectedEdge = null;
      
      if (id === null) {
        state.ui.selectedIds = [];
        return;
      }
      if (multi) {
        if (state.ui.selectedIds.includes(id)) {
          state.ui.selectedIds = state.ui.selectedIds.filter(i => i !== id);
        } else {
          state.ui.selectedIds.push(id);
        }
      } else {
        state.ui.selectedIds = [id];
      }
    }),

    selectEdge: (itemId, itemType, edgeIndex) => set((state) => {
       if (itemId === null || itemType === null || edgeIndex === null) {
         state.ui.selectedEdge = null;
       } else {
         state.ui.selectedEdge = { itemId, itemType, edgeIndex };
         // Also ensure the object is selected
         state.ui.selectedIds = [itemId];
       }
    }),

    setHovered: (id) => set((state) => { state.ui.hoveredId = id; }),

    addRoom: (x, y, width, height) => {
      const roomId = uuidv4();
      const levelId = get().ui.activeLevelId;

      set((state) => {
        // Add Room
        // Points: Bottom-Left, Bottom-Right, Top-Right, Top-Left (CCW)
        const points = [
            { x, y },
            { x: x + width, y },
            { x: x + width, y: y + height },
            { x, y: y + height }
        ];

        state.project.rooms[roomId] = {
          id: roomId,
          levelId,
          x, y, width, height,
          points,
          name: 'New Room',
          edges: {
             0: { clipByFoundation: false },
             1: { clipByFoundation: false },
             2: { clipByFoundation: false },
             3: { clipByFoundation: false },
          }
        };
      });

      // Generate walls only
      get().regenerateWalls(roomId);
    },

    addFloor: (x, y, width, height) => {
      // Floors need to be associated with a Room ID for now because of how the store is structured (Floor has roomId),
      // but the user wants to draw floors independently.
      // For MVP, I will create a "dummy" room or just use a UUID as roomId that doesn't exist in rooms table?
      // Looking at types.ts: export interface Floor { ... roomId: string; ... }
      // And in Canvas2D/3D filtering: `const activeFloors = Object.values(floors).filter(f => rooms[f.roomId]?.levelId === activeLevelId);`
      // This dependency on `rooms[f.roomId]` is problematic if we want independent floors.
      // I should modify how floors are filtered or create a "Floor Object" that acts as a container if needed.
      // Or simply: Create a Room for it but maybe flag it as "FloorOnly"?
      // Or better: Let's fix the filtering logic in components to allow floors without valid rooms if they have levelId directly?
      // Wait, Floor interface has `levelId` too.
      // Let's check `types.ts`: `export interface Floor { id: string; levelId: string; roomId: string; ... }`
      // So it has levelId. The filtering `rooms[f.roomId]?.levelId` was just a convenience or a constraint.
      
      // I will create a floor with a dummy roomId for now to satisfy the type, but rely on levelId.
      
      const floorId = uuidv4();
      const levelId = get().ui.activeLevelId;
      // We can use the floorId as the roomId effectively, or just a placeholder. 
      // But if we want to select it, we might need a stable ID.
      
      set((state) => {
         // Points: Bottom-Left, Bottom-Right, Top-Right, Top-Left (CCW)
         const points = [
            { x, y },
            { x: x + width, y },
            { x: x + width, y: y + height },
            { x, y: y + height }
         ];

         state.project.floors[floorId] = {
            id: floorId,
            levelId,
            roomId: "independent-floor-" + floorId, // Dummy ID
            x, y, width, height,
            points,
            thickness: DEFAULT_FLOOR_THICKNESS
         };
         
         // Generate foundations for this floor
         [0, 1, 2, 3].forEach((edgeIndex) => {
            const fId = uuidv4();
            state.project.foundations[fId] = {
              id: fId,
              floorId: floorId,
              edgeIndex: edgeIndex,
              thickness: 12,
              depth: 48,
              topOffset: 0,
              bottomOffset: 0
            };
         });
      });
    },

    splitEdge: (itemId, itemType, edgeIndex) => {
       set((state) => {
          let item: Room | Floor | null = null;
          if (itemType === 'room') {
             item = state.project.rooms[itemId];
          } else if (itemType === 'floor') {
             item = state.project.floors[itemId];
          }

          if (!item || !item.points) return;

          const points = item.points;
          if (edgeIndex < 0 || edgeIndex >= points.length) return;

          const p1 = points[edgeIndex];
          const p2 = points[(edgeIndex + 1) % points.length];

          // Calculate midpoint
          const midX = (p1.x + p2.x) / 2;
          const midY = (p1.y + p2.y) / 2;
          const newPoint = { x: midX, y: midY };

          // Insert new point after p1
          item.points.splice(edgeIndex + 1, 0, newPoint);

          // Remap edges
          // For Room: edges is Record<number, RoomEdgeSettings>
          // For Floor/Foundations: Foundations reference edgeIndex.

          // Shift properties for indices > edgeIndex
          // e.g. if we had 4 edges (0,1,2,3) and split 1.
          // Old 1 becomes 1a (0->new) and 1b (new->2).
          // But in our array, we insert at 2.
          // Points: 0, 1, New, 2, 3.
          // Edges: 
          // 0: 0->1 (unchanged)
          // 1: 1->New (Inherits props of old 1)
          // 2: New->2 (New edge! Inherits props of old 1?)
          // 3: 2->3 (Was old 2)
          // 4: 3->0 (Was old 3)

          // So we need to shift everything from edgeIndex+1 upwards by 1.
          // And duplicate edgeIndex props to edgeIndex+1.

          if (itemType === 'room') {
             const room = item as Room;
             const oldEdges = { ...room.edges };
             const newEdges: Record<number, RoomEdgeSettings> = {};
             
             // Count is old edge count. New count is old + 1.
             const oldEdgeCount = points.length - 1; // Since we already added a point, points.length is new count + 1? No. Vertices = Edges for loop.
             // points.length is now 5. old was 4.
             // Loop through new edge indices: 0 to 4.
             
             for (let i = 0; i < points.length; i++) {
                if (i <= edgeIndex) {
                   newEdges[i] = oldEdges[i] || { clipByFoundation: false };
                } else if (i === edgeIndex + 1) {
                   // This is the new segment of the split edge. Inherit from split parent?
                   newEdges[i] = { ...oldEdges[edgeIndex] } || { clipByFoundation: false };
                } else {
                   // Shifted edges
                   newEdges[i] = oldEdges[i - 1] || { clipByFoundation: false };
                }
             }
             room.edges = newEdges;
          }

          if (itemType === 'floor') {
             // Remap foundations
             // We need to find all foundations for this floor.
             const foundations = Object.values(state.project.foundations).filter(f => f.floorId === itemId);
             
             // If we split edge 1.
             // Foundation on edge 0 -> stays 0.
             // Foundation on edge 1 -> ? We now have edge 1 and 2 representing the old edge 1.
             // Should we split the foundation? Or assign it to one?
             // "The edge numbers should be remapped".
             // Let's keep it simple: Existing foundation on split edge stays on the first segment (index).
             // Foundations on higher indices shift up.
             
             foundations.forEach(f => {
                if (f.edgeIndex > edgeIndex) {
                   f.edgeIndex += 1;
                } else if (f.edgeIndex === edgeIndex) {
                   // It stays on the first half.
                   // Optionally create a new foundation for the second half?
                   // "Edges today are split by corners... I could have two colinear edges."
                   // Likely user wants to control them independently.
                   // Let's create a new default foundation for the new edge segment?
                   // Or just leave it empty?
                   // Existing code generates foundations for all 4 edges.
                   // If we add an edge, we probably want a foundation there too.
                   
                   // Let's create a new foundation for the new segment (edgeIndex + 1).
                   // We'll do this outside the loop.
                }
             });

             // Add new foundation for the new edge segment
             const newFId = uuidv4();
             state.project.foundations[newFId] = {
                id: newFId,
                floorId: itemId,
                edgeIndex: edgeIndex + 1,
                thickness: 12,
                depth: 48,
                topOffset: 0,
                bottomOffset: 0
             };
          }
       });
       
       // Regenerate logic
       if (itemType === 'room') {
          get().regenerateWalls(itemId);
          get().regenerateFloor(itemId); // Only if floor matches room?
       }
    },

    updateRoom: (id, updates) => {
      set((state) => {
        const room = state.project.rooms[id];
        if (room) {
          Object.assign(room, updates);
        }
      });
      get().regenerateWalls(id);
      get().regenerateFloor(id);
    },

    updateFloor: (id, updates) => {
      set((state) => {
        const floor = state.project.floors[id];
        if (floor) {
          Object.assign(floor, updates);
        }
      });
    },

    removeRoom: (id) => {
      set((state) => {
        delete state.project.rooms[id];
        // Cleanup dependent walls
        const wallIds = Object.values(state.project.walls).filter(w => w.roomId === id).map(w => w.id);
        wallIds.forEach(wid => delete state.project.walls[wid]);
        
        // Cleanup dependent floors
        const floorIds = Object.values(state.project.floors).filter(f => f.roomId === id).map(f => f.id);
        floorIds.forEach(fid => {
            delete state.project.floors[fid];
            // Cleanup foundations
            const foundationIds = Object.values(state.project.foundations).filter(found => found.floorId === fid).map(found => found.id);
            foundationIds.forEach(foundId => delete state.project.foundations[foundId]);
        });
      });
    },

    removeFloor: (id) => {
      set((state) => {
        delete state.project.floors[id];
        // Cleanup foundations
        const foundationIds = Object.values(state.project.foundations).filter(found => found.floorId === id).map(found => found.id);
        foundationIds.forEach(foundId => delete state.project.foundations[foundId]);
      });
    },

    updateFoundation: (id, updates) => {
      set((state) => {
        const foundation = state.project.foundations[id];
        if (foundation) {
          Object.assign(foundation, updates);
        }
      });
    },

    regenerateWalls: (roomId) => {
      set((state) => {
        const room = state.project.rooms[roomId];
        if (!room) return;

        // Remove old walls for this room
        const oldWalls = Object.values(state.project.walls).filter(w => w.roomId === roomId);
        oldWalls.forEach(w => delete state.project.walls[w.id]);

        const walls: Omit<Wall, 'id'>[] = [];
        const points = room.points;
        
        if (points && points.length > 0) {
            for (let i = 0; i < points.length; i++) {
                const p1 = points[i];
                const p2 = points[(i + 1) % points.length];
                walls.push({
                    levelId: room.levelId, roomId,
                    start: p1,
                    end: p2,
                    thickness: DEFAULT_WALL_THICKNESS, height: DEFAULT_WALL_HEIGHT
                });
            }
        } else {
             // Fallback for Rooms without points (shouldn't happen with new ones, but for safety)
             walls.push(
              {
                levelId: room.levelId, roomId,
                start: { x: room.x, y: room.y },
                end: { x: room.x + room.width, y: room.y },
                thickness: DEFAULT_WALL_THICKNESS, height: DEFAULT_WALL_HEIGHT
              },
              {
                levelId: room.levelId, roomId,
                start: { x: room.x + room.width, y: room.y },
                end: { x: room.x + room.width, y: room.y + room.height },
                thickness: DEFAULT_WALL_THICKNESS, height: DEFAULT_WALL_HEIGHT
              },
              {
                levelId: room.levelId, roomId,
                start: { x: room.x + room.width, y: room.y + room.height },
                end: { x: room.x, y: room.y + room.height },
                thickness: DEFAULT_WALL_THICKNESS, height: DEFAULT_WALL_HEIGHT
              },
              {
                levelId: room.levelId, roomId,
                start: { x: room.x, y: room.y + room.height },
                end: { x: room.x, y: room.y },
                thickness: DEFAULT_WALL_THICKNESS, height: DEFAULT_WALL_HEIGHT
              }
            );
        }

        walls.forEach(w => {
          const id = uuidv4();
          state.project.walls[id] = { ...w, id };
        });
      });
    },

    regenerateFloor: (roomId) => {
      set((state) => {
        const room = state.project.rooms[roomId];
        if (!room) return;
        
        // We only want to regenerate IF a floor exists for this room.
        // If we decoupled them, maybe we shouldn't regenerate it automatically unless it's linked?
        // But for now, if there is a floor with this roomId, update it.
        const floor = Object.values(state.project.floors).find(f => f.roomId === roomId);
        
        if (floor) {
          floor.x = room.x;
          floor.y = room.y;
          floor.width = room.width;
          floor.height = room.height;
        }
      });
    }

  }))
);
