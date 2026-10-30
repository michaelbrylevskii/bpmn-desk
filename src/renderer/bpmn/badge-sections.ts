export type BadgeSectionKind = 'history' | 'runtime' | 'failed' | 'unfinished';
export interface BadgeSection { kind: BadgeSectionKind; label: string }
export const badgeLabel = (sections: BadgeSection[]): string => sections.map(section => section.label).join(' · ');
/** Одинаковая палитра для HTML и автономного SVG/PNG, с контрастным белым текстом. */
export const badgeColors: Record<BadgeSectionKind, string> = { history: '#626b79', runtime: '#207f67', failed: '#b4233a', unfinished: '#93601b' };
export const sectionWidth = (label: string): number => Math.max(22, label.length * 7 + 12);
export const sectionZigzag = '100% 0, calc(100% - 3px) 16.667%, 100% 33.333%, calc(100% - 3px) 50%, 100% 66.667%, calc(100% - 3px) 83.333%, 100% 100%';
export const sectionsWidth = (sections: BadgeSection[]): number => sections.reduce((sum, section) => sum + sectionWidth(section.label), 0) - Math.max(0, sections.length - 1) * 3;
