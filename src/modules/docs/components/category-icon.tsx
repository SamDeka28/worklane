import {
  Banknote,
  Compass,
  Hammer,
  Settings2,
  Target,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { DocCategoryId } from "../types";

export const CATEGORY_ICON: Record<DocCategoryId, LucideIcon> = {
  "getting-started": Compass,
  sell: Target,
  deliver: Hammer,
  money: Banknote,
  team: Users,
  account: Settings2,
};
