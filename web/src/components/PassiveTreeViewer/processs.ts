import { PassiveTree } from "../../../../common/data/tree";
import { BuildTree } from "../../../../common/route-processing";
import { UrlTree } from "../../state/passive-trees";

function intersection<T>(setA: Set<T>, setB: Set<T>) {
  const _intersection = new Set<T>();
  for (const elem of setB) {
    if (setA.has(elem)) {
      _intersection.add(elem);
    }
  }
  return _intersection;
}

function difference<T>(setA: Set<T>, setB: Set<T>) {
  const _difference = new Set<T>(setA);
  for (const elem of setB) {
    _difference.delete(elem);
  }
  return _difference;
}

export interface UrlTreeDelta {
  nodesActive: string[];
  nodesAdded: string[];
  nodesRemoved: string[];
  connectionsActive: string[];
  connectionsAdded: string[];
  connectionsRemoved: string[];
  masteryInfos: Record<string, MasteryInfo>;
}

export interface MasteryInfo {
  info: string;
}

export function buildUrlTreeDelta(
  currentTree: UrlTree.Data,
  previousTree: UrlTree.Data,
  passiveTree: PassiveTree.Data
): UrlTreeDelta {
  const curNodeSet = new Set(currentTree.nodes);
  const prevNodeSet = new Set(previousTree.nodes);

  for (const [nodeId, effectId] of Object.entries(currentTree.masteryLookup)) {
    if (previousTree.masteryLookup[nodeId] !== effectId)
      prevNodeSet.delete(nodeId);
  }

  const masteryLookups = [
    previousTree.masteryLookup,
    currentTree.masteryLookup,
  ];

  const masteryInfos: UrlTreeDelta["masteryInfos"] = {};
  for (const masteryLookup of masteryLookups) {
    for (const [nodeId, effectId] of Object.entries(masteryLookup)) {
      masteryInfos[nodeId] = {
        info: passiveTree.masteryEffects[effectId].stats.join("\n"),
      };
    }
  }

  const nodesActiveSet = intersection(curNodeSet, prevNodeSet);
  const nodesAddedSet = difference(curNodeSet, prevNodeSet);
  const nodesRemovedSet = difference(prevNodeSet, curNodeSet);

  const connectionsActive: string[] = [];
  const connectionsAdded: string[] = [];
  const connectionsRemoved: string[] = [];

  for (const connection of passiveTree.connections) {
    const id = [connection.a, connection.b].sort().join("-");

    const aIsActive = nodesActiveSet.has(connection.a);
    const bIsActive = nodesActiveSet.has(connection.b);

    if (aIsActive && bIsActive) connectionsActive.push(id);

    const aIsAdded = nodesAddedSet.has(connection.a);
    const bIsAdded = nodesAddedSet.has(connection.b);

    if (
      (aIsAdded && (bIsAdded || bIsActive)) ||
      (bIsAdded && (aIsAdded || aIsActive))
    )
      connectionsAdded.push(id);

    const aIsRemoved = nodesRemovedSet.has(connection.a);
    const bIsRemoved = nodesRemovedSet.has(connection.b);

    if (
      (aIsRemoved && (bIsRemoved || bIsActive)) ||
      (bIsRemoved && (aIsRemoved || aIsActive))
    )
      connectionsRemoved.push(id);
  }

  return {
    nodesActive: Array.from(nodesActiveSet),
    nodesAdded: Array.from(nodesAddedSet),
    nodesRemoved: Array.from(nodesRemovedSet),
    connectionsActive,
    connectionsAdded,
    connectionsRemoved,
    masteryInfos,
  };
}

export function calculateBounds(
  { nodesActive, nodesAdded, nodesRemoved }: UrlTreeDelta,
  passiveTree: PassiveTree.Data
) {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  const updateMinMax = (x: number, y: number) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };

  if (nodesAdded.length == 0 && nodesRemoved.length == 0) {
    for (const nodeId of nodesActive) {
      const node = passiveTree.nodes[nodeId];
      updateMinMax(node.x, node.y);
    }
  } else {
    for (const nodeId of nodesAdded) {
      const node = passiveTree.nodes[nodeId];
      updateMinMax(node.x, node.y);
    }

    for (const nodeId of nodesRemoved) {
      const node = passiveTree.nodes[nodeId];
      updateMinMax(node.x, node.y);
    }
  }

  const padding = 1250;

  const x = minX - padding;
  const y = minY - padding;
  const w = maxX - minX + padding * 2;
  const h = maxY - minY + padding * 2;

  return {
    // Anchor 0,0
    x: x - passiveTree.viewBox.x,
    y: y - passiveTree.viewBox.y,
    width: w,
    height: h,
  };
}