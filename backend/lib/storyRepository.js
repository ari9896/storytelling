import Story from '../models/story.model.js'
import { retiredStorySlugs } from './retiredStories.js'

export const loadStory = async (slug, includeCharacters = false) => {
  if (retiredStorySlugs.includes(slug)) return null
  return Story.findOne({ slug, deletedAt: null }, includeCharacters ? '+characters' : undefined)
}
