export interface Point2D {
  x: number;
  y: number;
}

export interface Size2D {
  width: number;
  height: number;
}

export interface Level {
  id: string;
  name: string;
  elevation: number; // Height from origin in inches
  height: number; // Floor-to-floor height in inches
}

export interface RoomEdgeSettings {
  clipByFoundation: boolean;
}

export interface Room {
  id: string;
  levelId: string;
  x: number; // Bottom-left corner x (kept for bounding box/compat)
  y: number; // Bottom-left corner y (kept for bounding box/compat)
  width: number; // Kept for bounding box/compat
  height: number; // Kept for bounding box/compat
  points: Point2D[]; // Vertices in order (CCW)
  name: string;
  edges: Record<number, RoomEdgeSettings>; // Key is edge index
}

export interface Wall {
  id: string;
  levelId: string;
  roomId: string; // The room this wall belongs to
  start: Point2D;
  end: Point2D;
  thickness: number;
  height: number;
}

export interface Floor {
  id: string;
  levelId: string;
  roomId: string; // The room this floor belongs to
  x: number;
  y: number;
  width: number;
  height: number;
  points: Point2D[]; // Vertices in order (CCW)
  thickness: number;
}

export interface Foundation {
  id: string;
  floorId: string;
  edgeIndex: number; // Index into floor.points
  thickness: number;
  depth: number; // How far down it goes
  topOffset: number;
  bottomOffset: number;
}

export type ToolMode = 'select' | 'room' | 'floor' | 'split';
export type ViewMode = '2d' | '3d' | 'split';

export interface ProjectState {
  levels: Record<string, Level>;
  rooms: Record<string, Room>;
  walls: Record<string, Wall>;
  floors: Record<string, Floor>;
  foundations: Record<string, Foundation>;
}

export interface UIState {
  viewMode: ViewMode;
  activeLevelId: string;
  selectedIds: string[];
  selectedEdge: { itemId: string, itemType: 'floor' | 'room', edgeIndex: number } | null;
  tool: ToolMode;
  hoveredId: string | null;
  gridSize: number; // inches
}
