import React, { useRef, useState, useEffect } from 'react';
import { useStore } from "@/lib/store";
import { Grid } from './Grid';
import { cn } from '@/lib/utils';
import { Room, Wall, Floor, Foundation } from '@/lib/types';

export function Canvas2D() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState({ x: 50, y: 50 });
  const [zoom, setZoom] = useState(1.5); 
  const [isPanning, setIsPanning] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [isDragging, setIsDragging] = useState(false); // Add isDragging back
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 }); // Screen coords for panning
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 }); // World coords for drawing
  const [currentWorldPos, setCurrentWorldPos] = useState({ x: 0, y: 0 }); // World coords for preview
  const [selectionBox, setSelectionBox] = useState<{ x: number, y: number, w: number, h: number } | null>(null);
  
  const [dragState, setDragState] = useState<{
    itemId: string;
    itemType: 'room' | 'floor';
    startX: number;
    startY: number;
    originalX: number;
    originalY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  const { 
    rooms, walls, floors, foundations, levels 
  } = useStore((state) => state.project);
  const { activeLevelId, selectedIds, selectedEdge, tool, gridSize } = useStore((state) => state.ui);
  const selectObject = useStore((state) => state.selectObject);
  const selectEdge = useStore((state) => state.selectEdge);
  const addRoom = useStore((state) => state.addRoom);
  const addFloor = useStore((state) => state.addFloor);
  const updateRoom = useStore((state) => state.updateRoom);
  const updateFloor = useStore((state) => state.updateFloor);
  const splitEdge = useStore((state) => state.splitEdge);

  const activeRooms = Object.values(rooms).filter(r => r.levelId === activeLevelId);
  // Fix filtering to rely on floor.levelId, not room lookup (since floors can be independent now)
  const activeFloors = Object.values(floors).filter(f => f.levelId === activeLevelId);

  // Apply drag offsets for rendering
  const renderRooms = activeRooms.map(room => {
    if (dragState && dragState.itemId === room.id && dragState.itemType === 'room') {
      // If we have points, we need to shift all of them
      if (room.points) {
         const dx = dragState.currentX - dragState.originalX;
         const dy = dragState.currentY - dragState.originalY;
         const newPoints = room.points.map(p => ({ x: p.x + dx, y: p.y + dy }));
         return { ...room, x: dragState.currentX, y: dragState.currentY, points: newPoints };
      }
      return { ...room, x: dragState.currentX, y: dragState.currentY };
    }
    return room;
  });

  const renderFloors = activeFloors.map(floor => {
    if (dragState && dragState.itemId === floor.id && dragState.itemType === 'floor') {
      if (floor.points) {
         const dx = dragState.currentX - dragState.originalX;
         const dy = dragState.currentY - dragState.originalY;
         const newPoints = floor.points.map(p => ({ x: p.x + dx, y: p.y + dy }));
         return { ...floor, x: dragState.currentX, y: dragState.currentY, points: newPoints };
      }
      return { ...floor, x: dragState.currentX, y: dragState.currentY };
    }
    return floor;
  });

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomSensitivity = 0.001;
    const newZoom = Math.min(Math.max(0.1, zoom - e.deltaY * zoomSensitivity), 5);
    setZoom(newZoom);
  };

  const screenToWorld = (sx: number, sy: number) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: (sx - rect.left - offset.x) / zoom,
      y: (sy - rect.top - offset.y) / zoom
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Right click (button 2) -> Pan
    if (e.button === 2) {
        setIsPanning(true);
        setLastMousePos({ x: e.clientX, y: e.clientY });
        return;
    }

    if (e.button !== 0) return; // Only handle left click for other tools

    if (tool === 'select') {
      // Background click -> Start marquee selection
      setIsSelecting(true);
      const worldPos = screenToWorld(e.clientX, e.clientY);
      setDragStart({ x: worldPos.x, y: worldPos.y });
      setCurrentWorldPos({ x: worldPos.x, y: worldPos.y });
      
      if (e.target === e.currentTarget) {
        selectObject(null);
      }
    } else if (tool === 'room' || tool === 'floor') {
      const worldPos = screenToWorld(e.clientX, e.clientY);
      const snappedX = Math.round(worldPos.x / gridSize) * gridSize;
      const snappedY = Math.round(worldPos.y / gridSize) * gridSize;
      
      setIsDragging(true);
      setDragStart({ x: snappedX, y: snappedY });
      setCurrentWorldPos({ x: snappedX, y: snappedY });
    }
  };

  const handleRoomMouseDown = (e: React.MouseEvent, room: Room) => {
    if (tool === 'select' && e.button === 0) {
      e.stopPropagation();
      selectObject(room.id, e.shiftKey || e.ctrlKey); 
      
      const worldPos = screenToWorld(e.clientX, e.clientY);
      setDragState({
        itemId: room.id,
        itemType: 'room',
        startX: worldPos.x,
        startY: worldPos.y,
        originalX: room.x,
        originalY: room.y,
        currentX: room.x,
        currentY: room.y
      });
    }
  };

  const handleFloorMouseDown = (e: React.MouseEvent, floor: Floor) => {
    if (tool === 'select' && e.button === 0) {
      e.stopPropagation();
      selectObject(floor.id, e.shiftKey || e.ctrlKey); 
      
      const worldPos = screenToWorld(e.clientX, e.clientY);
      setDragState({
        itemId: floor.id,
        itemType: 'floor',
        startX: worldPos.x,
        startY: worldPos.y,
        originalX: floor.x,
        originalY: floor.y,
        currentX: floor.x,
        currentY: floor.y
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      const dx = e.clientX - lastMousePos.x;
      const dy = e.clientY - lastMousePos.y;
      setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setLastMousePos({ x: e.clientX, y: e.clientY });
      return;
    }

    if (dragState) {
      const worldPos = screenToWorld(e.clientX, e.clientY);
      const dx = worldPos.x - dragState.startX;
      const dy = worldPos.y - dragState.startY;
      
      // Snap to grid
      const rawX = dragState.originalX + dx;
      const rawY = dragState.originalY + dy;
      
      const snappedX = Math.round(rawX / gridSize) * gridSize;
      const snappedY = Math.round(rawY / gridSize) * gridSize;

      setDragState(prev => prev ? ({ ...prev, currentX: snappedX, currentY: snappedY }) : null);

    } else if (tool === 'select' && isSelecting) {
        const worldPos = screenToWorld(e.clientX, e.clientY);
        setCurrentWorldPos({ x: worldPos.x, y: worldPos.y });
    } else if ((tool === 'room' || tool === 'floor') && isDragging) {
      const worldPos = screenToWorld(e.clientX, e.clientY);
      const snappedX = Math.round(worldPos.x / gridSize) * gridSize;
      const snappedY = Math.round(worldPos.y / gridSize) * gridSize;
      setCurrentWorldPos({ x: snappedX, y: snappedY });
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (isPanning) {
        setIsPanning(false);
        return;
    }

    if (dragState) {
      // Commit the move
      if (dragState.currentX !== dragState.originalX || dragState.currentY !== dragState.originalY) {
        if (dragState.itemType === 'room') {
            updateRoom(dragState.itemId, { x: dragState.currentX, y: dragState.currentY });
        } else if (dragState.itemType === 'floor') {
            updateFloor(dragState.itemId, { x: dragState.currentX, y: dragState.currentY });
        }
      }
      setDragState(null);
    } else if (tool === 'select' && isSelecting) {
        // Finalize marquee selection
        const x1 = Math.min(dragStart.x, currentWorldPos.x);
        const y1 = Math.min(dragStart.y, currentWorldPos.y);
        const x2 = Math.max(dragStart.x, currentWorldPos.x);
        const y2 = Math.max(dragStart.y, currentWorldPos.y);
        
        // Simple AABB intersection test
        const selected = activeRooms.filter(room => {
            const rx = room.x;
            const ry = room.y;
            const rw = room.width;
            const rh = room.height;
            // Check if room intersects selection box
            return (rx < x2 && rx + rw > x1 && ry < y2 && ry + rh > y1);
        }).map(r => r.id);
        
        if (selected.length > 0) {
            // For now, replace selection. Multi-select logic can be enhanced.
             selectObject(selected[0], true); // Just select the first one or pass array if store supports it? 
             // Store supports array: selectObject(id, multi). But we need to set explicit list.
             // Currently store selectObject pushes or toggles one.
             // Let's iterate for now or improve store later.
             selected.forEach(id => selectObject(id, true)); 
        }
        
        setIsSelecting(false);
    } else if ((tool === 'room' || tool === 'floor') && isDragging) {
      const worldPos = screenToWorld(e.clientX, e.clientY);
      const snappedX = Math.round(worldPos.x / gridSize) * gridSize;
      const snappedY = Math.round(worldPos.y / gridSize) * gridSize;

      const width = snappedX - dragStart.x;
      const height = snappedY - dragStart.y;

      if (Math.abs(width) > 0 && Math.abs(height) > 0) {
        const x = width > 0 ? dragStart.x : snappedX;
        const y = height > 0 ? dragStart.y : snappedY;
        
        if (tool === 'room') {
            addRoom(x, y, Math.abs(width), Math.abs(height));
        } else {
            addFloor(x, y, Math.abs(width), Math.abs(height));
        }
      }
      setIsDragging(false);
    }
  };

  // Marquee box calculation
  let marqueeRect = null;
  if (tool === 'select' && isSelecting) {
      const x = Math.min(dragStart.x, currentWorldPos.x);
      const y = Math.min(dragStart.y, currentWorldPos.y);
      const w = Math.abs(currentWorldPos.x - dragStart.x);
      const h = Math.abs(currentWorldPos.y - dragStart.y);
      marqueeRect = { x, y, width: w, height: h };
  }

  // Drag preview rect calculation
  let previewRect = null;
  if ((tool === 'room' || tool === 'floor') && isDragging) {
      const width = currentWorldPos.x - dragStart.x;
      const height = currentWorldPos.y - dragStart.y;
      const x = width > 0 ? dragStart.x : currentWorldPos.x;
      const y = height > 0 ? dragStart.y : currentWorldPos.y;
      previewRect = { x, y, width: Math.abs(width), height: Math.abs(height) };
  }

  return (
    <div 
      ref={containerRef}
      className="w-full h-full cursor-crosshair overflow-hidden touch-none select-none bg-white"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      <svg width="100%" height="100%" className="block">
        <Grid 
          size={gridSize} 
          offsetX={offset.x} 
          offsetY={offset.y} 
          zoom={zoom}
          width={4000} 
          height={4000} 
        />
        
        <rect width="100%" height="100%" fill="url(#grid)" pointerEvents="none" />

        <g transform={`translate(${offset.x}, ${offset.y}) scale(${zoom})`}>
          {/* Origin */}
          <path d="M -20 0 L 20 0 M 0 -20 L 0 20" stroke="rgba(255,0,0,0.5)" strokeWidth={2 / zoom} />

          {/* Floors - rendered subtly behind everything */}
          {renderFloors.map(floor => {
             const isSelected = selectedIds.includes(floor.id);
             const isEdgeSelected = (idx: number) => 
                selectedEdge?.itemId === floor.id && 
                selectedEdge?.itemType === 'floor' &&
                selectedEdge?.edgeIndex === idx;
             
             // Generate path data from points if available, else fallback to rect
             let d = "";
             if (floor.points && floor.points.length > 0) {
                 d = `M ${floor.points.map(p => `${p.x} ${p.y}`).join(" L ")} Z`;
             } else {
                 d = `M ${floor.x} ${floor.y} h ${floor.width} v ${floor.height} h ${-floor.width} Z`;
             }

             return (
             <g key={floor.id}
                onMouseDown={(e) => handleFloorMouseDown(e, floor)}
             >
               <path
                d={d}
                fill={isSelected ? "rgba(200, 200, 255, 0.3)" : "rgba(200, 200, 200, 0.3)"} 
                stroke={isSelected ? "#60a5fa" : "#a1a1aa"}
                strokeWidth={1 / zoom}
                strokeDasharray="4 2"
                onClick={(e) => {
                  e.stopPropagation();
                  selectObject(floor.id, e.shiftKey || e.ctrlKey);
                }}
                className={cn("cursor-pointer", tool === 'split' && "cursor-crosshair")}
              />
              
              {/* Edge Handles - Show if floor is selected OR tool is split */}
              {(isSelected || tool === 'split') && floor.points && floor.points.map((p1, idx) => {
                  const p2 = floor.points[(idx + 1) % floor.points.length];
                  const isHovered = false; // We could add hover state for split preview

                  return (
                    <line 
                        key={`edge-${idx}`}
                        x1={p1.x} y1={p1.y}
                        x2={p2.x} y2={p2.y}
                        stroke={isEdgeSelected(idx) ? "#ef4444" : (tool === 'split' ? "rgba(239, 68, 68, 0.01)" : "transparent")} // Invisible hit target for split
                        strokeWidth={6 / zoom}
                        className={cn(
                            "cursor-pointer",
                            tool === 'split' ? "hover:stroke-purple-500/50" : "hover:stroke-red-400/50"
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (tool === 'split') {
                             splitEdge(floor.id, 'floor', idx);
                          } else {
                             selectEdge(floor.id, 'floor', idx);
                          }
                        }}
                    />
                  );
              })}
              
              {/* Edge Labels/Handles - Only if selected and NOT split tool */}
              {isSelected && tool !== 'split' && floor.points && floor.points.map((p1, idx) => {
                  const p2 = floor.points[(idx + 1) % floor.points.length];
                  const midX = (p1.x + p2.x) / 2;
                  const midY = (p1.y + p2.y) / 2;
                  
                  // Calculate offset for label (normal to edge)
                  const dx = p2.x - p1.x;
                  const dy = p2.y - p1.y;
                  const len = Math.sqrt(dx*dx + dy*dy);
                  const nx = -dy / len;
                  const ny = dx / len;
                  const labelX = midX + nx * (10/zoom);
                  const labelY = midY + ny * (10/zoom);

                  return (
                    <circle
                      key={`handle-${idx}`}
                      cx={labelX} cy={labelY} r={4 / zoom}
                      fill={isEdgeSelected(idx) ? "#ef4444" : "white"}
                      stroke="#ef4444"
                      strokeWidth={1/zoom}
                      className="cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        selectEdge(floor.id, 'floor', idx);
                      }}
                    />
                  );
              })}
             </g>
             );
          })}

          {/* Walls with Poche Style (Rendered from Rooms for clean miters) */}
          {/* Layer 1: Fills (to merge visually) */}
          {renderRooms.map(room => {
            const t = 3.5; // Wall thickness (hardcoded for visual consistency with store)
            
            // For walls, we need to generate inner and outer paths from points
            // This is complex for general polygons (requires offsetting).
            // For MVP/Prototype, if points exist, let's assume simple offsetting or just render thick lines for now?
            // "clean miters" suggests we want the polygon offset.
            // If room is still rectangular in points, we can use the old logic if points match rect?
            // Or just implement simple polygon offset.
            
            // Let's use the points directly if available.
            // Simple approach: Just draw the polygon filled? No, walls are thick lines.
            // We need "Inner" and "Outer" polygon.
            // For now, let's just stick to the old logic if 4 points and rectangular?
            // But we need to support split edges (collinear).
            // If edges are collinear, the shape is still the same, just more points.
            // So calculating "Outer" and "Inner" based on the winding order is key.
            // Assuming CCW winding.
            
            let d = "";
            
            if (room.points && room.points.length >= 4) {
               // Offset polygon
               // For a robust solution we'd use a library, but here we can approximate by moving each line segment along its normal
               // and computing intersections. 
               // OR: Since we are in mockup mode, maybe we just render thick stroke?
               // Thick stroke doesn't give us the "Poche" (filled interior of wall).
               // Poche = Area between Outer and Inner shell.
               
               // Let's try to compute offsets.
               // Vector math time.
               
               const offsetPolygon = (pts: {x:number, y:number}[], dist: number) => {
                   const newPts = [];
                   for (let i = 0; i < pts.length; i++) {
                       const p0 = pts[(i - 1 + pts.length) % pts.length];
                       const p1 = pts[i];
                       const p2 = pts[(i + 1) % pts.length];
                       
                       // Vector 0->1
                       const dx1 = p1.x - p0.x;
                       const dy1 = p1.y - p0.y;
                       const len1 = Math.sqrt(dx1*dx1 + dy1*dy1);
                       const nx1 = -dy1/len1;
                       const ny1 = dx1/len1;
                       
                       // Vector 1->2
                       const dx2 = p2.x - p1.x;
                       const dy2 = p2.y - p1.y;
                       const len2 = Math.sqrt(dx2*dx2 + dy2*dy2);
                       const nx2 = -dy2/len2;
                       const ny2 = dx2/len2;
                       
                       // Average normal (bisector)
                       // Be careful with concave corners, but rooms are usually convex-ish or we assume simple.
                       // For simple collinear points, normals are same.
                       
                       // Miter offset = dist / sin(alpha/2)
                       // But simpler: intersect the two offset lines.
                       
                       // Line 1: P = (p1 + n1*d) + t * v1
                       // Line 2: P = (p1 + n2*d) + u * v2
                       // Actually line 1 passes through (p0+n1*d) and (p1+n1*d)
                       // Line 2 passes through (p1+n2*d) and (p2+n2*d)
                       
                       // Intersection of L1 and L2 is the new vertex.
                       
                       // L1 point A = {x: p0.x + nx1*dist, y: p0.y + ny1*dist}
                       // L1 point B = {x: p1.x + nx1*dist, y: p1.y + ny1*dist}
                       
                       // L2 point C = {x: p1.x + nx2*dist, y: p1.y + ny2*dist}
                       // L2 point D = {x: p2.x + nx2*dist, y: p2.y + ny2*dist}
                       
                       // Intersect AB and CD.
                       // ... (Intersection math)
                       // If parallel (collinear), just use B (which equals C).
                       
                       if (Math.abs(nx1 - nx2) < 0.001 && Math.abs(ny1 - ny2) < 0.001) {
                           newPts.push({x: p1.x + nx1*dist, y: p1.y + ny1*dist});
                       } else {
                           // Compute intersection
                           const x1 = p0.x + nx1*dist, y1 = p0.y + ny1*dist;
                           const x2 = p1.x + nx1*dist, y2 = p1.y + ny1*dist;
                           const x3 = p1.x + nx2*dist, y3 = p1.y + ny2*dist;
                           const x4 = p2.x + nx2*dist, y4 = p2.y + ny2*dist;
                           
                           const det = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
                           if (det === 0) {
                               newPts.push({x: x2, y: y2});
                           } else {
                               const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / det;
                               newPts.push({x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1)});
                           }
                       }
                   }
                   return newPts;
               };
               
               const outerPts = offsetPolygon(room.points, t/2); // Expand outwards?
               // Wait, room.x/y/w/h defined the *inner* or *center* or *outer*?
               // Usually user draws the boundary. Let's assume boundary is center line? 
               // Or usually boundary is interior face or exterior face.
               // Code before: ox = room.x - t/2. So room.x is Center.
               // So we offset +t/2 (Outer) and -t/2 (Inner).
               // Note: If winding is CCW, normal points "Right" (Inwards) or "Left" (Outwards)?
               // My normal calc: (-dy, dx). If vector is (1,0) [Right], normal is (0,1) [Down].
               // If CCW box: Bottom edge (Right), Right edge (Up), Top edge (Left), Left edge (Down).
               // Bottom (1,0) -> N (0,1) [Up? No, Y is down in SVG? Wait, Y is Up in Math, Down in Screen]
               // Screen coords: Y increases downwards.
               // Bottom edge: (0, H) -> (W, H). Vector (1, 0). Normal (-0, 1) = (0, 1). Points Down (Outwards).
               // Right edge: (W, H) -> (W, 0). Vector (0, -1). Normal (1, 0). Points Right (Outwards).
               // So my normal points Outwards.
               
               const outerPtsList = offsetPolygon(room.points, t/2);
               const innerPtsList = offsetPolygon(room.points, -t/2);
               
               const outerPath = `M ${outerPtsList.map(p => `${p.x} ${p.y}`).join(" L ")} Z`;
               const innerPath = `M ${innerPtsList.map(p => `${p.x} ${p.y}`).join(" L ")} Z`; // Inner hole must be reverse winding for fill rule?
               // Actually SVG fill-rule "evenodd" handles it if we just dump both paths.
               
               d = `${outerPath} ${innerPath}`;
            } else {
                // Fallback
                const ox = room.x - t/2;
                const oy = room.y - t/2;
                const ow = room.width + t;
                const oh = room.height + t;
                const ix = room.x + t/2;
                const iy = room.y + t/2;
                const iw = room.width - t;
                const ih = room.height - t;
                d = `M ${ox} ${oy} h ${ow} v ${oh} h ${-ow} Z M ${ix} ${iy} h ${iw} v ${ih} h ${-iw} Z`;
            }

            return (
              <path 
                key={`wall-fill-${room.id}`}
                d={d}
                fill="#e4e4e7" 
                fillRule="evenodd"
              />
            );
          })}

          {/* Layer 2: Strokes (Outlines) */}
          {renderRooms.map(room => {
            const t = 3.5;
            let d = "";
            if (room.points && room.points.length >= 4) {
               // Same offset logic
               const offsetPolygon = (pts: {x:number, y:number}[], dist: number) => {
                   const newPts = [];
                   for (let i = 0; i < pts.length; i++) {
                       const p0 = pts[(i - 1 + pts.length) % pts.length];
                       const p1 = pts[i];
                       const p2 = pts[(i + 1) % pts.length];
                       const dx1 = p1.x - p0.x, dy1 = p1.y - p0.y;
                       const len1 = Math.sqrt(dx1*dx1 + dy1*dy1);
                       const nx1 = -dy1/len1, ny1 = dx1/len1;
                       const dx2 = p2.x - p1.x, dy2 = p2.y - p1.y;
                       const len2 = Math.sqrt(dx2*dx2 + dy2*dy2);
                       const nx2 = -dy2/len2, ny2 = dx2/len2;
                       if (Math.abs(nx1 - nx2) < 0.001 && Math.abs(ny1 - ny2) < 0.001) {
                           newPts.push({x: p1.x + nx1*dist, y: p1.y + ny1*dist});
                       } else {
                           const x1 = p0.x + nx1*dist, y1 = p0.y + ny1*dist;
                           const x2 = p1.x + nx1*dist, y2 = p1.y + ny1*dist;
                           const x3 = p1.x + nx2*dist, y3 = p1.y + ny2*dist;
                           const x4 = p2.x + nx2*dist, y4 = p2.y + ny2*dist;
                           const det = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
                           if (det === 0) newPts.push({x: x2, y: y2});
                           else {
                               const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / det;
                               newPts.push({x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1)});
                           }
                       }
                   }
                   return newPts;
               };
               const outerPtsList = offsetPolygon(room.points, t/2);
               const innerPtsList = offsetPolygon(room.points, -t/2);
               d = `M ${outerPtsList.map(p => `${p.x} ${p.y}`).join(" L ")} Z M ${innerPtsList.map(p => `${p.x} ${p.y}`).join(" L ")} Z`;
            } else {
                const ox = room.x - t/2, oy = room.y - t/2, ow = room.width + t, oh = room.height + t;
                const ix = room.x + t/2, iy = room.y + t/2, iw = room.width - t, ih = room.height - t;
                d = `M ${ox} ${oy} h ${ow} v ${oh} h ${-ow} Z M ${ix} ${iy} h ${iw} v ${ih} h ${-iw} Z`;
            }

            return (
              <path 
                key={`wall-stroke-${room.id}`}
                d={d}
                fill="none"
                stroke="#71717a"
                strokeWidth={2 / zoom}
                fillRule="evenodd"
              />
            );
          })}

          {/* Room Selection / Snap Guides (Centerlines) */}
          {renderRooms.map(room => {
            const isSelected = selectedIds.includes(room.id);
            const isEdgeSelected = (idx: number) => 
                selectedEdge?.itemId === room.id && 
                selectedEdge?.itemType === 'room' &&
                selectedEdge?.edgeIndex === idx;

            // Path for centerline
            let d = "";
            if (room.points) {
                d = `M ${room.points.map(p => `${p.x} ${p.y}`).join(" L ")} Z`;
            } else {
                d = `M ${room.x} ${room.y} h ${room.width} v ${room.height} h ${-room.width} Z`;
            }

            return (
              <g key={room.id}
                 className="cursor-pointer"
                 onMouseDown={(e) => handleRoomMouseDown(e, room)}
              >
                {/* Invisible hit target for easier selection */}
                <path
                  d={d}
                  fill="transparent"
                  stroke={isSelected ? "#3b82f6" : "transparent"}
                  strokeWidth={2 / zoom}
                  className={cn(tool === 'split' && "cursor-crosshair")}
                />

                {(isSelected || tool === 'split') && room.points && room.points.map((p1, idx) => {
                    const p2 = room.points[(idx + 1) % room.points.length];
                    return (
                        <line 
                            key={`edge-${idx}`}
                            x1={p1.x} y1={p1.y}
                            x2={p2.x} y2={p2.y}
                            stroke={isEdgeSelected(idx) ? "#ef4444" : (tool === 'split' ? "rgba(239, 68, 68, 0.01)" : "transparent")}
                            strokeWidth={6 / zoom}
                            className={cn(
                                "cursor-pointer",
                                tool === 'split' ? "hover:stroke-purple-500/50" : "hover:stroke-red-400/50"
                            )}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (tool === 'split') {
                                    splitEdge(room.id, 'room', idx);
                                } else {
                                    selectEdge(room.id, 'room', idx);
                                }
                            }}
                        />
                    );
                })}

                {/* Edge Labels - Only if selected and not split */}
                {isSelected && tool !== 'split' && room.points && room.points.map((p1, idx) => {
                    const p2 = room.points[(idx + 1) % room.points.length];
                    const midX = (p1.x + p2.x) / 2;
                    const midY = (p1.y + p2.y) / 2;
                    const dx = p2.x - p1.x, dy = p2.y - p1.y;
                    const len = Math.sqrt(dx*dx + dy*dy);
                    const nx = -dy / len, ny = dx / len;
                    const labelX = midX + nx * (10/zoom);
                    const labelY = midY + ny * (10/zoom);
                    
                    return (
                        <circle
                        key={`room-handle-${idx}`}
                        cx={labelX} cy={labelY} r={4 / zoom}
                        fill={isEdgeSelected(idx) ? "#ef4444" : "white"}
                        stroke="#ef4444"
                        strokeWidth={1/zoom}
                        className="cursor-pointer"
                        onClick={(e) => {
                            e.stopPropagation();
                            selectEdge(room.id, 'room', idx);
                        }}
                        />
                    );
                })}
                
                {/* Center Label */}
                <text 
                   x={room.points ? (room.points.reduce((sum, p) => sum + p.x, 0) / room.points.length) : (room.x + room.width/2)} 
                   y={room.points ? (room.points.reduce((sum, p) => sum + p.y, 0) / room.points.length) : (room.y + room.height/2)} 
                   textAnchor="middle" 
                   dominantBaseline="middle"
                   fontSize={14 / zoom}
                   fill="#71717a"
                   className="pointer-events-none font-mono opacity-50 select-none"
                >
                  {room.name}
                </text>
              </g>
            );
          })}
          
          {/* Drag Preview */}
          {previewRect && (
             <rect
               x={previewRect.x}
               y={previewRect.y}
               width={previewRect.width}
               height={previewRect.height}
               fill="transparent"
               stroke="#3b82f6"
               strokeWidth={2 / zoom}
             />
          )}

          {/* Marquee Selection Box */}
          {marqueeRect && (
            <rect
              x={marqueeRect.x}
              y={marqueeRect.y}
              width={marqueeRect.width}
              height={marqueeRect.height}
              fill="rgba(59, 130, 246, 0.1)"
              stroke="#3b82f6"
              strokeWidth={1 / zoom}
              strokeDasharray="4 4"
            />
          )}
        </g>
      </svg>
      
      <div className="absolute bottom-4 left-4 bg-background/80 backdrop-blur p-2 rounded border text-xs font-mono shadow-sm pointer-events-none text-foreground">
         Scale: {(1/zoom).toFixed(2)} | Zoom: {(zoom * 100).toFixed(0)}%
      </div>
    </div>
  );
}
