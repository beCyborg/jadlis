import type { NeedName, NeedCategory, NeedSubcategory } from "../types/need";

export interface NeedDefinition {
  name: NeedName;
  category: NeedCategory;
  subcategory: NeedSubcategory;
  is_bridge_node: boolean;
  description: string;
}

export const NEEDS: NeedDefinition[] = [
  // Layer 1: Физиология (Foundation)
  { name: "sleep", category: "foundation", subcategory: "biological", is_bridge_node: false, description: "Сон" },
  { name: "nutrition", category: "foundation", subcategory: "biological", is_bridge_node: false, description: "Питание" },
  { name: "movement", category: "foundation", subcategory: "biological", is_bridge_node: false, description: "Движение" },
  { name: "health", category: "foundation", subcategory: "biological", is_bridge_node: true, description: "Здоровье" },

  // Layer 2: Безопасность (Foundation, bridge)
  { name: "safety", category: "foundation", subcategory: "psychological", is_bridge_node: true, description: "Безопасность" },
  { name: "orientation", category: "foundation", subcategory: "psychological", is_bridge_node: true, description: "Ориентация и контроль" },

  // Layer 3: Принадлежность (Parallel)
  { name: "closeness", category: "parallel", subcategory: "psychological", is_bridge_node: false, description: "Близость" },
  { name: "community", category: "parallel", subcategory: "psychological", is_bridge_node: false, description: "Сообщество" },
  { name: "status", category: "parallel", subcategory: "psychological", is_bridge_node: false, description: "Статус" },

  // Layer 4: Самореализация (Parallel)
  { name: "autonomy", category: "parallel", subcategory: "growth", is_bridge_node: false, description: "Автономия" },
  { name: "competence", category: "parallel", subcategory: "growth", is_bridge_node: false, description: "Компетентность" },
  { name: "curiosity", category: "parallel", subcategory: "growth", is_bridge_node: false, description: "Познание" },

  // Layer 5: Трансценденция (Parallel)
  { name: "meaning", category: "parallel", subcategory: "integration", is_bridge_node: false, description: "Смысл" },
  { name: "creativity", category: "parallel", subcategory: "expression", is_bridge_node: false, description: "Творчество" },
  { name: "play", category: "parallel", subcategory: "expression", is_bridge_node: false, description: "Игра" },
];

export const FOUNDATION_NEEDS = NEEDS.filter((n) => n.category === "foundation");
export const PARALLEL_NEEDS = NEEDS.filter((n) => n.category === "parallel");
export const NEED_NAMES = NEEDS.map((n) => n.name);
