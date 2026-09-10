export interface CategoryMeta {
  id: string;
  name: string;
  token: string;
  description: string;
  colorVar: string;
  badgeClass: string;
  dotClass: string;
  chipClass: string;
  borderClass: string;
  textClass: string;
}

export interface CategoryMap {
  health: CategoryMeta;
  study: CategoryMeta;
  work: CategoryMeta;
  finance: CategoryMeta;
  spiritual: CategoryMeta;
  relationships: CategoryMeta;
}

export const CATEGORIES: CategoryMap = {
  health: {
    id: "health",
    name: "Health",
    token: "--cat-health",
    description: "Workouts, recovery & vitality",
    colorVar: "var(--cat-health)",
    badgeClass: "bg-cat-health/15 text-cat-health border-cat-health/30",
    dotClass: "bg-cat-health",
    chipClass: "bg-cat-health/20 text-cat-health border-cat-health/40",
    borderClass: "border-cat-health/40",
    textClass: "text-cat-health",
  },
  study: {
    id: "study",
    name: "Study",
    token: "--cat-study",
    description: "Tech, skills, coding & books",
    colorVar: "var(--cat-study)",
    badgeClass: "bg-cat-study/15 text-cat-study border-cat-study/30",
    dotClass: "bg-cat-study",
    chipClass: "bg-cat-study/20 text-cat-study border-cat-study/40",
    borderClass: "border-cat-study/40",
    textClass: "text-cat-study",
  },
  work: {
    id: "work",
    name: "Work",
    token: "--cat-work",
    description: "Deep work, focus & career milestones",
    colorVar: "var(--cat-work)",
    badgeClass: "bg-cat-work/15 text-cat-work border-cat-work/30",
    dotClass: "bg-cat-work",
    chipClass: "bg-cat-work/20 text-cat-work border-cat-work/40",
    borderClass: "border-cat-work/40",
    textClass: "text-cat-work",
  },
  finance: {
    id: "finance",
    name: "Finance",
    token: "--cat-finance",
    description: "Budgeting, investing & discipline",
    colorVar: "var(--cat-finance)",
    badgeClass: "bg-cat-finance/15 text-cat-finance border-cat-finance/30",
    dotClass: "bg-cat-finance",
    chipClass: "bg-cat-finance/20 text-cat-finance border-cat-finance/40",
    borderClass: "border-cat-finance/40",
    textClass: "text-cat-finance",
  },
  spiritual: {
    id: "spiritual",
    name: "Spiritual",
    token: "--cat-spiritual",
    description: "Meditation, breathwork & stillness",
    colorVar: "var(--cat-spiritual)",
    badgeClass: "bg-cat-spiritual/15 text-cat-spiritual border-cat-spiritual/30",
    dotClass: "bg-cat-spiritual",
    chipClass: "bg-cat-spiritual/20 text-cat-spiritual border-cat-spiritual/40",
    borderClass: "border-cat-spiritual/40",
    textClass: "text-cat-spiritual",
  },
  relationships: {
    id: "relationships",
    name: "Relationships",
    token: "--cat-relationships",
    description: "Family, friends & community connection",
    colorVar: "var(--cat-relationships)",
    badgeClass: "bg-cat-relationships/15 text-cat-relationships border-cat-relationships/30",
    dotClass: "bg-cat-relationships",
    chipClass: "bg-cat-relationships/20 text-cat-relationships border-cat-relationships/40",
    borderClass: "border-cat-relationships/40",
    textClass: "text-cat-relationships",
  },
};

export const CATEGORY_LIST: CategoryMeta[] = Object.values(CATEGORIES);

export function getCategoryMeta(categoryName?: string): CategoryMeta {
  if (!categoryName) return CATEGORIES.health;

  const norm = categoryName.trim().toLowerCase();

  if (
    norm.includes("study") ||
    norm.includes("code") ||
    norm.includes("coding") ||
    norm.includes("tech") ||
    norm.includes("read") ||
    norm.includes("learn") ||
    norm.includes("practice")
  ) {
    return CATEGORIES.study;
  }
  if (
    norm.includes("work") ||
    norm.includes("career") ||
    norm.includes("job") ||
    norm.includes("project") ||
    norm.includes("writing")
  ) {
    return CATEGORIES.work;
  }
  if (
    norm.includes("finan") ||
    norm.includes("wealth") ||
    norm.includes("money") ||
    norm.includes("budget") ||
    norm.includes("invest")
  ) {
    return CATEGORIES.finance;
  }
  if (
    norm.includes("spirit") ||
    norm.includes("mind") ||
    norm.includes("breath") ||
    norm.includes("meditat") ||
    norm.includes("zen") ||
    norm.includes("still")
  ) {
    return CATEGORIES.spiritual;
  }
  if (
    norm.includes("relat") ||
    norm.includes("social") ||
    norm.includes("communit") ||
    norm.includes("family") ||
    norm.includes("outdoor") ||
    norm.includes("trail") ||
    norm.includes("trek")
  ) {
    return CATEGORIES.relationships;
  }

  return CATEGORIES.health;
}
