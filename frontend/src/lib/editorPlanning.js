export const PLANNING_TABS = ['characters', 'events', 'threads']
export const newPlanningSheet = () => ({ id: crypto.randomUUID(), title: '', text: '' })
export const loadPlanningSheets = (sheets = []) => sheets.map(sheet => ({ ...sheet, sheetId: sheet.id }))
export const serializePlanningSheets = sheets => sheets.map(sheet => ({ ...(sheet.sheetId ? { id: sheet.sheetId } : {}), title: sheet.title, text: sheet.text }))
export const restorePlanningSelection = (selection, events, threads) => {
  if (!selection || !['events', 'threads'].includes(selection.type) || !Number.isInteger(selection.index)) return null
  const sheets = selection.type === 'events' ? events : threads
  return selection.index >= 0 && selection.index < sheets.length ? { type: selection.type, index: selection.index } : null
}
