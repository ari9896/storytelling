const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
const emojiPart = /^[\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Modifier}\uFE0F\u200D\u20E3#*0-9\u{E0020}-\u{E007F}]+$/u
const emojiSymbol = /[\p{Extended_Pictographic}\p{Regional_Indicator}\u20E3]/u

export const validReactionEmoji = emoji => typeof emoji === 'string' && emoji.length <= 40 &&
  emojiPart.test(emoji) && emojiSymbol.test(emoji) && [...segmenter.segment(emoji)].length === 1

export const reactionSummary = (reactions = [], userId = null) => {
  const counts = new Map()
  let myReaction = null
  for (const reaction of reactions) {
    counts.set(reaction.emoji, (counts.get(reaction.emoji) || 0) + 1)
    if (userId && String(reaction.userId) === String(userId)) myReaction = reaction.emoji
  }
  return {
    reactions: [...counts].map(([emoji, count]) => ({ emoji, count })).sort((a, b) => b.count - a.count || a.emoji.localeCompare(b.emoji)),
    myReaction,
  }
}

// One atomic update removes the user's old choice before adding their new one.
// Repeating a request is safe; different users' concurrent reactions are preserved.
export const reactionUpdate = (userId, emoji) => [{ $set: { reactions: { $concatArrays: [
  { $filter: { input: { $ifNull: ['$reactions', []] }, as: 'reaction', cond: { $ne: ['$$reaction.userId', { $literal: userId }] } } },
  { $literal: emoji === null ? [] : [{ userId, emoji }] },
] } } }]
