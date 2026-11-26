import mongoose from 'mongoose'

export const PLANNING_GROUPS = ['events', 'threads']
export const validatePlanningSheets = (sheets, existing = [], allowExisting = false) => {
  if (sheets === undefined) return null
  if (!Array.isArray(sheets) || sheets.length > 100) return 'Add up to 100 sheets per planning tab.'
  const byId = new Map(existing.map(sheet => [String(sheet._id), sheet]))
  const seen = new Set()
  for (const sheet of sheets) {
    if (!sheet || typeof sheet.title !== 'string' || sheet.title.length > 200 || typeof sheet.text !== 'string' || sheet.text.length > 100000) return 'Planning titles can be up to 200 characters and text up to 100,000 characters.'
    if (sheet.status !== undefined || (sheet.visibility !== undefined && sheet.visibility !== 'private')) return 'Events and threads are always private and cannot be published.'
    if (sheet.images !== undefined) return 'Events and threads use a title and text only.'
    if (sheet.id !== undefined) {
      if (!allowExisting || typeof sheet.id !== 'string' || !byId.has(sheet.id) || seen.has(sheet.id)) return 'Each saved planning sheet must belong to this story and tab and appear only once.'
      seen.add(sheet.id)
    }
  }
  return null
}

export const preparePlanningSheets = (sheets, existing = []) => {
  const byId = new Map(existing.map(sheet => [String(sheet._id), sheet]))
  return sheets.map(sheet => ({ _id: sheet.id ? byId.get(sheet.id)._id : new mongoose.Types.ObjectId(),
    title: sheet.title.trim(), text: sheet.text, createdAt: byId.get(sheet.id)?.createdAt || new Date(), updatedAt: new Date(),
  }))
}

export const editorPlanningSheets = story => Object.fromEntries(PLANNING_GROUPS.map(group => [group,
  (story[group] || []).map(sheet => ({ id: String(sheet._id), title: sheet.title, text: sheet.text })),
]))

export const planningArchiveUpdates = (body, fields) => Object.fromEntries(PLANNING_GROUPS.filter(group => body[group] !== undefined).map(group => {
  const archive = group === 'events' ? 'archivedEvents' : 'archivedThreads'
  return [archive, { $concatArrays: [
    { $ifNull: [`$${archive}`, []] },
    { $map: { input: { $filter: { input: { $ifNull: [`$${group}`, []] }, as: 'oldSheet', cond: { $not: [{ $in: ['$$oldSheet._id', { $literal: fields[group].map(sheet => sheet._id) }] }] } } },
      as: 'removedSheet', in: { $mergeObjects: ['$$removedSheet', { deletedAt: { $literal: new Date() } }] } } },
  ] }]
}))
