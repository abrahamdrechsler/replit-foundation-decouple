import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Environment } from '@react-three/drei';
import { Geometry, Base, Subtraction } from '@react-three/csg';
import { useStore } from "@/lib/store";
import * as THREE from 'three';

function SceneContent() {
  const { rooms, walls, floors, foundations, levels } = useStore((state) => state.project);
  const { activeLevelId, selectedIds } = useStore((state) => state.ui);
  const selectObject = useStore((state) => state.selectObject);

  // Debug logging
  console.log('Rendering 3D Scene');
  console.log('Levels:', Object.keys(levels).length);
  console.log('Floors:', Object.keys(floors).length);
  console.log('Foundations:', Object.keys(foundations).length);

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[500, 1000, 500]} intensity={1.2} castShadow />
      <hemisphereLight args={["#fff", "#444", 0.5]} />
      
      {/* Infinite Grid on ground (y=0) */}
      <Grid 
        infiniteGrid 
        fadeDistance={2000} 
        sectionSize={12} 
        cellSize={12} 
        sectionColor="#444" 
        cellColor="#666" 
        position={[0, -0.1, 0]}
      />

      <group>
        {Object.values(levels).map(level => {
          const levelRooms = Object.values(rooms).filter(r => r.levelId === level.id);
          const levelWalls = Object.values(walls).filter(w => w.levelId === level.id);
          // Decoupled floors: Filter by floor levelId directly
          const levelFloors = Object.values(floors).filter(f => f.levelId === level.id);
          
          const yPos = level.elevation;

          return (
            <group key={level.id} position={[0, yPos, 0]}>
              {/* Floors */}
              {levelFloors.map(floor => {
                 const isSelected = selectedIds.includes(floor.roomId);
                 
                 // Get foundations for this floor
                 const floorFoundations = Object.values(foundations).filter(f => f.floorId === floor.id);

                 const floorCenterX = floor.x + floor.width/2;
                 const floorCenterY = -floor.thickness/2;
                 const floorCenterZ = floor.y + floor.height/2;

                 return (
                   <group key={floor.id}>
                     {/* The Floor Slab (with CSG subtraction) */}
                     <mesh 
                       position={[floorCenterX, floorCenterY, floorCenterZ]}
                       onClick={(e) => {
                         e.stopPropagation();
                         selectObject(floor.roomId);
                       }}
                     >
                       <Geometry>
                         <Base>
                           {/* Add 1.75" offset to width and height (depth) on both sides -> +3.5 total */}
                           <boxGeometry args={[floor.width + 3.5, floor.thickness, floor.height + 3.5]} />
                         </Base>
                         
                         {/* Subtract Foundations */}
                         {floorFoundations.map(foundation => {
                            const calculatedHeight = Math.max(1, foundation.topOffset - foundation.bottomOffset + foundation.depth);
                            
                            // Calculate global foundation parameters (same logic as below)
                            const offset = 1.75;
                            let fx = 0, fz = 0;
                            let fw = 0, fh = calculatedHeight, fd = 0;
                            const topY = -floor.thickness + foundation.topOffset;
                            const centerY = topY - calculatedHeight / 2;

                            if (foundation.edgeIndex === 0) { // Bottom
                               fx = floor.x + floor.width/2;
                               fz = floor.y + floor.height + offset - foundation.thickness/2;
                               fw = floor.width + 2*offset;
                               fd = foundation.thickness;
                            } else if (foundation.edgeIndex === 1) { // Right
                               fx = floor.x + floor.width + offset - foundation.thickness/2;
                               fz = floor.y + floor.height/2;
                               fw = foundation.thickness;
                               fd = floor.height + 2*offset;
                            } else if (foundation.edgeIndex === 2) { // Top
                               fx = floor.x + floor.width/2;
                               fz = floor.y - offset + foundation.thickness/2;
                               fw = floor.width + 2*offset;
                               fd = foundation.thickness;
                            } else if (foundation.edgeIndex === 3) { // Left
                               fx = floor.x - offset + foundation.thickness/2;
                               fz = floor.y + floor.height/2;
                               fw = foundation.thickness;
                               fd = floor.height + 2*offset;
                            }

                            // Convert to relative coordinates for CSG
                            const relX = fx - floorCenterX;
                            const relY = centerY - floorCenterY;
                            const relZ = fz - floorCenterZ;

                            return (
                                <Subtraction key={`sub-${foundation.id}`} position={[relX, relY, relZ]}>
                                    <boxGeometry args={[fw, fh, fd]} />
                                </Subtraction>
                            );
                         })}
                       </Geometry>
                       <meshStandardMaterial color={isSelected ? "#60a5fa" : "#9ca3af"} roughness={0.8} />
                     </mesh>

                     {/* Foundations (Visible Meshes) */}
                     {floorFoundations.map(foundation => {
                        // Calculate position and size based on edge index
                        // 0: bottom, 1: right, 2: top, 3: left
                        // Offset for foundation alignment (1.75" from drawn boundary)
                        const offset = 1.75;
                        
                        let fx = 0, fy = 0, fz = 0;
                        // Calculate variable height based on offsets
                        // Desired: Top = (SlabBottom + TopOffset), Bottom = (SlabBottom - Depth + BottomOffset)
                        // Height = Top - Bottom = (SlabBottom + TopOffset) - (SlabBottom - Depth + BottomOffset)
                        // Height = TopOffset - BottomOffset + Depth
                        
                        const calculatedHeight = Math.max(1, foundation.topOffset - foundation.bottomOffset + foundation.depth);
                        
                        let fw = 0, fh = calculatedHeight, fd = 0;
                        
                        const topY = -floor.thickness + foundation.topOffset;
                        const centerY = topY - calculatedHeight / 2;

                        if (foundation.edgeIndex === 0) { // Bottom Edge (Max Z)
                           // Center Z = floor.y + floor.height + offset - thickness/2
                           fx = floor.x + floor.width/2;
                           fz = floor.y + floor.height + offset - foundation.thickness/2;
                           
                           // Length covers corners -> width + 2*offset
                           fw = floor.width + 2*offset;
                           fd = foundation.thickness;
                        } else if (foundation.edgeIndex === 1) { // Right Edge (Max X)
                           // Center X = floor.x + floor.width + offset - thickness/2
                           fx = floor.x + floor.width + offset - foundation.thickness/2;
                           fz = floor.y + floor.height/2;
                           
                           fw = foundation.thickness;
                           // Length covers corners -> height + 2*offset
                           fd = floor.height + 2*offset;
                        } else if (foundation.edgeIndex === 2) { // Top Edge (Min Z)
                           // Center Z = floor.y - offset + thickness/2
                           fx = floor.x + floor.width/2;
                           fz = floor.y - offset + foundation.thickness/2;
                           
                           fw = floor.width + 2*offset;
                           fd = foundation.thickness;
                        } else if (foundation.edgeIndex === 3) { // Left Edge (Min X)
                           // Center X = floor.x - offset + thickness/2
                           fx = floor.x - offset + foundation.thickness/2;
                           fz = floor.y + floor.height/2;
                           
                           fw = foundation.thickness;
                           fd = floor.height + 2*offset;
                        }
                        
                        return (
                          <mesh 
                            key={foundation.id}
                            position={[fx, centerY, fz]}
                          >
                             <boxGeometry args={[fw, fh, fd]} />
                             <meshStandardMaterial color="#78716c" roughness={0.9} />
                          </mesh>
                        );
                     })}
                   </group>
                 );
              })}

              {/* Walls (Rendered by Room for clean miters) */}
              {levelRooms.map(room => {
                const t = 3.5;
                const height = 108; // Default 9 feet
                
                const shape = new THREE.Shape();
                
                // Outer rect (CCW for Shape in X/-Y plane)
                // We negate Y because in 3D with -90 rotation, Shape Y becomes -Z.
                // We want Shape Y (2D "Down") to become +Z (3D "Forward").
                // So we use -Y coordinates.
                // Winding must be CCW.
                // Points with -Y:
                // Top-Left (ox, -oy)
                // Bottom-Left (ox, -(oy+oh))
                // Bottom-Right (ox+ow, -(oy+oh))
                // Top-Right (ox+ow, -oy)
                
                const ox = room.x - t/2;
                const oy = room.y - t/2;
                const ow = room.width + t;
                const oh = room.height + t;
                
                shape.moveTo(ox, -oy);
                shape.lineTo(ox, -(oy + oh));
                shape.lineTo(ox + ow, -(oy + oh));
                shape.lineTo(ox + ow, -oy);
                shape.lineTo(ox, -oy);
                
                // Inner rect (Hole - CW)
                // Winding must be CW.
                // Points with -Y:
                // Top-Left (ix, -iy)
                // Top-Right (ix+iw, -iy)
                // Bottom-Right (ix+iw, -(iy+ih))
                // Bottom-Left (ix, -(iy+ih))

                const hole = new THREE.Path();
                const ix = room.x + t/2;
                const iy = room.y + t/2;
                const iw = room.width - t;
                const ih = room.height - t;
                
                hole.moveTo(ix, -iy);
                hole.lineTo(ix + iw, -iy);
                hole.lineTo(ix + iw, -(iy + ih));
                hole.lineTo(ix, -(iy + ih));
                hole.lineTo(ix, -iy);
                
                shape.holes.push(hole);

                const extrudeSettings = {
                  depth: height,
                  bevelEnabled: false
                };

                // Filter foundations on this level to subtract
                const allLevelFoundations = Object.values(foundations).filter(f => {
                   // Ensure foundation is on a floor that is on this level
                   const floor = floors[f.floorId];
                   return floor && floor.levelId === level.id;
                });

                return (
                  <mesh 
                    key={`room-walls-${room.id}`}
                    rotation={[-Math.PI / 2, 0, 0]} // Rotate so Z becomes Y (Up)
                    position={[0, 0, 0]} // Shape coordinates are already world coordinates (X, Z mapped to X, Y in shape)
                  >
                    <Geometry>
                        <Base>
                            <extrudeGeometry args={[shape, extrudeSettings]} />
                        </Base>
                        
                        {allLevelFoundations.map(foundation => {
                            // Check if this foundation corresponds to a room edge that has clip enabled
                            const edgeSettings = room.edges ? room.edges[foundation.edgeIndex] : null;
                            if (!edgeSettings || !edgeSettings.clipByFoundation) return null;

                            const floor = floors[foundation.floorId];
                            if (!floor) return null;

                            const calculatedHeight = Math.max(1, foundation.topOffset - foundation.bottomOffset + foundation.depth);
                            const offset = 1.75;
                            let fx = 0, fz = 0;
                            let fw = 0, fh = calculatedHeight, fd = 0;
                            const topY = -floor.thickness + foundation.topOffset;
                            const centerY = topY - calculatedHeight / 2;

                            if (foundation.edgeIndex === 0) { // Bottom
                               fx = floor.x + floor.width/2;
                               fz = floor.y + floor.height + offset - foundation.thickness/2;
                               fw = floor.width + 2*offset;
                               fd = foundation.thickness;
                            } else if (foundation.edgeIndex === 1) { // Right
                               fx = floor.x + floor.width + offset - foundation.thickness/2;
                               fz = floor.y + floor.height/2;
                               fw = foundation.thickness;
                               fd = floor.height + 2*offset;
                            } else if (foundation.edgeIndex === 2) { // Top
                               fx = floor.x + floor.width/2;
                               fz = floor.y - offset + foundation.thickness/2;
                               fw = floor.width + 2*offset;
                               fd = foundation.thickness;
                            } else if (foundation.edgeIndex === 3) { // Left
                               fx = floor.x - offset + foundation.thickness/2;
                               fz = floor.y + floor.height/2;
                               fw = foundation.thickness;
                               fd = floor.height + 2*offset;
                            }

                            // Transform to Wall Local Space
                            // Wall Local X = World X
                            // Wall Local Y = -World Z (because shape defined with -Y for +Z)
                            // Wall Local Z = World Y
                            const localX = fx;
                            const localY = -fz;
                            const localZ = centerY + height/2; // Extrude starts at Z=0 and goes to Z=height (World Y=0 to Y=height)
                            
                            return (
                                <Subtraction key={`wall-sub-${foundation.id}`} position={[localX, localY, centerY]}>
                                    <boxGeometry args={[fw, fd, fh]} />
                                </Subtraction>
                            );
                        })}
                    </Geometry>
                    <meshStandardMaterial color="#f4f4f5" />
                    {/* Visual outline for the top edges? - Optional, maybe skipping for now for cleaner look */}
                    <lineSegments>
                      <edgesGeometry args={[new THREE.ExtrudeGeometry(shape, extrudeSettings)]} />
                      <lineBasicMaterial color="#a1a1aa" opacity={0.5} transparent />
                    </lineSegments>
                  </mesh>
                );
              })}

            </group>
          );
        })}
      </group>
      
      <OrbitControls makeDefault />
    </>
  );
}

export function Canvas3D() {
  return (
    <Canvas
      shadows
      camera={{ position: [100, 200, 200], fov: 50 }}
      className="bg-zinc-900"
    >
      <Suspense fallback={null}>
        <SceneContent />
      </Suspense>
    </Canvas>
  );
}
