import { useEffect, useMemo, useState } from 'react';
import { ReactFlow, Background, Controls, Handle, MiniMap, Position, MarkerType, type Edge, type Node, type NodeChange, type NodeProps } from '@xyflow/react';
import ELK from 'elkjs/lib/elk.bundled.js';
import type { MapLayout, MapPosition, Relation } from '../shared/model.js';
import type { ProjectSnapshot } from '../server/openspec.js';

type Suggestion = { source: string; target: string; change: string };
type Props = {
  project: ProjectSnapshot;
  relations: Relation[];
  suggestions: Suggestion[];
  selected: string | null;
  onSelect: (id: string) => void;
  search: string;
  focus: boolean;
  savedPositions: MapLayout['positions'];
  saving: boolean;
  editable: boolean;
  onMove: (id: string, position: MapPosition) => Promise<void>;
};

function CapabilityNode({ data, selected }: NodeProps<Node<{ label: string; detail: string; proposed: boolean }>>) {
  return <div className={`cap-node ${selected ? 'selected' : ''} ${data.proposed ? 'proposed' : ''}`}>
    <Handle type="target" position={Position.Left} isConnectable={false} />
    <span className="cap-kicker">{data.proposed ? 'PROPOSED SPEC' : 'CURRENT SPEC'}</span>
    <strong>{data.label}</strong>
    <small>{data.detail}</small>
    <Handle type="source" position={Position.Right} isConnectable={false} />
  </div>;
}

const nodeTypes = { capability: CapabilityNode };
const elk = new ELK();

export function MapView({ project, relations, suggestions, selected, onSelect, search, focus, savedPositions, saving, editable, onMove }: Props) {
  const [autoPositions, setAutoPositions] = useState<Record<string, MapPosition>>({});
  const [dragPositions, setDragPositions] = useState<Record<string, MapPosition>>({});
  const capabilities = useMemo(() => {
    const byId = new Map(project.current.map((item) => [item.id, { ...item, proposedOnly: false }]));
    for (const item of project.proposed) if (!byId.has(item.id)) byId.set(item.id, { ...item, proposedOnly: true });
    const all = [...byId.values()];
    const query = search.trim().toLowerCase();
    const visible = query ? all.filter((item) => `${item.id} ${item.purpose}`.toLowerCase().includes(query)) : all;
    if (!focus || !selected) return visible;
    const neighbors = new Set([selected]);
    for (const edge of relations) if (edge.source === selected || edge.target === selected) { neighbors.add(edge.source); neighbors.add(edge.target); }
    return visible.filter((item) => neighbors.has(item.id));
  }, [project, relations, selected, search, focus]);
  const ids = useMemo(() => new Set(capabilities.map((item) => item.id)), [capabilities]);
  const visibleRelations = relations.filter((item) => ids.has(item.source) && ids.has(item.target));

  useEffect(() => {
    let cancelled = false;
    const graph = {
      id: 'capabilities', layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': 'RIGHT',
        'elk.spacing.nodeNode': '150',
        'elk.spacing.componentComponent': '170',
        'elk.layered.spacing.nodeNodeBetweenLayers': '230',
      },
      children: capabilities.map((item) => ({ id: item.id, width: 205, height: 96 })),
      edges: visibleRelations.map((item) => ({ id: item.id, sources: [item.source], targets: [item.target] })),
    };
    void elk.layout(graph).then((layout) => {
      if (cancelled) return;
      setAutoPositions(Object.fromEntries((layout.children ?? []).map((item) => [item.id, { x: item.x ?? 0, y: item.y ?? 0 }])));
    });
    return () => { cancelled = true; };
  }, [capabilities.map((item) => item.id).join('|'), visibleRelations.map((item) => `${item.id}:${item.source}:${item.target}`).join('|')]);

  const layoutKey = capabilities.map((item) => `${item.id}:${autoPositions[item.id]?.x ?? 'pending'}:${autoPositions[item.id]?.y ?? 'pending'}`).join('|');

  const nodes: Node[] = capabilities.map((item, index) => ({
    id: item.id, type: 'capability', position: dragPositions[item.id] ?? savedPositions[item.id] ?? autoPositions[item.id] ?? { x: (index % 3) * 435, y: Math.floor(index / 3) * 245 },
    initialWidth: 205, initialHeight: 96,
    data: { label: item.id, detail: item.purpose.slice(0, 85) || 'Spec in progress', proposed: item.proposedOnly },
    selected: selected === item.id,
  }));
  const edges: Edge[] = [
    ...visibleRelations.map((item) => ({ id: item.id, source: item.source, target: item.target, label: item.type, animated: false,
      style: { stroke: selected && (item.source === selected || item.target === selected) ? '#d3753e' : '#2e7082',
        strokeWidth: selected && (item.source === selected || item.target === selected) ? 3.5 : 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#2e7082' },
      labelStyle: { fill: '#17485a', fontSize: 11 } })),
    ...suggestions.filter((item) => ids.has(item.source) && ids.has(item.target) && (item.source === selected || item.target === selected)).map((item, index) => ({
      id: `suggestion-${index}`, source: item.source, target: item.target, label: 'possible',
      style: { stroke: '#b4a483', strokeDasharray: '5 5', strokeWidth: 1.5 }, labelStyle: { fill: '#827256', fontSize: 10 },
    })),
  ];
  return <div className="canvas map-canvas">
    <ReactFlow key={layoutKey} nodes={nodes} edges={edges} nodeTypes={nodeTypes} nodesDraggable={editable && !saving} nodesConnectable={false}
      onNodesChange={editable ? (changes: NodeChange[]) => {
        const moved: Record<string, MapPosition> = {};
        for (const change of changes) if (change.type === 'position' && change.position) moved[change.id] = change.position;
        if (Object.keys(moved).length) setDragPositions((current) => ({ ...current, ...moved }));
      } : undefined}
      onNodeDragStop={editable ? (_event, node) => { void onMove(node.id, node.position).finally(() => setDragPositions((current) => {
        const next = { ...current }; delete next[node.id]; return next;
      })); } : undefined}
      onNodeClick={(_event, node) => onSelect(node.id)} fitView fitViewOptions={{ padding: 0.2, maxZoom: 1.15 }} proOptions={{ hideAttribution: true }}>
      <Background color="#d5dee0" gap={22} size={1} />
      <Controls showInteractive={false} />
      <MiniMap pannable zoomable nodeColor={(node) => node.id === selected ? '#d86b48' : '#38869b'} />
    </ReactFlow>
  </div>;
}
