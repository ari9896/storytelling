import Notification from '../models/notification.model.js'

export const notifyReply = async ({ parent, reply, story, chapter, user, session }) => {
  if (!parent || String(parent.author) === String(user._id)) return
  await Notification.create([{
    recipient: parent.author, actor: user._id, storyId: story._id,
    chapterId: chapter._id, commentId: reply._id,
  }], { session })
}
