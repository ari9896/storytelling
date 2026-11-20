import { randomUUID } from 'node:crypto'
import User from '../models/user.model.js'

export const INVITE_LIMIT = 20
export const reserveStoryInvitation = async userId => {
  const at = new Date(), cutoff = new Date(at.getTime() - 24 * 60 * 60 * 1000)
  const requestId = randomUUID()
  const recent = { $filter: { input: { $ifNull: ['$storyInviteRate', []] }, as: 'attempt', cond: { $gte: ['$$attempt.at', { $literal: cutoff }] } } }
  const user = await User.findOneAndUpdate({ _id: userId, $expr: { $lt: [{ $size: recent }, INVITE_LIMIT] } },
    [{ $set: { storyInviteRate: { $concatArrays: [recent, { $literal: [{ requestId, at }] }] } } }],
    { new: true, updatePipeline: true }).select('_id')
  return user ? requestId : null
}
export const releaseStoryInvitation = (userId, requestId) => User.updateOne({ _id: userId }, { $pull: { storyInviteRate: { requestId } } })
