export type NeedName =
  | "sleep"        // 1.1 Сон
  | "nutrition"    // 1.2 Питание
  | "movement"     // 1.3 Движение
  | "health"       // 1.4 Здоровье
  | "safety"       // 2.1 Безопасность
  | "orientation"  // 2.2 Ориентация и контроль
  | "closeness"    // 3.1 Близость
  | "community"    // 3.2 Сообщество
  | "status"       // 3.3 Статус
  | "autonomy"     // 4.1 Автономия
  | "competence"   // 4.2 Компетентность
  | "curiosity"    // 4.3 Познание
  | "meaning"      // 5.1 Смысл
  | "creativity"   // 5.2 Творчество
  | "play";        // 5.3 Игра

export type NeedCategory = "foundation" | "parallel";

export type NeedSubcategory =
  | "biological"
  | "psychological"
  | "growth"
  | "expression"
  | "integration";

export interface Need {
  id: string;
  user_id: string;
  name: NeedName;
  category: NeedCategory;
  subcategory: NeedSubcategory;
  current_score: number;
  target_score: number;
  is_bridge_node: boolean;
}
