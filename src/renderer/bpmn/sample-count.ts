/** Нижняя граница выборки: «17+» означает не менее 17, включая само 17. */
export function sampleCount(count: number, complete: boolean): string { return `${count}${complete ? '' : '+'}`; }
